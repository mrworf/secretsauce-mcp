import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import { InflightLimiter } from "../inflightLimiter.js";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../control/authentication.js";
import { CONTROL_ENROLLMENT_COOKIE } from "../control/security.js";
import type { ValidatedBrowserSession } from "./browserSessions.js";
import {
  generateTemporaryPassword,
} from "./credentialLifecycle.js";
import {
  PasswordPolicy,
  hashPassword,
  isSupportedPasswordHash,
  verifyPasswordHash,
} from "./password.js";
import type { IdentityAuditContext } from "./repository.js";
import {
  IdentityKeyRing,
  beginTotpEnrollment,
  decryptTotpSeed,
  parseTotpEnvelope,
  verifyTotpCode,
  type TotpEnvelope,
} from "./totp.js";
import { normalizeEmail } from "./validation.js";

const SESSION_BYTES = 32;
const SESSION_DOMAIN = "secretsauce.restricted-session.v1";
const CSRF_DOMAIN = "secretsauce.restricted-csrf.v1";
const ACCOUNT_DOMAIN = "secretsauce.enrollment-account.v1";
const OPAQUE_VALUE = /^[A-Za-z0-9_-]{43}$/;

export type RestrictedSessionPurpose =
  | "initial_enrollment"
  | "password_change"
  | "totp_enrollment"
  | "totp_replacement";

type RestrictedLoginPurpose = Exclude<RestrictedSessionPurpose, "totp_replacement">;

export class EnrollmentError extends Error {
  constructor(
    readonly code:
      | "authentication_failed"
      | "rate_limited"
      | "invalid_request"
      | "enrollment_unavailable",
  ) {
    super(
      code === "authentication_failed"
        ? "Authentication failed."
        : code === "rate_limited"
          ? "Authentication is temporarily unavailable."
          : code === "invalid_request"
            ? "Enrollment input is invalid."
            : "Enrollment is unavailable.",
    );
    this.name = "EnrollmentError";
  }
}

interface EnrollmentCandidate {
  userId: string;
  email: string;
  givenName: string;
  familyName: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  passwordPolicyVersion: number;
  passwordState: string;
  totpState: string;
  temporaryHash: string | null;
  temporaryPurpose: string | null;
  temporaryExpiresAt: number | null;
  temporaryConsumedAt: number | null;
  temporaryRevokedAt: number | null;
  temporaryVersion: number | null;
  passwordHash: string | null;
  passwordVersion: number | null;
  totpAuthenticatorId: string | null;
  totpEnvelopeJson: string | null;
  totpRootKeyId: string | null;
  totpGeneration: number | null;
  authenticatorVersion: number;
}

interface RestrictedSessionMaterial {
  id: string;
  userId: string;
  purpose: RestrictedSessionPurpose;
  sessionHash: string;
  csrfHash: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  issuedAt: number;
  expiresAt: number;
}

export interface RestrictedLoginResult {
  userId: string;
  role: "superadmin" | "admin" | "user";
  purpose: RestrictedLoginPurpose;
  sessionToken: string;
  csrfToken: string;
  expiresAt: number;
}

export interface ValidatedRestrictedSession {
  sessionId: string;
  userId: string;
  role: "superadmin" | "admin" | "user";
  purpose: RestrictedSessionPurpose;
  csrfHash: string;
  expiresAt: number;
}

interface PendingEnrollment {
  sessionId: string;
  userId: string;
  authenticatorId: string;
  envelopeJson: string;
  rootKeyId: string;
  generation: number;
  expiresAt: number;
  email: string;
  givenName: string;
  familyName: string;
  status: string;
  passwordPolicyVersion: number;
  currentPasswordPolicyVersion: number;
  securityEpoch: number;
  globalSecurityEpoch: number;
}

export class LocalEnrollmentRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async issueInitialTemporary(input: {
    userId: string;
    encodedHash: string;
    expiresAt: number;
    audit: IdentityAuditContext;
  }): Promise<void> {
    if (!isUuidV7(input.userId) || !isSupportedPasswordHash(input.encodedHash)) {
      throw new EnrollmentError("invalid_request");
    }
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const target = transaction.get<{ status: string; role: string }>(
            "SELECT status, role FROM users WHERE id = ?",
            [input.userId],
          );
          if (
            target === undefined ||
            !["invited", "enrollment_required"].includes(target.status)
          ) {
            throw new PersistenceError("identity_not_found");
          }
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
          `, [input.userId, input.encodedHash, now, input.expiresAt]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'temporary', totp_state = 'not_configured',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.userId]);
          return {
            value: undefined,
            auditInput: {
              actor: input.audit.actor,
              action: "identity.enrollment_issue",
              result: "allow",
              target: {
                type: "user",
                id: input.userId,
                label: `user:${input.userId}`,
              },
              justification: input.audit.justification,
              changes: [{ field: "enrollment", after: "temporary_access_issued" }],
              correlationId: input.audit.correlationId,
              source: input.audit.source ?? { category: "identity" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async candidate(normalizedEmail: string): Promise<EnrollmentCandidate | undefined> {
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<EnrollmentCandidate>(`
        SELECT
          u.id AS userId, u.email, u.given_name AS givenName,
          u.family_name AS familyName, u.role, u.status,
          u.security_epoch AS securityEpoch,
          sec.global_security_epoch AS globalSecurityEpoch,
          u.password_policy_version AS passwordPolicyVersion,
          a.password_state AS passwordState, a.totp_state AS totpState,
          tp.encoded_hash AS temporaryHash,
          tp.purpose AS temporaryPurpose,
          tp.expires_at AS temporaryExpiresAt,
          tp.consumed_at AS temporaryConsumedAt,
          tp.revoked_at AS temporaryRevokedAt,
          tp.version AS temporaryVersion,
          pw.encoded_hash AS passwordHash, pw.version AS passwordVersion,
          ta.id AS totpAuthenticatorId, ta.envelope_json AS totpEnvelopeJson,
          ta.root_key_id AS totpRootKeyId, ta.generation AS totpGeneration,
          a.version AS authenticatorVersion
        FROM users u
        JOIN identity_security_state sec ON sec.singleton = 1
        JOIN local_authenticator_states a ON a.user_id = u.id
        LEFT JOIN identity_temporary_passwords tp ON tp.user_id = u.id
        LEFT JOIN local_password_credentials pw ON pw.user_id = u.id
        LEFT JOIN local_totp_authenticators ta ON ta.user_id = u.id
        WHERE u.normalized_email = ?
      `, [normalizedEmail])),
    });
  }

  async candidateByUserId(userId: string): Promise<EnrollmentCandidate | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<EnrollmentCandidate>(`
        SELECT
          u.id AS userId, u.email, u.given_name AS givenName,
          u.family_name AS familyName, u.role, u.status,
          u.security_epoch AS securityEpoch,
          sec.global_security_epoch AS globalSecurityEpoch,
          u.password_policy_version AS passwordPolicyVersion,
          a.password_state AS passwordState, a.totp_state AS totpState,
          tp.encoded_hash AS temporaryHash,
          tp.purpose AS temporaryPurpose,
          tp.expires_at AS temporaryExpiresAt,
          tp.consumed_at AS temporaryConsumedAt,
          tp.revoked_at AS temporaryRevokedAt,
          tp.version AS temporaryVersion,
          pw.encoded_hash AS passwordHash, pw.version AS passwordVersion,
          ta.id AS totpAuthenticatorId, ta.envelope_json AS totpEnvelopeJson,
          ta.root_key_id AS totpRootKeyId, ta.generation AS totpGeneration,
          a.version AS authenticatorVersion
        FROM users u
        JOIN identity_security_state sec ON sec.singleton = 1
        JOIN local_authenticator_states a ON a.user_id = u.id
        LEFT JOIN identity_temporary_passwords tp ON tp.user_id = u.id
        LEFT JOIN local_password_credentials pw ON pw.user_id = u.id
        LEFT JOIN local_totp_authenticators ta ON ta.user_id = u.id
        WHERE u.id = ?
      `, [userId])),
    });
  }

  async createRestrictedSession(
    candidate: EnrollmentCandidate,
    material: RestrictedSessionMaterial,
    correlationId: string,
  ): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredEnrollmentCandidate(transaction, candidate.userId);
          const currentMatches = material.purpose === "totp_enrollment"
            ? sameTotpRecoveryCandidate(current, candidate)
            : sameTemporaryCandidate(current, candidate, material.purpose, now);
          if (!currentMatches) {
            throw new PersistenceError("authentication_failed");
          }
          if (material.purpose !== "totp_enrollment") {
            const consumed = transaction.run(`
              UPDATE identity_temporary_passwords
              SET consumed_at = ?, version = version + 1
              WHERE user_id = ? AND version = ?
                AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?
            `, [now, candidate.userId, candidate.temporaryVersion, now]);
            if (consumed.changes !== 1) throw new PersistenceError("authentication_failed");
          }
          transaction.run(`
            UPDATE identity_restricted_sessions
            SET revoked_at = ?, version = version + 1
            WHERE user_id = ? AND revoked_at IS NULL
          `, [now, candidate.userId]);
          transaction.run(`
            INSERT INTO identity_restricted_sessions (
              id, user_id, purpose, session_hash, csrf_hash,
              issued_security_epoch, issued_global_epoch,
              issued_at, expires_at, revoked_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
          `, [
            material.id,
            material.userId,
            material.purpose,
            material.sessionHash,
            material.csrfHash,
            material.securityEpoch,
            material.globalSecurityEpoch,
            material.issuedAt,
            material.expiresAt,
          ]);
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "system",
                label: "restricted-enrollment",
                authenticationMethod: material.purpose === "totp_enrollment"
                  ? "password"
                  : "temporary_password",
              },
              action: material.purpose === "totp_enrollment"
                ? "identity.totp_recovery_login"
                : "identity.enrollment_login",
              result: "allow",
              target: {
                type: "user",
                id: candidate.userId,
                label: `user:${candidate.userId}`,
              },
              changes: [{ field: "restricted_session", after: "created" }],
              correlationId,
              source: { category: "authentication" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "authentication_failed") {
        throw new EnrollmentError("authentication_failed");
      }
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async restrictedSession(sessionHash: string): Promise<ValidatedRestrictedSession | undefined> {
    if (!/^[a-f0-9]{64}$/.test(sessionHash)) return undefined;
    const now = safeNow(this.now);
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{
          id: string;
          user_id: string;
          role: "superadmin" | "admin" | "user";
          status: string;
          purpose: RestrictedSessionPurpose;
          csrf_hash: string;
          issued_security_epoch: number;
          issued_global_epoch: number;
          security_epoch: number;
          global_security_epoch: number;
          expires_at: number;
          revoked_at: number | null;
          password_state: string;
          totp_state: string;
        }>(`
          SELECT
            rs.id, rs.user_id, u.role, u.status, rs.purpose, rs.csrf_hash,
            rs.issued_security_epoch, rs.issued_global_epoch,
            u.security_epoch, sec.global_security_epoch,
            rs.expires_at, rs.revoked_at,
            a.password_state, a.totp_state
          FROM identity_restricted_sessions rs
          JOIN users u ON u.id = rs.user_id
          JOIN local_authenticator_states a ON a.user_id = u.id
          JOIN identity_security_state sec ON sec.singleton = 1
          WHERE rs.session_hash = ?
        `, [sessionHash]);
        if (
          row === undefined ||
          row.revoked_at !== null ||
          now >= row.expires_at ||
          row.security_epoch !== row.issued_security_epoch ||
          row.global_security_epoch !== row.issued_global_epoch ||
          !validRestrictedState(
            row.purpose,
            row.status,
            row.password_state,
            row.totp_state,
          )
        ) return undefined;
        return {
          sessionId: row.id,
          userId: row.user_id,
          role: row.role,
          purpose: row.purpose,
          csrfHash: row.csrf_hash,
          expiresAt: row.expires_at,
        };
      }),
    });
  }

  async rotateCsrf(sessionId: string, userId: string, csrfHash: string): Promise<void> {
    try {
      await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const result = transaction.run(`
            UPDATE identity_restricted_sessions
            SET csrf_hash = ?, version = version + 1
            WHERE id = ? AND user_id = ? AND revoked_at IS NULL
          `, [csrfHash, sessionId, userId]);
          if (result.changes !== 1) throw new PersistenceError("authentication_failed");
        }),
      });
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async savePendingTotp(
    session: ValidatedRestrictedSession,
    envelope: TotpEnvelope,
    passwordPolicyVersion: number,
  ): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          requireCurrentRestrictedSession(transaction, session, now);
          transaction.run(`
            INSERT INTO identity_pending_totp (
              restricted_session_id, user_id, authenticator_id, envelope_json,
              root_key_id, generation, password_policy_version, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(restricted_session_id) DO UPDATE SET
              authenticator_id = excluded.authenticator_id,
              envelope_json = excluded.envelope_json,
              root_key_id = excluded.root_key_id,
              generation = excluded.generation,
              password_policy_version = excluded.password_policy_version,
              created_at = excluded.created_at,
              expires_at = excluded.expires_at
          `, [
            session.sessionId,
            session.userId,
            envelope.authenticatorId,
            JSON.stringify(envelope),
            envelope.rootKeyId,
            envelope.generation,
            passwordPolicyVersion,
            now,
            session.expiresAt,
          ]);
        }),
      });
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async pending(sessionId: string, userId: string): Promise<PendingEnrollment | undefined> {
    if (!isUuidV7(sessionId) || !isUuidV7(userId)) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<PendingEnrollment>(`
        SELECT
          p.restricted_session_id AS sessionId,
          p.user_id AS userId,
          p.authenticator_id AS authenticatorId,
          p.envelope_json AS envelopeJson,
          p.root_key_id AS rootKeyId,
          p.generation,
          p.expires_at AS expiresAt,
          u.email, u.given_name AS givenName, u.family_name AS familyName,
          u.status, p.password_policy_version AS passwordPolicyVersion,
          u.password_policy_version AS currentPasswordPolicyVersion,
          u.security_epoch AS securityEpoch,
          sec.global_security_epoch AS globalSecurityEpoch
        FROM identity_pending_totp p
        JOIN users u ON u.id = p.user_id
        JOIN identity_security_state sec ON sec.singleton = 1
        WHERE p.restricted_session_id = ? AND p.user_id = ?
      `, [sessionId, userId])),
    });
  }

  async completeInitialEnrollment(input: {
    session: ValidatedRestrictedSession;
    pending: PendingEnrollment;
    encodedHash: string;
    acceptedStep: number;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentRestrictedSession(transaction, input.session, now);
          const currentPending = requiredPending(transaction, input.pending, now);
          if (
            currentPending.passwordPolicyVersion !== input.pending.passwordPolicyVersion ||
            currentPending.securityEpoch !== input.pending.securityEpoch ||
            currentPending.globalSecurityEpoch !== input.pending.globalSecurityEpoch
          ) {
            throw new PersistenceError("authentication_failed");
          }
          if (transaction.get<{ present: number }>(
            "SELECT 1 AS present FROM accepted_totp_steps WHERE user_id = ? AND time_step = ?",
            [input.session.userId, input.acceptedStep],
          ) !== undefined) {
            throw new PersistenceError("totp_replayed");
          }
          transaction.run(`
            INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
            VALUES (?, ?, 'confirmation', ?)
          `, [input.session.userId, input.acceptedStep, now]);
          transaction.run(`
            INSERT INTO local_password_credentials (
              user_id, encoded_hash, policy_version, version, created_at, updated_at
            ) VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              encoded_hash = excluded.encoded_hash,
              policy_version = excluded.policy_version,
              version = local_password_credentials.version + 1,
              updated_at = excluded.updated_at
          `, [
            input.session.userId,
            input.encodedHash,
            input.pending.passwordPolicyVersion,
            now,
            now,
          ]);
          transaction.run(`
            INSERT INTO local_totp_authenticators (
              id, user_id, envelope_json, root_key_id, generation,
              confirmed_at, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          `, [
            input.pending.authenticatorId,
            input.session.userId,
            input.pending.envelopeJson,
            input.pending.rootKeyId,
            input.pending.generation,
            now,
            now,
            now,
          ]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'configured', totp_state = 'configured',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.session.userId]);
          const activated = transaction.run(`
            UPDATE users
            SET status = 'active', security_epoch = security_epoch + 1,
                version = version + 1, updated_at = ?
            WHERE id = ? AND status IN ('invited', 'enrollment_required')
          `, [now, input.session.userId]);
          if (activated.changes !== 1) throw new PersistenceError("authentication_failed");
          const browserSessionsRevoked = Number(transaction.run(`
            UPDATE browser_sessions
            SET revoked_at = ?, version = version + 1
            WHERE user_id = ? AND revoked_at IS NULL
          `, [now, input.session.userId]).changes);
          const restrictedSessionsRevoked = Number(transaction.run(`
            UPDATE identity_restricted_sessions
            SET revoked_at = ?, version = version + 1
            WHERE user_id = ? AND revoked_at IS NULL
          `, [now, input.session.userId]).changes);
          transaction.run(`
            UPDATE identity_temporary_passwords
            SET revoked_at = coalesce(revoked_at, ?), version = version + 1
            WHERE user_id = ?
          `, [now, input.session.userId]);
          transaction.run(
            "DELETE FROM identity_pending_totp WHERE user_id = ?",
            [input.session.userId],
          );
          transaction.run(`
            INSERT INTO identity_invalidation_events (
              id, user_id, reason, browser_sessions_revoked,
              restricted_sessions_revoked, created_at, dispatched_at, attempts
            ) VALUES (?, ?, 'enrollment', ?, ?, ?, NULL, 0)
          `, [
            input.eventId,
            input.session.userId,
            browserSessionsRevoked,
            restrictedSessionsRevoked,
            now,
          ]);
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "system",
                label: `user:${input.session.userId}`,
                authenticationMethod: "restricted_session",
              },
              action: "identity.enrollment_complete",
              result: "allow",
              target: {
                type: "user",
                id: input.session.userId,
                label: `user:${input.session.userId}`,
              },
              changes: [
                { field: "status", before: input.pending.status, after: "active" },
                { field: "enrollment", after: "configured" },
                { field: "security_epoch", after: "incremented" },
                { field: "browser_sessions_revoked", after: browserSessionsRevoked },
                { field: "restricted_sessions_revoked", after: restrictedSessionsRevoked },
              ],
              correlationId: input.correlationId,
              source: { category: "identity" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) {
        throw new EnrollmentError("authentication_failed");
      }
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async completePasswordChange(input: {
    session: ValidatedRestrictedSession;
    candidate: EnrollmentCandidate;
    encodedHash: string;
    acceptedStep: number;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentRestrictedSession(transaction, input.session, now);
          const current = requiredEnrollmentCandidate(transaction, input.session.userId);
          if (!samePasswordChangeCandidate(current, input.candidate)) {
            throw new PersistenceError("authentication_failed");
          }
          acceptTotpStep(transaction, input.session.userId, input.acceptedStep, now);
          transaction.run(`
            INSERT INTO local_password_credentials (
              user_id, encoded_hash, policy_version, version, created_at, updated_at
            ) VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              encoded_hash = excluded.encoded_hash,
              policy_version = excluded.policy_version,
              version = local_password_credentials.version + 1,
              updated_at = excluded.updated_at
          `, [
            input.session.userId,
            input.encodedHash,
            current.passwordPolicyVersion,
            now,
            now,
          ]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'configured', version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.session.userId]);
          const counts = finalizeCredentialChange(
            transaction,
            input.session.userId,
            input.eventId,
            "password_change",
            now,
          );
          transaction.run(`
            UPDATE identity_temporary_passwords
            SET revoked_at = coalesce(revoked_at, ?), version = version + 1
            WHERE user_id = ?
          `, [now, input.session.userId]);
          return {
            value: undefined,
            auditInput: credentialChangeAudit(
              input.session.userId,
              input.correlationId,
              "identity.password_change",
              counts,
            ),
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) throw new EnrollmentError("authentication_failed");
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async completeTotpEnrollment(input: {
    session: ValidatedRestrictedSession;
    pending: PendingEnrollment;
    acceptedStep: number;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentRestrictedSession(transaction, input.session, now);
          const pending = requiredPending(transaction, input.pending, now);
          if (
            input.session.purpose !== "totp_enrollment" ||
            pending.status !== "active"
          ) throw new PersistenceError("authentication_failed");
          const current = requiredEnrollmentCandidate(transaction, input.session.userId);
          if (!sameTotpRecoveryCandidate(current, current)) {
            throw new PersistenceError("authentication_failed");
          }
          acceptTotpStep(transaction, input.session.userId, input.acceptedStep, now);
          transaction.run(`
            INSERT INTO local_totp_authenticators (
              id, user_id, envelope_json, root_key_id, generation,
              confirmed_at, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          `, [
            pending.authenticatorId,
            input.session.userId,
            pending.envelopeJson,
            pending.rootKeyId,
            pending.generation,
            now,
            now,
            now,
          ]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET totp_state = 'configured', version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.session.userId]);
          const counts = finalizeCredentialChange(
            transaction,
            input.session.userId,
            input.eventId,
            "totp_change",
            now,
          );
          transaction.run(
            "DELETE FROM identity_pending_totp WHERE user_id = ?",
            [input.session.userId],
          );
          return {
            value: undefined,
            auditInput: credentialChangeAudit(
              input.session.userId,
              input.correlationId,
              "identity.totp_enrollment_complete",
              counts,
            ),
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) throw new EnrollmentError("authentication_failed");
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async completeSelfPasswordChange(input: {
    browserSession: ValidatedBrowserSession;
    candidate: EnrollmentCandidate;
    encodedHash: string;
    acceptedStep: number;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentBrowserSession(transaction, input.browserSession, now);
          const current = requiredEnrollmentCandidate(
            transaction,
            input.browserSession.userId,
          );
          if (!sameConfiguredCandidate(current, input.candidate)) {
            throw new PersistenceError("authentication_failed");
          }
          acceptTotpStep(
            transaction,
            input.browserSession.userId,
            input.acceptedStep,
            now,
          );
          const passwordChanged = transaction.run(`
            UPDATE local_password_credentials
            SET encoded_hash = ?, policy_version = ?, version = version + 1, updated_at = ?
            WHERE user_id = ? AND version = ?
          `, [
            input.encodedHash,
            current.passwordPolicyVersion,
            now,
            input.browserSession.userId,
            current.passwordVersion,
          ]);
          if (passwordChanged.changes !== 1) {
            throw new PersistenceError("authentication_failed");
          }
          const counts = finalizeCredentialChange(
            transaction,
            input.browserSession.userId,
            input.eventId,
            "password_change",
            now,
          );
          return {
            value: undefined,
            auditInput: browserCredentialChangeAudit(
              input.browserSession,
              input.correlationId,
              "identity.self_password_change",
              counts,
            ),
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) throw new EnrollmentError("authentication_failed");
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async beginTotpReplacement(input: {
    browserSession: ValidatedBrowserSession;
    candidate: EnrollmentCandidate;
    material: RestrictedSessionMaterial;
    envelope: TotpEnvelope;
    acceptedStep: number;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentBrowserSession(transaction, input.browserSession, now);
          const current = requiredEnrollmentCandidate(
            transaction,
            input.browserSession.userId,
          );
          if (
            input.material.purpose !== "totp_replacement" ||
            !sameConfiguredCandidate(current, input.candidate)
          ) throw new PersistenceError("authentication_failed");
          acceptTotpStep(
            transaction,
            input.browserSession.userId,
            input.acceptedStep,
            now,
          );
          transaction.run(`
            UPDATE identity_restricted_sessions
            SET revoked_at = ?, version = version + 1
            WHERE user_id = ? AND revoked_at IS NULL
          `, [now, input.browserSession.userId]);
          transaction.run(`
            INSERT INTO identity_restricted_sessions (
              id, user_id, purpose, session_hash, csrf_hash,
              issued_security_epoch, issued_global_epoch,
              issued_at, expires_at, revoked_at, version
            ) VALUES (?, ?, 'totp_replacement', ?, ?, ?, ?, ?, ?, NULL, 1)
          `, [
            input.material.id,
            input.browserSession.userId,
            input.material.sessionHash,
            input.material.csrfHash,
            input.material.securityEpoch,
            input.material.globalSecurityEpoch,
            input.material.issuedAt,
            input.material.expiresAt,
          ]);
          transaction.run(`
            INSERT INTO identity_pending_totp (
              restricted_session_id, user_id, authenticator_id, envelope_json,
              root_key_id, generation, password_policy_version, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            input.material.id,
            input.browserSession.userId,
            input.envelope.authenticatorId,
            JSON.stringify(input.envelope),
            input.envelope.rootKeyId,
            input.envelope.generation,
            current.passwordPolicyVersion,
            now,
            input.material.expiresAt,
          ]);
          return {
            value: undefined,
            auditInput: {
              actor: browserAuditActor(input.browserSession),
              action: "identity.self_totp_begin",
              result: "allow",
              target: {
                type: "user",
                id: input.browserSession.userId,
                label: `user:${input.browserSession.userId}`,
              },
              changes: [{ field: "totp_replacement", after: "pending" }],
              correlationId: input.correlationId,
              source: { category: "identity" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) throw new EnrollmentError("authentication_failed");
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async completeTotpReplacement(input: {
    session: ValidatedRestrictedSession;
    pending: PendingEnrollment;
    acceptedStep: number;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    const now = safeNow(this.now);
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentRestrictedSession(transaction, input.session, now);
          const pending = requiredPending(transaction, input.pending, now);
          const current = requiredEnrollmentCandidate(transaction, input.session.userId);
          if (
            input.session.purpose !== "totp_replacement" ||
            pending.status !== "active" ||
            !eligibleConfiguredCandidate(current)
          ) throw new PersistenceError("authentication_failed");
          acceptTotpStep(transaction, input.session.userId, input.acceptedStep, now);
          const replaced = transaction.run(`
            UPDATE local_totp_authenticators
            SET id = ?, envelope_json = ?, root_key_id = ?, generation = ?,
                confirmed_at = ?, version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [
            pending.authenticatorId,
            pending.envelopeJson,
            pending.rootKeyId,
            pending.generation,
            now,
            now,
            input.session.userId,
          ]);
          if (replaced.changes !== 1) throw new PersistenceError("authentication_failed");
          const counts = finalizeCredentialChange(
            transaction,
            input.session.userId,
            input.eventId,
            "totp_change",
            now,
          );
          transaction.run(
            "DELETE FROM identity_pending_totp WHERE user_id = ?",
            [input.session.userId],
          );
          return {
            value: undefined,
            auditInput: credentialChangeAudit(
              input.session.userId,
              input.correlationId,
              "identity.self_totp_change",
              counts,
            ),
          };
        }),
      });
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        ["authentication_failed", "totp_replayed"].includes(error.code)
      ) throw new EnrollmentError("authentication_failed");
      throw new EnrollmentError("enrollment_unavailable");
    }
  }
}

export interface LocalEnrollmentServiceOptions {
  repository: LocalEnrollmentRepository;
  config: IdentityConfig;
  keyRing: IdentityKeyRing;
  sessionHmacKey: Buffer;
  now?: () => number;
  random?: (size: number) => Buffer;
  uuid?: () => string;
  dummyTemporaryHash?: string;
}

export class LocalEnrollmentService {
  readonly #repository: LocalEnrollmentRepository;
  readonly #config: IdentityConfig;
  readonly #keyRing: IdentityKeyRing;
  readonly #sessionHmacKey: Buffer;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #dummyTemporaryHash: string;
  readonly #passwordPolicy: PasswordPolicy;
  readonly #loginLimiter: EnrollmentAttemptLimiter;
  readonly #passwordLimiter: EnrollmentAttemptLimiter;
  readonly #totpLimiter: EnrollmentAttemptLimiter;
  readonly #passwordInflight: InflightLimiter;
  readonly #totpInflight: InflightLimiter;

  private constructor(options: LocalEnrollmentServiceOptions & { dummyTemporaryHash: string }) {
    this.#repository = options.repository;
    this.#config = options.config;
    this.#keyRing = options.keyRing;
    if (options.sessionHmacKey.byteLength !== 32) {
      throw new EnrollmentError("enrollment_unavailable");
    }
    this.#sessionHmacKey = Buffer.from(options.sessionHmacKey);
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.#dummyTemporaryHash = options.dummyTemporaryHash;
    this.#passwordPolicy = new PasswordPolicy({
      minimumLength: options.config.password.minimumLength,
      ...(options.config.password.compromisedBlocklistFile === undefined
        ? {}
        : { operatorBlocklistFile: options.config.password.compromisedBlocklistFile }),
    });
    this.#loginLimiter = new EnrollmentAttemptLimiter(
      options.config.limits.loginAttempts,
      options.config.limits.loginWindowMs,
      this.#now,
    );
    this.#passwordLimiter = new EnrollmentAttemptLimiter(
      options.config.limits.passwordAttempts,
      options.config.limits.passwordWindowMs,
      this.#now,
    );
    this.#totpLimiter = new EnrollmentAttemptLimiter(
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

  static async create(options: LocalEnrollmentServiceOptions): Promise<LocalEnrollmentService> {
    const dummyTemporaryHash = options.dummyTemporaryHash ?? await hashPassword(
      Buffer.from(generateTemporaryPassword(options.config.password.minimumLength), "utf8"),
    );
    if (!isSupportedPasswordHash(dummyTemporaryHash)) {
      throw new EnrollmentError("enrollment_unavailable");
    }
    return new LocalEnrollmentService({ ...options, dummyTemporaryHash });
  }

  async issueInitialTemporary(
    userId: string,
    audit: IdentityAuditContext,
  ): Promise<{ temporaryPassword: string; expiresAt: number }> {
    if (!isUuidV7(userId)) throw new EnrollmentError("invalid_request");
    const temporaryPassword = generateTemporaryPassword(
      this.#config.password.minimumLength,
      this.#random,
    );
    const encodedHash = await hashPassword(Buffer.from(temporaryPassword, "utf8"));
    const now = safeNow(this.#now);
    const expiresAt = now + this.#config.temporaryPasswordTtlMs;
    await this.#repository.issueInitialTemporary({
      userId,
      encodedHash,
      expiresAt,
      audit,
    });
    return { temporaryPassword, expiresAt };
  }

  async temporaryLogin(input: unknown): Promise<RestrictedLoginResult> {
    let parsed: ReturnType<typeof parseTemporaryLogin>;
    try {
      parsed = parseTemporaryLogin(input);
    } catch {
      await this.#uniformTemporaryDenial("invalid");
      throw new EnrollmentError("authentication_failed");
    }
    const accountKey = keyedHash(
      this.#sessionHmacKey,
      ACCOUNT_DOMAIN,
      parsed.normalizedEmail,
    );
    if (
      !this.#loginLimiter.take(parsed.source, accountKey) ||
      !this.#passwordLimiter.take(parsed.source, accountKey)
    ) throw new EnrollmentError("rate_limited");
    let candidate: EnrollmentCandidate | undefined;
    try {
      candidate = await this.#repository.candidate(parsed.normalizedEmail);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
    const eligible = eligibleTemporaryCandidate(candidate, safeNow(this.#now));
    const hash = eligible?.temporaryHash ?? this.#dummyTemporaryHash;
    const release = this.#passwordInflight.acquire(parsed.source);
    if (release === undefined) throw new EnrollmentError("rate_limited");
    let valid = false;
    try {
      valid = await verifyPasswordHash(Buffer.from(parsed.temporaryPassword, "utf8"), hash);
    } finally {
      release();
    }
    if (eligible === undefined || !valid) throw new EnrollmentError("authentication_failed");
    const issuedAt = safeNow(this.#now);
    const sessionToken = opaqueValue(this.#random);
    const csrfToken = opaqueValue(this.#random);
    const material: RestrictedSessionMaterial = {
      id: this.nextUuid(),
      userId: eligible.userId,
      purpose: eligible.temporaryPurpose === "password_reset"
        ? "password_change"
        : "initial_enrollment",
      sessionHash: keyedHash(this.#sessionHmacKey, SESSION_DOMAIN, sessionToken),
      csrfHash: keyedHash(this.#sessionHmacKey, CSRF_DOMAIN, csrfToken),
      securityEpoch: eligible.securityEpoch,
      globalSecurityEpoch: eligible.globalSecurityEpoch,
      issuedAt,
      expiresAt: issuedAt + this.#config.restrictedSessionTtlMs,
    };
    await this.#repository.createRestrictedSession(eligible, material, parsed.correlationId);
    return {
      userId: eligible.userId,
      role: eligible.role,
      purpose: material.purpose as RestrictedLoginPurpose,
      sessionToken,
      csrfToken,
      expiresAt: material.expiresAt,
    };
  }

  async totpRecoveryLogin(input: unknown): Promise<RestrictedLoginResult> {
    let parsed: ReturnType<typeof parseTotpRecoveryLogin>;
    try {
      parsed = parseTotpRecoveryLogin(input);
    } catch {
      await this.#uniformTemporaryDenial("invalid");
      throw new EnrollmentError("authentication_failed");
    }
    const accountKey = keyedHash(
      this.#sessionHmacKey,
      ACCOUNT_DOMAIN,
      parsed.normalizedEmail,
    );
    if (
      !this.#loginLimiter.take(parsed.source, accountKey) ||
      !this.#passwordLimiter.take(parsed.source, accountKey)
    ) throw new EnrollmentError("rate_limited");
    let candidate: EnrollmentCandidate | undefined;
    try {
      candidate = await this.#repository.candidate(parsed.normalizedEmail);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
    const eligible = eligibleTotpRecoveryCandidate(candidate);
    const encodedHash = eligible?.passwordHash ?? this.#dummyTemporaryHash;
    const release = this.#passwordInflight.acquire(parsed.source);
    if (release === undefined) throw new EnrollmentError("rate_limited");
    let valid = false;
    try {
      valid = await verifyPasswordHash(Buffer.from(parsed.password, "utf8"), encodedHash);
    } finally {
      release();
    }
    if (eligible === undefined || !valid) throw new EnrollmentError("authentication_failed");
    const issuedAt = safeNow(this.#now);
    const sessionToken = opaqueValue(this.#random);
    const csrfToken = opaqueValue(this.#random);
    const material: RestrictedSessionMaterial = {
      id: this.nextUuid(),
      userId: eligible.userId,
      purpose: "totp_enrollment",
      sessionHash: keyedHash(this.#sessionHmacKey, SESSION_DOMAIN, sessionToken),
      csrfHash: keyedHash(this.#sessionHmacKey, CSRF_DOMAIN, csrfToken),
      securityEpoch: eligible.securityEpoch,
      globalSecurityEpoch: eligible.globalSecurityEpoch,
      issuedAt,
      expiresAt: issuedAt + this.#config.restrictedSessionTtlMs,
    };
    await this.#repository.createRestrictedSession(eligible, material, parsed.correlationId);
    return {
      userId: eligible.userId,
      role: eligible.role,
      purpose: material.purpose as RestrictedLoginPurpose,
      sessionToken,
      csrfToken,
      expiresAt: material.expiresAt,
    };
  }

  async beginInitial(
    session: ValidatedRestrictedSession,
    newPassword: unknown,
  ): Promise<{ secret: string; uri: string; expiresAt: number }> {
    if (session.purpose !== "initial_enrollment") throw new EnrollmentError("invalid_request");
    const candidate = await this.#repository.pending(session.sessionId, session.userId);
    const profile = candidate ?? await this.#initialProfile(session.userId);
    const normalized = this.#passwordPolicy.validate(newPassword, {
      email: profile.email,
      givenName: profile.givenName,
      familyName: profile.familyName,
      productName: "SecretSauce",
    });
    normalized.fill(0);
    const enrollment = beginTotpEnrollment({
      authenticatorId: this.nextUuid(),
      userId: session.userId,
      issuer: "SecretSauce",
      label: profile.email,
      keyRing: this.#keyRing,
      random: this.#random,
    });
    try {
      await this.#repository.savePendingTotp(
        session,
        enrollment.envelope,
        profile.passwordPolicyVersion,
      );
      return {
        secret: enrollment.secret,
        uri: enrollment.uri,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      throw error;
    }
  }

  async beginTotpEnrollment(
    session: ValidatedRestrictedSession,
  ): Promise<{ secret: string; uri: string; expiresAt: number }> {
    if (session.purpose !== "totp_enrollment") throw new EnrollmentError("invalid_request");
    const candidate = await this.#repository.pending(session.sessionId, session.userId);
    const profile = candidate ?? await this.#initialProfile(session.userId);
    if (profile.status !== "active") throw new EnrollmentError("authentication_failed");
    const enrollment = beginTotpEnrollment({
      authenticatorId: this.nextUuid(),
      userId: session.userId,
      issuer: "SecretSauce",
      label: profile.email,
      keyRing: this.#keyRing,
      random: this.#random,
    });
    await this.#repository.savePendingTotp(
      session,
      enrollment.envelope,
      profile.passwordPolicyVersion,
    );
    return {
      secret: enrollment.secret,
      uri: enrollment.uri,
      expiresAt: session.expiresAt,
    };
  }

  async confirmInitial(
    session: ValidatedRestrictedSession,
    input: {
      newPassword: unknown;
      totp: unknown;
      correlationId: string;
      source?: unknown;
    },
  ): Promise<void> {
    if (
      session.purpose !== "initial_enrollment" ||
      typeof input.totp !== "string" ||
      !/^\d{6}$/.test(input.totp) ||
      !validCorrelationId(input.correlationId)
    ) throw new EnrollmentError("invalid_request");
    const pending = await this.#repository.pending(session.sessionId, session.userId);
    if (pending === undefined || safeNow(this.#now) >= pending.expiresAt) {
      throw new EnrollmentError("authentication_failed");
    }
    const password = this.#passwordPolicy.validate(input.newPassword, {
      email: pending.email,
      givenName: pending.givenName,
      familyName: pending.familyName,
      productName: "SecretSauce",
    });
    const source = validAttemptSource(input.source) ? input.source : "restricted-session";
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, session.userId);
    if (!this.#passwordLimiter.take(source, accountKey)) {
      password.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releasePassword = this.#passwordInflight.acquire(source);
    if (releasePassword === undefined) {
      password.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(password);
    } finally {
      password.fill(0);
      releasePassword();
    }
    let seed: Buffer;
    try {
      const envelope = parseTotpEnvelope(JSON.parse(pending.envelopeJson));
      if (
        envelope.userId !== pending.userId ||
        envelope.authenticatorId !== pending.authenticatorId ||
        envelope.rootKeyId !== pending.rootKeyId ||
        envelope.generation !== pending.generation
      ) throw new Error("binding mismatch");
      seed = decryptTotpSeed(envelope, this.#keyRing);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
    if (!this.#totpLimiter.take(source, accountKey)) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(source);
    if (releaseTotp === undefined) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, input.totp, safeNow(this.#now));
    } finally {
      seed.fill(0);
      releaseTotp();
    }
    if (acceptedStep === undefined) throw new EnrollmentError("authentication_failed");
    await this.#repository.completeInitialEnrollment({
      session,
      pending,
      encodedHash,
      acceptedStep,
      eventId: this.nextUuid(),
      correlationId: input.correlationId,
    });
  }

  async confirmPasswordChange(
    session: ValidatedRestrictedSession,
    input: {
      newPassword: unknown;
      totp: unknown;
      correlationId: string;
      source?: unknown;
    },
  ): Promise<void> {
    if (
      session.purpose !== "password_change" ||
      typeof input.totp !== "string" ||
      !/^\d{6}$/.test(input.totp) ||
      !validCorrelationId(input.correlationId)
    ) throw new EnrollmentError("invalid_request");
    const candidate = await this.#repository.candidateByUserId(session.userId);
    if (!eligiblePasswordChangeCandidate(candidate)) {
      throw new EnrollmentError("authentication_failed");
    }
    const password = this.#passwordPolicy.validate(input.newPassword, {
      email: candidate.email,
      givenName: candidate.givenName,
      familyName: candidate.familyName,
      productName: "SecretSauce",
    });
    const source = validAttemptSource(input.source) ? input.source : "restricted-session";
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, session.userId);
    if (!this.#passwordLimiter.take(source, accountKey)) {
      password.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releasePassword = this.#passwordInflight.acquire(source);
    if (releasePassword === undefined) {
      password.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(password);
    } finally {
      password.fill(0);
      releasePassword();
    }
    const seed = this.#candidateTotpSeed(candidate);
    if (!this.#totpLimiter.take(source, accountKey)) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(source);
    if (releaseTotp === undefined) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, input.totp, safeNow(this.#now));
    } finally {
      seed.fill(0);
      releaseTotp();
    }
    if (acceptedStep === undefined) throw new EnrollmentError("authentication_failed");
    await this.#repository.completePasswordChange({
      session,
      candidate,
      encodedHash,
      acceptedStep,
      eventId: this.nextUuid(),
      correlationId: input.correlationId,
    });
  }

  async confirmTotpEnrollment(
    session: ValidatedRestrictedSession,
    input: { totp: unknown; correlationId: string; source?: unknown },
  ): Promise<void> {
    if (
      session.purpose !== "totp_enrollment" ||
      typeof input.totp !== "string" ||
      !/^\d{6}$/.test(input.totp) ||
      !validCorrelationId(input.correlationId)
    ) throw new EnrollmentError("invalid_request");
    const pending = await this.#repository.pending(session.sessionId, session.userId);
    if (pending === undefined || safeNow(this.#now) >= pending.expiresAt) {
      throw new EnrollmentError("authentication_failed");
    }
    let seed: Buffer;
    try {
      const envelope = parseTotpEnvelope(JSON.parse(pending.envelopeJson));
      if (
        envelope.userId !== pending.userId ||
        envelope.authenticatorId !== pending.authenticatorId ||
        envelope.rootKeyId !== pending.rootKeyId ||
        envelope.generation !== pending.generation
      ) throw new Error("binding mismatch");
      seed = decryptTotpSeed(envelope, this.#keyRing);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
    const source = validAttemptSource(input.source) ? input.source : "restricted-session";
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, session.userId);
    if (!this.#totpLimiter.take(source, accountKey)) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(source);
    if (releaseTotp === undefined) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, input.totp, safeNow(this.#now));
    } finally {
      seed.fill(0);
      releaseTotp();
    }
    if (acceptedStep === undefined) throw new EnrollmentError("authentication_failed");
    await this.#repository.completeTotpEnrollment({
      session,
      pending,
      acceptedStep,
      eventId: this.nextUuid(),
      correlationId: input.correlationId,
    });
  }

  async selfPasswordChange(
    browserSession: ValidatedBrowserSession,
    input: {
      currentPassword: unknown;
      currentTotp: unknown;
      newPassword: unknown;
      correlationId: string;
      source?: unknown;
    },
  ): Promise<void> {
    if (!validCorrelationId(input.correlationId)) {
      throw new EnrollmentError("invalid_request");
    }
    const candidate = await this.#repository.candidateByUserId(browserSession.userId);
    if (!eligibleConfiguredCandidate(candidate)) {
      throw new EnrollmentError("authentication_failed");
    }
    const source = validAttemptSource(input.source) ? input.source : "browser-session";
    const acceptedStep = await this.#verifyCurrentAuthenticator(
      candidate,
      input.currentPassword,
      input.currentTotp,
      source,
    );
    const password = this.#passwordPolicy.validate(input.newPassword, {
      email: candidate.email,
      givenName: candidate.givenName,
      familyName: candidate.familyName,
      productName: "SecretSauce",
    });
    const release = this.#passwordInflight.acquire(source);
    if (release === undefined) {
      password.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(password);
    } finally {
      password.fill(0);
      release();
    }
    await this.#repository.completeSelfPasswordChange({
      browserSession,
      candidate,
      encodedHash,
      acceptedStep,
      eventId: this.nextUuid(),
      correlationId: input.correlationId,
    });
  }

  async beginTotpReplacement(
    browserSession: ValidatedBrowserSession,
    input: {
      currentPassword: unknown;
      currentTotp: unknown;
      correlationId: string;
      source?: unknown;
    },
  ): Promise<{
    secret: string;
    uri: string;
    sessionToken: string;
    csrfToken: string;
    expiresAt: number;
  }> {
    if (!validCorrelationId(input.correlationId)) {
      throw new EnrollmentError("invalid_request");
    }
    const candidate = await this.#repository.candidateByUserId(browserSession.userId);
    if (!eligibleConfiguredCandidate(candidate)) {
      throw new EnrollmentError("authentication_failed");
    }
    const source = validAttemptSource(input.source) ? input.source : "browser-session";
    const acceptedStep = await this.#verifyCurrentAuthenticator(
      candidate,
      input.currentPassword,
      input.currentTotp,
      source,
    );
    const issuedAt = safeNow(this.#now);
    const sessionToken = opaqueValue(this.#random);
    const csrfToken = opaqueValue(this.#random);
    const material: RestrictedSessionMaterial = {
      id: this.nextUuid(),
      userId: browserSession.userId,
      purpose: "totp_replacement",
      sessionHash: keyedHash(this.#sessionHmacKey, SESSION_DOMAIN, sessionToken),
      csrfHash: keyedHash(this.#sessionHmacKey, CSRF_DOMAIN, csrfToken),
      securityEpoch: candidate.securityEpoch,
      globalSecurityEpoch: candidate.globalSecurityEpoch,
      issuedAt,
      expiresAt: issuedAt + this.#config.restrictedSessionTtlMs,
    };
    const enrollment = beginTotpEnrollment({
      authenticatorId: this.nextUuid(),
      userId: browserSession.userId,
      issuer: "SecretSauce",
      label: candidate.email,
      keyRing: this.#keyRing,
      random: this.#random,
    });
    await this.#repository.beginTotpReplacement({
      browserSession,
      candidate,
      material,
      envelope: enrollment.envelope,
      acceptedStep,
      correlationId: input.correlationId,
    });
    return {
      secret: enrollment.secret,
      uri: enrollment.uri,
      sessionToken,
      csrfToken,
      expiresAt: material.expiresAt,
    };
  }

  async confirmTotpReplacement(
    session: ValidatedRestrictedSession,
    input: { totp: unknown; correlationId: string; source?: unknown },
  ): Promise<void> {
    if (
      session.purpose !== "totp_replacement" ||
      typeof input.totp !== "string" ||
      !/^\d{6}$/.test(input.totp) ||
      !validCorrelationId(input.correlationId)
    ) throw new EnrollmentError("invalid_request");
    const pending = await this.#repository.pending(session.sessionId, session.userId);
    if (pending === undefined || safeNow(this.#now) >= pending.expiresAt) {
      throw new EnrollmentError("authentication_failed");
    }
    let seed: Buffer;
    try {
      const envelope = parseTotpEnvelope(JSON.parse(pending.envelopeJson));
      if (
        envelope.userId !== pending.userId ||
        envelope.authenticatorId !== pending.authenticatorId ||
        envelope.rootKeyId !== pending.rootKeyId ||
        envelope.generation !== pending.generation
      ) throw new Error("binding mismatch");
      seed = decryptTotpSeed(envelope, this.#keyRing);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
    const source = validAttemptSource(input.source) ? input.source : "restricted-session";
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, session.userId);
    if (!this.#totpLimiter.take(source, accountKey)) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const release = this.#totpInflight.acquire(source);
    if (release === undefined) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, input.totp, safeNow(this.#now));
    } finally {
      seed.fill(0);
      release();
    }
    if (acceptedStep === undefined) throw new EnrollmentError("authentication_failed");
    await this.#repository.completeTotpReplacement({
      session,
      pending,
      acceptedStep,
      eventId: this.nextUuid(),
      correlationId: input.correlationId,
    });
  }

  async #initialProfile(userId: string): Promise<PendingEnrollment> {
    const candidate = await this.#repository.candidateByUserId(userId);
    if (candidate === undefined) throw new EnrollmentError("enrollment_unavailable");
    return {
      sessionId: "",
      userId: candidate.userId,
      authenticatorId: "",
      envelopeJson: "",
      rootKeyId: "",
      generation: 1,
      expiresAt: 0,
      email: candidate.email,
      givenName: candidate.givenName,
      familyName: candidate.familyName,
      status: candidate.status,
      passwordPolicyVersion: candidate.passwordPolicyVersion,
      currentPasswordPolicyVersion: candidate.passwordPolicyVersion,
      securityEpoch: candidate.securityEpoch,
      globalSecurityEpoch: candidate.globalSecurityEpoch,
    };
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new EnrollmentError("enrollment_unavailable");
    return value;
  }

  #candidateTotpSeed(candidate: EnrollmentCandidate): Buffer {
    try {
      if (
        candidate.totpAuthenticatorId === null ||
        candidate.totpEnvelopeJson === null ||
        candidate.totpRootKeyId === null ||
        candidate.totpGeneration === null
      ) throw new Error("missing authenticator");
      const envelope = parseTotpEnvelope(JSON.parse(candidate.totpEnvelopeJson));
      if (
        envelope.userId !== candidate.userId ||
        envelope.authenticatorId !== candidate.totpAuthenticatorId ||
        envelope.rootKeyId !== candidate.totpRootKeyId ||
        envelope.generation !== candidate.totpGeneration
      ) throw new Error("binding mismatch");
      return decryptTotpSeed(envelope, this.#keyRing);
    } catch {
      throw new EnrollmentError("enrollment_unavailable");
    }
  }

  async #verifyCurrentAuthenticator(
    candidate: EnrollmentCandidate,
    passwordInput: unknown,
    totpInput: unknown,
    source: string,
  ): Promise<number> {
    if (
      typeof passwordInput !== "string" ||
      [...passwordInput].length > 1_024 ||
      Buffer.byteLength(passwordInput, "utf8") > 4_096 ||
      typeof totpInput !== "string" ||
      !/^\d{6}$/.test(totpInput) ||
      candidate.passwordHash === null
    ) throw new EnrollmentError("authentication_failed");
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, candidate.userId);
    if (!this.#passwordLimiter.take(source, accountKey)) {
      throw new EnrollmentError("rate_limited");
    }
    const releasePassword = this.#passwordInflight.acquire(source);
    if (releasePassword === undefined) throw new EnrollmentError("rate_limited");
    let passwordValid = false;
    try {
      passwordValid = await verifyPasswordHash(
        Buffer.from(passwordInput.normalize("NFKC"), "utf8"),
        candidate.passwordHash,
      );
    } finally {
      releasePassword();
    }
    const seed = this.#candidateTotpSeed(candidate);
    if (!this.#totpLimiter.take(source, accountKey)) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(source);
    if (releaseTotp === undefined) {
      seed.fill(0);
      throw new EnrollmentError("rate_limited");
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, totpInput, safeNow(this.#now));
    } finally {
      seed.fill(0);
      releaseTotp();
    }
    if (!passwordValid || acceptedStep === undefined) {
      throw new EnrollmentError("authentication_failed");
    }
    return acceptedStep;
  }

  async #uniformTemporaryDenial(source: string): Promise<void> {
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, "invalid");
    if (
      !this.#loginLimiter.take(source, accountKey) ||
      !this.#passwordLimiter.take(source, accountKey)
    ) throw new EnrollmentError("rate_limited");
    const release = this.#passwordInflight.acquire(source);
    if (release === undefined) throw new EnrollmentError("rate_limited");
    try {
      await verifyPasswordHash(Buffer.alloc(0), this.#dummyTemporaryHash);
    } finally {
      release();
    }
  }

  close(): void {
    this.#sessionHmacKey.fill(0);
  }
}

interface BoundRestrictedSession extends ValidatedRestrictedSession {
  context: ControlAuthenticationContext;
}

export class RestrictedSessionAuthenticator implements ControlAuthenticator {
  readonly #sessions = new WeakMap<FastifyRequest, BoundRestrictedSession>();
  readonly #key: Buffer;

  constructor(
    private readonly repository: LocalEnrollmentRepository,
    sessionHmacKey: Buffer,
    private readonly random: (size: number) => Buffer = randomBytes,
  ) {
    if (sessionHmacKey.byteLength !== 32) throw new Error("Invalid restricted session key.");
    this.#key = Buffer.from(sessionHmacKey);
  }

  async authenticate(request: FastifyRequest): Promise<ControlAuthenticationContext | undefined> {
    const token = request.cookies[CONTROL_ENROLLMENT_COOKIE];
    if (typeof token !== "string" || !OPAQUE_VALUE.test(token)) return undefined;
    let session: ValidatedRestrictedSession | undefined;
    try {
      session = await this.repository.restrictedSession(
        keyedHash(this.#key, SESSION_DOMAIN, token),
      );
    } catch {
      return undefined;
    }
    if (session === undefined) return undefined;
    const context: ControlAuthenticationContext = {
      method: "restricted_session",
      principalId: session.userId,
      role: session.role,
    };
    this.#sessions.set(request, { ...session, context });
    return context;
  }

  async verifyCsrf(
    context: ControlAuthenticationContext,
    proof: string,
    request: FastifyRequest,
  ): Promise<boolean> {
    const session = this.#sessions.get(request);
    return session !== undefined &&
      session.context === context &&
      OPAQUE_VALUE.test(proof) &&
      constantTimeHexEqual(
        keyedHash(this.#key, CSRF_DOMAIN, proof),
        session.csrfHash,
      );
  }

  session(request: FastifyRequest): ValidatedRestrictedSession | undefined {
    return this.#sessions.get(request);
  }

  async rotateCsrf(request: FastifyRequest): Promise<string> {
    const session = this.#sessions.get(request);
    if (session === undefined) throw new EnrollmentError("authentication_failed");
    const token = opaqueValue(this.random);
    const hash = keyedHash(this.#key, CSRF_DOMAIN, token);
    await this.repository.rotateCsrf(session.sessionId, session.userId, hash);
    session.csrfHash = hash;
    return token;
  }

  close(): void {
    this.#key.fill(0);
  }
}

export class LocalControlAuthenticator implements ControlAuthenticator {
  constructor(
    private readonly browser: ControlAuthenticator,
    private readonly restricted: ControlAuthenticator,
  ) {}

  async authenticate(request: FastifyRequest): Promise<ControlAuthenticationContext | undefined> {
    const methods = (
      request.routeOptions.config as {
        controlSecurity?: { authenticationMethods?: readonly string[] };
      }
    ).controlSecurity?.authenticationMethods;
    if (methods?.includes("restricted_session") && !methods.includes("browser_session")) {
      return this.restricted.authenticate(request);
    }
    if (methods?.includes("browser_session") && !methods.includes("restricted_session")) {
      return this.browser.authenticate(request);
    }
    return await this.browser.authenticate(request) ?? this.restricted.authenticate(request);
  }

  async verifyCsrf(
    context: ControlAuthenticationContext,
    proof: string,
    request: FastifyRequest,
  ): Promise<boolean> {
    return context.method === "restricted_session"
      ? this.restricted.verifyCsrf(context, proof, request)
      : this.browser.verifyCsrf(context, proof, request);
  }
}

function parseTemporaryLogin(value: unknown): {
  normalizedEmail: string;
  temporaryPassword: string;
  source: string;
  correlationId: string;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new EnrollmentError("authentication_failed");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 4 ||
    typeof input.email !== "string" ||
    typeof input.temporaryPassword !== "string" ||
    typeof input.source !== "string" ||
    typeof input.correlationId !== "string" ||
    [...input.temporaryPassword].length > 1_024 ||
    Buffer.byteLength(input.temporaryPassword, "utf8") > 4_096 ||
    input.source.length < 1 ||
    input.source.length > 128 ||
    !validCorrelationId(input.correlationId)
  ) throw new EnrollmentError("authentication_failed");
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeEmail(input.email);
  } catch {
    throw new EnrollmentError("authentication_failed");
  }
  return {
    normalizedEmail,
    temporaryPassword: input.temporaryPassword.normalize("NFKC"),
    source: input.source,
    correlationId: input.correlationId,
  };
}

function parseTotpRecoveryLogin(value: unknown): {
  normalizedEmail: string;
  password: string;
  source: string;
  correlationId: string;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new EnrollmentError("authentication_failed");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 4 ||
    typeof input.email !== "string" ||
    typeof input.password !== "string" ||
    typeof input.source !== "string" ||
    typeof input.correlationId !== "string" ||
    [...input.password].length > 1_024 ||
    Buffer.byteLength(input.password, "utf8") > 4_096 ||
    !validAttemptSource(input.source) ||
    !validCorrelationId(input.correlationId)
  ) throw new EnrollmentError("authentication_failed");
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeEmail(input.email);
  } catch {
    throw new EnrollmentError("authentication_failed");
  }
  return {
    normalizedEmail,
    password: input.password.normalize("NFKC"),
    source: input.source,
    correlationId: input.correlationId,
  };
}

function validAttemptSource(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128;
}

function validRestrictedState(
  purpose: RestrictedSessionPurpose,
  status: string,
  passwordState: string,
  totpState: string,
): boolean {
  if (purpose === "initial_enrollment") {
    return ["invited", "enrollment_required"].includes(status) &&
      passwordState === "temporary" &&
      totpState === "not_configured";
  }
  if (purpose === "password_change") {
    return status === "active" &&
      passwordState === "temporary" &&
      totpState === "configured";
  }
  if (purpose === "totp_enrollment") {
    return status === "active" &&
      passwordState === "configured" &&
      totpState === "not_configured";
  }
  if (purpose === "totp_replacement") {
    return status === "active" &&
      passwordState === "configured" &&
      totpState === "configured";
  }
  return false;
}

class EnrollmentAttemptLimiter {
  readonly #entries = new Map<string, { count: number; startedAt: number; seenAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    readonly now: () => number,
  ) {}

  take(source: string, account: string): boolean {
    const now = safeNow(this.now);
    this.sweep(now);
    const sourceEntry = this.current(`s:${source}`, now);
    const accountEntry = this.current(`a:${account}`, now);
    if (sourceEntry.count >= this.limit || accountEntry.count >= this.limit) return false;
    sourceEntry.count += 1;
    sourceEntry.seenAt = now;
    accountEntry.count += 1;
    accountEntry.seenAt = now;
    return true;
  }

  private current(
    key: string,
    now: number,
  ): { count: number; startedAt: number; seenAt: number } {
    const existing = this.#entries.get(key);
    if (existing !== undefined && now - existing.startedAt < this.windowMs) return existing;
    const created = { count: 0, startedAt: now, seenAt: now };
    this.#entries.set(key, created);
    return created;
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (now - entry.seenAt >= this.windowMs) this.#entries.delete(key);
    }
    while (this.#entries.size > 20_000) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }
}

function eligibleTemporaryCandidate(
  candidate: EnrollmentCandidate | undefined,
  now: number,
): (EnrollmentCandidate & {
  temporaryHash: string;
  temporaryVersion: number;
  temporaryPurpose: "initial_enrollment" | "password_reset";
}) | undefined {
  const initial = candidate !== undefined &&
    ["invited", "enrollment_required"].includes(candidate.status) &&
    candidate.passwordState === "temporary" &&
    candidate.totpState === "not_configured" &&
    candidate.temporaryPurpose === "initial_enrollment";
  const passwordReset = candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "temporary" &&
    candidate.totpState === "configured" &&
    candidate.temporaryPurpose === "password_reset";
  return candidate !== undefined &&
    (initial || passwordReset) &&
    candidate.temporaryHash !== null &&
    candidate.temporaryVersion !== null &&
    candidate.temporaryExpiresAt !== null &&
    candidate.temporaryExpiresAt > now &&
    candidate.temporaryConsumedAt === null &&
    candidate.temporaryRevokedAt === null
      ? candidate as EnrollmentCandidate & {
          temporaryHash: string;
          temporaryVersion: number;
          temporaryPurpose: "initial_enrollment" | "password_reset";
        }
      : undefined;
}

function eligibleTotpRecoveryCandidate(
  candidate: EnrollmentCandidate | undefined,
): (EnrollmentCandidate & { passwordHash: string; passwordVersion: number }) | undefined {
  return candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "configured" &&
    candidate.totpState === "not_configured" &&
    candidate.passwordHash !== null &&
    candidate.passwordVersion !== null
      ? candidate as EnrollmentCandidate & { passwordHash: string; passwordVersion: number }
      : undefined;
}

function eligiblePasswordChangeCandidate(
  candidate: EnrollmentCandidate | undefined,
): candidate is EnrollmentCandidate {
  return candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "temporary" &&
    candidate.totpState === "configured" &&
    candidate.temporaryPurpose === "password_reset" &&
    candidate.temporaryConsumedAt !== null &&
    candidate.temporaryRevokedAt === null &&
    candidate.totpAuthenticatorId !== null &&
    candidate.totpEnvelopeJson !== null &&
    candidate.totpRootKeyId !== null &&
    candidate.totpGeneration !== null;
}

function eligibleConfiguredCandidate(
  candidate: EnrollmentCandidate | undefined,
): candidate is EnrollmentCandidate {
  return candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "configured" &&
    candidate.totpState === "configured" &&
    candidate.passwordHash !== null &&
    candidate.passwordVersion !== null &&
    candidate.totpAuthenticatorId !== null &&
    candidate.totpEnvelopeJson !== null &&
    candidate.totpRootKeyId !== null &&
    candidate.totpGeneration !== null;
}

function requiredEnrollmentCandidate(
  transaction: PersistenceTransaction,
  userId: string,
): EnrollmentCandidate {
  const row = transaction.get<EnrollmentCandidate>(`
    SELECT
      u.id AS userId, u.email, u.given_name AS givenName,
      u.family_name AS familyName, u.role, u.status,
      u.security_epoch AS securityEpoch,
      sec.global_security_epoch AS globalSecurityEpoch,
      u.password_policy_version AS passwordPolicyVersion,
      a.password_state AS passwordState, a.totp_state AS totpState,
      tp.encoded_hash AS temporaryHash,
      tp.purpose AS temporaryPurpose,
      tp.expires_at AS temporaryExpiresAt,
      tp.consumed_at AS temporaryConsumedAt,
      tp.revoked_at AS temporaryRevokedAt,
      tp.version AS temporaryVersion,
      pw.encoded_hash AS passwordHash, pw.version AS passwordVersion,
      ta.id AS totpAuthenticatorId, ta.envelope_json AS totpEnvelopeJson,
      ta.root_key_id AS totpRootKeyId, ta.generation AS totpGeneration,
      a.version AS authenticatorVersion
    FROM users u
    JOIN identity_security_state sec ON sec.singleton = 1
    JOIN local_authenticator_states a ON a.user_id = u.id
    LEFT JOIN identity_temporary_passwords tp ON tp.user_id = u.id
    LEFT JOIN local_password_credentials pw ON pw.user_id = u.id
    LEFT JOIN local_totp_authenticators ta ON ta.user_id = u.id
    WHERE u.id = ?
  `, [userId]);
  if (row === undefined) throw new PersistenceError("authentication_failed");
  return row;
}

function sameTemporaryCandidate(
  current: EnrollmentCandidate,
  candidate: EnrollmentCandidate,
  purpose: RestrictedSessionPurpose,
  now: number,
): boolean {
  const temporaryPurpose = purpose === "password_change"
    ? "password_reset"
    : "initial_enrollment";
  const totpState = purpose === "password_change" ? "configured" : "not_configured";
  return current.status === candidate.status &&
    current.securityEpoch === candidate.securityEpoch &&
    current.globalSecurityEpoch === candidate.globalSecurityEpoch &&
    current.passwordState === "temporary" &&
    current.totpState === totpState &&
    current.temporaryHash === candidate.temporaryHash &&
    current.temporaryPurpose === temporaryPurpose &&
    current.temporaryExpiresAt !== null &&
    current.temporaryExpiresAt > now &&
    current.temporaryConsumedAt === null &&
    current.temporaryRevokedAt === null &&
    current.temporaryVersion === candidate.temporaryVersion;
}

function sameTotpRecoveryCandidate(
  current: EnrollmentCandidate,
  candidate: EnrollmentCandidate,
): boolean {
  return current.status === "active" &&
    current.status === candidate.status &&
    current.securityEpoch === candidate.securityEpoch &&
    current.globalSecurityEpoch === candidate.globalSecurityEpoch &&
    current.passwordState === "configured" &&
    current.totpState === "not_configured" &&
    current.passwordHash === candidate.passwordHash &&
    current.passwordVersion === candidate.passwordVersion &&
    current.authenticatorVersion === candidate.authenticatorVersion;
}

function samePasswordChangeCandidate(
  current: EnrollmentCandidate,
  candidate: EnrollmentCandidate,
): boolean {
  return eligiblePasswordChangeCandidate(current) &&
    current.securityEpoch === candidate.securityEpoch &&
    current.globalSecurityEpoch === candidate.globalSecurityEpoch &&
    current.passwordPolicyVersion === candidate.passwordPolicyVersion &&
    current.temporaryHash === candidate.temporaryHash &&
    current.temporaryVersion === candidate.temporaryVersion &&
    current.totpAuthenticatorId === candidate.totpAuthenticatorId &&
    current.totpEnvelopeJson === candidate.totpEnvelopeJson &&
    current.totpGeneration === candidate.totpGeneration &&
    current.authenticatorVersion === candidate.authenticatorVersion;
}

function sameConfiguredCandidate(
  current: EnrollmentCandidate,
  candidate: EnrollmentCandidate,
): boolean {
  return eligibleConfiguredCandidate(current) &&
    current.securityEpoch === candidate.securityEpoch &&
    current.globalSecurityEpoch === candidate.globalSecurityEpoch &&
    current.passwordPolicyVersion === candidate.passwordPolicyVersion &&
    current.passwordHash === candidate.passwordHash &&
    current.passwordVersion === candidate.passwordVersion &&
    current.totpAuthenticatorId === candidate.totpAuthenticatorId &&
    current.totpEnvelopeJson === candidate.totpEnvelopeJson &&
    current.totpGeneration === candidate.totpGeneration &&
    current.authenticatorVersion === candidate.authenticatorVersion;
}

function acceptTotpStep(
  transaction: PersistenceTransaction,
  userId: string,
  acceptedStep: number,
  now: number,
): void {
  if (transaction.get<{ present: number }>(
    "SELECT 1 AS present FROM accepted_totp_steps WHERE user_id = ? AND time_step = ?",
    [userId, acceptedStep],
  ) !== undefined) throw new PersistenceError("totp_replayed");
  transaction.run(`
    INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
    VALUES (?, ?, 'confirmation', ?)
  `, [userId, acceptedStep, now]);
}

function finalizeCredentialChange(
  transaction: PersistenceTransaction,
  userId: string,
  eventId: string,
  reason: "password_change" | "totp_change",
  now: number,
): { browserSessionsRevoked: number; restrictedSessionsRevoked: number } {
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
  const epoch = transaction.run(`
    UPDATE users
    SET security_epoch = security_epoch + 1, version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'active'
  `, [now, userId]);
  if (epoch.changes !== 1) throw new PersistenceError("authentication_failed");
  transaction.run(`
    INSERT INTO identity_invalidation_events (
      id, user_id, reason, browser_sessions_revoked,
      restricted_sessions_revoked, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
  `, [
    eventId,
    userId,
    reason,
    browserSessionsRevoked,
    restrictedSessionsRevoked,
    now,
  ]);
  return { browserSessionsRevoked, restrictedSessionsRevoked };
}

function credentialChangeAudit(
  userId: string,
  correlationId: string,
  action: string,
  counts: { browserSessionsRevoked: number; restrictedSessionsRevoked: number },
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "system",
      label: `user:${userId}`,
      authenticationMethod: "restricted_session",
    },
    action,
    result: "allow",
    target: { type: "user", id: userId, label: `user:${userId}` },
    changes: [
      { field: "security_epoch", after: "incremented" },
      { field: "browser_sessions_revoked", after: counts.browserSessionsRevoked },
      { field: "restricted_sessions_revoked", after: counts.restrictedSessionsRevoked },
    ],
    correlationId,
    source: { category: "identity" },
  };
}

function requireCurrentBrowserSession(
  transaction: PersistenceTransaction,
  session: ValidatedBrowserSession,
  now: number,
): void {
  const current = transaction.get<{
    user_id: string;
    role: string;
    status: string;
    password_state: string;
    totp_state: string;
    issued_security_epoch: number;
    issued_global_epoch: number;
    security_epoch: number;
    global_security_epoch: number;
    absolute_expires_at: number;
    revoked_at: number | null;
  }>(`
    SELECT
      bs.user_id, u.role, u.status, a.password_state, a.totp_state,
      bs.issued_security_epoch, bs.issued_global_epoch,
      u.security_epoch, sec.global_security_epoch,
      bs.absolute_expires_at, bs.revoked_at
    FROM browser_sessions bs
    JOIN users u ON u.id = bs.user_id
    JOIN local_authenticator_states a ON a.user_id = u.id
    JOIN identity_security_state sec ON sec.singleton = 1
    WHERE bs.id = ?
  `, [session.sessionId]);
  if (
    current === undefined ||
    current.user_id !== session.userId ||
    current.role !== session.role ||
    current.status !== "active" ||
    current.password_state !== "configured" ||
    current.totp_state !== "configured" ||
    current.issued_security_epoch !== current.security_epoch ||
    current.issued_global_epoch !== current.global_security_epoch ||
    current.absolute_expires_at !== session.absoluteExpiresAt ||
    current.absolute_expires_at <= now ||
    current.revoked_at !== null
  ) throw new PersistenceError("authentication_failed");
}

function browserAuditActor(
  session: ValidatedBrowserSession,
): AdministrativeAuditEventInput["actor"] {
  return {
    type: "browser_session",
    id: session.userId,
    label: `user:${session.userId}`,
    role: session.role,
    authenticationMethod: "browser_session",
  };
}

function browserCredentialChangeAudit(
  session: ValidatedBrowserSession,
  correlationId: string,
  action: string,
  counts: { browserSessionsRevoked: number; restrictedSessionsRevoked: number },
): AdministrativeAuditEventInput {
  return {
    ...credentialChangeAudit(session.userId, correlationId, action, counts),
    actor: browserAuditActor(session),
  };
}

function requireCurrentRestrictedSession(
  transaction: PersistenceTransaction,
  session: ValidatedRestrictedSession,
  now: number,
): void {
  const row = transaction.get<{
    user_id: string;
    purpose: string;
    issued_security_epoch: number;
    issued_global_epoch: number;
    security_epoch: number;
    global_security_epoch: number;
    expires_at: number;
    revoked_at: number | null;
  }>(`
    SELECT
      rs.user_id, rs.purpose, rs.issued_security_epoch, rs.issued_global_epoch,
      u.security_epoch, sec.global_security_epoch, rs.expires_at, rs.revoked_at
    FROM identity_restricted_sessions rs
    JOIN users u ON u.id = rs.user_id
    JOIN identity_security_state sec ON sec.singleton = 1
    WHERE rs.id = ?
  `, [session.sessionId]);
  if (
    row === undefined ||
    row.user_id !== session.userId ||
    row.purpose !== session.purpose ||
    row.issued_security_epoch !== row.security_epoch ||
    row.issued_global_epoch !== row.global_security_epoch ||
    row.expires_at !== session.expiresAt ||
    row.expires_at <= now ||
    row.revoked_at !== null
  ) throw new PersistenceError("authentication_failed");
}

function requiredPending(
  transaction: PersistenceTransaction,
  pending: PendingEnrollment,
  now: number,
): PendingEnrollment {
  const current = transaction.get<PendingEnrollment>(`
    SELECT
      p.restricted_session_id AS sessionId, p.user_id AS userId,
      p.authenticator_id AS authenticatorId, p.envelope_json AS envelopeJson,
      p.root_key_id AS rootKeyId, p.generation, p.expires_at AS expiresAt,
      u.email, u.given_name AS givenName, u.family_name AS familyName,
      u.status, p.password_policy_version AS passwordPolicyVersion,
      u.password_policy_version AS currentPasswordPolicyVersion,
      u.security_epoch AS securityEpoch,
      sec.global_security_epoch AS globalSecurityEpoch
    FROM identity_pending_totp p
    JOIN users u ON u.id = p.user_id
    JOIN identity_security_state sec ON sec.singleton = 1
    WHERE p.restricted_session_id = ? AND p.user_id = ?
  `, [pending.sessionId, pending.userId]);
  if (
    current === undefined ||
    current.authenticatorId !== pending.authenticatorId ||
    current.envelopeJson !== pending.envelopeJson ||
    current.rootKeyId !== pending.rootKeyId ||
    current.generation !== pending.generation ||
    current.expiresAt !== pending.expiresAt ||
    current.expiresAt <= now ||
    current.status !== pending.status ||
    current.currentPasswordPolicyVersion !== current.passwordPolicyVersion
  ) throw new PersistenceError("authentication_failed");
  return current;
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function opaqueValue(random: (size: number) => Buffer): string {
  const value = random(SESSION_BYTES);
  try {
    if (!Buffer.isBuffer(value) || value.byteLength !== SESSION_BYTES) {
      throw new EnrollmentError("enrollment_unavailable");
    }
    return value.toString("base64url");
  } finally {
    value?.fill?.(0);
  }
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EnrollmentError("enrollment_unavailable");
  }
  return value;
}

function validCorrelationId(value: string): boolean {
  return /^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
