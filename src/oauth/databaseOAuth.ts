import { createHash, createHmac, randomBytes } from "node:crypto";
import type { PersistenceOwner } from "../persistence/worker.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import { normalizeEmail } from "../identity/validation.js";
import type { LocalMcpAuthenticationProof } from "../identity/localAuthentication.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "../persistence/transaction.js";
import { canonicalJson } from "../vault/canonicalJson.js";
import { PersistenceError } from "../persistence/errors.js";
import type { ProviderAssertion } from "../identity/provider.js";
import { recordQualifyingActivity } from "../humanActivity.js";

const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type OAuthHashDomain = "access" | "authorization_code" | "intent" | "refresh";

export interface DatabaseOAuthEligibility {
  userId: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  passwordState: string;
  totpState: string;
  hasEffectiveService: boolean;
  localEligible: boolean;
}

export interface DatabaseOAuthSettings {
  accessTokenTtlMs: number;
  authorizationCodeTtlMs: number;
  refreshTokenIdleTtlMs: number;
  refreshTokenMaxTtlMs: number;
  maxAuthorizationCodes: number;
  maxTokenRecords: number;
}

export interface DatabaseOAuthClientInput {
  identifier: string;
  displayName: string;
  redirectUris: string[];
}

export interface DatabaseOAuthAuthorizationInput {
  proof: LocalMcpAuthenticationProof;
  client: DatabaseOAuthClientInput;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge: string;
}

export interface DatabaseOAuthAuthorizationResult {
  code: string;
  grantId: string;
  expiresAt: number;
}

export interface DatabaseOAuthCodeExchangeInput {
  code: string;
  clientIdentifier: string;
  redirectUri: string;
  resource?: string;
  codeVerifier: string;
}

export interface DatabaseOAuthTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scopes: string[];
  grantId: string;
}

export interface DatabaseOAuthRefreshInput {
  refreshToken: string;
  clientIdentifier: string;
  resource?: string;
  scopes?: string[];
  correlationId: string;
}

export interface DatabaseOAuthAccessInput {
  accessToken: string;
  resource: string;
  requiredScopes: string[];
}

export interface DatabaseOAuthAccessAuthentication {
  subject: string;
  scopes: string[];
  mode: "builtin_oauth";
}

export interface DatabaseOAuthIntentInput {
  client: DatabaseOAuthClientInput;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge: string;
  providerId: string;
  stateEnvelopeJson?: string;
}

export interface DatabaseOAuthIntent {
  id: string;
  handle: string;
  expiresAt: number;
}

export interface DatabaseOAuthExternalAuthorization {
  code: string;
  redirectUri: string;
  stateEnvelopeJson?: string;
}

type RefreshRotationResult =
  | { kind: "replay" }
  | {
    kind: "rotated";
    scopes: string[];
    grantId: string;
    accessExpiresAt: number;
  };

export class DatabaseOAuthError extends Error {
  constructor(
    readonly code:
      | "invalid_authorization"
      | "invalid_grant"
      | "capacity_exceeded"
      | "unavailable",
  ) {
    super("OAuth operation could not be completed.");
    this.name = "DatabaseOAuthError";
  }
}

interface EligibilityRow {
  user_id: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  security_epoch: number;
  global_security_epoch: number;
  password_state: string;
  totp_state: string;
  has_effective_service: number;
}

export class DatabaseOAuthTokenHasher {
  readonly #key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Invalid OAuth token HMAC key.");
    this.#key = Buffer.from(key);
  }

  hash(domain: OAuthHashDomain, value: string): string {
    if (!isCanonicalOpaqueOAuthValue(value)) {
      throw new Error("Invalid opaque OAuth value.");
    }
    return createHmac("sha256", this.#key)
      .update(`secretsauce:oauth:${domain}:v1\0`, "utf8")
      .update(value, "utf8")
      .digest("hex");
  }

  close(): void {
    this.#key.fill(0);
  }
}

export class DatabaseOAuthEligibilityRepository {
  constructor(private readonly owner: PersistenceOwner) {}

  async byEmail(email: string): Promise<DatabaseOAuthEligibility | undefined> {
    let normalized: string;
    try {
      normalized = normalizeEmail(email);
    } catch {
      return undefined;
    }
    return this.read("u.normalized_email = ?", normalized);
  }

  async byUserId(userId: string): Promise<DatabaseOAuthEligibility | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.read("u.id = ?", userId);
  }

  async byExternalIdentity(
    providerId: string,
    issuer: string,
    subject: string,
  ): Promise<DatabaseOAuthEligibility | undefined> {
    if (
      providerId.length < 1
      || providerId.length > 64
      || issuer.length < 1
      || issuer.length > 2048
      || subject.length < 1
      || subject.length > 1024
    ) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<EligibilityRow>(`
          ${ELIGIBILITY_SELECT}
          JOIN external_identities external ON external.user_id = u.id
          WHERE external.provider_id = ?
            AND external.issuer = ?
            AND external.subject = ?
        `, [providerId, issuer, subject]);
        return row === undefined ? undefined : eligibility(row);
      }),
    });
  }

  private async read(
    predicate: "u.id = ?" | "u.normalized_email = ?",
    value: string,
  ): Promise<DatabaseOAuthEligibility | undefined> {
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<EligibilityRow>(`
          ${ELIGIBILITY_SELECT}
          WHERE ${predicate}
        `, [value]);
        return row === undefined ? undefined : eligibility(row);
      }),
    });
  }
}

export class DatabaseOAuthRepository {
  readonly #uuid: () => string;
  readonly #random: (size: number) => Buffer;
  readonly #now: () => number;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly hasher: DatabaseOAuthTokenHasher,
    private readonly settings:
      | DatabaseOAuthSettings
      | (() => DatabaseOAuthSettings),
    options: {
      uuid?: () => string;
      random?: (size: number) => Buffer;
      now?: () => number;
    } = {},
  ) {
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  private currentSettings(): DatabaseOAuthSettings {
    return typeof this.settings === "function" ? this.settings() : this.settings;
  }

  async createExternalIntent(
    input: DatabaseOAuthIntentInput,
  ): Promise<DatabaseOAuthIntent> {
    const normalized = normalizeIntentInput(input);
    const now = safeNow(this.#now);
    const handle = opaque(this.#random);
    const handleHash = this.hasher.hash("intent", handle);
    const id = this.nextUuid();
    const clientId = this.nextUuid();
    const expiresAt = now + this.currentSettings().authorizationCodeTtlMs;
    try {
      await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          transaction.run(
            "DELETE FROM oauth_authorization_intents WHERE expires_at <= ?",
            [now],
          );
          const count = transaction.get<{ count: number }>(
            "SELECT count(*) AS count FROM oauth_authorization_intents",
          )?.count ?? this.currentSettings().maxAuthorizationCodes;
          if (count >= this.currentSettings().maxAuthorizationCodes) {
            throw new PersistenceError("oauth_capacity_exceeded");
          }
          const client = upsertClient(
            transaction,
            clientId,
            normalized.client,
            now,
          );
          transaction.run(`
            INSERT INTO oauth_authorization_intents (
              id, handle_hash, client_id, redirect_uri, resource, scopes_json,
              code_challenge, state_envelope_json, provider_id,
              created_at, expires_at, consumed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `, [
            id,
            handleHash,
            client.id,
            normalized.redirectUri,
            normalized.resource,
            JSON.stringify(normalized.scopes),
            normalized.codeChallenge,
            normalized.stateEnvelopeJson ?? null,
            normalized.providerId,
            now,
            expiresAt,
          ]);
        }),
      });
      return { id, handle, expiresAt };
    } catch (error) {
      throw mapDatabaseOAuthError(error);
    }
  }

  async resolveExternalIntent(
    handle: string,
    providerId: string,
  ): Promise<{ id: string }> {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)) {
      throw new DatabaseOAuthError("invalid_authorization");
    }
    let handleHash: string;
    try {
      handleHash = this.hasher.hash("intent", handle);
    } catch {
      throw new DatabaseOAuthError("invalid_authorization");
    }
    const now = safeNow(this.#now);
    const intent = await this.owner.execute({
      run: (database) => database.read((query) => query.get<{ id: string }>(`
        SELECT id FROM oauth_authorization_intents
        WHERE handle_hash = ? AND provider_id = ?
          AND consumed_at IS NULL AND expires_at > ?
      `, [handleHash, providerId, now])),
    });
    if (intent === undefined) {
      throw new DatabaseOAuthError("invalid_authorization");
    }
    return intent;
  }

  async authorizeExternalIntent(
    intentId: string,
    assertion: ProviderAssertion,
    correlationId: string,
  ): Promise<DatabaseOAuthExternalAuthorization> {
    if (
      !isUuidV7(intentId)
      || !assertion.mfa.verified
      || assertion.providerId.length < 1
      || assertion.providerId.length > 64
      || assertion.issuer.length < 1
      || assertion.issuer.length > 2048
      || assertion.subject.length < 1
      || assertion.subject.length > 1024
      || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        correlationId,
      )
    ) throw new DatabaseOAuthError("invalid_authorization");
    const now = safeNow(this.#now);
    const code = opaque(this.#random);
    const codeHash = this.hasher.hash("authorization_code", code);
    const grantId = this.nextUuid();
    const codeId = this.nextUuid();
    try {
      const result = await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => {
            const record = transaction.get<ExternalIntentRow>(`
              SELECT
                intent.id, intent.client_id, intent.redirect_uri,
                intent.resource, intent.scopes_json, intent.code_challenge,
                intent.state_envelope_json, intent.provider_id,
                intent.expires_at, intent.consumed_at,
                external.user_id
              FROM oauth_authorization_intents intent
              JOIN external_identities external
                ON external.provider_id = intent.provider_id
                AND external.issuer = ?
                AND external.subject = ?
              WHERE intent.id = ? AND intent.provider_id = ?
            `, [
              assertion.issuer,
              assertion.subject,
              intentId,
              assertion.providerId,
            ]);
            const current = record === undefined
              ? undefined
              : currentEligibility(transaction, record.user_id);
            if (
              record === undefined
              || record.consumed_at !== null
              || record.expires_at <= now
              || current === undefined
              || !eligibleForGrant(current, "oidc")
            ) throw new PersistenceError("oauth_invalid_authorization");
            const liveCodes = transaction.get<{ count: number }>(`
              SELECT count(*) AS count FROM oauth_authorization_codes
              WHERE consumed_at IS NULL AND expires_at > ?
            `, [now])?.count ?? 0;
            const liveGrants = transaction.get<{ count: number }>(`
              SELECT count(*) AS count FROM oauth_grants
              WHERE status = 'active'
                AND absolute_expires_at > ? AND idle_expires_at > ?
            `, [now, now])?.count ?? 0;
            if (
              liveCodes >= this.currentSettings().maxAuthorizationCodes
              || liveGrants >= this.currentSettings().maxTokenRecords
            ) throw new PersistenceError("oauth_capacity_exceeded");
            const consumed = transaction.run(`
              UPDATE oauth_authorization_intents SET consumed_at = ?
              WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
            `, [now, record.id, now]);
            if (consumed.changes !== 1) {
              throw new PersistenceError("oauth_invalid_authorization");
            }
            const scopes = parseStoredScopes(record.scopes_json);
            const absoluteExpiresAt =
              now + this.currentSettings().refreshTokenMaxTtlMs;
            const idleExpiresAt = Math.min(
              absoluteExpiresAt,
              now + this.currentSettings().refreshTokenIdleTtlMs,
            );
            transaction.run(`
              INSERT INTO oauth_grants (
                id, user_id, client_id, resource, scopes_json,
                authentication_method, issued_security_epoch,
                issued_global_epoch, issued_access_ttl_ms,
                issued_refresh_idle_ms, issued_refresh_absolute_ms,
                status, issued_at, last_used_at, absolute_expires_at,
                idle_expires_at, revoked_at, revocation_reason, version
              ) VALUES (?, ?, ?, ?, ?, 'oidc', ?, ?, ?, ?, ?, 'active',
                ?, ?, ?, ?, NULL, NULL, 1)
            `, [
              grantId,
              record.user_id,
              record.client_id,
              record.resource,
              JSON.stringify(scopes),
              current.security_epoch,
              current.global_security_epoch,
              this.currentSettings().accessTokenTtlMs,
              this.currentSettings().refreshTokenIdleTtlMs,
              this.currentSettings().refreshTokenMaxTtlMs,
              now,
              now,
              absoluteExpiresAt,
              idleExpiresAt,
            ]);
            transaction.run(`
              INSERT INTO oauth_authorization_codes (
                id, code_hash, grant_id, user_id, client_id, redirect_uri,
                resource, scopes_json, code_challenge,
                issued_security_epoch, issued_global_epoch,
                issued_at, expires_at, consumed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            `, [
              codeId,
              codeHash,
              grantId,
              record.user_id,
              record.client_id,
              record.redirect_uri,
              record.resource,
              JSON.stringify(scopes),
              record.code_challenge,
              current.security_epoch,
              current.global_security_epoch,
              now,
              now + this.currentSettings().authorizationCodeTtlMs,
            ]);
            return {
              value: {
                redirectUri: record.redirect_uri,
                stateEnvelopeJson: record.state_envelope_json,
              },
              auditInput: {
                actor: {
                  type: "system" as const,
                  id: record.user_id,
                  label: `user:${record.user_id}`,
                  role: "user",
                  authenticationMethod: "oidc",
                },
                action: "oauth.grant_authorize",
                result: "allow" as const,
                target: {
                  type: "oauth_grant",
                  id: grantId,
                  label: `client:${record.client_id}`,
                },
                changes: [{ field: "grant", after: "active" }],
                correlationId,
                source: { category: "oauth" },
              },
            };
          },
        ),
      });
      return {
        code,
        redirectUri: result.redirectUri,
        ...(result.stateEnvelopeJson === null
          ? {}
          : { stateEnvelopeJson: result.stateEnvelopeJson }),
      };
    } catch (error) {
      throw mapDatabaseOAuthError(error);
    }
  }

  async authorizeLocal(
    input: DatabaseOAuthAuthorizationInput,
  ): Promise<DatabaseOAuthAuthorizationResult> {
    const normalized = normalizeAuthorizationInput(input);
    const now = safeNow(this.#now);
    const code = opaque(this.#random);
    const codeHash = this.hasher.hash("authorization_code", code);
    const clientId = this.nextUuid();
    const grantId = this.nextUuid();
    const codeId = this.nextUuid();
    const expiresAt = now + this.currentSettings().authorizationCodeTtlMs;
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => {
            const current = currentEligibility(transaction, input.proof.userId);
            if (
              current === undefined
              || !eligibility(current).localEligible
              || current.security_epoch !== input.proof.securityEpoch
              || current.global_security_epoch
                !== input.proof.globalSecurityEpoch
              || input.proof.role !== "user"
            ) throw new PersistenceError("oauth_invalid_authorization");
            if (transaction.get<{ present: number }>(`
              SELECT 1 AS present FROM accepted_totp_steps
              WHERE user_id = ? AND time_step = ?
            `, [input.proof.userId, input.proof.acceptedTotpStep]) !== undefined) {
              throw new PersistenceError("oauth_invalid_authorization");
            }
            const liveCodes = transaction.get<{ count: number }>(`
              SELECT count(*) AS count FROM oauth_authorization_codes
              WHERE consumed_at IS NULL AND expires_at > ?
            `, [now])?.count ?? 0;
            const liveGrants = transaction.get<{ count: number }>(`
              SELECT count(*) AS count FROM oauth_grants
              WHERE status = 'active'
                AND absolute_expires_at > ? AND idle_expires_at > ?
            `, [now, now])?.count ?? 0;
            if (
              liveCodes >= this.currentSettings().maxAuthorizationCodes
              || liveGrants >= this.currentSettings().maxTokenRecords
            ) throw new PersistenceError("oauth_capacity_exceeded");
            const client = upsertClient(
              transaction,
              clientId,
              normalized.client,
              now,
            );
            transaction.run(`
              INSERT INTO accepted_totp_steps (
                user_id, time_step, purpose, accepted_at
              ) VALUES (?, ?, 'oauth', ?)
            `, [input.proof.userId, input.proof.acceptedTotpStep, now]);
            transaction.run(`
              INSERT INTO oauth_grants (
                id, user_id, client_id, resource, scopes_json,
                authentication_method, issued_security_epoch,
                issued_global_epoch, issued_access_ttl_ms,
                issued_refresh_idle_ms, issued_refresh_absolute_ms,
                status, issued_at, last_used_at, absolute_expires_at,
                idle_expires_at, revoked_at, revocation_reason, version
              ) VALUES (?, ?, ?, ?, ?, 'local_password_totp', ?, ?, ?, ?, ?,
                'active', ?, ?, ?, ?, NULL, NULL, 1)
            `, [
              grantId,
              input.proof.userId,
              client.id,
              normalized.resource,
              JSON.stringify(normalized.scopes),
              input.proof.securityEpoch,
              input.proof.globalSecurityEpoch,
              this.currentSettings().accessTokenTtlMs,
              this.currentSettings().refreshTokenIdleTtlMs,
              this.currentSettings().refreshTokenMaxTtlMs,
              now,
              now,
              now + this.currentSettings().refreshTokenMaxTtlMs,
              Math.min(
                now + this.currentSettings().refreshTokenIdleTtlMs,
                now + this.currentSettings().refreshTokenMaxTtlMs,
              ),
            ]);
            transaction.run(`
              INSERT INTO oauth_authorization_codes (
                id, code_hash, grant_id, user_id, client_id, redirect_uri,
                resource, scopes_json, code_challenge,
                issued_security_epoch, issued_global_epoch,
                issued_at, expires_at, consumed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            `, [
              codeId,
              codeHash,
              grantId,
              input.proof.userId,
              client.id,
              normalized.redirectUri,
              normalized.resource,
              JSON.stringify(normalized.scopes),
              normalized.codeChallenge,
              input.proof.securityEpoch,
              input.proof.globalSecurityEpoch,
              now,
              expiresAt,
            ]);
            return {
              value: undefined,
              auditInput: {
                actor: {
                  type: "browser_session" as const,
                  id: input.proof.userId,
                  label: `user:${input.proof.userId}`,
                  role: "user",
                  authenticationMethod: "local_password_totp",
                },
                action: "oauth.grant_authorize",
                result: "allow" as const,
                target: {
                  type: "oauth_grant",
                  id: grantId,
                  label: `client:${client.id}`,
                },
                changes: [
                  { field: "grant", after: "active" },
                  { field: "scope_count", after: normalized.scopes.length },
                ],
                correlationId: input.proof.correlationId,
                source: { category: "oauth" },
              },
            };
          },
        ),
      });
      return { code, grantId, expiresAt };
    } catch (error) {
      if (error instanceof DatabaseOAuthError) throw error;
      if (error instanceof PersistenceError) {
        if (error.code === "oauth_invalid_authorization") {
          throw new DatabaseOAuthError("invalid_authorization");
        }
        if (error.code === "oauth_capacity_exceeded") {
          throw new DatabaseOAuthError("capacity_exceeded");
        }
      }
      throw new DatabaseOAuthError("unavailable");
    }
  }

  async exchangeAuthorizationCode(
    input: DatabaseOAuthCodeExchangeInput,
  ): Promise<DatabaseOAuthTokenPair> {
    if (
      input.clientIdentifier.length < 1
      || input.clientIdentifier.length > 2048
      || input.redirectUri.length < 1
      || input.redirectUri.length > 2048
      || input.resource !== undefined
        && (input.resource.length < 1 || input.resource.length > 2048)
      || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)
    ) throw new DatabaseOAuthError("invalid_grant");
    let codeHash: string;
    try {
      codeHash = this.hasher.hash("authorization_code", input.code);
    } catch {
      throw new DatabaseOAuthError("invalid_grant");
    }
    const accessToken = opaque(this.#random);
    const refreshToken = opaque(this.#random);
    const accessHash = this.hasher.hash("access", accessToken);
    const refreshHash = this.hasher.hash("refresh", refreshToken);
    const now = safeNow(this.#now);
    const familyId = this.nextUuid();
    const refreshId = this.nextUuid();
    const accessId = this.nextUuid();
    try {
      const result = await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => {
            const record = transaction.get<AuthorizationCodeRow>(`
              SELECT
                code.id, code.grant_id, code.user_id, code.client_id,
                code.redirect_uri, code.resource, code.scopes_json,
                code.code_challenge, code.issued_security_epoch,
                code.issued_global_epoch, code.expires_at, code.consumed_at,
                client.client_identifier,
                grant.status AS grant_status,
                grant.absolute_expires_at,
                grant.idle_expires_at,
                grant.issued_access_ttl_ms
              FROM oauth_authorization_codes code
              JOIN oauth_clients client ON client.id = code.client_id
              JOIN oauth_grants grant ON grant.id = code.grant_id
              WHERE code.code_hash = ?
            `, [codeHash]);
            const current = record === undefined
              ? undefined
              : currentEligibility(transaction, record.user_id);
            if (
              record === undefined
              || record.consumed_at !== null
              || record.expires_at <= now
              || record.grant_status !== "active"
              || record.absolute_expires_at <= now
              || record.idle_expires_at <= now
              || record.client_identifier !== input.clientIdentifier
              || record.redirect_uri !== input.redirectUri
              || input.resource !== undefined
                && record.resource !== input.resource
              || pkceChallenge(input.codeVerifier) !== record.code_challenge
              || current === undefined
              || !eligibility(current).localEligible
              || current.security_epoch !== record.issued_security_epoch
              || current.global_security_epoch !== record.issued_global_epoch
            ) throw new PersistenceError("oauth_invalid_grant");
            const tokenCount = transaction.get<{ count: number }>(`
              SELECT
                (SELECT count(*) FROM oauth_refresh_tokens)
                + (SELECT count(*) FROM oauth_access_tokens) AS count
            `)?.count ?? 0;
            if (tokenCount + 2 > this.currentSettings().maxTokenRecords) {
              throw new PersistenceError("oauth_capacity_exceeded");
            }
            const scopes = parseStoredScopes(record.scopes_json);
            const absoluteExpiresAt = Math.min(
              record.absolute_expires_at,
              now + this.currentSettings().refreshTokenMaxTtlMs,
            );
            const idleExpiresAt = Math.min(
              absoluteExpiresAt,
              now + this.currentSettings().refreshTokenIdleTtlMs,
            );
            const accessExpiresAt = now + Math.min(
              record.issued_access_ttl_ms,
              this.currentSettings().accessTokenTtlMs,
            );
            if (idleExpiresAt <= now || accessExpiresAt <= now) {
              throw new PersistenceError("oauth_invalid_grant");
            }
            const consumed = transaction.run(`
              UPDATE oauth_authorization_codes
              SET consumed_at = ?
              WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
            `, [now, record.id, now]);
            if (consumed.changes !== 1) {
              throw new PersistenceError("oauth_invalid_grant");
            }
            transaction.run(`
              INSERT INTO oauth_refresh_families (
                id, grant_id, current_sequence, status, issued_at,
                last_used_at, absolute_expires_at, idle_expires_at,
                revoked_at, revocation_reason, version
              ) VALUES (?, ?, 0, 'active', ?, ?, ?, ?, NULL, NULL, 1)
            `, [
              familyId,
              record.grant_id,
              now,
              now,
              absoluteExpiresAt,
              idleExpiresAt,
            ]);
            transaction.run(`
              INSERT INTO oauth_refresh_tokens (
                id, token_hash, family_id, sequence, status, issued_at, used_at
              ) VALUES (?, ?, ?, 0, 'active', ?, NULL)
            `, [refreshId, refreshHash, familyId, now]);
            transaction.run(`
              INSERT INTO oauth_access_tokens (
                id, token_hash, grant_id, family_id, scopes_json,
                issued_at, expires_at, last_used_at, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `, [
              accessId,
              accessHash,
              record.grant_id,
              familyId,
              JSON.stringify(scopes),
              now,
              accessExpiresAt,
              now,
            ]);
            transaction.run(`
              UPDATE oauth_grants
              SET last_used_at = ?, idle_expires_at = ?,
                version = version + 1
              WHERE id = ? AND status = 'active'
            `, [now, idleExpiresAt, record.grant_id]);
            return {
              value: {
                scopes,
                grantId: record.grant_id,
                accessExpiresAt,
              },
              auditInput: {
                actor: {
                  type: "system" as const,
                  id: record.client_id,
                  label: `client:${record.client_id}`,
                  authenticationMethod: "oauth_authorization_code",
                },
                action: "oauth.code_exchange",
                result: "allow" as const,
                target: {
                  type: "oauth_grant",
                  id: record.grant_id,
                  label: `grant:${record.grant_id}`,
                },
                changes: [
                  { field: "refresh_family", after: "active" },
                  { field: "access_issued", after: true },
                ],
                correlationId: `req_${this.nextUuid()}`,
                source: { category: "oauth" },
              },
            };
          },
        ),
      });
      return {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        expiresIn: Math.floor((result.accessExpiresAt - now) / 1_000),
        scopes: result.scopes,
        grantId: result.grantId,
      };
    } catch (error) {
      if (error instanceof DatabaseOAuthError) throw error;
      if (error instanceof PersistenceError) {
        if (error.code === "oauth_invalid_grant") {
          throw new DatabaseOAuthError("invalid_grant");
        }
        if (error.code === "oauth_capacity_exceeded") {
          throw new DatabaseOAuthError("capacity_exceeded");
        }
      }
      throw new DatabaseOAuthError("unavailable");
    }
  }

  async rotateRefreshToken(
    input: DatabaseOAuthRefreshInput,
  ): Promise<DatabaseOAuthTokenPair> {
    const normalized = normalizeRefreshInput(input);
    let refreshHash: string;
    try {
      refreshHash = this.hasher.hash("refresh", input.refreshToken);
    } catch {
      throw new DatabaseOAuthError("invalid_grant");
    }
    const nextRefreshToken = opaque(this.#random);
    const nextAccessToken = opaque(this.#random);
    const nextRefreshHash = this.hasher.hash("refresh", nextRefreshToken);
    const nextAccessHash = this.hasher.hash("access", nextAccessToken);
    const refreshId = this.nextUuid();
    const accessId = this.nextUuid();
    const now = safeNow(this.#now);
    try {
      const result = await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAuditOutcome<RefreshRotationResult>(
          (transaction) => {
            const record = transaction.get<RefreshTokenRow>(`
              SELECT
                token.id, token.family_id, token.sequence,
                token.status AS token_status,
                family.status AS family_status, family.current_sequence,
                family.issued_at AS family_issued_at,
                family.last_used_at AS family_last_used_at,
                family.absolute_expires_at AS family_absolute_expires_at,
                family.idle_expires_at AS family_idle_expires_at,
                grant.id AS grant_id, grant.user_id, grant.client_id,
                grant.resource, grant.scopes_json, grant.authentication_method,
                grant.issued_security_epoch, grant.issued_global_epoch,
                grant.issued_access_ttl_ms, grant.issued_refresh_idle_ms,
                grant.issued_refresh_absolute_ms,
                grant.status AS grant_status,
                grant.issued_at AS grant_issued_at,
                grant.absolute_expires_at AS grant_absolute_expires_at,
                grant.idle_expires_at AS grant_idle_expires_at,
                client.client_identifier
              FROM oauth_refresh_tokens token
              JOIN oauth_refresh_families family ON family.id = token.family_id
              JOIN oauth_grants grant ON grant.id = family.grant_id
              JOIN oauth_clients client ON client.id = grant.client_id
              WHERE token.token_hash = ?
            `, [refreshHash]);
            if (
              record !== undefined
              && record.token_status === "used"
              && record.family_status === "active"
            ) {
              transaction.run(`
                UPDATE oauth_refresh_families
                SET status = 'revoked', revoked_at = ?,
                  revocation_reason = 'refresh_replay', version = version + 1
                WHERE id = ? AND status = 'active'
              `, [now, record.family_id]);
              transaction.run(`
                UPDATE oauth_refresh_tokens
                SET status = 'revoked', used_at = coalesce(used_at, ?)
                WHERE family_id = ? AND status = 'active'
              `, [now, record.family_id]);
              transaction.run(`
                UPDATE oauth_access_tokens SET status = 'revoked'
                WHERE family_id = ? AND status = 'active'
              `, [record.family_id]);
              return {
                value: { kind: "replay" as const },
                auditInput: refreshAudit(
                  record,
                  input.correlationId,
                  "deny",
                  "refresh_replay",
                  [{ field: "family_status", before: "active", after: "revoked" }],
                ),
              };
            }
            const current = record === undefined
              ? undefined
              : currentEligibility(transaction, record.user_id);
            const scopes = record === undefined
              ? undefined
              : parseStoredScopes(record.scopes_json);
            const requestedScopes = normalized.scopes ?? scopes;
            const currentAbsolute = record === undefined
              ? 0
              : Math.min(
                record.family_absolute_expires_at,
                record.grant_absolute_expires_at,
                record.family_issued_at + this.currentSettings().refreshTokenMaxTtlMs,
                record.grant_issued_at + this.currentSettings().refreshTokenMaxTtlMs,
              );
            const currentIdle = record === undefined
              ? 0
              : Math.min(
                currentAbsolute,
                record.family_idle_expires_at,
                record.grant_idle_expires_at,
                record.family_last_used_at + this.currentSettings().refreshTokenIdleTtlMs,
              );
            if (
              record === undefined
              || record.token_status !== "active"
              || record.family_status !== "active"
              || record.grant_status !== "active"
              || record.sequence !== record.current_sequence
              || record.client_identifier !== input.clientIdentifier
              || input.resource !== undefined && record.resource !== input.resource
              || currentAbsolute <= now
              || currentIdle <= now
              || current === undefined
              || !eligibleForGrant(current, record.authentication_method)
              || current.security_epoch !== record.issued_security_epoch
              || current.global_security_epoch !== record.issued_global_epoch
              || scopes === undefined
              || requestedScopes === undefined
              || requestedScopes.some((scope) => !scopes.includes(scope))
            ) throw new PersistenceError("oauth_invalid_grant");
            const tokenCount = transaction.get<{ count: number }>(`
              SELECT
                (SELECT count(*) FROM oauth_refresh_tokens)
                + (SELECT count(*) FROM oauth_access_tokens) AS count
            `)?.count ?? 0;
            if (tokenCount + 2 > this.currentSettings().maxTokenRecords) {
              throw new PersistenceError("oauth_capacity_exceeded");
            }
            const nextSequence = record.sequence + 1;
            const idleExpiresAt = Math.min(
              currentAbsolute,
              now + Math.min(
                record.issued_refresh_idle_ms,
                this.currentSettings().refreshTokenIdleTtlMs,
              ),
            );
            const accessExpiresAt = now + Math.min(
              record.issued_access_ttl_ms,
              this.currentSettings().accessTokenTtlMs,
            );
            const used = transaction.run(`
              UPDATE oauth_refresh_tokens
              SET status = 'used', used_at = ?
              WHERE id = ? AND status = 'active'
            `, [now, record.id]);
            if (used.changes !== 1) {
              throw new PersistenceError("oauth_invalid_grant");
            }
            transaction.run(`
              INSERT INTO oauth_refresh_tokens (
                id, token_hash, family_id, sequence, status, issued_at, used_at
              ) VALUES (?, ?, ?, ?, 'active', ?, NULL)
            `, [
              refreshId,
              nextRefreshHash,
              record.family_id,
              nextSequence,
              now,
            ]);
            transaction.run(`
              INSERT INTO oauth_access_tokens (
                id, token_hash, grant_id, family_id, scopes_json,
                issued_at, expires_at, last_used_at, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `, [
              accessId,
              nextAccessHash,
              record.grant_id,
              record.family_id,
              JSON.stringify(requestedScopes),
              now,
              accessExpiresAt,
              now,
            ]);
            transaction.run(`
              UPDATE oauth_refresh_families
              SET current_sequence = ?, last_used_at = ?, idle_expires_at = ?,
                version = version + 1
              WHERE id = ? AND status = 'active'
            `, [
              nextSequence,
              now,
              idleExpiresAt,
              record.family_id,
            ]);
            transaction.run(`
              UPDATE oauth_grants
              SET last_used_at = ?, idle_expires_at = ?, version = version + 1
              WHERE id = ? AND status = 'active'
            `, [now, idleExpiresAt, record.grant_id]);
            return {
              value: {
                kind: "rotated" as const,
                scopes: requestedScopes,
                grantId: record.grant_id,
                accessExpiresAt,
              },
              auditInput: refreshAudit(
                record,
                input.correlationId,
                "allow",
                undefined,
                [
                  { field: "sequence", before: record.sequence, after: nextSequence },
                  { field: "scope_count", after: requestedScopes.length },
                ],
              ),
            };
          },
        ),
      });
      if (result.kind === "replay") {
        throw new DatabaseOAuthError("invalid_grant");
      }
      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        tokenType: "Bearer",
        expiresIn: Math.floor((result.accessExpiresAt - now) / 1_000),
        scopes: result.scopes,
        grantId: result.grantId,
      };
    } catch (error) {
      throw mapDatabaseOAuthError(error);
    }
  }

  async authenticateAccessToken(
    input: DatabaseOAuthAccessInput,
  ): Promise<DatabaseOAuthAccessAuthentication> {
    if (
      input.resource.length < 1
      || input.resource.length > 2048
      || input.requiredScopes.length > 32
      || input.requiredScopes.some((scope) =>
        scope.length < 1
        || scope.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(scope))
      || new Set(input.requiredScopes).size !== input.requiredScopes.length
    ) throw new DatabaseOAuthError("invalid_grant");
    let tokenHash: string;
    try {
      tokenHash = this.hasher.hash("access", input.accessToken);
    } catch {
      throw new DatabaseOAuthError("invalid_grant");
    }
    const now = safeNow(this.#now);
    try {
      return await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const record = transaction.get<AccessTokenRow>(`
            SELECT
              token.id, token.grant_id, token.family_id, token.scopes_json,
              token.issued_at AS token_issued_at,
              token.expires_at AS token_expires_at,
              token.status AS token_status,
              grant.user_id, grant.resource, grant.authentication_method,
              grant.issued_security_epoch, grant.issued_global_epoch,
              grant.issued_access_ttl_ms, grant.issued_refresh_idle_ms,
              grant.status AS grant_status,
              grant.issued_at AS grant_issued_at,
              grant.last_used_at AS grant_last_used_at,
              grant.absolute_expires_at AS grant_absolute_expires_at,
              grant.idle_expires_at AS grant_idle_expires_at,
              family.status AS family_status,
              family.issued_at AS family_issued_at,
              family.last_used_at AS family_last_used_at,
              family.absolute_expires_at AS family_absolute_expires_at,
              family.idle_expires_at AS family_idle_expires_at
            FROM oauth_access_tokens token
            JOIN oauth_grants grant ON grant.id = token.grant_id
            JOIN oauth_refresh_families family ON family.id = token.family_id
            WHERE token.token_hash = ?
          `, [tokenHash]);
          const current = record === undefined
            ? undefined
            : currentEligibility(transaction, record.user_id);
          const scopes = record === undefined
            ? undefined
            : parseStoredScopes(record.scopes_json);
          const absoluteExpiresAt = record === undefined
            ? 0
            : Math.min(
              record.grant_absolute_expires_at,
              record.family_absolute_expires_at,
              record.grant_issued_at + this.currentSettings().refreshTokenMaxTtlMs,
              record.family_issued_at + this.currentSettings().refreshTokenMaxTtlMs,
            );
          const idleExpiresAt = record === undefined
            ? 0
            : Math.min(
              absoluteExpiresAt,
              record.grant_idle_expires_at,
              record.family_idle_expires_at,
              record.grant_last_used_at + this.currentSettings().refreshTokenIdleTtlMs,
              record.family_last_used_at + this.currentSettings().refreshTokenIdleTtlMs,
            );
          const accessExpiresAt = record === undefined
            ? 0
            : Math.min(
              record.token_expires_at,
              record.token_issued_at + this.currentSettings().accessTokenTtlMs,
            );
          if (
            record === undefined
            || record.family_id === null
            || record.token_status !== "active"
            || record.grant_status !== "active"
            || record.family_status !== "active"
            || record.resource !== input.resource
            || accessExpiresAt <= now
            || absoluteExpiresAt <= now
            || idleExpiresAt <= now
            || current === undefined
            || !eligibleForGrant(current, record.authentication_method)
            || current.security_epoch !== record.issued_security_epoch
            || current.global_security_epoch !== record.issued_global_epoch
            || scopes === undefined
            || input.requiredScopes.some((scope) => !scopes.includes(scope))
          ) throw new PersistenceError("oauth_invalid_grant");
          const refreshedIdle = Math.min(
            absoluteExpiresAt,
            now + Math.min(
              record.issued_refresh_idle_ms,
              this.currentSettings().refreshTokenIdleTtlMs,
            ),
          );
          transaction.run(`
            UPDATE oauth_access_tokens SET last_used_at = ? WHERE id = ?
          `, [now, record.id]);
          transaction.run(`
            UPDATE oauth_refresh_families
            SET last_used_at = ?, idle_expires_at = ?, version = version + 1
            WHERE id = ? AND status = 'active'
          `, [now, refreshedIdle, record.family_id]);
          transaction.run(`
            UPDATE oauth_grants
            SET last_used_at = ?, idle_expires_at = ?, version = version + 1
            WHERE id = ? AND status = 'active'
          `, [now, refreshedIdle, record.grant_id]);
          recordQualifyingActivity(transaction, record.user_id, now);
          return {
            subject: record.user_id,
            scopes,
            mode: "builtin_oauth" as const,
          };
        }),
      });
    } catch (error) {
      throw mapDatabaseOAuthError(error);
    }
  }

  async sweepExpired(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new DatabaseOAuthError("unavailable");
    }
    const now = safeNow(this.#now);
    try {
      return await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const codes = transaction.run(`
            DELETE FROM oauth_authorization_codes
            WHERE id IN (
              SELECT id FROM oauth_authorization_codes
              WHERE consumed_at IS NOT NULL OR expires_at <= ?
              ORDER BY expires_at, id LIMIT ?
            )
          `, [now, limit]).changes;
          const intents = transaction.run(`
            DELETE FROM oauth_authorization_intents
            WHERE id IN (
              SELECT id FROM oauth_authorization_intents
              WHERE consumed_at IS NOT NULL OR expires_at <= ?
              ORDER BY expires_at, id LIMIT ?
            )
          `, [now, limit]).changes;
          const access = transaction.run(`
            DELETE FROM oauth_access_tokens
            WHERE id IN (
              SELECT id FROM oauth_access_tokens
              WHERE status = 'revoked' OR expires_at <= ?
              ORDER BY expires_at, id LIMIT ?
            )
          `, [now, limit]).changes;
          const refresh = transaction.run(`
            DELETE FROM oauth_refresh_tokens
            WHERE id IN (
              SELECT token.id
              FROM oauth_refresh_tokens token
              JOIN oauth_refresh_families family ON family.id = token.family_id
              WHERE family.status <> 'active'
                OR family.absolute_expires_at <= ?
                OR family.idle_expires_at <= ?
              ORDER BY token.issued_at, token.id LIMIT ?
            )
          `, [now, now, limit]).changes;
          return codes + intents + access + refresh;
        }),
      });
    } catch {
      throw new DatabaseOAuthError("unavailable");
    }
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new DatabaseOAuthError("unavailable");
    return value;
  }
}

export function isCanonicalOpaqueOAuthValue(value: string): boolean {
  if (!OPAQUE_VALUE_PATTERN.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength === 32 && decoded.toString("base64url") === value;
}

const ELIGIBILITY_SELECT = `
  SELECT
    u.id AS user_id,
    u.role,
    u.status,
    u.security_epoch,
    security.global_security_epoch,
    authenticators.password_state,
    authenticators.totp_state,
    EXISTS (
      SELECT 1
      FROM runtime_active_services active
      JOIN services service
        ON service.id = active.service_id
        AND service.lifecycle = 'published'
      JOIN service_principal_assignments assignment
        ON assignment.service_id = active.service_id
      JOIN runtime_activation activation
        ON activation.singleton = 1 AND activation.state = 'active'
      WHERE (
        assignment.selector_kind = 'all'
        OR (
            assignment.selector_kind = 'user'
            AND assignment.user_id = u.id
          )
        OR (
            assignment.selector_kind = 'group'
            AND EXISTS (
              SELECT 1
              FROM service_group_members member
              JOIN service_groups service_group
                ON service_group.id = member.group_id
                AND service_group.service_id = member.service_id
              WHERE member.service_id = assignment.service_id
                AND member.group_id = assignment.group_id
                AND member.user_id = u.id
                AND service_group.lifecycle = 'active'
            )
          )
      )
    ) AS has_effective_service
  FROM users u
  JOIN identity_security_state security ON security.singleton = 1
  JOIN local_authenticator_states authenticators
    ON authenticators.user_id = u.id
`;

interface AuthorizationCodeRow {
  id: string;
  grant_id: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  resource: string;
  scopes_json: string;
  code_challenge: string;
  issued_security_epoch: number;
  issued_global_epoch: number;
  expires_at: number;
  consumed_at: number | null;
  client_identifier: string;
  grant_status: string;
  absolute_expires_at: number;
  idle_expires_at: number;
  issued_access_ttl_ms: number;
}

interface RefreshTokenRow {
  id: string;
  family_id: string;
  sequence: number;
  token_status: string;
  family_status: string;
  current_sequence: number;
  family_issued_at: number;
  family_last_used_at: number;
  family_absolute_expires_at: number;
  family_idle_expires_at: number;
  grant_id: string;
  user_id: string;
  client_id: string;
  resource: string;
  scopes_json: string;
  authentication_method: "local_password_totp" | "oidc";
  issued_security_epoch: number;
  issued_global_epoch: number;
  issued_access_ttl_ms: number;
  issued_refresh_idle_ms: number;
  issued_refresh_absolute_ms: number;
  grant_status: string;
  grant_issued_at: number;
  grant_absolute_expires_at: number;
  grant_idle_expires_at: number;
  client_identifier: string;
}

interface AccessTokenRow {
  id: string;
  grant_id: string;
  family_id: string | null;
  scopes_json: string;
  token_issued_at: number;
  token_expires_at: number;
  token_status: string;
  user_id: string;
  resource: string;
  authentication_method: "local_password_totp" | "oidc";
  issued_security_epoch: number;
  issued_global_epoch: number;
  issued_access_ttl_ms: number;
  issued_refresh_idle_ms: number;
  grant_status: string;
  grant_issued_at: number;
  grant_last_used_at: number;
  grant_absolute_expires_at: number;
  grant_idle_expires_at: number;
  family_status: string;
  family_issued_at: number;
  family_last_used_at: number;
  family_absolute_expires_at: number;
  family_idle_expires_at: number;
}

interface ExternalIntentRow {
  id: string;
  client_id: string;
  redirect_uri: string;
  resource: string;
  scopes_json: string;
  code_challenge: string;
  state_envelope_json: string | null;
  provider_id: string;
  expires_at: number;
  consumed_at: number | null;
  user_id: string;
}

function eligibility(row: EligibilityRow): DatabaseOAuthEligibility {
  const hasEffectiveService = row.has_effective_service === 1;
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status,
    securityEpoch: row.security_epoch,
    globalSecurityEpoch: row.global_security_epoch,
    passwordState: row.password_state,
    totpState: row.totp_state,
    hasEffectiveService,
    localEligible: row.role === "user"
      && row.status === "active"
      && row.password_state === "configured"
      && row.totp_state === "configured"
      && hasEffectiveService,
  };
}

function currentEligibility(
  query: Pick<PersistenceQuery, "get">,
  userId: string,
): EligibilityRow | undefined {
  return query.get<EligibilityRow>(`
    ${ELIGIBILITY_SELECT}
    WHERE u.id = ?
  `, [userId]);
}

function normalizeAuthorizationInput(
  input: DatabaseOAuthAuthorizationInput,
): Omit<DatabaseOAuthAuthorizationInput, "proof"> {
  if (
    !isUuidV7(input.proof.userId)
    || input.client.identifier.length < 1
    || input.client.identifier.length > 2048
    || input.client.displayName.length < 1
    || input.client.displayName.length > 256
    || input.client.redirectUris.length < 1
    || input.client.redirectUris.length > 32
    || new Set(input.client.redirectUris).size !== input.client.redirectUris.length
    || input.client.redirectUris.some(
      (uri) => uri.length < 1 || uri.length > 2048,
    )
    || !input.client.redirectUris.includes(input.redirectUri)
    || input.resource.length < 1
    || input.resource.length > 2048
    || input.scopes.length < 1
    || input.scopes.length > 32
    || input.scopes.some(
      (scope) => scope.length < 1
        || scope.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(scope),
    )
    || new Set(input.scopes).size !== input.scopes.length
    || !isCanonicalOpaqueOAuthValue(input.codeChallenge)
  ) throw new DatabaseOAuthError("invalid_authorization");
  for (const uri of [input.client.identifier, ...input.client.redirectUris]) {
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new Error("invalid");
      }
    } catch {
      throw new DatabaseOAuthError("invalid_authorization");
    }
  }
  return {
    client: {
      identifier: input.client.identifier,
      displayName: input.client.displayName.normalize("NFKC").trim(),
      redirectUris: [...input.client.redirectUris].sort(),
    },
    redirectUri: input.redirectUri,
    resource: input.resource,
    scopes: [...input.scopes].sort(),
    codeChallenge: input.codeChallenge,
  };
}

function normalizeIntentInput(
  input: DatabaseOAuthIntentInput,
): DatabaseOAuthIntentInput {
  const normalized = normalizeAuthorizationInput({
    proof: {
      userId: "018f1f2e-7b3c-7a10-8000-000000000001",
      role: "user",
      securityEpoch: 1,
      globalSecurityEpoch: 1,
      acceptedTotpStep: 0,
      verifiedAt: 0,
      correlationId: "req_12345678-1234-4234-8234-123456789abc",
    },
    client: input.client,
    redirectUri: input.redirectUri,
    resource: input.resource,
    scopes: input.scopes,
    codeChallenge: input.codeChallenge,
  });
  if (
    !/^[a-z][a-z0-9_.-]{0,63}$/.test(input.providerId)
    || input.stateEnvelopeJson !== undefined && (
      input.stateEnvelopeJson.length < 2
      || input.stateEnvelopeJson.length > 8192
      || !isJsonObject(input.stateEnvelopeJson)
    )
  ) throw new DatabaseOAuthError("invalid_authorization");
  return {
    ...normalized,
    providerId: input.providerId,
    ...(input.stateEnvelopeJson === undefined
      ? {}
      : { stateEnvelopeJson: input.stateEnvelopeJson }),
  };
}

function isJsonObject(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function normalizeRefreshInput(
  input: DatabaseOAuthRefreshInput,
): DatabaseOAuthRefreshInput {
  if (
    input.clientIdentifier.length < 1
    || input.clientIdentifier.length > 2048
    || input.resource !== undefined
      && (input.resource.length < 1 || input.resource.length > 2048)
    || input.scopes !== undefined && (
      input.scopes.length < 1
      || input.scopes.length > 32
      || input.scopes.some((scope) =>
        scope.length < 1
        || scope.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(scope))
      || new Set(input.scopes).size !== input.scopes.length
    )
    || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input.correlationId,
    )
  ) throw new DatabaseOAuthError("invalid_grant");
  return {
    ...input,
    ...(input.scopes === undefined ? {} : { scopes: [...input.scopes].sort() }),
  };
}

function eligibleForGrant(
  row: EligibilityRow,
  method: "local_password_totp" | "oidc",
): boolean {
  const base = row.role === "user"
    && row.status === "active"
    && row.has_effective_service === 1;
  return method === "oidc"
    ? base
    : base
      && row.password_state === "configured"
      && row.totp_state === "configured";
}

function refreshAudit(
  record: RefreshTokenRow,
  correlationId: string,
  result: "allow" | "deny",
  failureCode: string | undefined,
  changes: Array<{
    field: string;
    before?: string | number | boolean;
    after?: string | number | boolean;
  }>,
) {
  return {
    actor: {
      type: "system" as const,
      id: record.client_id,
      label: `client:${record.client_id}`,
      authenticationMethod: "oauth_refresh",
    },
    action: result === "allow" ? "oauth.refresh_rotate" : "oauth.refresh_replay",
    result,
    target: {
      type: "oauth_grant",
      id: record.grant_id,
      label: `grant:${record.grant_id}`,
    },
    changes,
    correlationId,
    source: { category: "oauth" },
    ...(failureCode === undefined ? {} : { failureCode }),
  };
}

function mapDatabaseOAuthError(error: unknown): DatabaseOAuthError {
  if (error instanceof DatabaseOAuthError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "oauth_invalid_authorization") {
      return new DatabaseOAuthError("invalid_authorization");
    }
    if (error.code === "oauth_invalid_grant") {
      return new DatabaseOAuthError("invalid_grant");
    }
    if (error.code === "oauth_capacity_exceeded") {
      return new DatabaseOAuthError("capacity_exceeded");
    }
  }
  return new DatabaseOAuthError("unavailable");
}

function upsertClient(
  transaction: PersistenceTransaction,
  proposedId: string,
  client: DatabaseOAuthClientInput,
  now: number,
): { id: string } {
  const metadataJson = canonicalJson({
    clientId: client.identifier,
    redirectUris: client.redirectUris,
  });
  const digest = createHash("sha256").update(metadataJson, "utf8").digest("hex");
  const existing = transaction.get<{
    id: string;
    lifecycle: string;
    metadata_digest: string;
  }>(`
    SELECT id, lifecycle, metadata_digest
    FROM oauth_clients WHERE client_identifier = ?
  `, [client.identifier]);
  if (existing !== undefined) {
    if (
      existing.lifecycle !== "active"
      || existing.metadata_digest !== digest
    ) throw new DatabaseOAuthError("invalid_authorization");
    transaction.run(`
      UPDATE oauth_clients
      SET display_name = ?, last_seen_at = ?, version = version + 1
      WHERE id = ?
    `, [client.displayName, now, existing.id]);
    return { id: existing.id };
  }
  transaction.run(`
    INSERT INTO oauth_clients (
      id, client_identifier, display_name, metadata_json, metadata_digest,
      lifecycle, first_seen_at, last_seen_at, version
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1)
  `, [
    proposedId,
    client.identifier,
    client.displayName,
    metadataJson,
    digest,
    now,
    now,
  ]);
  return { id: proposedId };
}

function parseStoredScopes(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !Array.isArray(parsed)
      || parsed.length < 1
      || parsed.length > 32
      || parsed.some((scope) =>
        typeof scope !== "string"
        || scope.length < 1
        || scope.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(scope))
      || new Set(parsed).size !== parsed.length
    ) throw new Error("invalid");
    return parsed;
  } catch {
    throw new DatabaseOAuthError("unavailable");
  }
}

function opaque(random: (size: number) => Buffer): string {
  const value = random(32);
  if (value.byteLength !== 32) throw new DatabaseOAuthError("unavailable");
  return value.toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function safeNow(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DatabaseOAuthError("unavailable");
  }
  return value;
}
