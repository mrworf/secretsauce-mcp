import { randomBytes } from "node:crypto";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import { hashPassword } from "./password.js";
import type { IdentityAuditContext } from "./repository.js";
import { normalizeEmail } from "./validation.js";

export type CredentialResetReason = "password_reset" | "totp_reset" | "break_glass";

export class CredentialLifecycleError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "forbidden"
      | "identity_not_found"
      | "credential_lifecycle_unavailable",
  ) {
    super(
      code === "forbidden"
        ? "Credential reset is not permitted."
        : code === "identity_not_found"
          ? "Credential reset could not be completed."
          : code === "invalid_request"
            ? "Credential reset request is invalid."
            : "Credential lifecycle is unavailable.",
    );
    this.name = "CredentialLifecycleError";
  }
}

export interface CredentialResetAuthorization {
  allowed: boolean;
  targetUserId: string;
  capability: "reset_ordinary_user_password" | "reset_ordinary_user_totp" | "affect_superadmin";
  humanStepUpSatisfied: boolean;
  actor: AdministrativeAuditEventInput["actor"];
  correlationId: string;
  source?: AdministrativeAuditEventInput["source"];
}

export interface IdentityInvalidationNotice {
  eventId: string;
  userId: string;
  reason: CredentialResetReason;
  browserSessionsRevoked: number;
  restrictedSessionsRevoked: number;
}

export interface IdentityInvalidationSink {
  invalidate(notice: IdentityInvalidationNotice): Promise<void>;
}

export interface PasswordResetResult {
  temporaryPassword: string;
  expiresAt: number;
  invalidationPending: boolean;
  browserSessionsRevoked: number;
  restrictedSessionsRevoked: number;
}

export interface TotpResetResult {
  invalidationPending: boolean;
  browserSessionsRevoked: number;
  restrictedSessionsRevoked: number;
}

interface ResetMutationResult extends IdentityInvalidationNotice {
  expiresAt?: number;
}

interface CredentialTarget {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  role: "superadmin" | "admin" | "user";
  status: string;
}

export class LocalCredentialLifecycleRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async target(userId: string): Promise<CredentialTarget | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<CredentialTarget>(`
        SELECT
          id, email, given_name AS givenName, family_name AS familyName,
          role, status
        FROM users
        WHERE id = ?
      `, [userId])),
    });
  }

  async targetByIdentifier(identifier: string): Promise<CredentialTarget | undefined> {
    let normalizedEmail: string | undefined;
    if (!isUuidV7(identifier)) {
      try {
        normalizedEmail = normalizeEmail(identifier);
      } catch {
        return undefined;
      }
    }
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<CredentialTarget>(`
        SELECT
          id, email, given_name AS givenName, family_name AS familyName,
          role, status
        FROM users
        WHERE ${normalizedEmail === undefined ? "id" : "normalized_email"} = ?
      `, [normalizedEmail ?? identifier])),
    });
  }

  async resetPassword(input: {
    target: CredentialTarget;
    encodedHash: string;
    expiresAt: number;
    eventId: string;
    audit: IdentityAuditContext;
  }): Promise<ResetMutationResult> {
    const now = safeNow(this.now);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentTarget(transaction, input.target);
          const counts = revokeUserSessions(transaction, input.target.id, now);
          transaction.run(`
            INSERT INTO identity_temporary_passwords (
              user_id, encoded_hash, purpose, issued_at, expires_at,
              consumed_at, revoked_at, version
            ) VALUES (?, ?, 'password_reset', ?, ?, NULL, NULL, 1)
            ON CONFLICT(user_id) DO UPDATE SET
              encoded_hash = excluded.encoded_hash,
              purpose = excluded.purpose,
              issued_at = excluded.issued_at,
              expires_at = excluded.expires_at,
              consumed_at = NULL,
              revoked_at = NULL,
              version = identity_temporary_passwords.version + 1
          `, [input.target.id, input.encodedHash, now, input.expiresAt]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'temporary', version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.target.id]);
          incrementUserEpoch(transaction, input.target.id, now);
          insertInvalidation(transaction, {
            eventId: input.eventId,
            userId: input.target.id,
            reason: "password_reset",
            ...counts,
          }, now);
          return {
            value: {
              eventId: input.eventId,
              userId: input.target.id,
              reason: "password_reset" as const,
              expiresAt: input.expiresAt,
              ...counts,
            },
            auditInput: resetAudit(input.audit, input.target, "identity.password_reset", counts, [
              { field: "authentication_state", after: "change_required" },
              { field: "security_epoch", after: "incremented" },
            ]),
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "identity_not_found") {
        throw new CredentialLifecycleError("identity_not_found");
      }
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
  }

  async resetTotp(input: {
    target: CredentialTarget;
    eventId: string;
    audit: IdentityAuditContext;
  }): Promise<ResetMutationResult> {
    const now = safeNow(this.now);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentTarget(transaction, input.target);
          const counts = revokeUserSessions(transaction, input.target.id, now);
          transaction.run(
            "DELETE FROM local_totp_authenticators WHERE user_id = ?",
            [input.target.id],
          );
          transaction.run(`
            UPDATE local_authenticator_states
            SET totp_state = 'not_configured', version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.target.id]);
          incrementUserEpoch(transaction, input.target.id, now);
          insertInvalidation(transaction, {
            eventId: input.eventId,
            userId: input.target.id,
            reason: "totp_reset",
            ...counts,
          }, now);
          return {
            value: {
              eventId: input.eventId,
              userId: input.target.id,
              reason: "totp_reset" as const,
              ...counts,
            },
            auditInput: resetAudit(input.audit, input.target, "identity.totp_reset", counts, [
              { field: "totp_state", before: "configured", after: "not_configured" },
              { field: "security_epoch", after: "incremented" },
            ]),
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "identity_not_found") {
        throw new CredentialLifecycleError("identity_not_found");
      }
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
  }

  async breakGlassReset(input: {
    target: CredentialTarget;
    encodedHash: string;
    expiresAt: number;
    eventId: string;
    audit: IdentityAuditContext;
  }): Promise<ResetMutationResult> {
    const now = safeNow(this.now);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentTarget(transaction, input.target);
          const counts = revokeUserSessions(transaction, input.target.id, now);
          transaction.run(
            "DELETE FROM local_password_credentials WHERE user_id = ?",
            [input.target.id],
          );
          transaction.run(
            "DELETE FROM local_totp_authenticators WHERE user_id = ?",
            [input.target.id],
          );
          transaction.run(`
            INSERT INTO identity_temporary_passwords (
              user_id, encoded_hash, purpose, issued_at, expires_at,
              consumed_at, revoked_at, version
            ) VALUES (?, ?, 'initial_enrollment', ?, ?, NULL, NULL, 1)
            ON CONFLICT(user_id) DO UPDATE SET
              encoded_hash = excluded.encoded_hash,
              purpose = excluded.purpose,
              issued_at = excluded.issued_at,
              expires_at = excluded.expires_at,
              consumed_at = NULL,
              revoked_at = NULL,
              version = identity_temporary_passwords.version + 1
          `, [input.target.id, input.encodedHash, now, input.expiresAt]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'temporary', totp_state = 'not_configured',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.target.id]);
          const user = transaction.run(`
            UPDATE users
            SET status = 'enrollment_required',
                security_epoch = security_epoch + 1,
                version = version + 1,
                updated_at = ?
            WHERE id = ?
          `, [now, input.target.id]);
          if (user.changes !== 1) throw new PersistenceError("identity_not_found");
          insertInvalidation(transaction, {
            eventId: input.eventId,
            userId: input.target.id,
            reason: "break_glass",
            ...counts,
          }, now);
          return {
            value: {
              eventId: input.eventId,
              userId: input.target.id,
              reason: "break_glass" as const,
              expiresAt: input.expiresAt,
              ...counts,
            },
            auditInput: resetAudit(
              input.audit,
              input.target,
              "identity.break_glass_reset",
              counts,
              [
                { field: "status", before: input.target.status, after: "enrollment_required" },
                { field: "authentication_state", after: "initial_enrollment_required" },
                { field: "security_epoch", after: "incremented" },
              ],
            ),
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "identity_not_found") {
        throw new CredentialLifecycleError("identity_not_found");
      }
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
  }

  async markDispatched(eventId: string): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const result = transaction.run(`
            UPDATE identity_invalidation_events
            SET dispatched_at = ?, attempts = attempts + 1
            WHERE id = ? AND dispatched_at IS NULL
          `, [now, eventId]);
          if (result.changes !== 1) throw new PersistenceError("database_unavailable");
        }),
      });
    } catch {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
  }
}

export interface LocalCredentialLifecycleServiceOptions {
  repository: LocalCredentialLifecycleRepository;
  config: IdentityConfig;
  invalidationSink?: IdentityInvalidationSink;
  random?: (size: number) => Buffer;
  uuid?: () => string;
  now?: () => number;
}

export class LocalCredentialLifecycleService {
  readonly #repository: LocalCredentialLifecycleRepository;
  readonly #config: IdentityConfig;
  readonly #invalidationSink: IdentityInvalidationSink | undefined;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #now: () => number;

  constructor(options: LocalCredentialLifecycleServiceOptions) {
    this.#repository = options.repository;
    this.#config = options.config;
    this.#invalidationSink = options.invalidationSink;
    this.#random = options.random ?? randomBytes;
    this.#now = options.now ?? Date.now;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  async resetPassword(input: {
    targetUserId: unknown;
    justification: unknown;
    authorization: CredentialResetAuthorization;
  }): Promise<PasswordResetResult> {
    const targetUserId = parseTarget(input.targetUserId);
    const justification = parseJustification(input.justification);
    requireAuthorization(input.authorization, targetUserId, "password");
    const target = await this.#repository.target(targetUserId);
    if (target === undefined) throw new CredentialLifecycleError("identity_not_found");
    requireTargetAuthorization(input.authorization, target);
    const temporaryPassword = generateTemporaryPassword(
      this.#config.password.minimumLength,
      this.#random,
    );
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(Buffer.from(temporaryPassword, "utf8"));
    } catch {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    const now = safeNow(this.#now);
    const expiresAt = now + this.#config.temporaryPasswordTtlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    const eventId = this.nextUuid();
    const mutation = await this.#repository.resetPassword({
      target,
      encodedHash,
      expiresAt,
      eventId,
      audit: auditContext(input.authorization, justification),
    });
    const invalidationPending = !(await this.dispatch(mutation));
    return {
      temporaryPassword,
      expiresAt,
      invalidationPending,
      browserSessionsRevoked: mutation.browserSessionsRevoked,
      restrictedSessionsRevoked: mutation.restrictedSessionsRevoked,
    };
  }

  async resetTotp(input: {
    targetUserId: unknown;
    justification: unknown;
    authorization: CredentialResetAuthorization;
  }): Promise<TotpResetResult> {
    const targetUserId = parseTarget(input.targetUserId);
    const justification = parseJustification(input.justification);
    requireAuthorization(input.authorization, targetUserId, "totp");
    const target = await this.#repository.target(targetUserId);
    if (target === undefined) throw new CredentialLifecycleError("identity_not_found");
    requireTargetAuthorization(input.authorization, target);
    const mutation = await this.#repository.resetTotp({
      target,
      eventId: this.nextUuid(),
      audit: auditContext(input.authorization, justification),
    });
    const invalidationPending = !(await this.dispatch(mutation));
    return {
      invalidationPending,
      browserSessionsRevoked: mutation.browserSessionsRevoked,
      restrictedSessionsRevoked: mutation.restrictedSessionsRevoked,
    };
  }

  async breakGlassReset(input: {
    identifier: unknown;
    authorization: CredentialResetAuthorization;
  }): Promise<PasswordResetResult & {
    userId: string;
    role: "superadmin" | "admin" | "user";
  }> {
    if (
      typeof input.identifier !== "string" ||
      input.identifier.length < 1 ||
      input.identifier.length > 254 ||
      input.authorization.allowed !== true ||
      input.authorization.actor.type !== "local_cli" ||
      input.authorization.actor.authenticationMethod !== "host_terminal" ||
      input.authorization.source?.category !== "break_glass" ||
      !validCorrelationId(input.authorization.correlationId)
    ) throw new CredentialLifecycleError("forbidden");
    const target = await this.#repository.targetByIdentifier(input.identifier);
    if (target === undefined) throw new CredentialLifecycleError("identity_not_found");
    const temporaryPassword = generateTemporaryPassword(
      this.#config.password.minimumLength,
      this.#random,
    );
    let encodedHash: string;
    try {
      const bytes = Buffer.from(temporaryPassword, "utf8");
      try {
        encodedHash = await hashPassword(bytes);
      } finally {
        bytes.fill(0);
      }
    } catch {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    const expiresAt = safeNow(this.#now) + this.#config.temporaryPasswordTtlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    const mutation = await this.#repository.breakGlassReset({
      target,
      encodedHash,
      expiresAt,
      eventId: this.nextUuid(),
      audit: {
        actor: input.authorization.actor,
        correlationId: input.authorization.correlationId,
        source: input.authorization.source,
        justification: "Host-local break-glass credential recovery.",
      },
    });
    const invalidationPending = !(await this.dispatch(mutation));
    return {
      userId: target.id,
      role: target.role,
      temporaryPassword,
      expiresAt,
      invalidationPending,
      browserSessionsRevoked: mutation.browserSessionsRevoked,
      restrictedSessionsRevoked: mutation.restrictedSessionsRevoked,
    };
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    return value;
  }

  private async dispatch(notice: IdentityInvalidationNotice): Promise<boolean> {
    if (this.#invalidationSink === undefined) return false;
    try {
      await this.#invalidationSink.invalidate(notice);
      await this.#repository.markDispatched(notice.eventId);
      return true;
    } catch {
      return false;
    }
  }
}

export function generateTemporaryPassword(
  minimumLength: number,
  random: (size: number) => Buffer = randomBytes,
): string {
  if (!Number.isInteger(minimumLength) || minimumLength < 8 || minimumLength > 128) {
    throw new CredentialLifecycleError("invalid_request");
  }
  const length = Math.max(24, minimumLength);
  const bytes = random(Math.ceil(length * 3 / 4));
  try {
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== Math.ceil(length * 3 / 4)) {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    const value = bytes.toString("base64url").slice(0, length);
    if (value.length !== length || !/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new CredentialLifecycleError("credential_lifecycle_unavailable");
    }
    return value;
  } finally {
    if (Buffer.isBuffer(bytes)) bytes.fill(0);
  }
}

function requireAuthorization(
  authorization: CredentialResetAuthorization,
  targetUserId: string,
  kind: "password" | "totp",
): void {
  const expectedCapability = kind === "password"
    ? "reset_ordinary_user_password"
    : "reset_ordinary_user_totp";
  if (
    authorization === null ||
    typeof authorization !== "object" ||
    authorization.allowed !== true ||
    authorization.targetUserId !== targetUserId ||
    ![expectedCapability, "affect_superadmin"].includes(authorization.capability) ||
    !validCorrelationId(authorization.correlationId) ||
    (authorization.actor.type === "browser_session" && authorization.humanStepUpSatisfied !== true) ||
    (authorization.actor.type !== "browser_session" && authorization.actor.type !== "api_key")
  ) {
    throw new CredentialLifecycleError("forbidden");
  }
}

function auditContext(
  authorization: CredentialResetAuthorization,
  justification: string,
): IdentityAuditContext {
  return {
    actor: authorization.actor,
    correlationId: authorization.correlationId,
    ...(authorization.source === undefined ? {} : { source: authorization.source }),
    justification,
  };
}

function requireTargetAuthorization(
  authorization: CredentialResetAuthorization,
  target: CredentialTarget,
): void {
  if (target.role !== "superadmin") return;
  if (
    authorization.capability !== "affect_superadmin" ||
    authorization.actor.type !== "browser_session" ||
    authorization.actor.role !== "superadmin" ||
    authorization.humanStepUpSatisfied !== true
  ) {
    throw new CredentialLifecycleError("forbidden");
  }
}

function parseTarget(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) {
    throw new CredentialLifecycleError("invalid_request");
  }
  return value;
}

function parseJustification(value: unknown): string {
  if (typeof value !== "string") throw new CredentialLifecycleError("invalid_request");
  const normalized = value.normalize("NFKC").trim();
  if (
    [...normalized].length < 1 ||
    [...normalized].length > 1_024 ||
    Buffer.byteLength(normalized, "utf8") > 4_096
  ) {
    throw new CredentialLifecycleError("invalid_request");
  }
  return normalized;
}

function validCorrelationId(value: unknown): value is string {
  return typeof value === "string" &&
    /^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function requireCurrentTarget(transaction: PersistenceTransaction, target: CredentialTarget): void {
  const current = transaction.get<{
    role: string;
    status: string;
  }>("SELECT role, status FROM users WHERE id = ?", [target.id]);
  if (
    current === undefined ||
    current.role !== target.role ||
    current.status !== target.status
  ) {
    throw new PersistenceError("identity_not_found");
  }
}

function revokeUserSessions(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): Pick<IdentityInvalidationNotice, "browserSessionsRevoked" | "restrictedSessionsRevoked"> {
  const browserSessionsRevoked = Number(transaction.run(`
    UPDATE browser_sessions
    SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  const restrictedSessionsRevoked = Number(transaction.run(`
    UPDATE identity_restricted_sessions
    SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  return { browserSessionsRevoked, restrictedSessionsRevoked };
}

function incrementUserEpoch(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): void {
  const result = transaction.run(`
    UPDATE users
    SET security_epoch = security_epoch + 1,
        version = version + 1,
        updated_at = ?
    WHERE id = ?
  `, [now, userId]);
  if (result.changes !== 1) throw new PersistenceError("identity_not_found");
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  notice: IdentityInvalidationNotice,
  now: number,
): void {
  transaction.run(`
    INSERT INTO identity_invalidation_events (
      id, user_id, reason, browser_sessions_revoked,
      restricted_sessions_revoked, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
  `, [
    notice.eventId,
    notice.userId,
    notice.reason,
    notice.browserSessionsRevoked,
    notice.restrictedSessionsRevoked,
    now,
  ]);
}

function resetAudit(
  audit: IdentityAuditContext,
  target: CredentialTarget,
  action: string,
  counts: Pick<IdentityInvalidationNotice, "browserSessionsRevoked" | "restrictedSessionsRevoked">,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: audit.actor,
    action,
    result: "allow",
    target: {
      type: "user",
      id: target.id,
      label: `user:${target.id}`,
    },
    justification: audit.justification,
    changes: [
      ...changes,
      { field: "browser_sessions_revoked", after: counts.browserSessionsRevoked },
      { field: "restricted_sessions_revoked", after: counts.restrictedSessionsRevoked },
    ],
    correlationId: audit.correlationId,
    source: audit.source ?? { category: "identity" },
  };
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CredentialLifecycleError("credential_lifecycle_unavailable");
  }
  return value;
}
