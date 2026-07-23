import { createHmac, randomBytes } from "node:crypto";
import type { ControlAuthenticationContext } from "../control/authentication.js";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig, OidcProviderConfig } from "../types.js";
import type { ValidatedBrowserSession } from "./browserSessions.js";
import type { ValidatedRestrictedSession } from "./enrollment.js";
import type { BrowserSessionMaterial, LoginResult } from "./localAuthentication.js";
import type { OidcFlowBinding } from "./oidcFlow.js";
import type { ProviderAssertion } from "./provider.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./stepUp.js";
import { parseIdentityProfile } from "./validation.js";

const SESSION_DOMAIN = "secretsauce.browser-session.v1";
const CSRF_DOMAIN = "secretsauce.browser-csrf.v1";

interface LinkTarget {
  id: string;
  email: string;
  normalized_email: string;
  given_name: string;
  family_name: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  security_epoch: number;
  global_security_epoch: number;
  version: number;
  email_source: string;
  given_name_source: string;
  family_name_source: string;
}

export interface OidcLinkView {
  id: string;
  providerId: string;
  providerDisplayName: string;
  createdAt: number;
  lastAuthenticatedAt?: number;
}

export class OidcLinkError extends Error {
  constructor(readonly code: "invalid" | "stale" | "conflict" | "last_method" | "unavailable") {
    super("External identity linking could not be completed.");
    this.name = "OidcLinkError";
  }
}

export class OidcLinkRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly stepUps?: StepUpRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async restrictedBinding(session: ValidatedRestrictedSession): Promise<OidcFlowBinding> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          const row = query.get<{ version: number }>(`
            SELECT u.version
            FROM identity_restricted_sessions rs
            JOIN users u ON u.id = rs.user_id
            JOIN identity_security_state sec ON sec.singleton = 1
            WHERE rs.id = ? AND rs.user_id = ?
              AND rs.purpose = 'initial_enrollment'
              AND rs.revoked_at IS NULL AND rs.expires_at > ?
              AND rs.issued_security_epoch = u.security_epoch
              AND rs.issued_global_epoch = sec.global_security_epoch
              AND u.status IN ('invited', 'enrollment_required')
          `, [session.sessionId, session.userId, safeNow(this.now)]);
          if (row === undefined || session.purpose !== "initial_enrollment") {
            throw new PersistenceError("authentication_failed");
          }
          return {
            purpose: "restricted_link",
            targetUserId: session.userId,
            actorUserId: session.userId,
            actorSessionId: session.sessionId,
            targetVersion: row.version,
          };
        }),
      });
    } catch {
      throw new OidcLinkError("invalid");
    }
  }

  async adminBinding(
    actor: ControlAuthenticationContext,
    session: ValidatedBrowserSession,
    targetUserId: string,
    expectedVersion: number,
  ): Promise<OidcFlowBinding> {
    if (
      actor.method !== "browser_session" ||
      actor.role !== "superadmin" ||
      actor.principalId !== session.userId ||
      !isUuidV7(targetUserId) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1 ||
      targetUserId === actor.principalId
    ) throw new OidcLinkError("invalid");
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          requireLiveSuperadminSession(query, actor.principalId, session.sessionId, safeNow(this.now));
          const target = query.get<{ version: number; status: string }>(
            "SELECT version, status FROM users WHERE id = ?",
            [targetUserId],
          );
          if (target === undefined || target.status === "deactivated") {
            throw new PersistenceError("identity_not_found");
          }
          if (target.version !== expectedVersion) throw new PersistenceError("identity_stale");
          return {
            purpose: "superadmin_link",
            targetUserId,
            actorUserId: actor.principalId,
            actorSessionId: session.sessionId,
            targetVersion: expectedVersion,
          };
        }),
      });
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "identity_stale") {
        throw new OidcLinkError("stale");
      }
      throw new OidcLinkError("invalid");
    }
  }

  async completeRestricted(input: {
    assertion: ProviderAssertion;
    provider: OidcProviderConfig;
    binding: OidcFlowBinding;
    linkId: string;
    eventId: string;
    session: BrowserSessionMaterial;
    sessionSettings: IdentityConfig["sessions"];
    correlationId: string;
  }): Promise<{ userId: string; role: "superadmin" | "admin" | "user" }> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const now = safeNow(this.now);
          const target = requiredRestrictedTarget(transaction, input.binding, now);
          insertLink(transaction, input, target.id, now);
          applyLinkedProfile(
            transaction,
            target,
            input.provider,
            input.assertion,
            input.linkId,
            now,
          );
          transaction.run("DELETE FROM local_password_credentials WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM local_totp_authenticators WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM identity_temporary_passwords WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM identity_pending_totp WHERE user_id = ?", [target.id]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'disabled', totp_state = 'disabled',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, target.id]);
          const counts = revokeSessions(transaction, target.id, now);
          const updated = transaction.run(`
            UPDATE users
            SET status = 'active', security_epoch = security_epoch + 1,
                version = version + 1, last_login_at = ?,
                last_authenticated_at = ?, updated_at = ?
            WHERE id = ? AND version = ?
          `, [now, now, now, target.id, target.version]);
          if (updated.changes !== 1) throw new PersistenceError("identity_stale");
          insertInvalidation(transaction, input.eventId, target.id, counts, now);
          insertSession(
            transaction,
            input.session,
            input.sessionSettings,
            target,
            target.security_epoch + 1,
          );
          return {
            value: { userId: target.id, role: target.role },
            auditInput: linkAudit(
              target.id,
              target.role,
              input.provider.id,
              input.correlationId,
              "restricted_session",
            ),
          };
        }),
      });
    } catch (error) {
      throw mapLinkError(error);
    }
  }

  async completeAdmin(input: {
    assertion: ProviderAssertion;
    provider: OidcProviderConfig;
    binding: OidcFlowBinding;
    linkId: string;
    eventId: string;
    correlationId: string;
  }): Promise<void> {
    try {
      await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const now = safeNow(this.now);
          const { actor, target } = requiredAdminTargets(transaction, input.binding, now);
          insertLink(transaction, input, target.id, now);
          applyLinkedProfile(
            transaction,
            target,
            input.provider,
            input.assertion,
            input.linkId,
            now,
          );
          const counts = revokeSessions(transaction, target.id, now);
          const updated = transaction.run(`
            UPDATE users
            SET security_epoch = security_epoch + 1,
                version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?
          `, [now, target.id, target.version]);
          if (updated.changes !== 1) throw new PersistenceError("identity_stale");
          insertInvalidation(transaction, input.eventId, target.id, counts, now);
          return {
            value: undefined,
            auditInput: {
              ...linkAudit(
                target.id,
                target.role,
                input.provider.id,
                input.correlationId,
                "browser_session",
              ),
              actor: {
                type: "browser_session",
                id: actor.id,
                label: `user:${actor.id}`,
                role: actor.role,
                authenticationMethod: "browser_session",
              },
            },
          };
        }),
      });
    } catch (error) {
      throw mapLinkError(error);
    }
  }

  async links(userId: string): Promise<Array<{
    id: string;
    provider_id: string;
    created_at: number;
    last_authenticated_at: number | null;
  }>> {
    if (!isUuidV7(userId)) throw new OidcLinkError("invalid");
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => query.all(`
          SELECT id, provider_id, created_at, last_authenticated_at
          FROM external_identities WHERE user_id = ?
          ORDER BY provider_id, id
        `, [userId])),
      });
    } catch {
      throw new OidcLinkError("unavailable");
    }
  }

  async unlink(input: {
    actor: ControlAuthenticationContext;
    session: ValidatedBrowserSession;
    targetUserId: string;
    linkId: string;
    expectedVersion: number;
    justification: string;
    eventId: string;
    correlationId: string;
    proof?: AlwaysStepUpHandle;
  }): Promise<number> {
    const audit: AdministrativeAuditEventInput = {
      actor: {
        type: "browser_session",
        id: input.actor.principalId,
        label: `user:${input.actor.principalId}`,
        role: input.actor.role,
        authenticationMethod: "browser_session",
      },
      action: "identity.oidc_unlink",
      result: "allow",
      target: {
        type: "user",
        id: input.targetUserId,
        label: `user:${input.targetUserId}`,
      },
      justification: input.justification,
      changes: [{ field: "provider_link", after: "removed" }],
      correlationId: input.correlationId,
      source: { category: "identity" },
    };
    const execute = (transaction: PersistenceTransaction): number => {
      const now = safeNow(this.now);
      requireLiveSuperadminSession(
        transaction,
        input.actor.principalId,
        input.session.sessionId,
        now,
      );
      if (input.targetUserId === input.actor.principalId) {
        throw new PersistenceError("identity_not_found");
      }
      const target = requiredTarget(transaction, input.targetUserId);
      if (target.version !== input.expectedVersion) throw new PersistenceError("identity_stale");
      const link = transaction.get<{ provider_id: string }>(
        "SELECT provider_id FROM external_identities WHERE id = ? AND user_id = ?",
        [input.linkId, target.id],
      );
      if (link === undefined) throw new PersistenceError("identity_not_found");
      if (target.status === "active" && !hasAlternativeMethod(transaction, target.id, input.linkId)) {
        throw new PersistenceError("authentication_method_required");
      }
      transaction.run("DELETE FROM external_identities WHERE id = ? AND user_id = ?", [
        input.linkId,
        target.id,
      ]);
      const updated = transaction.run(`
        UPDATE users
        SET email_source = CASE WHEN email_source = ? THEN 'local' ELSE email_source END,
            given_name_source = CASE WHEN given_name_source = ? THEN 'local' ELSE given_name_source END,
            family_name_source = CASE WHEN family_name_source = ? THEN 'local' ELSE family_name_source END,
            security_epoch = security_epoch + 1, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `, [
        `oidc:${link.provider_id}`,
        `oidc:${link.provider_id}`,
        `oidc:${link.provider_id}`,
        now,
        target.id,
        target.version,
      ]);
      if (updated.changes !== 1) throw new PersistenceError("identity_stale");
      const counts = revokeSessions(transaction, target.id, now);
      insertInvalidation(transaction, input.eventId, target.id, counts, now);
      return target.version + 1;
    };
    try {
      if (input.proof !== undefined) {
        if (this.stepUps === undefined) throw new PersistenceError("authentication_failed");
        return await this.stepUps.withConsumedProof(input.proof, audit, execute);
      }
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => ({
          value: execute(transaction),
          auditInput: audit,
        })),
      });
    } catch (error) {
      throw mapLinkError(error);
    }
  }
}

export class OidcLinkService {
  readonly #sessionKey: Buffer;
  readonly #uuid: () => string;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;

  constructor(
    private readonly repository: OidcLinkRepository,
    private readonly config: IdentityConfig,
    sessionKey: Buffer,
    options: {
      uuid?: () => string;
      now?: () => number;
      random?: (size: number) => Buffer;
    } = {},
  ) {
    if (sessionKey.byteLength !== 32) throw new Error("Invalid browser session key.");
    this.#sessionKey = Buffer.from(sessionKey);
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  restrictedBinding(session: ValidatedRestrictedSession): Promise<OidcFlowBinding> {
    return this.repository.restrictedBinding(session);
  }

  adminBinding(
    actor: ControlAuthenticationContext,
    session: ValidatedBrowserSession,
    targetUserId: string,
    expectedVersion: number,
  ): Promise<OidcFlowBinding> {
    return this.repository.adminBinding(actor, session, targetUserId, expectedVersion);
  }

  beginStepUp(
    actor: ControlAuthenticationContext,
    targetUserId: string,
    providerId: string,
    justification: string,
    correlationId: string,
    proof?: AlwaysStepUpHandle,
  ): { proof: AlwaysStepUpHandle; audit: AdministrativeAuditEventInput } | undefined {
    if (proof === undefined) return undefined;
    return {
      proof,
      audit: {
        actor: {
          type: "browser_session",
          id: actor.principalId,
          label: `user:${actor.principalId}`,
          role: actor.role,
          authenticationMethod: "browser_session",
        },
        action: "identity.oidc_link_begin",
        result: "allow",
        target: { type: "user", id: targetUserId, label: `user:${targetUserId}` },
        justification,
        changes: [{ field: "provider", after: providerId }],
        correlationId,
        source: { category: "identity" },
      },
    };
  }

  async completeRestricted(
    assertion: ProviderAssertion,
    binding: OidcFlowBinding,
    correlationId: string,
  ): Promise<LoginResult> {
    const provider = this.provider(assertion);
    const issuedAt = safeNow(this.#now);
    const sessionToken = opaque(this.#random);
    const csrfToken = opaque(this.#random);
    const session = sessionMaterial(
      this.nextUuid(),
      sessionToken,
      csrfToken,
      "user",
      this.config.sessions,
      this.#sessionKey,
      issuedAt,
    );
    const linked = await this.repository.completeRestricted({
      assertion,
      provider,
      binding,
      linkId: this.nextUuid(),
      eventId: this.nextUuid(),
      session,
      sessionSettings: this.config.sessions,
      correlationId,
    });
    const roleClass = linked.role === "user" ? "user" : "admin";
    const absoluteMs = roleClass === "user"
      ? this.config.sessions.userAbsoluteMs
      : this.config.sessions.adminAbsoluteMs;
    return {
      sessionId: session.id,
      userId: linked.userId,
      role: linked.role,
      sessionToken,
      csrfToken,
      issuedAt,
      absoluteExpiresAt: issuedAt + absoluteMs,
    };
  }

  async completeAdmin(
    assertion: ProviderAssertion,
    binding: OidcFlowBinding,
    correlationId: string,
  ): Promise<void> {
    await this.repository.completeAdmin({
      assertion,
      provider: this.provider(assertion),
      binding,
      linkId: this.nextUuid(),
      eventId: this.nextUuid(),
      correlationId,
    });
  }

  async links(userId: string): Promise<OidcLinkView[]> {
    const rows = await this.repository.links(userId);
    return rows.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      providerDisplayName: this.config.oidc?.providers[row.provider_id]?.displayName ?? row.provider_id,
      createdAt: row.created_at,
      ...(row.last_authenticated_at === null
        ? {}
        : { lastAuthenticatedAt: row.last_authenticated_at }),
    }));
  }

  unlink(input: {
    actor: ControlAuthenticationContext;
    session: ValidatedBrowserSession;
    targetUserId: string;
    linkId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    proof?: AlwaysStepUpHandle;
  }): Promise<number> {
    return this.repository.unlink({
      ...input,
      eventId: this.nextUuid(),
    });
  }

  close(): void {
    this.#sessionKey.fill(0);
  }

  private provider(assertion: ProviderAssertion): OidcProviderConfig {
    const provider = this.config.oidc?.providers[assertion.providerId];
    if (
      provider === undefined ||
      provider.issuer !== assertion.issuer ||
      !assertion.mfa.verified
    ) throw new OidcLinkError("invalid");
    return provider;
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new OidcLinkError("unavailable");
    return value;
  }
}

function requiredRestrictedTarget(
  transaction: PersistenceTransaction,
  binding: OidcFlowBinding,
  now: number,
): LinkTarget {
  if (
    binding.purpose !== "restricted_link" ||
    binding.targetUserId === undefined ||
    binding.actorUserId !== binding.targetUserId ||
    binding.actorSessionId === undefined ||
    binding.targetVersion === undefined
  ) throw new PersistenceError("authentication_failed");
  const target = transaction.get<LinkTarget>(`
    SELECT u.*, sec.global_security_epoch
    FROM users u
    JOIN identity_security_state sec ON sec.singleton = 1
    JOIN identity_restricted_sessions rs ON rs.user_id = u.id
    WHERE u.id = ? AND rs.id = ?
      AND rs.purpose = 'initial_enrollment'
      AND rs.revoked_at IS NULL AND rs.expires_at > ?
      AND rs.issued_security_epoch = u.security_epoch
      AND rs.issued_global_epoch = sec.global_security_epoch
      AND u.status IN ('invited', 'enrollment_required')
  `, [binding.targetUserId, binding.actorSessionId, now]);
  if (target === undefined || target.version !== binding.targetVersion) {
    throw new PersistenceError("authentication_failed");
  }
  return target;
}

function requiredAdminTargets(
  transaction: PersistenceTransaction,
  binding: OidcFlowBinding,
  now: number,
): { actor: LinkTarget; target: LinkTarget } {
  if (
    binding.purpose !== "superadmin_link" ||
    binding.targetUserId === undefined ||
    binding.actorUserId === undefined ||
    binding.actorSessionId === undefined ||
    binding.targetVersion === undefined ||
    binding.targetUserId === binding.actorUserId
  ) throw new PersistenceError("authentication_failed");
  requireLiveSuperadminSession(transaction, binding.actorUserId, binding.actorSessionId, now);
  const actor = requiredTarget(transaction, binding.actorUserId);
  const target = requiredTarget(transaction, binding.targetUserId);
  if (
    actor.role !== "superadmin" ||
    actor.status !== "active" ||
    target.status === "deactivated" ||
    target.version !== binding.targetVersion
  ) throw new PersistenceError("authentication_failed");
  return { actor, target };
}

function requireLiveSuperadminSession(
  transaction: Pick<PersistenceTransaction, "get">,
  actorId: string,
  sessionId: string,
  now: number,
): void {
  const row = transaction.get<{ valid: number }>(`
    SELECT 1 AS valid
    FROM browser_sessions bs
    JOIN users u ON u.id = bs.user_id
    JOIN identity_security_state sec ON sec.singleton = 1
    WHERE bs.id = ? AND bs.user_id = ?
      AND bs.revoked_at IS NULL AND bs.absolute_expires_at > ?
      AND u.status = 'active' AND u.role = 'superadmin'
      AND bs.issued_security_epoch = u.security_epoch
      AND bs.issued_global_epoch = sec.global_security_epoch
  `, [sessionId, actorId, now]);
  if (row === undefined) throw new PersistenceError("authentication_failed");
}

function requiredTarget(transaction: PersistenceTransaction, userId: string): LinkTarget {
  const row = transaction.get<LinkTarget>(`
    SELECT u.*, sec.global_security_epoch
    FROM users u JOIN identity_security_state sec ON sec.singleton = 1
    WHERE u.id = ?
  `, [userId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function insertLink(
  transaction: PersistenceTransaction,
  input: {
    assertion: ProviderAssertion;
    provider: OidcProviderConfig;
    linkId: string;
  },
  userId: string,
  now: number,
): void {
  transaction.run(`
    INSERT INTO external_identities (
      id, user_id, provider_id, issuer, subject,
      last_authenticated_at, last_claim_update_at,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
  `, [
    input.linkId,
    userId,
    input.provider.id,
    input.assertion.issuer,
    input.assertion.subject,
    now,
    now,
    now,
  ]);
}

function applyLinkedProfile(
  transaction: PersistenceTransaction,
  target: LinkTarget,
  provider: OidcProviderConfig,
  assertion: ProviderAssertion,
  linkId: string,
  now: number,
): void {
  const owned = new Set(provider.profileClaims.providerOwnedFields);
  const profile = assertion.profile;
  if (profile === undefined) return;
  const emailOwned = owned.has("email") &&
    profile.email !== undefined &&
    profile.emailVerified === true;
  const givenOwned = owned.has("given_name") && profile.givenName !== undefined;
  const familyOwned = owned.has("family_name") && profile.familyName !== undefined;
  let parsed: ReturnType<typeof parseIdentityProfile>;
  try {
    parsed = parseIdentityProfile({
      email: emailOwned ? profile.email : target.email,
      givenName: givenOwned ? profile.givenName : target.given_name,
      familyName: familyOwned ? profile.familyName : target.family_name,
    });
  } catch {
    return;
  }
  if (
    parsed.normalizedEmail !== target.normalized_email &&
    transaction.get<{ present: number }>(
      "SELECT 1 AS present FROM users WHERE normalized_email = ? AND id <> ?",
      [parsed.normalizedEmail, target.id],
    ) !== undefined
  ) return;
  transaction.run(`
    UPDATE users
    SET email = ?, normalized_email = ?, given_name = ?, family_name = ?,
        email_source = ?, given_name_source = ?, family_name_source = ?,
        updated_at = ?
    WHERE id = ?
  `, [
    parsed.email,
    parsed.normalizedEmail,
    parsed.givenName,
    parsed.familyName,
    emailOwned ? `oidc:${provider.id}` : target.email_source,
    givenOwned ? `oidc:${provider.id}` : target.given_name_source,
    familyOwned ? `oidc:${provider.id}` : target.family_name_source,
    now,
    target.id,
  ]);
  transaction.run(`
    UPDATE external_identities SET last_claim_update_at = ?, updated_at = ?
    WHERE id = ?
  `, [now, now, linkId]);
}

function revokeSessions(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): { browser: number; restricted: number } {
  const browser = Number(transaction.run(`
    UPDATE browser_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  const restricted = Number(transaction.run(`
    UPDATE identity_restricted_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  return { browser, restricted };
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  eventId: string,
  userId: string,
  counts: { browser: number; restricted: number },
  now: number,
): void {
  transaction.run(`
    INSERT INTO identity_invalidation_events (
      id, user_id, reason, browser_sessions_revoked,
      restricted_sessions_revoked, created_at, dispatched_at, attempts
    ) VALUES (?, ?, 'provider_link_change', ?, ?, ?, NULL, 0)
  `, [eventId, userId, counts.browser, counts.restricted, now]);
}

function insertSession(
  transaction: PersistenceTransaction,
  session: BrowserSessionMaterial,
  settings: IdentityConfig["sessions"],
  target: LinkTarget,
  securityEpoch: number,
): void {
  const roleClass = target.role === "user" ? "user" : "admin";
  const absoluteMs = roleClass === "user" ? settings.userAbsoluteMs : settings.adminAbsoluteMs;
  const inactivityMs = roleClass === "user"
    ? settings.userInactivityMs
    : settings.adminInactivityMs;
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
    target.id,
    session.sessionHash,
    session.csrfHash,
    roleClass,
    securityEpoch,
    target.global_security_epoch,
    absoluteMs,
    inactivityMs,
    session.issuedAt,
    session.issuedAt,
    session.issuedAt + absoluteMs,
  ]);
}

function hasAlternativeMethod(
  transaction: PersistenceTransaction,
  userId: string,
  removedLinkId: string,
): boolean {
  const local = transaction.get<{ valid: number }>(`
    SELECT 1 AS valid
    FROM local_authenticator_states a
    JOIN local_password_credentials p ON p.user_id = a.user_id
    JOIN local_totp_authenticators t ON t.user_id = a.user_id
    WHERE a.user_id = ?
      AND a.password_state = 'configured' AND a.totp_state = 'configured'
  `, [userId]);
  if (local !== undefined) return true;
  return transaction.get<{ valid: number }>(`
    SELECT 1 AS valid FROM external_identities
    WHERE user_id = ? AND id <> ? LIMIT 1
  `, [userId, removedLinkId]) !== undefined;
}

function sessionMaterial(
  id: string,
  sessionToken: string,
  csrfToken: string,
  role: "superadmin" | "admin" | "user",
  settings: IdentityConfig["sessions"],
  key: Buffer,
  issuedAt: number,
): BrowserSessionMaterial {
  const roleClass = role === "user" ? "user" : "admin";
  return {
    id,
    sessionHash: keyedHash(key, SESSION_DOMAIN, sessionToken),
    csrfHash: keyedHash(key, CSRF_DOMAIN, csrfToken),
    roleClass,
    securityEpoch: 0,
    globalSecurityEpoch: 1,
    absoluteMs: roleClass === "user" ? settings.userAbsoluteMs : settings.adminAbsoluteMs,
    inactivityMs: roleClass === "user"
      ? settings.userInactivityMs
      : settings.adminInactivityMs,
    issuedAt,
  };
}

function linkAudit(
  userId: string,
  role: "superadmin" | "admin" | "user",
  providerId: string,
  correlationId: string,
  authenticationMethod: string,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: userId,
      label: `user:${userId}`,
      role,
      authenticationMethod,
    },
    action: "identity.oidc_link",
    result: "allow",
    target: { type: "user", id: userId, label: `user:${userId}` },
    changes: [{ field: "provider", after: providerId }],
    correlationId,
    source: { category: "identity" },
  };
}

function mapLinkError(error: unknown): OidcLinkError {
  if (error instanceof OidcLinkError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_stale") return new OidcLinkError("stale");
    if (error.code === "authentication_method_required") return new OidcLinkError("last_method");
    if (error.code === "identity_conflict") return new OidcLinkError("conflict");
    if (["authentication_failed", "identity_not_found"].includes(error.code)) {
      return new OidcLinkError("invalid");
    }
  }
  return new OidcLinkError("conflict");
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value).digest("hex");
}

function opaque(random: (size: number) => Buffer): string {
  const value = random(32);
  if (!Buffer.isBuffer(value) || value.byteLength !== 32) {
    value?.fill?.(0);
    throw new OidcLinkError("unavailable");
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
