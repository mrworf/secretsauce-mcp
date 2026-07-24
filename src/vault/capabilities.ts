import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { publicRequestIdPattern } from "../requestId.js";
import { canonicalJson } from "./canonicalJson.js";
import { vaultError } from "./errors.js";
import { BoundedReplayCache } from "./replayCache.js";

const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const uuidV7 = z.string().refine(isUuidV7);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const epoch = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const resolveSchema = z.object({
  version: z.literal(1),
  kind: z.literal("resolve"),
  capabilityId: uuidV4,
  issuedAt: timestamp,
  expiresAt: timestamp,
  caller: z.literal("data_plane"),
  subjectId: uuidV7,
  grantEpoch: epoch,
  securityEpoch: epoch,
  serviceId: uuidV7,
  destinationId: uuidV7,
  credentialId: uuidV7,
  locator: uuidV4,
  generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  method: z.enum(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]),
  pathDigest: digest,
  requestId: z.string().regex(publicRequestIdPattern),
  operationDigest: digest,
}).strict();

const backupSchema = z.object({
  version: z.literal(1),
  kind: z.literal("backup"),
  capabilityId: uuidV4,
  issuedAt: timestamp,
  expiresAt: timestamp,
  caller: z.literal("backup"),
  operation: z.enum(["export_encrypted", "import_encrypted"]),
  authorizationId: uuidV7,
  subjectId: uuidV7,
  operationDigest: digest,
}).strict();

export type ResolveCapability = z.infer<typeof resolveSchema>;
export type BackupCapability = z.infer<typeof backupSchema>;
export type VaultCapability = ResolveCapability | BackupCapability;
export type ResolveCapabilityInput = Omit<ResolveCapability, "version" | "kind" | "capabilityId" | "issuedAt" | "expiresAt" | "caller">;
export type BackupCapabilityInput = Omit<BackupCapability, "version" | "kind" | "capabilityId" | "issuedAt" | "expiresAt" | "caller">;

export interface CapabilityVerifierOptions {
  resolveKey: Uint8Array;
  backupKey: Uint8Array;
  replayCache?: BoundedReplayCache;
  now?: () => number;
}

const RESOLVE_TTL_MS = 15_000;
const BACKUP_TTL_MS = 5 * 60_000;

export class VaultCapabilityAuthority {
  readonly #resolveKey: Buffer;
  readonly #backupKey: Buffer;
  readonly #replayCache: BoundedReplayCache;
  readonly #now: () => number;

  constructor(options: CapabilityVerifierOptions) {
    this.#resolveKey = validatedKey(options.resolveKey);
    this.#backupKey = validatedKey(options.backupKey);
    this.#replayCache = options.replayCache ?? new BoundedReplayCache();
    this.#now = options.now ?? Date.now;
  }

  issueResolve(input: ResolveCapabilityInput, ttlMs = RESOLVE_TTL_MS): string {
    const issuedAt = this.#now();
    validateTtl(ttlMs, RESOLVE_TTL_MS);
    return sign({
      version: 1,
      kind: "resolve",
      capabilityId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + ttlMs,
      caller: "data_plane",
      ...input,
    }, this.#resolveKey, resolveSchema);
  }

  issueBackup(input: BackupCapabilityInput, ttlMs = BACKUP_TTL_MS): string {
    const issuedAt = this.#now();
    validateTtl(ttlMs, BACKUP_TTL_MS);
    return sign({
      version: 1,
      kind: "backup",
      capabilityId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + ttlMs,
      caller: "backup",
      ...input,
    }, this.#backupKey, backupSchema);
  }

  consumeResolve(token: string): ResolveCapability {
    return this.#consume(token, "resolve", this.#resolveKey, resolveSchema, RESOLVE_TTL_MS);
  }

  consumeBackup(token: string): BackupCapability {
    return this.#consume(token, "backup", this.#backupKey, backupSchema, BACKUP_TTL_MS);
  }

  #consume<T extends VaultCapability>(
    token: string,
    kind: T["kind"],
    key: Buffer,
    schema: z.ZodType<T>,
    maxTtlMs: number,
  ): T {
    const payload = verify(token, key);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw vaultError("vault_capability_invalid");
    const capability = parsed.data;
    const now = this.#now();
    if (
      capability.kind !== kind
      || capability.issuedAt > now
      || capability.expiresAt <= now
      || capability.expiresAt - capability.issuedAt > maxTtlMs
    ) {
      throw vaultError("vault_capability_invalid");
    }
    this.#replayCache.consume(`capability:${capability.capabilityId}`, capability.expiresAt, now);
    return capability;
  }
}

export class VaultResolveCapabilityIssuer {
  readonly #resolveKey: Buffer;
  readonly #now: () => number;

  constructor(resolveKey: Uint8Array, now: () => number = Date.now) {
    this.#resolveKey = validatedKey(resolveKey);
    this.#now = now;
  }

  issueResolve(input: ResolveCapabilityInput, ttlMs = RESOLVE_TTL_MS): string {
    const issuedAt = this.#now();
    validateTtl(ttlMs, RESOLVE_TTL_MS);
    return sign({
      version: 1,
      kind: "resolve",
      capabilityId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + ttlMs,
      caller: "data_plane",
      ...input,
    }, this.#resolveKey, resolveSchema);
  }
}

export class VaultBackupCapabilityIssuer {
  readonly #backupKey: Buffer;
  readonly #now: () => number;

  constructor(backupKey: Uint8Array, now: () => number = Date.now) {
    this.#backupKey = validatedKey(backupKey);
    this.#now = now;
  }

  issueBackup(
    input: BackupCapabilityInput,
    ttlMs = BACKUP_TTL_MS,
  ): string {
    const issuedAt = this.#now();
    validateTtl(ttlMs, BACKUP_TTL_MS);
    return sign({
      version: 1,
      kind: "backup",
      capabilityId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + ttlMs,
      caller: "backup",
      ...input,
    }, this.#backupKey, backupSchema);
  }
}

function sign<T>(payload: T, key: Buffer, schema: z.ZodType<T>): string {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw vaultError("vault_capability_invalid");
  const encoded = Buffer.from(canonicalJson(parsed.data), "utf8").toString("base64url");
  const signature = createHmac("sha256", key).update(domainFor(parsed.data)).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token: string, key: Buffer): unknown {
  if (token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) {
    throw vaultError("vault_capability_invalid");
  }
  const separator = token.indexOf(".");
  const encoded = token.slice(0, separator);
  const encodedSignature = token.slice(separator + 1);
  const provided = Buffer.from(encodedSignature, "base64url");
  if (provided.toString("base64url") !== encodedSignature) throw vaultError("vault_capability_invalid");
  let payload: unknown;
  try {
    const source = Buffer.from(encoded, "base64url").toString("utf8");
    payload = JSON.parse(source);
    if (Buffer.from(source, "utf8").toString("base64url") !== encoded || canonicalJson(payload) !== source) {
      throw new Error("Non-canonical capability.");
    }
  } catch {
    throw vaultError("vault_capability_invalid");
  }
  const expected = createHmac("sha256", key).update(domainFor(payload)).update(encoded).digest();
  if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) {
    throw vaultError("vault_capability_invalid");
  }
  return payload;
}

function domainFor(value: unknown): string {
  const kind = typeof value === "object" && value !== null && "kind" in value ? (value as { kind?: unknown }).kind : undefined;
  if (kind === "resolve") return "secretsauce:vault:resolve:v1:";
  if (kind === "backup") return "secretsauce:vault:backup:v1:";
  return "secretsauce:vault:invalid:v1:";
}

function validatedKey(value: Uint8Array): Buffer {
  if (value.byteLength !== 32) throw vaultError("vault_key_invalid");
  return Buffer.from(value);
}

function validateTtl(value: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw vaultError("vault_capability_invalid");
}
