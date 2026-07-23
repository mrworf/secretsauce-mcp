import { createHmac, randomBytes } from "node:crypto";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig, OidcProviderConfig } from "../types.js";
import type {
  BrowserSessionMaterial,
  LoginResult,
} from "./localAuthentication.js";
import type { ProviderAssertion } from "./provider.js";
import { parseIdentityProfile } from "./validation.js";

const SESSION_DOMAIN = "secretsauce.browser-session.v1";
const CSRF_DOMAIN = "secretsauce.browser-csrf.v1";

interface LinkedCandidate {
  linkId: string;
  userId: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  userVersion: number;
  email: string;
  normalizedEmail: string;
  givenName: string;
  familyName: string;
  emailSource: string;
  givenNameSource: string;
  familyNameSource: string;
}

export class OidcLoginError extends Error {
  constructor() {
    super("OIDC authentication failed.");
    this.name = "OidcLoginError";
  }
}

export class OidcLoginRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async candidate(assertion: ProviderAssertion): Promise<LinkedCandidate | undefined> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => query.get<LinkedCandidate>(`
          SELECT
            e.id AS linkId,
            u.id AS userId,
            u.role AS role,
            u.status AS status,
            u.security_epoch AS securityEpoch,
            s.global_security_epoch AS globalSecurityEpoch,
            u.version AS userVersion,
            u.email AS email,
            u.normalized_email AS normalizedEmail,
            u.given_name AS givenName,
            u.family_name AS familyName,
            u.email_source AS emailSource,
            u.given_name_source AS givenNameSource,
            u.family_name_source AS familyNameSource
          FROM external_identities e
          JOIN users u ON u.id = e.user_id
          JOIN identity_security_state s ON s.singleton = 1
          WHERE e.provider_id = ? AND e.issuer = ? AND e.subject = ?
        `, [assertion.providerId, assertion.issuer, assertion.subject])),
      });
    } catch {
      throw new OidcLoginError();
    }
  }

  async commit(input: {
    assertion: ProviderAssertion;
    provider: OidcProviderConfig;
    candidate: LinkedCandidate;
    session: BrowserSessionMaterial;
    correlationId: string;
  }): Promise<void> {
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = currentCandidate(transaction, input.assertion);
          if (
            current === undefined ||
            current.linkId !== input.candidate.linkId ||
            current.userId !== input.candidate.userId ||
            current.status !== "active" ||
            current.securityEpoch !== input.candidate.securityEpoch ||
            current.globalSecurityEpoch !== input.candidate.globalSecurityEpoch ||
            current.userVersion !== input.candidate.userVersion
          ) throw new PersistenceError("authentication_failed");
          const now = safeNow(this.now);
          insertBrowserSession(transaction, input.session, current.userId);
          transaction.run(`
            UPDATE external_identities
            SET last_authenticated_at = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND user_id = ?
          `, [now, now, current.linkId, current.userId]);
          const profileChanged = updateOwnedProfile(
            transaction,
            current,
            input.provider,
            input.assertion,
            now,
          );
          transaction.run(`
            UPDATE users
            SET last_login_at = ?, last_authenticated_at = ?, updated_at = ?
            WHERE id = ?
          `, [now, now, now, current.userId]);
          return {
            value: undefined,
            auditInput: {
              actor: {
                type: "browser_session",
                id: current.userId,
                label: `user:${current.userId}`,
                role: current.role,
                authenticationMethod: "oidc",
              },
              action: "identity.login",
              result: "allow",
              target: {
                type: "user",
                id: current.userId,
                label: `user:${current.userId}`,
              },
              changes: [
                { field: "session", after: "created" },
                ...(profileChanged ? [{ field: "provider_profile", after: "updated" }] : []),
              ],
              correlationId: input.correlationId,
              source: { category: "authentication" },
            } satisfies AdministrativeAuditEventInput,
          };
        }),
      });
    } catch {
      throw new OidcLoginError();
    }
  }

  async recordDenied(correlationId: string): Promise<void> {
    await this.owner.execute({
      run: (database) => database.appendAdministrativeAudit({
        actor: {
          type: "system",
          label: "anonymous OIDC login",
          authenticationMethod: "oidc",
        },
        action: "identity.login",
        result: "deny",
        target: { type: "authentication", label: "external login" },
        correlationId,
        source: { category: "authentication" },
        failureCode: "authentication.invalid",
      } satisfies AdministrativeAuditEventInput),
    });
  }
}

export class OidcLoginService {
  readonly #sessionKey: Buffer;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;

  constructor(
    private readonly repository: OidcLoginRepository,
    private readonly config: IdentityConfig,
    sessionKey: Buffer,
    options: {
      now?: () => number;
      random?: (size: number) => Buffer;
      uuid?: () => string;
    } = {},
  ) {
    if (sessionKey.byteLength !== 32) throw new Error("Invalid browser session key.");
    this.#sessionKey = Buffer.from(sessionKey);
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  async login(
    assertion: ProviderAssertion,
    correlationId: string,
  ): Promise<LoginResult> {
    try {
      const provider = this.config.oidc?.providers[assertion.providerId];
      if (
        provider === undefined ||
        assertion.issuer !== provider.issuer ||
        !assertion.mfa.verified
      ) throw new OidcLoginError();
      const candidate = await this.repository.candidate(assertion);
      if (candidate === undefined || candidate.status !== "active") throw new OidcLoginError();
      const issuedAt = safeNow(this.#now);
      const sessionToken = opaque(this.#random);
      const csrfToken = opaque(this.#random);
      const roleClass = candidate.role === "user" ? "user" : "admin";
      const absoluteMs = roleClass === "admin"
        ? this.config.sessions.adminAbsoluteMs
        : this.config.sessions.userAbsoluteMs;
      const inactivityMs = roleClass === "admin"
        ? this.config.sessions.adminInactivityMs
        : this.config.sessions.userInactivityMs;
      const id = this.#uuid();
      if (!isUuidV7(id)) throw new OidcLoginError();
      const session: BrowserSessionMaterial = {
        id,
        sessionHash: keyedHash(this.#sessionKey, SESSION_DOMAIN, sessionToken),
        csrfHash: keyedHash(this.#sessionKey, CSRF_DOMAIN, csrfToken),
        roleClass,
        securityEpoch: candidate.securityEpoch,
        globalSecurityEpoch: candidate.globalSecurityEpoch,
        absoluteMs,
        inactivityMs,
        issuedAt,
      };
      await this.repository.commit({
        assertion,
        provider,
        candidate,
        session,
        correlationId,
      });
      return {
        sessionId: id,
        userId: candidate.userId,
        role: candidate.role,
        sessionToken,
        csrfToken,
        issuedAt,
        absoluteExpiresAt: issuedAt + absoluteMs,
      };
    } catch {
      try {
        await this.repository.recordDenied(correlationId);
      } catch {
        // Preserve the uniform authentication result if best-effort denial auditing fails.
      }
      throw new OidcLoginError();
    }
  }

  close(): void {
    this.#sessionKey.fill(0);
  }
}

function currentCandidate(
  transaction: PersistenceTransaction,
  assertion: ProviderAssertion,
): LinkedCandidate | undefined {
  return transaction.get<LinkedCandidate>(`
    SELECT
      e.id AS linkId,
      u.id AS userId,
      u.role AS role,
      u.status AS status,
      u.security_epoch AS securityEpoch,
      s.global_security_epoch AS globalSecurityEpoch,
      u.version AS userVersion,
      u.email AS email,
      u.normalized_email AS normalizedEmail,
      u.given_name AS givenName,
      u.family_name AS familyName,
      u.email_source AS emailSource,
      u.given_name_source AS givenNameSource,
      u.family_name_source AS familyNameSource
    FROM external_identities e
    JOIN users u ON u.id = e.user_id
    JOIN identity_security_state s ON s.singleton = 1
    WHERE e.provider_id = ? AND e.issuer = ? AND e.subject = ?
  `, [assertion.providerId, assertion.issuer, assertion.subject]);
}

function insertBrowserSession(
  transaction: PersistenceTransaction,
  session: BrowserSessionMaterial,
  userId: string,
): void {
  transaction.run(`
    INSERT INTO browser_sessions (
      id, user_id, session_hash, csrf_hash, role_class,
      issued_security_epoch, issued_global_epoch,
      issued_absolute_ms, issued_inactivity_ms,
      issued_at, last_activity_at, absolute_expires_at,
      step_up_at, revoked_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
  `, [
    session.id,
    userId,
    session.sessionHash,
    session.csrfHash,
    session.roleClass,
    session.securityEpoch,
    session.globalSecurityEpoch,
    session.absoluteMs,
    session.inactivityMs,
    session.issuedAt,
    session.issuedAt,
    session.issuedAt + session.absoluteMs,
  ]);
}

function updateOwnedProfile(
  transaction: PersistenceTransaction,
  current: LinkedCandidate,
  provider: OidcProviderConfig,
  assertion: ProviderAssertion,
  now: number,
): boolean {
  const source = `oidc:${provider.id}`;
  const profile = assertion.profile;
  if (profile === undefined) return false;
  const owns = new Set(provider.profileClaims.providerOwnedFields);
  const email = owns.has("email") &&
    current.emailSource === source &&
    profile.emailVerified === true &&
    profile.email !== undefined
    ? profile.email
    : current.email;
  const givenName = owns.has("given_name") &&
    current.givenNameSource === source &&
    profile.givenName !== undefined
    ? profile.givenName
    : current.givenName;
  const familyName = owns.has("family_name") &&
    current.familyNameSource === source &&
    profile.familyName !== undefined
    ? profile.familyName
    : current.familyName;
  let parsed: ReturnType<typeof parseIdentityProfile>;
  try {
    parsed = parseIdentityProfile({ email, givenName, familyName });
  } catch {
    return false;
  }
  if (
    parsed.email === current.email &&
    parsed.givenName === current.givenName &&
    parsed.familyName === current.familyName
  ) return false;
  if (
    parsed.normalizedEmail !== current.normalizedEmail &&
    transaction.get<{ present: number }>(
      "SELECT 1 AS present FROM users WHERE normalized_email = ? AND id <> ?",
      [parsed.normalizedEmail, current.userId],
    ) !== undefined
  ) return false;
  const result = transaction.run(`
    UPDATE users
    SET email = ?, normalized_email = ?, given_name = ?, family_name = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `, [
    parsed.email,
    parsed.normalizedEmail,
    parsed.givenName,
    parsed.familyName,
    now,
    current.userId,
    current.userVersion,
  ]);
  if (result.changes !== 1) throw new PersistenceError("authentication_failed");
  transaction.run(`
    UPDATE external_identities
    SET last_claim_update_at = ?, version = version + 1, updated_at = ?
    WHERE id = ?
  `, [now, now, current.linkId]);
  return true;
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value, "utf8").digest("hex");
}

function opaque(random: (size: number) => Buffer): string {
  const value = random(32);
  if (!Buffer.isBuffer(value) || value.byteLength !== 32) {
    value?.fill?.(0);
    throw new OidcLoginError();
  }
  try {
    return value.toString("base64url");
  } finally {
    value.fill(0);
  }
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) throw new OidcLoginError();
  return value;
}
