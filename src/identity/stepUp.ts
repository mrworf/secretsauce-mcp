import { createHash, createHmac, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import { InflightLimiter } from "../inflightLimiter.js";
import { canonicalControlJson } from "../control/idempotency.js";
import type {
  ControlAuthorizationSeam,
  ControlStepUpOperation,
  ControlStepUpRule,
} from "../control/routeRegistry.js";
import type {
  ControlAuthenticationContext,
} from "../control/authentication.js";
import type { PermissionOutcome, ControlCapability } from "../control/permissions.js";
import type { BrowserSessionAuthenticator } from "./browserSessions.js";
import {
  LocalAuthenticationError,
  type LocalAuthenticationRepository,
  type LoginCandidate,
} from "./localAuthentication.js";
import { verifyPasswordHash } from "./password.js";
import {
  type IdentityKeyRing,
  decryptTotpSeed,
  parseTotpEnvelope,
  verifyTotpCode,
} from "./totp.js";

const STEP_UP_WINDOW_MS = 5 * 60_000;
const PROOF_DOMAIN = "secretsauce.step-up-proof.v1";
const IDEMPOTENCY_DOMAIN = "secretsauce.step-up-idempotency.v1";
const BODY_DOMAIN = "secretsauce.step-up-body.v1";
const OPAQUE_PROOF = /^[A-Za-z0-9_-]{43}$/;
const ROUTE_ID = /^[a-z][a-z0-9_.-]{0,127}$/;
const consumeHandle = Symbol("consume-step-up-proof");

export interface StepUpOperationInput {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  routeId: string;
  targets: string[];
  expectedVersion?: number;
  idempotencyKey?: string;
  body: unknown;
}

export interface StepUpOperationBinding {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  routeId: string;
  targets: string[];
  expectedVersion?: number;
  idempotencyKeyHash?: string;
  bodyDigest: string;
}

export class AlwaysStepUpHandle {
  #consumed = false;

  constructor(
    readonly proofId: string,
    readonly sessionId: string,
    readonly userId: string,
  ) {}

  get consumed(): boolean {
    return this.#consumed;
  }

  [consumeHandle](): void {
    this.#consumed = true;
  }
}

export interface StepUpResult {
  mode: "five_minutes" | "always";
  expiresAt: number;
  proof?: string;
}

export class StepUpRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async elevateFiveMinutes(input: {
    candidate: EligibleCandidate;
    sessionId: string;
    acceptedStep: number;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        requireCurrentSessionCandidate(transaction, input.candidate, input.sessionId);
        consumeTotpStep(transaction, input.candidate.userId, input.acceptedStep, "step_up", now);
        const result = transaction.run(`
          UPDATE browser_sessions
          SET step_up_at = ?, last_activity_at = ?, version = version + 1
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL
        `, [now, now, input.sessionId, input.candidate.userId]);
        if (result.changes !== 1) throw new PersistenceError("authentication_failed");
        return {
          value: undefined,
          auditInput: stepUpAudit(input.candidate, input.correlationId, "five_minutes"),
        };
      }),
    });
  }

  async issueAlwaysProof(input: {
    candidate: EligibleCandidate;
    sessionId: string;
    acceptedStep: number;
    proofId: string;
    proofHash: string;
    operation: StepUpOperationBinding;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        requireCurrentSessionCandidate(transaction, input.candidate, input.sessionId);
        consumeTotpStep(transaction, input.candidate.userId, input.acceptedStep, "step_up", now);
        transaction.run(`
          INSERT INTO identity_step_up_proofs (
            id, proof_hash, session_id, user_id, method, route_id,
            targets_json, expected_version, idempotency_key_hash, body_digest,
            issued_security_epoch, issued_global_epoch,
            issued_at, expires_at, consumed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `, [
          input.proofId,
          input.proofHash,
          input.sessionId,
          input.candidate.userId,
          input.operation.method,
          input.operation.routeId,
          JSON.stringify(input.operation.targets),
          input.operation.expectedVersion ?? null,
          input.operation.idempotencyKeyHash ?? null,
          input.operation.bodyDigest,
          input.candidate.securityEpoch,
          input.candidate.globalSecurityEpoch,
          now,
          now + STEP_UP_WINDOW_MS,
        ]);
        return {
          value: undefined,
          auditInput: stepUpAudit(input.candidate, input.correlationId, "always"),
        };
      }),
    });
  }

  async fiveMinuteValid(sessionId: string, userId: string): Promise<boolean> {
    const now = safeNow(this.now);
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{
          step_up_at: number | null;
          revoked_at: number | null;
          absolute_expires_at: number;
          status: string;
          password_state: string;
          totp_state: string;
          security_epoch: number;
          global_security_epoch: number;
          issued_security_epoch: number;
          issued_global_epoch: number;
        }>(`
          SELECT
            bs.step_up_at, bs.revoked_at, bs.absolute_expires_at, u.status,
            a.password_state, a.totp_state,
            u.security_epoch, sec.global_security_epoch,
            bs.issued_security_epoch, bs.issued_global_epoch
          FROM browser_sessions bs
          JOIN users u ON u.id = bs.user_id
          JOIN local_authenticator_states a ON a.user_id = u.id
          JOIN identity_security_state sec ON sec.singleton = 1
          WHERE bs.id = ? AND bs.user_id = ?
        `, [sessionId, userId]);
        return row !== undefined &&
          row.step_up_at !== null &&
          row.revoked_at === null &&
          row.absolute_expires_at > now &&
          row.status === "active" &&
          row.password_state === "configured" &&
          row.totp_state === "configured" &&
          row.security_epoch === row.issued_security_epoch &&
          row.global_security_epoch === row.issued_global_epoch &&
          now - row.step_up_at >= 0 &&
          now - row.step_up_at < STEP_UP_WINDOW_MS;
      }),
    });
  }

  async alwaysProof(
    proofHash: string,
    sessionId: string,
    userId: string,
    operation: StepUpOperationBinding,
  ): Promise<AlwaysStepUpHandle | undefined> {
    const now = safeNow(this.now);
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{
          id: string;
          method: string;
          route_id: string;
          targets_json: string;
          expected_version: number | null;
          idempotency_key_hash: string | null;
          body_digest: string;
          issued_security_epoch: number;
          issued_global_epoch: number;
          expires_at: number;
          consumed_at: number | null;
          revoked_at: number | null;
          absolute_expires_at: number;
          status: string;
          password_state: string;
          totp_state: string;
          security_epoch: number;
          global_security_epoch: number;
        }>(`
          SELECT
            p.id, p.method, p.route_id, p.targets_json,
            p.expected_version, p.idempotency_key_hash, p.body_digest,
            p.issued_security_epoch, p.issued_global_epoch,
            p.expires_at, p.consumed_at,
            bs.revoked_at, bs.absolute_expires_at,
            u.status, a.password_state, a.totp_state,
            u.security_epoch, sec.global_security_epoch
          FROM identity_step_up_proofs p
          JOIN browser_sessions bs ON bs.id = p.session_id
          JOIN users u ON u.id = p.user_id
          JOIN local_authenticator_states a ON a.user_id = u.id
          JOIN identity_security_state sec ON sec.singleton = 1
          WHERE p.proof_hash = ? AND p.session_id = ? AND p.user_id = ?
        `, [proofHash, sessionId, userId]);
        if (
          row === undefined ||
          row.consumed_at !== null ||
          row.expires_at <= now ||
          row.revoked_at !== null ||
          row.absolute_expires_at <= now ||
          row.status !== "active" ||
          row.password_state !== "configured" ||
          row.totp_state !== "configured" ||
          row.security_epoch !== row.issued_security_epoch ||
          row.global_security_epoch !== row.issued_global_epoch ||
          row.method !== operation.method ||
          row.route_id !== operation.routeId ||
          row.targets_json !== JSON.stringify(operation.targets) ||
          row.expected_version !== (operation.expectedVersion ?? null) ||
          row.idempotency_key_hash !== (operation.idempotencyKeyHash ?? null) ||
          row.body_digest !== operation.bodyDigest
        ) return undefined;
        return new AlwaysStepUpHandle(row.id, sessionId, userId);
      }),
    });
  }

  async withConsumedProof<T>(
    handle: AlwaysStepUpHandle,
    auditInput: AdministrativeAuditEventInput,
    mutation: (transaction: PersistenceTransaction) => T,
  ): Promise<T> {
    if (handle.consumed) throw new PersistenceError("authentication_failed");
    const now = safeNow(this.now);
    const result = await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const consumed = transaction.run(`
          UPDATE identity_step_up_proofs
          SET consumed_at = ?
          WHERE id = ? AND session_id = ? AND user_id = ?
            AND consumed_at IS NULL AND expires_at > ?
            AND EXISTS (
              SELECT 1
              FROM browser_sessions bs
              JOIN users u ON u.id = bs.user_id
              JOIN local_authenticator_states a ON a.user_id = u.id
              JOIN identity_security_state sec ON sec.singleton = 1
              WHERE bs.id = identity_step_up_proofs.session_id
                AND bs.user_id = identity_step_up_proofs.user_id
                AND bs.revoked_at IS NULL
                AND bs.absolute_expires_at > ?
                AND u.status = 'active'
                AND a.password_state = 'configured'
                AND a.totp_state = 'configured'
                AND u.security_epoch = identity_step_up_proofs.issued_security_epoch
                AND sec.global_security_epoch = identity_step_up_proofs.issued_global_epoch
            )
        `, [now, handle.proofId, handle.sessionId, handle.userId, now, now]);
        if (consumed.changes !== 1) throw new PersistenceError("authentication_failed");
        return { value: mutation(transaction), auditInput };
      }),
    });
    handle[consumeHandle]();
    return result;
  }

  async recordDenied(
    userId: string,
    role: "superadmin" | "admin" | "user",
    correlationId: string,
    failureCode: "invalid" | "limited" | "unavailable",
  ): Promise<void> {
    await this.owner.execute({
      run: (database) => {
        database.appendAdministrativeAudit({
          actor: {
            type: "browser_session",
            id: userId,
            label: `user:${userId}`,
            role,
            authenticationMethod: "browser_session",
          },
          action: "identity.step_up",
          result: "deny",
          target: { type: "authentication", label: "local-step-up" },
          correlationId,
          source: { category: "authentication" },
          failureCode: `authentication.${failureCode}`,
        } satisfies AdministrativeAuditEventInput);
      },
    });
  }
}

export interface StepUpServiceOptions {
  authenticationRepository: LocalAuthenticationRepository;
  repository: StepUpRepository;
  config: IdentityConfig;
  keyRing: IdentityKeyRing;
  sessionHmacKey: Buffer;
  now?: () => number;
  random?: (size: number) => Buffer;
  uuid?: () => string;
}

export class StepUpService {
  readonly #authenticationRepository: LocalAuthenticationRepository;
  readonly #repository: StepUpRepository;
  readonly #config: IdentityConfig;
  readonly #keyRing: IdentityKeyRing;
  readonly #hmacKey: Buffer;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #passwordLimiter: AttemptLimiter;
  readonly #totpLimiter: AttemptLimiter;
  readonly #passwordInflight: InflightLimiter;
  readonly #totpInflight: InflightLimiter;

  constructor(options: StepUpServiceOptions) {
    this.#authenticationRepository = options.authenticationRepository;
    this.#repository = options.repository;
    this.#config = options.config;
    this.#keyRing = options.keyRing;
    if (options.sessionHmacKey.byteLength !== 32) throw new Error("Invalid step-up key.");
    this.#hmacKey = Buffer.from(options.sessionHmacKey);
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.#passwordLimiter = new AttemptLimiter(
      options.config.limits.passwordAttempts,
      options.config.limits.passwordWindowMs,
      this.#now,
    );
    this.#totpLimiter = new AttemptLimiter(
      options.config.limits.totpAttempts,
      options.config.limits.totpWindowMs,
      this.#now,
    );
    this.#passwordInflight = new InflightLimiter(
      options.config.limits.maxPasswordVerifications,
      options.config.limits.maxPasswordVerificationsPerSource,
    );
    this.#totpInflight = new InflightLimiter(
      options.config.limits.maxTotpVerifications,
      options.config.limits.maxTotpVerificationsPerSource,
    );
  }

  async stepUp(input: {
    userId: string;
    sessionId: string;
    role: "superadmin" | "admin" | "user";
    password: unknown;
    totp: unknown;
    source: string;
    correlationId: string;
    operation?: unknown;
  }): Promise<StepUpResult> {
    const credentials = parseCredentials(input.password, input.totp);
    const account = keyedHash(this.#hmacKey, "secretsauce.step-up-account.v1", input.userId);
    const candidate = await this.#authenticationRepository.candidateByUserId(input.userId);
    const eligible = eligibleCandidate(candidate);
    if (
      eligible === undefined ||
      eligible.role !== input.role ||
      !this.#passwordLimiter.take(input.source, account)
    ) {
      await this.deny(input, eligible === undefined ? "invalid" : "limited");
      throw new LocalAuthenticationError(eligible === undefined ? "authentication_failed" : "rate_limited");
    }
    const releasePassword = this.#passwordInflight.acquire(input.source);
    if (releasePassword === undefined) {
      await this.deny(input, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    let passwordValid: boolean;
    try {
      passwordValid = await verifyPasswordHash(Buffer.from(credentials.password, "utf8"), eligible.encodedHash);
    } finally {
      releasePassword();
    }
    if (!this.#totpLimiter.take(input.source, account)) {
      await this.deny(input, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(input.source);
    if (releaseTotp === undefined) {
      await this.deny(input, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    let seed: Buffer | undefined;
    let step: number | undefined;
    try {
      const envelope = parseTotpEnvelope(JSON.parse(eligible.totpEnvelopeJson));
      if (
        envelope.userId !== eligible.userId ||
        envelope.authenticatorId !== eligible.totpAuthenticatorId ||
        envelope.generation !== eligible.totpGeneration
      ) throw new Error("binding");
      seed = decryptTotpSeed(envelope, this.#keyRing);
      step = verifyTotpCode(seed, credentials.totp, safeNow(this.#now));
    } catch {
      step = undefined;
    } finally {
      seed?.fill(0);
      releaseTotp();
    }
    if (!passwordValid || step === undefined) {
      await this.deny(input, "invalid");
      throw new LocalAuthenticationError("authentication_failed");
    }

    const issuedAt = safeNow(this.#now);
    if (this.#config.stepUpMode === "five_minutes" && input.operation === undefined) {
      try {
        await this.#repository.elevateFiveMinutes({
          candidate: eligible,
          sessionId: input.sessionId,
          acceptedStep: step,
          correlationId: input.correlationId,
        });
      } catch (error) {
        await this.deny(input, error instanceof PersistenceError && error.code === "totp_replayed"
          ? "invalid"
          : "unavailable");
        throw new LocalAuthenticationError(
          error instanceof PersistenceError && error.code === "totp_replayed"
            ? "authentication_failed"
            : "authentication_unavailable",
        );
      }
      return { mode: "five_minutes", expiresAt: issuedAt + STEP_UP_WINDOW_MS };
    }

    let operation: StepUpOperationBinding;
    try {
      operation = bindIssuedOperation(input.operation, input.userId, this.#hmacKey);
    } catch {
      await this.deny(input, "invalid");
      throw new LocalAuthenticationError("authentication_failed");
    }
    const proof = opaqueValue(this.#random);
    const proofId = this.nextUuid();
    try {
      await this.#repository.issueAlwaysProof({
        candidate: eligible,
        sessionId: input.sessionId,
        acceptedStep: step,
        proofId,
        proofHash: keyedHash(this.#hmacKey, PROOF_DOMAIN, proof),
        operation,
        correlationId: input.correlationId,
      });
    } catch (error) {
      await this.deny(input, error instanceof PersistenceError && error.code === "totp_replayed"
        ? "invalid"
        : "unavailable");
      throw new LocalAuthenticationError(
        error instanceof PersistenceError && error.code === "totp_replayed"
          ? "authentication_failed"
          : "authentication_unavailable",
      );
    }
    return {
      mode: "always",
      expiresAt: issuedAt + STEP_UP_WINDOW_MS,
      proof,
    };
  }

  close(): void {
    this.#hmacKey.fill(0);
  }

  private nextUuid(): string {
    const id = this.#uuid();
    if (!isUuidV7(id)) throw new LocalAuthenticationError("authentication_unavailable");
    return id;
  }

  private async deny(
    input: { userId: string; role: "superadmin" | "admin" | "user"; correlationId: string },
    code: "invalid" | "limited" | "unavailable",
  ): Promise<void> {
    try {
      await this.#repository.recordDenied(input.userId, input.role, input.correlationId, code);
    } catch {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
  }
}

export class BrowserStepUpAuthorization implements ControlAuthorizationSeam {
  readonly #handles = new WeakMap<FastifyRequest, AlwaysStepUpHandle>();
  readonly #hmacKey: Buffer;

  constructor(
    private readonly sessions: BrowserSessionAuthenticator,
    private readonly repository: StepUpRepository,
    private readonly configuredMode: IdentityConfig["stepUpMode"],
    hmacKey: Buffer,
  ) {
    if (hmacKey.byteLength !== 32) throw new Error("Invalid step-up authorization key.");
    this.#hmacKey = Buffer.from(hmacKey);
  }

  async authorizeScope(
    _context: ControlAuthenticationContext,
    _capability: ControlCapability,
    outcome: PermissionOutcome,
    _request: FastifyRequest,
  ): Promise<boolean> {
    return outcome === "self" || outcome === "self_permitted";
  }

  async verifyStepUp(
    context: ControlAuthenticationContext,
    rule: Exclude<ControlStepUpRule, "none">,
    request: FastifyRequest,
    operation: ControlStepUpOperation,
  ): Promise<boolean> {
    const session = this.sessions.session(request);
    if (
      session === undefined ||
      session.userId !== context.principalId ||
      session.context !== context
    ) return false;
    const mode = rule === "always" || this.configuredMode === "always"
      ? "always"
      : "five_minutes";
    if (mode === "five_minutes") {
      return this.repository.fiveMinuteValid(session.sessionId, session.userId);
    }
    const proof = request.headers["x-step-up-proof"];
    if (typeof proof !== "string" || !OPAQUE_PROOF.test(proof)) return false;
    const binding = bindRequestOperation(operation, session.userId, this.#hmacKey);
    const handle = await this.repository.alwaysProof(
      keyedHash(this.#hmacKey, PROOF_DOMAIN, proof),
      session.sessionId,
      session.userId,
      binding,
    );
    if (handle === undefined) return false;
    this.#handles.set(request, handle);
    return true;
  }

  stepUpProof(request: FastifyRequest): AlwaysStepUpHandle | undefined {
    return this.#handles.get(request);
  }

  close(): void {
    this.#hmacKey.fill(0);
  }
}

type EligibleCandidate = LoginCandidate & {
  encodedHash: string;
  passwordVersion: number;
  totpAuthenticatorId: string;
  totpEnvelopeJson: string;
  totpGeneration: number;
};

function eligibleCandidate(candidate: LoginCandidate | undefined): EligibleCandidate | undefined {
  return candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "configured" &&
    candidate.totpState === "configured" &&
    candidate.encodedHash !== null &&
    candidate.passwordVersion !== null &&
    candidate.totpAuthenticatorId !== null &&
    candidate.totpEnvelopeJson !== null &&
    candidate.totpGeneration !== null
    ? candidate as EligibleCandidate
    : undefined;
}

function requireCurrentSessionCandidate(
  transaction: PersistenceTransaction,
  candidate: EligibleCandidate,
  sessionId: string,
): void {
  const row = transaction.get<{
    status: string;
    password_state: string;
    totp_state: string;
    security_epoch: number;
    global_security_epoch: number;
    issued_security_epoch: number;
    issued_global_epoch: number;
    encoded_hash: string;
    password_version: number;
    envelope_json: string;
    totp_generation: number;
    revoked_at: number | null;
  }>(`
    SELECT
      u.status, a.password_state, a.totp_state,
      u.security_epoch, sec.global_security_epoch,
      bs.issued_security_epoch, bs.issued_global_epoch,
      p.encoded_hash, p.version AS password_version,
      t.envelope_json, t.generation AS totp_generation,
      bs.revoked_at
    FROM browser_sessions bs
    JOIN users u ON u.id = bs.user_id
    JOIN local_authenticator_states a ON a.user_id = u.id
    JOIN local_password_credentials p ON p.user_id = u.id
    JOIN local_totp_authenticators t ON t.user_id = u.id
    JOIN identity_security_state sec ON sec.singleton = 1
    WHERE bs.id = ? AND bs.user_id = ?
  `, [sessionId, candidate.userId]);
  if (
    row === undefined ||
    row.status !== "active" ||
    row.password_state !== "configured" ||
    row.totp_state !== "configured" ||
    row.revoked_at !== null ||
    row.security_epoch !== candidate.securityEpoch ||
    row.global_security_epoch !== candidate.globalSecurityEpoch ||
    row.issued_security_epoch !== candidate.securityEpoch ||
    row.issued_global_epoch !== candidate.globalSecurityEpoch ||
    row.encoded_hash !== candidate.encodedHash ||
    row.password_version !== candidate.passwordVersion ||
    row.envelope_json !== candidate.totpEnvelopeJson ||
    row.totp_generation !== candidate.totpGeneration
  ) throw new PersistenceError("authentication_failed");
}

function consumeTotpStep(
  transaction: PersistenceTransaction,
  userId: string,
  step: number,
  purpose: "step_up",
  now: number,
): void {
  if (transaction.get<{ present: number }>(
    "SELECT 1 AS present FROM accepted_totp_steps WHERE user_id = ? AND time_step = ?",
    [userId, step],
  ) !== undefined) throw new PersistenceError("totp_replayed");
  transaction.run(`
    INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
    VALUES (?, ?, ?, ?)
  `, [userId, step, purpose, now]);
}

function stepUpAudit(
  candidate: EligibleCandidate,
  correlationId: string,
  mode: "five_minutes" | "always",
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: candidate.userId,
      label: `user:${candidate.userId}`,
      role: candidate.role,
      authenticationMethod: "local_password_totp",
    },
    action: "identity.step_up",
    result: "allow",
    target: { type: "authentication", label: "local-step-up" },
    changes: [{ field: "step_up_mode", after: mode }],
    correlationId,
    source: { category: "authentication" },
  };
}

function bindIssuedOperation(
  input: unknown,
  userId: string,
  key: Buffer,
): StepUpOperationBinding {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new LocalAuthenticationError("authentication_failed");
  }
  const value = input as Record<string, unknown>;
  const allowed = ["method", "routeId", "targets", "expectedVersion", "idempotencyKey", "body"];
  if (
    Object.keys(value).some((name) => !allowed.includes(name)) ||
    !allowed.slice(0, 3).every((name) => Object.prototype.hasOwnProperty.call(value, name)) ||
    !Object.prototype.hasOwnProperty.call(value, "body") ||
    !["POST", "PUT", "PATCH", "DELETE"].includes(String(value.method)) ||
    typeof value.routeId !== "string" ||
    !ROUTE_ID.test(value.routeId) ||
    !Array.isArray(value.targets) ||
    value.targets.length > 100 ||
    value.targets.some((target) => typeof target !== "string" || !isUuidV7(target)) ||
    (value.expectedVersion !== undefined && (
      !Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion) < 1
    )) ||
    (value.idempotencyKey !== undefined && (
      typeof value.idempotencyKey !== "string" ||
      value.idempotencyKey.length < 16 ||
      value.idempotencyKey.length > 128 ||
      value.idempotencyKey.trim() !== value.idempotencyKey ||
      /[^\x20-\x7e]/.test(value.idempotencyKey)
    ))
  ) throw new LocalAuthenticationError("authentication_failed");
  const targets = [...value.targets as string[]].sort();
  if (new Set(targets).size !== targets.length) {
    throw new LocalAuthenticationError("authentication_failed");
  }
  return {
    method: value.method as StepUpOperationBinding["method"],
    routeId: value.routeId,
    targets,
    ...(value.expectedVersion === undefined ? {} : { expectedVersion: Number(value.expectedVersion) }),
    ...(value.idempotencyKey === undefined
      ? {}
      : { idempotencyKeyHash: idempotencyHash(key, userId, value.routeId, value.idempotencyKey as string) }),
    bodyDigest: bodyDigest(value.body),
  };
}

function bindRequestOperation(
  operation: ControlStepUpOperation,
  userId: string,
  key: Buffer,
): StepUpOperationBinding {
  return {
    method: operation.method,
    routeId: operation.routeId,
    targets: operation.targets,
    ...(operation.expectedVersion === undefined ? {} : { expectedVersion: operation.expectedVersion }),
    ...(operation.idempotencyKey === undefined
      ? {}
      : { idempotencyKeyHash: idempotencyHash(key, userId, operation.routeId, operation.idempotencyKey) }),
    bodyDigest: operation.bodyDigest,
  };
}

export function controlStepUpBodyDigest(value: unknown): string {
  return bodyDigest(value);
}

function bodyDigest(value: unknown): string {
  return createHash("sha256")
    .update(`${BODY_DOMAIN}\0`, "utf8")
    .update(canonicalControlJson(value), "utf8")
    .digest("hex");
}

function idempotencyHash(key: Buffer, userId: string, routeId: string, value: string): string {
  return createHmac("sha256", key)
    .update(`${IDEMPOTENCY_DOMAIN}\0`, "utf8")
    .update(userId, "utf8")
    .update("\0")
    .update(routeId, "utf8")
    .update("\0")
    .update(value, "utf8")
    .digest("hex");
}

function parseCredentials(password: unknown, totp: unknown): { password: string; totp: string } {
  if (typeof password !== "string" || typeof totp !== "string" || !/^\d{6}$/.test(totp)) {
    throw new LocalAuthenticationError("authentication_failed");
  }
  const normalized = password.normalize("NFKC");
  if ([...normalized].length > 1_024 || Buffer.byteLength(normalized, "utf8") > 4_096) {
    throw new LocalAuthenticationError("authentication_failed");
  }
  return { password: normalized, totp };
}

class AttemptLimiter {
  readonly #entries = new Map<string, { count: number; startedAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  take(source: string, account: string): boolean {
    const now = safeNow(this.now);
    const keys = [`s:${source}`, `a:${account}`];
    const entries = keys.map((key) => {
      const current = this.#entries.get(key);
      if (current !== undefined && now - current.startedAt < this.windowMs) return current;
      const created = { count: 0, startedAt: now };
      this.#entries.set(key, created);
      return created;
    });
    if (entries.some((entry) => entry.count >= this.limit)) return false;
    for (const entry of entries) entry.count += 1;
    if (this.#entries.size > 20_000) {
      for (const [key, entry] of this.#entries) {
        if (now - entry.startedAt >= this.windowMs) this.#entries.delete(key);
      }
    }
    return true;
  }
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value, "utf8").digest("hex");
}

function opaqueValue(random: (size: number) => Buffer): string {
  const value = random(32);
  if (!Buffer.isBuffer(value) || value.byteLength !== 32) {
    value?.fill?.(0);
    throw new LocalAuthenticationError("authentication_unavailable");
  }
  try {
    return value.toString("base64url");
  } finally {
    value.fill(0);
  }
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) throw new PersistenceError("database_unavailable");
  return value;
}
