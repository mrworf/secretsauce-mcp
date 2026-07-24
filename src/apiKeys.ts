import { randomBytes } from "node:crypto";
import { argon2id, hash as argon2Hash, verify as argon2Verify } from "argon2";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const KEY_PREFIX = "ssk_v1";
const IDENTIFIER_BYTES = 12;
const SECRET_BYTES = 32;
const IDENTIFIER_LENGTH = 16;
const SECRET_LENGTH = 43;
const RAW_KEY_LENGTH = KEY_PREFIX.length + 2 + IDENTIFIER_LENGTH + SECRET_LENGTH;
const ARGON2_MEMORY_KIB = 65_536;
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_BYTES = 32;
const ARGON2_SALT_BYTES = 16;
const ARGON2_ENCODING =
  /^\$argon2id\$v=19\$m=65536,p=1,t=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;
const DAY_MS = 86_400_000;
export const ALL_SERVICES_KEY_CONFIRMATION =
  "I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES";

export const API_KEY_ROLES = ["service", "all_services", "system"] as const;
export type ApiKeyRole = (typeof API_KEY_ROLES)[number];
export type ApiKeyStatus = "active" | "expired" | "revoked";
export type ApiKeyExpiration =
  | { policy: "forever" }
  | { policy: "days"; days: number };

export class ApiKeyError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "rate_limited"
      | "unavailable",
  ) {
    super("API key operation could not be completed.");
    this.name = "ApiKeyError";
  }
}

export interface ParsedApiKey {
  identifier: string;
  raw: Buffer;
}

export interface GeneratedApiKey extends ParsedApiKey {
  value: string;
  lastFour: string;
}

export interface ApiKeyView {
  id: string;
  keyPrefix: string;
  nickname: string;
  lastFour: string;
  apiRole: ApiKeyRole;
  serviceId?: string;
  expirationPolicy: "forever" | "timestamp";
  expiresAt?: number;
  status: ApiKeyStatus;
  creatorId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

interface ApiKeyRow {
  id: string;
  identifier: string;
  verifier_hash: string;
  nickname: string;
  last_four: string;
  api_role: ApiKeyRole;
  service_id: string | null;
  expiration_policy: "forever" | "timestamp";
  expires_at: number | null;
  status: ApiKeyStatus;
  creator_id: string;
  version: number;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

export function generateApiKey(
  random: (size: number) => Buffer = randomBytes,
): GeneratedApiKey {
  const identifierBytes = Buffer.from(random(IDENTIFIER_BYTES));
  const secretBytes = Buffer.from(random(SECRET_BYTES));
  try {
    if (
      identifierBytes.byteLength !== IDENTIFIER_BYTES ||
      secretBytes.byteLength !== SECRET_BYTES
    ) {
      throw new ApiKeyError("unavailable");
    }
    const identifier = identifierBytes.toString("base64url");
    const secret = secretBytes.toString("base64url");
    const value = `${KEY_PREFIX}_${identifier}_${secret}`;
    const parsed = parseApiKey(value);
    parsed.raw.fill(0);
    return {
      identifier,
      value,
      lastFour: secret.slice(-4),
      raw: Buffer.from(value, "utf8"),
    };
  } finally {
    identifierBytes.fill(0);
    secretBytes.fill(0);
  }
}

export function parseApiKey(value: unknown): ParsedApiKey {
  if (
    typeof value !== "string" ||
    value.length !== RAW_KEY_LENGTH ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw new ApiKeyError("invalid_request");
  }
  const pieces = value.split("_");
  if (
    pieces.length !== 4 ||
    pieces[0] !== "ssk" ||
    pieces[1] !== "v1" ||
    pieces[2]?.length !== IDENTIFIER_LENGTH ||
    pieces[3]?.length !== SECRET_LENGTH
  ) {
    throw new ApiKeyError("invalid_request");
  }
  const identifier = pieces[2];
  const secret = pieces[3];
  if (
    identifier === undefined ||
    secret === undefined ||
    !canonicalBase64url(identifier, IDENTIFIER_BYTES) ||
    !canonicalBase64url(secret, SECRET_BYTES)
  ) {
    throw new ApiKeyError("invalid_request");
  }
  return { identifier, raw: Buffer.from(value, "utf8") };
}

export async function hashApiKey(raw: Buffer): Promise<string> {
  try {
    const encoded = await argon2Hash(raw, {
      type: argon2id,
      memoryCost: ARGON2_MEMORY_KIB,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_BYTES,
      salt: randomBytes(ARGON2_SALT_BYTES),
    });
    if (!isSupportedApiKeyHash(encoded)) throw new ApiKeyError("unavailable");
    return encoded;
  } catch (error) {
    if (error instanceof ApiKeyError) throw error;
    throw new ApiKeyError("unavailable");
  } finally {
    raw.fill(0);
  }
}

export function isSupportedApiKeyHash(encoded: string): boolean {
  return ARGON2_ENCODING.test(encoded);
}

export class ApiKeyVerifierPool {
  #active = 0;

  constructor(
    private readonly maximumConcurrent = 4,
    private readonly verify: (encoded: string, raw: Buffer) => Promise<boolean> =
      async (encoded, raw) => argon2Verify(encoded, raw),
  ) {
    if (!Number.isInteger(maximumConcurrent) || maximumConcurrent < 1 || maximumConcurrent > 64) {
      throw new Error("API key verifier concurrency must be between 1 and 64.");
    }
  }

  async check(raw: Buffer, encoded: string): Promise<boolean> {
    if (!isSupportedApiKeyHash(encoded)) {
      raw.fill(0);
      return false;
    }
    if (this.#active >= this.maximumConcurrent) {
      raw.fill(0);
      throw new ApiKeyError("rate_limited");
    }
    this.#active += 1;
    try {
      return await this.verify(encoded, raw);
    } catch {
      return false;
    } finally {
      raw.fill(0);
      this.#active -= 1;
    }
  }
}

export class ApiKeyRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async create(input: {
    actor: ControlAuthenticationContext;
    id: string;
    identifier: string;
    verifierHash: string;
    nickname: string;
    lastFour: string;
    apiRole: ApiKeyRole;
    serviceId?: string;
    expiration: ApiKeyExpiration;
    correlationId: string;
  }): Promise<ApiKeyView> {
    validateCreateInput(input);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireBrowserCreator(transaction, input.actor, input.apiRole, input.serviceId);
          const now = transaction.timestamp();
          const expiresAt = expirationTimestamp(input.expiration, now);
          transaction.run(`
            INSERT INTO api_keys (
              id, identifier, verifier_hash, nickname, last_four, api_role,
              service_id, expiration_policy, expires_at, status, creator_id,
              version, created_at, updated_at, last_used_at, revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?, NULL, NULL)
          `, [
            input.id,
            input.identifier,
            input.verifierHash,
            input.nickname,
            input.lastFour,
            input.apiRole,
            input.serviceId ?? null,
            input.expiration.policy === "forever" ? "forever" : "timestamp",
            expiresAt,
            input.actor.principalId,
            now,
            now,
          ]);
          const row = requiredRow(transaction, input.id);
          return {
            value: projectApiKey(row, now),
            auditInput: keyAudit(input, expiresAt),
          };
        }),
      });
    } catch (error) {
      throw mapApiKeyError(error);
    }
  }

  async metadata(id: string, actor: ControlAuthenticationContext): Promise<ApiKeyView> {
    if (!isUuidV7(id)) throw new ApiKeyError("invalid_request");
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          const row = query.get<ApiKeyRow>("SELECT * FROM api_keys WHERE id = ?", [id]);
          if (row === undefined || !metadataVisible(query, row, actor)) {
            throw new PersistenceError("identity_not_found");
          }
          return projectApiKey(row, safeNow(this.now));
        }),
      });
    } catch (error) {
      throw mapApiKeyError(error);
    }
  }
}

export class ApiKeyService {
  readonly #uuid: () => string;

  constructor(
    private readonly repository: ApiKeyRepository,
    options: {
      now?: () => number;
      uuid?: () => string;
      random?: (size: number) => Buffer;
    } = {},
  ) {
    const generator = new UuidV7Generator(options.now === undefined ? {} : { now: options.now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.random = options.random ?? randomBytes;
  }

  private readonly random: (size: number) => Buffer;

  async create(
    actor: ControlAuthenticationContext,
    input: {
      nickname: unknown;
      apiRole: unknown;
      serviceId?: unknown;
      expiration: unknown;
      allServicesConfirmation?: unknown;
    },
    correlationId: string,
  ): Promise<{ apiKey: ApiKeyView; oneTimeKey: string }> {
    const nickname = normalizeNickname(input.nickname);
    const apiRole = parseRole(input.apiRole);
    const serviceId = parseServiceScope(apiRole, input.serviceId);
    if (
      apiRole === "all_services"
        ? input.allServicesConfirmation !== ALL_SERVICES_KEY_CONFIRMATION
        : input.allServicesConfirmation !== undefined
    ) {
      throw new ApiKeyError("invalid_request");
    }
    const expiration = parseExpiration(input.expiration);
    const generated = generateApiKey(this.random);
    const verifierHash = await hashApiKey(generated.raw);
    try {
      const apiKey = await this.repository.create({
        actor,
        id: this.#uuid(),
        identifier: generated.identifier,
        verifierHash,
        nickname,
        lastFour: generated.lastFour,
        apiRole,
        ...(serviceId === undefined ? {} : { serviceId }),
        expiration,
        correlationId,
      });
      return { apiKey, oneTimeKey: generated.value };
    } catch (error) {
      throw error;
    }
  }
}

export function normalizeNickname(value: unknown): string {
  if (typeof value !== "string") throw new ApiKeyError("invalid_request");
  const normalized = value.normalize("NFKC").trim();
  if (
    [...normalized].length < 1 ||
    [...normalized].length > 128 ||
    Buffer.byteLength(normalized, "utf8") > 512 ||
    /[\0\r\n]/.test(normalized)
  ) {
    throw new ApiKeyError("invalid_request");
  }
  return normalized;
}

export function parseExpiration(value: unknown): ApiKeyExpiration {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiKeyError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (input.policy === "forever" && Object.keys(input).length === 1) {
    return { policy: "forever" };
  }
  if (
    input.policy === "days" &&
    Object.keys(input).length === 2 &&
    Number.isInteger(input.days) &&
    Number(input.days) >= 1 &&
    Number(input.days) <= 3650
  ) {
    return { policy: "days", days: Number(input.days) };
  }
  throw new ApiKeyError("invalid_request");
}

function parseRole(value: unknown): ApiKeyRole {
  if (!API_KEY_ROLES.includes(value as ApiKeyRole)) throw new ApiKeyError("invalid_request");
  return value as ApiKeyRole;
}

function parseServiceScope(role: ApiKeyRole, value: unknown): string | undefined {
  if (role === "service") {
    if (typeof value !== "string" || !isUuidV7(value)) throw new ApiKeyError("invalid_request");
    return value;
  }
  if (value !== undefined) throw new ApiKeyError("invalid_request");
  return undefined;
}

function canonicalBase64url(value: string, bytes: number): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength === bytes && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

function validateCreateInput(input: {
  actor: ControlAuthenticationContext;
  id: string;
  identifier: string;
  verifierHash: string;
  nickname: string;
  lastFour: string;
  apiRole: ApiKeyRole;
  serviceId?: string;
  expiration: ApiKeyExpiration;
  correlationId: string;
}): void {
  if (
    !isUuidV7(input.id) ||
    !canonicalBase64url(input.identifier, IDENTIFIER_BYTES) ||
    !isSupportedApiKeyHash(input.verifierHash) ||
    normalizeNickname(input.nickname) !== input.nickname ||
    !/^[A-Za-z0-9_-]{4}$/.test(input.lastFour) ||
    !API_KEY_ROLES.includes(input.apiRole) ||
    (input.apiRole === "service") !== (input.serviceId !== undefined) ||
    (input.serviceId !== undefined && !isUuidV7(input.serviceId)) ||
    !/^req_[0-9a-f-]{36}$/.test(input.correlationId)
  ) {
    throw new ApiKeyError("invalid_request");
  }
  parseExpiration(input.expiration);
}

function expirationTimestamp(expiration: ApiKeyExpiration, now: number): number | null {
  if (expiration.policy === "forever") return null;
  const expiresAt = now + expiration.days * DAY_MS;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    throw new PersistenceError("database_unavailable");
  }
  return expiresAt;
}

function requireBrowserCreator(
  transaction: Pick<PersistenceTransaction, "get">,
  actor: ControlAuthenticationContext,
  role: ApiKeyRole,
  serviceId: string | undefined,
): void {
  if (actor.method !== "browser_session" || !["admin", "superadmin"].includes(actor.role)) {
    throw new PersistenceError("authentication_failed");
  }
  const current = transaction.get<{ role: string; status: string }>(
    "SELECT role, status FROM users WHERE id = ?",
    [actor.principalId],
  );
  if (current?.role !== actor.role || current.status !== "active") {
    throw new PersistenceError("authentication_failed");
  }
  if (actor.role === "superadmin") return;
  if (
    role !== "service" ||
    serviceId === undefined ||
    transaction.get(
      `SELECT 1
       FROM service_admins sa
       JOIN services s ON s.id = sa.service_id
       WHERE sa.user_id = ? AND sa.service_id = ? AND s.lifecycle <> 'archived'`,
      [actor.principalId, serviceId],
    ) === undefined
  ) {
    throw new PersistenceError("authentication_failed");
  }
}

function requiredRow(
  transaction: Pick<PersistenceTransaction, "get">,
  id: string,
): ApiKeyRow {
  const row = transaction.get<ApiKeyRow>("SELECT * FROM api_keys WHERE id = ?", [id]);
  if (row === undefined) throw new PersistenceError("database_unavailable");
  return row;
}

function metadataVisible(
  query: { get<T>(sql: string, parameters?: readonly (string | number | bigint | Buffer | null)[]): T | undefined },
  row: ApiKeyRow,
  actor: ControlAuthenticationContext,
): boolean {
  if (actor.method !== "browser_session") return false;
  const current = query.get<{ role: string; status: string }>(
    "SELECT role, status FROM users WHERE id = ?",
    [actor.principalId],
  );
  if (current?.role !== actor.role || current.status !== "active") return false;
  if (actor.role === "superadmin") return true;
  return actor.role === "admin" &&
    row.api_role === "service" &&
    row.service_id !== null &&
    query.get(
      "SELECT 1 FROM service_admins WHERE user_id = ? AND service_id = ?",
      [actor.principalId, row.service_id],
    ) !== undefined;
}

function projectApiKey(row: ApiKeyRow, now: number): ApiKeyView {
  const status = row.status === "active" && row.expires_at !== null && row.expires_at <= now
    ? "expired"
    : row.status;
  return {
    id: row.id,
    keyPrefix: `${KEY_PREFIX}_${row.identifier}`,
    nickname: row.nickname,
    lastFour: row.last_four,
    apiRole: row.api_role,
    ...(row.service_id === null ? {} : { serviceId: row.service_id }),
    expirationPolicy: row.expiration_policy,
    ...(row.expires_at === null ? {} : { expiresAt: row.expires_at }),
    status,
    creatorId: row.creator_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.last_used_at === null ? {} : { lastUsedAt: row.last_used_at }),
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  };
}

function keyAudit(
  input: {
    actor: ControlAuthenticationContext;
    id: string;
    nickname: string;
    apiRole: ApiKeyRole;
    serviceId?: string;
    correlationId: string;
  },
  expiresAt: number | null,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.actor.principalId,
      label: `user:${input.actor.principalId}`,
      role: input.actor.role,
      authenticationMethod: input.actor.method,
    },
    action: "api_keys.create",
    result: "allow",
    target: { type: "api_key_metadata", id: input.id, label: input.nickname },
    ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    changes: [
      { field: "role", after: input.apiRole },
      { field: "scope", after: input.serviceId ?? "global" },
      { field: "expiration", after: expiresAt ?? "forever" },
    ],
    correlationId: input.correlationId,
    source: { category: "api_key_management" },
  };
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) throw new ApiKeyError("unavailable");
  return value;
}

function mapApiKeyError(error: unknown): ApiKeyError {
  if (error instanceof ApiKeyError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found") return new ApiKeyError("not_found");
    if (error.code === "authentication_failed") return new ApiKeyError("forbidden");
    if (error.code === "identity_conflict") return new ApiKeyError("conflict");
  }
  return new ApiKeyError("unavailable");
}
