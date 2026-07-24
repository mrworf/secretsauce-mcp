import { createHmac, randomBytes } from "node:crypto";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import type { SecuritySettings } from "../securitySettings.js";
import { InflightLimiter } from "../inflightLimiter.js";
import type { IdentityAuditContext } from "./repository.js";
import {
  hashPassword,
  isSupportedPasswordHash,
  PasswordPolicy,
  PasswordPolicyError,
  verifyPasswordHash,
} from "./password.js";
import {
  IdentityKeyRing,
  decryptTotpSeed,
  parseTotpEnvelope,
  type TotpEnvelope,
  verifyTotpCode,
} from "./totp.js";
import { normalizeEmail } from "./validation.js";

const SESSION_VALUE_BYTES = 32;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_DOMAIN = "secretsauce.browser-session.v1";
const CSRF_DOMAIN = "secretsauce.browser-csrf.v1";
const RESTRICTED_SESSION_DOMAIN = "secretsauce.restricted-session.v1";
const RESTRICTED_CSRF_DOMAIN = "secretsauce.restricted-csrf.v1";
const ACCOUNT_DOMAIN = "secretsauce.login-account.v1";

export class LocalAuthenticationError extends Error {
  constructor(readonly code: "authentication_failed" | "rate_limited" | "authentication_unavailable") {
    super(
      code === "rate_limited"
        ? "Authentication is temporarily unavailable."
        : "Authentication failed.",
    );
    this.name = "LocalAuthenticationError";
  }
}

export interface LoginCandidate {
  userId: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  passwordState: string;
  totpState: string;
  encodedHash: string | null;
  passwordVersion: number | null;
  credentialPolicyVersion: number | null;
  credentialPasswordChangeEpoch: number | null;
  currentPasswordPolicyVersion: number;
  currentPasswordChangeEpoch: number;
  email: string;
  givenName: string;
  familyName: string;
  totpAuthenticatorId: string | null;
  totpEnvelopeJson: string | null;
  totpGeneration: number | null;
}

type EligibleLoginCandidate = LoginCandidate & {
  encodedHash: string;
  passwordVersion: number;
  totpAuthenticatorId: string;
  totpEnvelopeJson: string;
  totpGeneration: number;
  credentialPolicyVersion: number;
  credentialPasswordChangeEpoch: number;
};

export interface BrowserSessionMaterial {
  id: string;
  sessionHash: string;
  csrfHash: string;
  roleClass: "admin" | "user";
  securityEpoch: number;
  globalSecurityEpoch: number;
  absoluteMs: number;
  inactivityMs: number;
  issuedAt: number;
}

interface PolicyRestrictedSessionMaterial {
  id: string;
  sessionHash: string;
  csrfHash: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  issuedAt: number;
  expiresAt: number;
}

export interface LoginResult {
  sessionId: string;
  userId: string;
  role: "superadmin" | "admin" | "user";
  sessionToken: string;
  csrfToken: string;
  issuedAt: number;
  absoluteExpiresAt: number;
  purpose?: "password_change";
}

export interface LocalMcpAuthenticationProof {
  userId: string;
  role: "superadmin" | "admin" | "user";
  securityEpoch: number;
  globalSecurityEpoch: number;
  acceptedTotpStep: number;
  verifiedAt: number;
  correlationId: string;
}

export interface LocalAuthenticationRepositoryOptions {
  now?: () => number;
}

export class LocalAuthenticationRepository {
  readonly #owner: PersistenceOwner;
  readonly #now: () => number;

  constructor(owner: PersistenceOwner, options: LocalAuthenticationRepositoryOptions = {}) {
    this.#owner = owner;
    this.#now = options.now ?? Date.now;
  }

  async provisionConfiguredAuthenticator(
    input: {
      userId: string;
      encodedHash: string;
      envelope: unknown;
    },
    audit: IdentityAuditContext,
  ): Promise<void> {
    if (!isUuidV7(input.userId) || !isSupportedPasswordHash(input.encodedHash)) {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    const envelope = parseTotpEnvelope(input.envelope);
    if (envelope.userId !== input.userId) {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    const now = safeTimestamp(this.#now);
    try {
      await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const user = transaction.get<{
            id: string;
            password_policy_version: number;
            password_change_epoch: number;
          }>(`
            SELECT u.id, s.password_policy_version,
              s.password_change_epoch
            FROM users u
            JOIN identity_security_state s ON s.singleton = 1
            WHERE u.id = ?
          `,
            [input.userId],
          );
          if (user === undefined) throw new PersistenceError("identity_not_found");
          transaction.run(`
            INSERT INTO local_password_credentials (
              user_id, encoded_hash, policy_version, password_change_epoch,
              version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              encoded_hash = excluded.encoded_hash,
              policy_version = excluded.policy_version,
              password_change_epoch = excluded.password_change_epoch,
              version = local_password_credentials.version + 1,
              updated_at = excluded.updated_at
          `, [
            input.userId,
            input.encodedHash,
            user.password_policy_version,
            user.password_change_epoch,
            now,
            now,
          ]);
          transaction.run(`
            INSERT INTO local_totp_authenticators (
              id, user_id, envelope_json, root_key_id, generation,
              confirmed_at, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              id = excluded.id,
              envelope_json = excluded.envelope_json,
              root_key_id = excluded.root_key_id,
              generation = excluded.generation,
              confirmed_at = excluded.confirmed_at,
              version = local_totp_authenticators.version + 1,
              updated_at = excluded.updated_at
          `, [
            envelope.authenticatorId,
            input.userId,
            JSON.stringify(envelope),
            envelope.rootKeyId,
            envelope.generation,
            now,
            now,
            now,
          ]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'configured', totp_state = 'configured',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, input.userId]);
          return {
            value: undefined,
            auditInput: successfulAudit(audit, input.userId, "identity.authenticator_configure", [
              { field: "local_authenticator", after: "configured" },
            ]),
          };
        }),
      });
    } catch {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
  }

  async candidate(normalizedEmail: string): Promise<LoginCandidate | undefined> {
    return this.#owner.execute({
      run: (database) => database.read((query) => query.get<LoginCandidate>(`
        SELECT
          u.id AS userId,
          u.role AS role,
          u.status AS status,
          u.security_epoch AS securityEpoch,
          s.global_security_epoch AS globalSecurityEpoch,
          a.password_state AS passwordState,
          a.totp_state AS totpState,
          p.encoded_hash AS encodedHash,
          p.version AS passwordVersion,
          p.policy_version AS credentialPolicyVersion,
          p.password_change_epoch AS credentialPasswordChangeEpoch,
          s.password_policy_version AS currentPasswordPolicyVersion,
          s.password_change_epoch AS currentPasswordChangeEpoch,
          u.email AS email, u.given_name AS givenName,
          u.family_name AS familyName,
          t.id AS totpAuthenticatorId,
          t.envelope_json AS totpEnvelopeJson,
          t.generation AS totpGeneration
        FROM users u
        JOIN identity_security_state s ON s.singleton = 1
        JOIN local_authenticator_states a ON a.user_id = u.id
        LEFT JOIN local_password_credentials p ON p.user_id = u.id
        LEFT JOIN local_totp_authenticators t ON t.user_id = u.id
        WHERE u.normalized_email = ?
      `, [normalizedEmail])),
    });
  }

  async candidateByUserId(userId: string): Promise<LoginCandidate | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.#owner.execute({
      run: (database) => database.read((query) => query.get<LoginCandidate>(`
        SELECT
          u.id AS userId,
          u.role AS role,
          u.status AS status,
          u.security_epoch AS securityEpoch,
          s.global_security_epoch AS globalSecurityEpoch,
          a.password_state AS passwordState,
          a.totp_state AS totpState,
          p.encoded_hash AS encodedHash,
          p.version AS passwordVersion,
          p.policy_version AS credentialPolicyVersion,
          p.password_change_epoch AS credentialPasswordChangeEpoch,
          s.password_policy_version AS currentPasswordPolicyVersion,
          s.password_change_epoch AS currentPasswordChangeEpoch,
          u.email AS email, u.given_name AS givenName,
          u.family_name AS familyName,
          t.id AS totpAuthenticatorId,
          t.envelope_json AS totpEnvelopeJson,
          t.generation AS totpGeneration
        FROM users u
        JOIN identity_security_state s ON s.singleton = 1
        JOIN local_authenticator_states a ON a.user_id = u.id
        LEFT JOIN local_password_credentials p ON p.user_id = u.id
        LEFT JOIN local_totp_authenticators t ON t.user_id = u.id
        WHERE u.id = ?
      `, [userId])),
    });
  }

  async commitLogin(input: {
    candidate: LoginCandidate;
    encodedHash: string;
    envelopeJson: string;
    acceptedStep: number;
    session: BrowserSessionMaterial;
    correlationId: string;
    advancePolicy: boolean;
  }): Promise<void> {
    try {
      await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentEligibleCandidate(transaction, input);
          if (input.advancePolicy) {
            advancePasswordPolicy(transaction, input.candidate, input.session.issuedAt);
          }
          if (transaction.get<{ present: number }>(
            "SELECT 1 AS present FROM accepted_totp_steps WHERE user_id = ? AND time_step = ?",
            [input.candidate.userId, input.acceptedStep],
          ) !== undefined) {
            throw new PersistenceError("totp_replayed");
          }
          transaction.run(`
            INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
            VALUES (?, ?, 'login', ?)
          `, [input.candidate.userId, input.acceptedStep, input.session.issuedAt]);
          transaction.run(`
            INSERT INTO browser_sessions (
              id, user_id, session_hash, csrf_hash, role_class,
              issued_security_epoch, issued_global_epoch,
              issued_absolute_ms, issued_inactivity_ms,
              issued_at, last_activity_at, absolute_expires_at,
              step_up_at, revoked_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
          `, [
            input.session.id,
            input.candidate.userId,
            input.session.sessionHash,
            input.session.csrfHash,
            input.session.roleClass,
            input.session.securityEpoch,
            input.session.globalSecurityEpoch,
            input.session.absoluteMs,
            input.session.inactivityMs,
            input.session.issuedAt,
            input.session.issuedAt,
            input.session.issuedAt + input.session.absoluteMs,
          ]);
          transaction.run(`
            UPDATE users
            SET last_login_at = ?, last_authenticated_at = ?, updated_at = ?
            WHERE id = ?
          `, [
            input.session.issuedAt,
            input.session.issuedAt,
            input.session.issuedAt,
            input.candidate.userId,
          ]);
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "browser_session",
                id: input.candidate.userId,
                label: `user:${input.candidate.userId}`,
                role: input.candidate.role,
                authenticationMethod: "local_password_totp",
              },
              action: "identity.login",
              result: "allow",
              target: {
                type: "user",
                id: input.candidate.userId,
                label: `user:${input.candidate.userId}`,
              },
              changes: [{ field: "session", after: "created" }],
              correlationId: input.correlationId,
              source: { category: "authentication" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "totp_replayed") {
        throw new LocalAuthenticationError("authentication_failed");
      }
      throw new LocalAuthenticationError("authentication_unavailable");
    }
  }

  async commitPolicyRestrictedLogin(input: {
    candidate: EligibleLoginCandidate;
    encodedHash: string;
    envelopeJson: string;
    acceptedStep: number;
    session: PolicyRestrictedSessionMaterial;
    correlationId: string;
  }): Promise<void> {
    try {
      await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireCurrentEligibleCandidate(transaction, input);
          if (transaction.get<{ present: number }>(
            "SELECT 1 AS present FROM accepted_totp_steps WHERE user_id = ? AND time_step = ?",
            [input.candidate.userId, input.acceptedStep],
          ) !== undefined) throw new PersistenceError("totp_replayed");
          transaction.run(`
            INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
            VALUES (?, ?, 'login', ?)
          `, [input.candidate.userId, input.acceptedStep, input.session.issuedAt]);
          transaction.run(`
            UPDATE identity_restricted_sessions
            SET revoked_at = ?, version = version + 1
            WHERE user_id = ? AND revoked_at IS NULL
          `, [input.session.issuedAt, input.candidate.userId]);
          transaction.run(`
            INSERT INTO identity_restricted_sessions (
              id, user_id, purpose, session_hash, csrf_hash,
              issued_security_epoch, issued_global_epoch,
              issued_at, expires_at, revoked_at, version
            ) VALUES (?, ?, 'password_change', ?, ?, ?, ?, ?, ?, NULL, 1)
          `, [
            input.session.id,
            input.candidate.userId,
            input.session.sessionHash,
            input.session.csrfHash,
            input.session.securityEpoch,
            input.session.globalSecurityEpoch,
            input.session.issuedAt,
            input.session.expiresAt,
          ]);
          transaction.run(`
            UPDATE users
            SET last_authenticated_at = ?, updated_at = ?
            WHERE id = ?
          `, [
            input.session.issuedAt,
            input.session.issuedAt,
            input.candidate.userId,
          ]);
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "browser_session",
                id: input.candidate.userId,
                label: `user:${input.candidate.userId}`,
                role: input.candidate.role,
                authenticationMethod: "local_password_totp",
              },
              action: "identity.login",
              result: "allow",
              target: {
                type: "user",
                id: input.candidate.userId,
                label: `user:${input.candidate.userId}`,
              },
              changes: [
                { field: "restricted_session", after: "password_change" },
              ],
              correlationId: input.correlationId,
              source: { category: "authentication" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "totp_replayed") {
        throw new LocalAuthenticationError("authentication_failed");
      }
      throw new LocalAuthenticationError("authentication_unavailable");
    }
  }

  async recordDenied(correlationId: string, failureCode: "invalid" | "limited" | "unavailable"): Promise<void> {
    await this.#owner.execute({
      run: (database) => {
        database.appendAdministrativeAudit({
          actor: {
            type: "system",
            label: "anonymous-local-login",
            authenticationMethod: "local_password_totp",
          },
          action: "identity.login",
          result: "deny",
          target: { type: "authentication", label: "local-login" },
          correlationId,
          source: { category: "authentication" },
          failureCode: `authentication.${failureCode}`,
        } satisfies AdministrativeAuditEventInput);
      },
    });
  }
}

export interface LocalAuthenticationServiceOptions {
  repository: LocalAuthenticationRepository;
  config: IdentityConfig;
  keyRing: IdentityKeyRing;
  sessionHmacKey: Buffer;
  now?: () => number;
  random?: (size: number) => Buffer;
  uuid?: () => string;
  dummyPasswordHash?: string;
  dummyTotpSeed?: Buffer;
  securitySettings?: () => SecuritySettings;
}

export class LocalAuthenticationService {
  readonly #repository: LocalAuthenticationRepository;
  readonly #config: IdentityConfig;
  readonly #keyRing: IdentityKeyRing;
  readonly #sessionHmacKey: Buffer;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #dummyPasswordHash: string;
  readonly #dummyTotpSeed: Buffer;
  readonly #loginLimiter: DualWindowLimiter;
  readonly #passwordLimiter: DualWindowLimiter;
  readonly #totpLimiter: DualWindowLimiter;
  readonly #passwordInflight: InflightLimiter;
  readonly #totpInflight: InflightLimiter;
  readonly #securitySettings: (() => SecuritySettings) | undefined;
  #passwordPolicy: PasswordPolicy | undefined;
  #passwordPolicyKey = "";

  private constructor(options: LocalAuthenticationServiceOptions & {
    dummyPasswordHash: string;
    dummyTotpSeed: Buffer;
  }) {
    this.#repository = options.repository;
    this.#config = options.config;
    this.#keyRing = options.keyRing;
    this.#sessionHmacKey = Buffer.from(options.sessionHmacKey);
    if (this.#sessionHmacKey.byteLength !== 32) {
      this.#sessionHmacKey.fill(0);
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.#dummyPasswordHash = options.dummyPasswordHash;
    this.#dummyTotpSeed = Buffer.from(options.dummyTotpSeed);
    this.#securitySettings = options.securitySettings;
    this.#loginLimiter = new DualWindowLimiter(
      () => ({
        limit: this.#securitySettings?.().loginAttempts
          ?? options.config.limits.loginAttempts,
        windowMs: this.#securitySettings?.().loginWindowMs
          ?? options.config.limits.loginWindowMs,
      }),
      this.#now,
    );
    this.#passwordLimiter = new DualWindowLimiter(
      () => ({
        limit: this.#securitySettings?.().passwordAttempts
          ?? options.config.limits.passwordAttempts,
        windowMs: this.#securitySettings?.().passwordWindowMs
          ?? options.config.limits.passwordWindowMs,
      }),
      this.#now,
    );
    this.#totpLimiter = new DualWindowLimiter(
      () => ({
        limit: this.#securitySettings?.().totpAttempts
          ?? options.config.limits.totpAttempts,
        windowMs: this.#securitySettings?.().totpWindowMs
          ?? options.config.limits.totpWindowMs,
      }),
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

  static async create(options: LocalAuthenticationServiceOptions): Promise<LocalAuthenticationService> {
    const dummyPasswordHash = options.dummyPasswordHash ?? await hashPassword(
      Buffer.from(randomBytes(32).toString("base64url"), "utf8"),
    );
    if (!isSupportedPasswordHash(dummyPasswordHash)) {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    const dummyTotpSeed = options.dummyTotpSeed ?? randomBytes(20);
    if (dummyTotpSeed.byteLength !== 20) {
      dummyTotpSeed.fill(0);
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    return new LocalAuthenticationService({ ...options, dummyPasswordHash, dummyTotpSeed });
  }

  async login(input: unknown): Promise<LoginResult> {
    const verified = await this.verifyLocalProof(input);
    const {
      candidate,
      encodedHash,
      acceptedStep,
      parsed,
      passwordPolicy,
    } = verified;
    const issuedAt = safeTimestamp(this.#now);
    const sessionToken = opaqueValue(this.#random);
    const csrfToken = opaqueValue(this.#random);
    if (passwordPolicy === "change_required") {
      const expiresAt = issuedAt + this.#config.restrictedSessionTtlMs;
      const session: PolicyRestrictedSessionMaterial = {
        id: this.nextUuid(),
        sessionHash: keyedHash(
          this.#sessionHmacKey,
          RESTRICTED_SESSION_DOMAIN,
          sessionToken,
        ),
        csrfHash: keyedHash(
          this.#sessionHmacKey,
          RESTRICTED_CSRF_DOMAIN,
          csrfToken,
        ),
        securityEpoch: candidate.securityEpoch,
        globalSecurityEpoch: candidate.globalSecurityEpoch,
        issuedAt,
        expiresAt,
      };
      await this.#repository.commitPolicyRestrictedLogin({
        candidate,
        encodedHash,
        envelopeJson: candidate.totpEnvelopeJson,
        acceptedStep,
        session,
        correlationId: parsed.correlationId,
      });
      return {
        sessionId: session.id,
        userId: candidate.userId,
        role: candidate.role,
        sessionToken,
        csrfToken,
        issuedAt,
        absoluteExpiresAt: expiresAt,
        purpose: "password_change",
      };
    }
    const roleClass = candidate.role === "user" ? "user" : "admin";
    const securitySettings = this.#securitySettings?.();
    const absoluteMs = roleClass === "admin"
      ? securitySettings?.adminSessionAbsoluteMs
        ?? this.#config.sessions.adminAbsoluteMs
      : securitySettings?.userSessionAbsoluteMs
        ?? this.#config.sessions.userAbsoluteMs;
    const inactivityMs = roleClass === "admin"
      ? securitySettings?.adminSessionInactivityMs
        ?? this.#config.sessions.adminInactivityMs
      : securitySettings?.userSessionInactivityMs
        ?? this.#config.sessions.userInactivityMs;
    const session: BrowserSessionMaterial = {
      id: this.nextUuid(),
      sessionHash: keyedHash(this.#sessionHmacKey, SESSION_DOMAIN, sessionToken),
      csrfHash: keyedHash(this.#sessionHmacKey, CSRF_DOMAIN, csrfToken),
      roleClass,
      securityEpoch: candidate.securityEpoch,
      globalSecurityEpoch: candidate.globalSecurityEpoch,
      absoluteMs,
      inactivityMs,
      issuedAt,
    };
    await this.#repository.commitLogin({
      candidate,
      encodedHash,
      envelopeJson: candidate.totpEnvelopeJson,
      acceptedStep,
      session,
      correlationId: parsed.correlationId,
      advancePolicy: passwordPolicy === "advance",
    });
    return {
      sessionId: session.id,
      userId: candidate.userId,
      role: candidate.role,
      sessionToken,
      csrfToken,
      issuedAt,
      absoluteExpiresAt: issuedAt + absoluteMs,
    };
  }

  async verifyMcpProof(input: unknown): Promise<LocalMcpAuthenticationProof> {
    const verified = await this.verifyLocalProof(input);
    if (verified.passwordPolicy !== "current") {
      await this.deny(verified.parsed.correlationId, "invalid");
      throw new LocalAuthenticationError("authentication_failed");
    }
    return {
      userId: verified.candidate.userId,
      role: verified.candidate.role,
      securityEpoch: verified.candidate.securityEpoch,
      globalSecurityEpoch: verified.candidate.globalSecurityEpoch,
      acceptedTotpStep: verified.acceptedStep,
      verifiedAt: safeTimestamp(this.#now),
      correlationId: verified.parsed.correlationId,
    };
  }

  private async verifyLocalProof(input: unknown): Promise<{
    candidate: EligibleLoginCandidate;
    encodedHash: string;
    acceptedStep: number;
    parsed: ParsedLogin;
    passwordPolicy: "current" | "advance" | "change_required";
  }> {
    let parsed: ParsedLogin;
    try {
      parsed = parseLogin(input);
    } catch {
      throw new LocalAuthenticationError("authentication_failed");
    }
    const accountKey = keyedHash(this.#sessionHmacKey, ACCOUNT_DOMAIN, parsed.normalizedEmail);
    if (!this.#loginLimiter.take(parsed.source, accountKey)) {
      await this.deny(parsed.correlationId, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }

    let candidate: LoginCandidate | undefined;
    try {
      candidate = await this.#repository.candidate(parsed.normalizedEmail);
    } catch {
      await this.deny(parsed.correlationId, "unavailable");
      throw new LocalAuthenticationError("authentication_unavailable");
    }
    const eligibleCandidate = isEligible(candidate) ? candidate : undefined;
    const encodedHash = eligibleCandidate?.encodedHash !== undefined
      ? eligibleCandidate.encodedHash
      : this.#dummyPasswordHash;
    if (!this.#passwordLimiter.take(parsed.source, accountKey)) {
      await this.deny(parsed.correlationId, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    const releasePassword = this.#passwordInflight.acquire(parsed.source);
    if (releasePassword === undefined) {
      await this.deny(parsed.correlationId, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    let passwordValid = false;
    try {
      passwordValid = await verifyPasswordHash(Buffer.from(parsed.password, "utf8"), encodedHash);
    } finally {
      releasePassword();
    }

    if (!this.#totpLimiter.take(parsed.source, accountKey)) {
      await this.deny(parsed.correlationId, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    const releaseTotp = this.#totpInflight.acquire(parsed.source);
    if (releaseTotp === undefined) {
      await this.deny(parsed.correlationId, "limited");
      throw new LocalAuthenticationError("rate_limited");
    }
    let seed: Buffer = Buffer.from(this.#dummyTotpSeed);
    let authenticatorValid = false;
    if (eligibleCandidate !== undefined) {
      try {
        const stored = parseTotpEnvelope(JSON.parse(eligibleCandidate.totpEnvelopeJson));
        if (
          stored.userId !== eligibleCandidate.userId ||
          stored.authenticatorId !== eligibleCandidate.totpAuthenticatorId ||
          stored.generation !== eligibleCandidate.totpGeneration
        ) throw new Error("authenticator binding mismatch");
        const decrypted = decryptTotpSeed(stored, this.#keyRing);
        seed.fill(0);
        seed = decrypted;
        authenticatorValid = true;
      } catch {
        // Keep comparable TOTP work on the dummy seed and fail uniformly.
      }
    }
    let acceptedStep: number | undefined;
    try {
      acceptedStep = verifyTotpCode(seed, parsed.totp, safeTimestamp(this.#now));
    } finally {
      seed.fill(0);
      releaseTotp();
    }
    if (
      eligibleCandidate === undefined ||
      !passwordValid ||
      !authenticatorValid ||
      acceptedStep === undefined
    ) {
      await this.deny(parsed.correlationId, "invalid");
      throw new LocalAuthenticationError("authentication_failed");
    }
    const passwordPolicy = this.passwordPolicyStatus(
      eligibleCandidate,
      parsed.password,
    );
    return {
      candidate: eligibleCandidate,
      encodedHash,
      acceptedStep,
      parsed,
      passwordPolicy,
    };
  }

  private passwordPolicyStatus(
    candidate: EligibleLoginCandidate,
    suppliedPassword: string,
  ): "current" | "advance" | "change_required" {
    if (
      candidate.credentialPasswordChangeEpoch
        < candidate.currentPasswordChangeEpoch
    ) return "change_required";
    if (
      candidate.credentialPolicyVersion === candidate.currentPasswordPolicyVersion
    ) return "current";
    if (
      candidate.credentialPolicyVersion > candidate.currentPasswordPolicyVersion
      || candidate.credentialPasswordChangeEpoch
        > candidate.currentPasswordChangeEpoch
    ) throw new LocalAuthenticationError("authentication_unavailable");
    let normalized: Buffer | undefined;
    try {
      const settings = this.#securitySettings?.();
      const minimumLength = settings?.passwordMinimumLength
        ?? this.#config.password.minimumLength;
      const blocklistVersion = settings?.passwordBlocklistVersion ?? 1;
      const key = `${minimumLength}:${blocklistVersion}`;
      if (this.#passwordPolicy === undefined || key !== this.#passwordPolicyKey) {
        this.#passwordPolicy = new PasswordPolicy({
          minimumLength,
          ...(this.#config.password.compromisedBlocklistFile === undefined
            ? {}
            : {
                operatorBlocklistFile:
                  this.#config.password.compromisedBlocklistFile,
              }),
        });
        this.#passwordPolicyKey = key;
      }
      normalized = this.#passwordPolicy.validate(suppliedPassword, {
        email: candidate.email,
        givenName: candidate.givenName,
        familyName: candidate.familyName,
        productName: "SecretSauce",
      });
      return "advance";
    } catch (error) {
      if (error instanceof PasswordPolicyError) return "change_required";
      throw error;
    } finally {
      normalized?.fill(0);
    }
  }

  close(): void {
    this.#sessionHmacKey.fill(0);
    this.#dummyTotpSeed.fill(0);
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new LocalAuthenticationError("authentication_unavailable");
    return value;
  }

  private async deny(correlationId: string, code: "invalid" | "limited" | "unavailable"): Promise<void> {
    try {
      await this.#repository.recordDenied(correlationId, code);
    } catch {
      throw new LocalAuthenticationError("authentication_unavailable");
    }
  }
}

interface ParsedLogin {
  normalizedEmail: string;
  password: string;
  totp: string;
  source: string;
  correlationId: string;
}

function parseLogin(input: unknown): ParsedLogin {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid");
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).length !== 5 ||
    !["email", "password", "totp", "source", "correlationId"].every((field) =>
      Object.prototype.hasOwnProperty.call(value, field)) ||
    typeof value.email !== "string" ||
    typeof value.password !== "string" ||
    typeof value.totp !== "string" ||
    typeof value.source !== "string" ||
    typeof value.correlationId !== "string"
  ) throw new Error("invalid");
  const normalizedEmail = normalizeEmail(value.email);
  const password = value.password.normalize("NFKC");
  if (
    [...password].length > 1_024 ||
    Buffer.byteLength(password, "utf8") > 4_096 ||
    !/^\d{6}$/.test(value.totp) ||
    value.source.length < 1 ||
    value.source.length > 128 ||
    value.source.trim() !== value.source ||
    !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.correlationId)
  ) throw new Error("invalid");
  return {
    normalizedEmail,
    password,
    totp: value.totp,
    source: value.source,
    correlationId: value.correlationId,
  };
}

function isEligible(candidate: LoginCandidate | undefined): candidate is EligibleLoginCandidate {
  return candidate !== undefined &&
    candidate.status === "active" &&
    candidate.passwordState === "configured" &&
    candidate.totpState === "configured" &&
    candidate.encodedHash !== null &&
    candidate.passwordVersion !== null &&
    candidate.credentialPolicyVersion !== null &&
    candidate.credentialPasswordChangeEpoch !== null &&
    candidate.totpAuthenticatorId !== null &&
    candidate.totpEnvelopeJson !== null &&
    candidate.totpGeneration !== null;
}

function requireCurrentEligibleCandidate(
  transaction: PersistenceTransaction,
  input: {
    candidate: LoginCandidate;
    encodedHash: string;
    envelopeJson: string;
  },
): void {
  const row = transaction.get<{
    status: string;
    security_epoch: number;
    global_security_epoch: number;
    password_state: string;
    totp_state: string;
    encoded_hash: string;
    password_version: number;
    credential_policy_version: number;
    credential_password_change_epoch: number;
    current_password_policy_version: number;
    current_password_change_epoch: number;
    envelope_json: string;
    totp_generation: number;
  }>(`
    SELECT
      u.status, u.security_epoch,
      s.global_security_epoch,
      s.password_policy_version AS current_password_policy_version,
      s.password_change_epoch AS current_password_change_epoch,
      a.password_state, a.totp_state,
      p.encoded_hash, p.version AS password_version,
      p.policy_version AS credential_policy_version,
      p.password_change_epoch AS credential_password_change_epoch,
      t.envelope_json, t.generation AS totp_generation
    FROM users u
    JOIN identity_security_state s ON s.singleton = 1
    JOIN local_authenticator_states a ON a.user_id = u.id
    JOIN local_password_credentials p ON p.user_id = u.id
    JOIN local_totp_authenticators t ON t.user_id = u.id
    WHERE u.id = ?
  `, [input.candidate.userId]);
  if (
    row === undefined ||
    row.status !== "active" ||
    row.password_state !== "configured" ||
    row.totp_state !== "configured" ||
    row.security_epoch !== input.candidate.securityEpoch ||
    row.global_security_epoch !== input.candidate.globalSecurityEpoch ||
    row.password_version !== input.candidate.passwordVersion ||
    row.credential_policy_version !==
      input.candidate.credentialPolicyVersion ||
    row.credential_password_change_epoch !==
      input.candidate.credentialPasswordChangeEpoch ||
    row.current_password_policy_version !==
      input.candidate.currentPasswordPolicyVersion ||
    row.current_password_change_epoch !==
      input.candidate.currentPasswordChangeEpoch ||
    row.totp_generation !== input.candidate.totpGeneration ||
    row.encoded_hash !== input.encodedHash ||
    row.envelope_json !== input.envelopeJson
  ) throw new PersistenceError("authentication_failed");
}

function advancePasswordPolicy(
  transaction: PersistenceTransaction,
  candidate: LoginCandidate,
  now: number,
): void {
  const credential = transaction.run(`
    UPDATE local_password_credentials
    SET policy_version = ?, password_change_epoch = ?,
        version = version + 1, updated_at = ?
    WHERE user_id = ? AND version = ? AND policy_version = ?
      AND password_change_epoch = ?
  `, [
    candidate.currentPasswordPolicyVersion,
    candidate.currentPasswordChangeEpoch,
    now,
    candidate.userId,
    candidate.passwordVersion,
    candidate.credentialPolicyVersion,
    candidate.credentialPasswordChangeEpoch,
  ]);
  const user = transaction.run(`
    UPDATE users
    SET password_policy_version = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND password_policy_version = ?
  `, [
    candidate.currentPasswordPolicyVersion,
    now,
    candidate.userId,
    candidate.credentialPolicyVersion,
  ]);
  if (credential.changes !== 1 || user.changes !== 1) {
    throw new PersistenceError("authentication_failed");
  }
}

function successfulAudit(
  context: IdentityAuditContext,
  userId: string,
  action: string,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: context.actor,
    action,
    result: "allow",
    target: { type: "user", id: userId, label: `user:${userId}` },
    changes,
    correlationId: context.correlationId,
    source: context.source ?? { category: "identity" },
  };
}

class DualWindowLimiter {
  readonly #entries = new Map<string, { count: number; resetAt: number; seenAt: number }>();

  constructor(
    readonly settings: () => { limit: number; windowMs: number },
    readonly now: () => number,
  ) {}

  take(source: string, account: string): boolean {
    const now = safeTimestamp(this.now);
    const { limit, windowMs } = this.settings();
    this.sweep(now);
    const sourceKey = `s:${source}`;
    const accountKey = `a:${account}`;
    const sourceEntry = this.current(sourceKey, now);
    const accountEntry = this.current(accountKey, now);
    if (sourceEntry.count >= limit || accountEntry.count >= limit) return false;
    sourceEntry.count += 1;
    sourceEntry.seenAt = now;
    accountEntry.count += 1;
    accountEntry.seenAt = now;
    return true;
  }

  private current(key: string, now: number): { count: number; resetAt: number; seenAt: number } {
    const existing = this.#entries.get(key);
    if (existing !== undefined && now < existing.resetAt) return existing;
    const created = { count: 0, resetAt: now + this.settings().windowMs, seenAt: now };
    this.#entries.set(key, created);
    return created;
  }

  private sweep(now: number): void {
    const { windowMs } = this.settings();
    for (const [key, entry] of this.#entries) {
      if (now - entry.seenAt >= windowMs) this.#entries.delete(key);
    }
    while (this.#entries.size > 20_000) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value, "utf8").digest("hex");
}

function safeTimestamp(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new LocalAuthenticationError("authentication_unavailable");
  }
  return value;
}

function exactRandom(random: (size: number) => Buffer, size: number): Buffer {
  const value = random(size);
  if (!Buffer.isBuffer(value) || value.byteLength !== size) {
    value?.fill?.(0);
    throw new LocalAuthenticationError("authentication_unavailable");
  }
  return value;
}

function opaqueValue(random: (size: number) => Buffer): string {
  const value = exactRandom(random, SESSION_VALUE_BYTES);
  try {
    return value.toString("base64url");
  } finally {
    value.fill(0);
  }
}
