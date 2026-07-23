import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserSessionAuthenticator,
  BrowserSessionRepository,
} from "../src/identity/browserSessions.js";
import type { ValidatedBrowserSession } from "../src/identity/browserSessions.js";
import {
  LocalControlAuthenticator,
  LocalEnrollmentRepository,
  RestrictedSessionAuthenticator,
  type ValidatedRestrictedSession,
} from "../src/identity/enrollment.js";
import type { LocalAuthenticationService } from "../src/identity/localAuthentication.js";
import type { OidcFlowService } from "../src/identity/oidcFlow.js";
import type { OidcLoginService } from "../src/identity/oidcLogin.js";
import {
  OidcLinkError,
  OidcLinkRepository,
  OidcLinkService,
} from "../src/identity/oidcLink.js";
import type { ProviderAssertion } from "../src/identity/provider.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { createControlApplication } from "../src/control/server.js";
import type { GatewayConfig, IdentityConfig, OidcProviderConfig } from "../src/types.js";
import { registryConfig } from "./helpers.js";

const NOW = 1_785_000_000_000;
const REQUEST_ID = "req_12345678-1234-4234-8234-123456789abc";
const USER = "019f9a4a-7a00-7000-8000-000000000001";
const ACTOR = "019f9a4a-7a00-7000-8000-000000000002";
const RESTRICTED = "019f9a4a-7a00-7000-8000-000000000003";
const ACTOR_SESSION = "019f9a4a-7a00-7000-8000-000000000004";
const TARGET_SESSION = "019f9a4a-7a00-7000-8000-000000000005";
const SESSION_KEY = Buffer.alloc(32, 91);
const ADMIN_TOKEN = "a".repeat(43);
const ADMIN_CSRF = "b".repeat(43);
const RESTRICTED_TOKEN = "c".repeat(43);
const RESTRICTED_CSRF = "d".repeat(43);
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("guarded OIDC identity linking", () => {
  it("converts an exact live restricted enrollment into an external-only active session", async () => {
    const worker = open();
    await seedRestricted(worker);
    const uuids = uuidSource([
      "019f9a4a-7a00-7000-8000-000000000010",
      "019f9a4a-7a00-7000-8000-000000000011",
      "019f9a4a-7a00-7000-8000-000000000012",
    ]);
    const service = new OidcLinkService(
      new OidcLinkRepository(worker, undefined, () => NOW),
      config(),
      SESSION_KEY,
      { now: () => NOW, uuid: uuids },
    );
    const restricted: ValidatedRestrictedSession = {
      sessionId: RESTRICTED,
      userId: USER,
      role: "user",
      purpose: "initial_enrollment",
      csrfHash: "a".repeat(64),
      expiresAt: NOW + 300_000,
    };
    const binding = await service.restrictedBinding(restricted);
    const login = await service.completeRestricted(assertion(), binding, REQUEST_ID);
    expect(login).toMatchObject({ userId: USER, role: "user" });
    const stored = await snapshot(worker, USER);
    expect(stored).toMatchObject({
      status: "active",
      password_state: "disabled",
      totp_state: "disabled",
      security_epoch: 2,
      link_count: 1,
      restricted_revoked: 1,
      invalidation_reason: "provider_link_change",
      email: "provider@example.org",
      email_source: "oidc:workforce",
      given_name_source: "oidc:workforce",
      family_name_source: "oidc:workforce",
    });
    const sessionHash = keyedHash(
      SESSION_KEY,
      "secretsauce.browser-session.v1",
      login.sessionToken,
    );
    await expect(new BrowserSessionRepository(worker, () => NOW + 1)
      .authenticate(sessionHash, config().sessions))
      .resolves.toMatchObject({ userId: USER, role: "user" });
    const audit = await auditText(worker);
    expect(audit).not.toContain("immutable-subject");
    expect(audit).not.toContain(login.sessionToken);
    service.close();
  });

  it("binds superadmin linking to actor session and target version, then prevents last-method unlink", async () => {
    const worker = open();
    await seedAdmin(worker);
    const uuids = uuidSource([
      "019f9a4a-7a00-7000-8000-000000000020",
      "019f9a4a-7a00-7000-8000-000000000021",
      "019f9a4a-7a00-7000-8000-000000000022",
      "019f9a4a-7a00-7000-8000-000000000023",
    ]);
    const service = new OidcLinkService(
      new OidcLinkRepository(worker, undefined, () => NOW),
      config(),
      SESSION_KEY,
      { now: () => NOW, uuid: uuids },
    );
    const actor = {
      method: "browser_session",
      principalId: ACTOR,
      role: "superadmin",
    } as const;
    const session: ValidatedBrowserSession = {
      sessionId: ACTOR_SESSION,
      userId: ACTOR,
      role: "superadmin",
      csrfHash: "b".repeat(64),
      issuedAt: NOW - 1_000,
      absoluteExpiresAt: NOW + 300_000,
    };
    const binding = await service.adminBinding(actor, session, USER, 1);
    await service.completeAdmin(assertion(), binding, REQUEST_ID);
    expect(await service.links(USER)).toEqual([
      expect.objectContaining({
        id: "019f9a4a-7a00-7000-8000-000000000020",
        providerId: "workforce",
        providerDisplayName: "Workforce",
      }),
    ]);
    const afterLink = await snapshot(worker, USER);
    expect(afterLink).toMatchObject({
      security_epoch: 2,
      version: 2,
      browser_revoked: 1,
      link_count: 1,
    });
    expect((await sessionState(worker, ACTOR_SESSION)).revoked_at).toBeNull();

    await expect(service.unlink({
      actor,
      session,
      targetUserId: USER,
      linkId: "019f9a4a-7a00-7000-8000-000000000020",
      expectedVersion: 2,
      justification: "Replace the workforce identity.",
      correlationId: REQUEST_ID,
    })).rejects.toEqual(new OidcLinkError("last_method"));
    await addSecondLink(worker);
    await expect(service.unlink({
      actor,
      session,
      targetUserId: USER,
      linkId: "019f9a4a-7a00-7000-8000-000000000020",
      expectedVersion: 2,
      justification: "Replace the workforce identity.",
      correlationId: REQUEST_ID,
    })).resolves.toBe(3);
    expect(await service.links(USER)).toEqual([
      expect.objectContaining({ providerId: "backup" }),
    ]);
    expect((await snapshot(worker, USER)).security_epoch).toBe(3);
    service.close();
  });

  it("rejects stale, stolen-session, self-target, and duplicate-subject link attempts", async () => {
    const worker = open();
    await seedAdmin(worker);
    const service = new OidcLinkService(
      new OidcLinkRepository(worker, undefined, () => NOW),
      config(),
      SESSION_KEY,
      { now: () => NOW, uuid: uuidSource([
        "019f9a4a-7a00-7000-8000-000000000030",
        "019f9a4a-7a00-7000-8000-000000000031",
        "019f9a4a-7a00-7000-8000-000000000032",
        "019f9a4a-7a00-7000-8000-000000000033",
      ]) },
    );
    const actor = {
      method: "browser_session",
      principalId: ACTOR,
      role: "superadmin",
    } as const;
    const session: ValidatedBrowserSession = {
      sessionId: ACTOR_SESSION,
      userId: ACTOR,
      role: "superadmin",
      csrfHash: "b".repeat(64),
      issuedAt: NOW - 1_000,
      absoluteExpiresAt: NOW + 300_000,
    };
    await expect(service.adminBinding(actor, session, USER, 99))
      .rejects.toEqual(new OidcLinkError("stale"));
    await expect(service.adminBinding(actor, { ...session, sessionId: TARGET_SESSION }, USER, 1))
      .rejects.toEqual(new OidcLinkError("invalid"));
    await expect(service.adminBinding(actor, session, ACTOR, 1))
      .rejects.toEqual(new OidcLinkError("invalid"));
    const binding = await service.adminBinding(actor, session, USER, 1);
    await addSubjectCollision(worker);
    await expect(service.completeAdmin(assertion(), binding, REQUEST_ID))
      .rejects.toEqual(new OidcLinkError("conflict"));
    expect((await snapshot(worker, USER)).version).toBe(1);
    service.close();
  });

  it("exposes restricted and guarded management routes without returning provider subjects", async () => {
    const worker = open();
    await seedRestricted(worker);
    await addActor(worker);
    const link = new OidcLinkService(
      new OidcLinkRepository(worker, undefined, () => NOW),
      config(),
      SESSION_KEY,
      {
        now: () => NOW,
        uuid: uuidSource([
          "019f9a4a-7a00-7000-8000-000000000050",
          "019f9a4a-7a00-7000-8000-000000000051",
          "019f9a4a-7a00-7000-8000-000000000052",
        ]),
      },
    );
    let restrictedBinding: Awaited<ReturnType<OidcLinkService["restrictedBinding"]>>;
    const begin = vi.fn(async (
      _providerId: string,
      binding: Awaited<ReturnType<OidcLinkService["restrictedBinding"]>>,
    ) => {
      restrictedBinding = binding;
      return {
        authorizationUrl: `https://id.example.org/authorize?state=${"s".repeat(43)}`,
        expiresAt: NOW + 300_000,
      };
    });
    const flow = {
      begin,
      callback: vi.fn(async () => ({
        assertion: assertion(),
        binding: restrictedBinding,
      })),
      deny: vi.fn(),
      close: vi.fn(),
    } as unknown as OidcFlowService;
    const browser = new BrowserSessionAuthenticator(
      new BrowserSessionRepository(worker, () => NOW),
      config().sessions,
      SESSION_KEY,
    );
    const restricted = new RestrictedSessionAuthenticator(
      new LocalEnrollmentRepository(worker, () => NOW),
      SESSION_KEY,
    );
    const application = createControlApplication(controlConfig(), {
      persistence: worker,
      authorization: {
        authorizeScope: async () => true,
        verifyStepUp: async () => true,
      },
      localIdentity: {
        authentication: {} as LocalAuthenticationService,
        browserSessions: browser,
        restrictedSessions: restricted,
        authenticator: new LocalControlAuthenticator(browser, restricted),
        oidc: {
          flow,
          login: {} as OidcLoginService,
          link,
          providers: config().oidc!.providers,
          flowTtlMs: config().oidc!.flowTtlMs,
        },
      },
    });

    const restrictedBegin = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/oidc/workforce/begin",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie: `__Host-secretsauce_enrollment=${RESTRICTED_TOKEN}`,
        "x-csrf-token": RESTRICTED_CSRF,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(restrictedBegin.statusCode).toBe(200);
    expect(restrictedBegin.headers["set-cookie"]).toContain("__Host-secretsauce_oidc=");
    const callback = await application.inject({
      method: "GET",
      url: `/api/v2/auth/oidc/workforce/callback?state=${"s".repeat(43)}&code=code`,
      headers: {
        host: "control.example.org",
        cookie: `__Host-secretsauce_oidc=${"s".repeat(43)}`,
      },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("/control/");
    expect(String(callback.headers["set-cookie"])).toContain("__Host-secretsauce_session=");
    expect(String(callback.headers["set-cookie"])).toContain("__Host-secretsauce_enrollment=");

    const adminBegin = await application.inject({
      method: "POST",
      url: "/api/v2/users/019f9a4a-7a00-7000-8000-000000000001/oidc-links/workforce/begin",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie: `__Host-secretsauce_session=${ADMIN_TOKEN}`,
        "x-csrf-token": ADMIN_CSRF,
        "if-match": '"2"',
        "content-type": "application/json",
      },
      payload: { justification: "Link the approved workforce identity." },
    });
    expect(adminBegin.statusCode).toBe(200);
    expect(begin).toHaveBeenLastCalledWith(
      "workforce",
      expect.objectContaining({
        purpose: "superadmin_link",
        targetUserId: USER,
        actorUserId: ACTOR,
        actorSessionId: ACTOR_SESSION,
        targetVersion: 2,
      }),
      undefined,
    );
    const links = await application.inject({
      method: "GET",
      url: `/api/v2/users/${USER}/oidc-links`,
      headers: {
        host: "control.example.org",
        cookie: `__Host-secretsauce_session=${ADMIN_TOKEN}`,
      },
    });
    expect(links.statusCode).toBe(200);
    expect(JSON.stringify(links.json())).not.toContain("immutable-subject");
    const openApi = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openApi.json().paths).toHaveProperty(
      "/api/v2/users/{user_id}/oidc-links/{link_id}",
    );
    await application.close();
    browser.close();
    restricted.close();
    link.close();
  });
});

function open(): PersistenceWorker {
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-oidc-link-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

async function seedRestricted(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      insertUser(transaction, USER, "invited", "user", "temporary", "not_configured");
      transaction.run(`
        INSERT INTO identity_restricted_sessions (
          id, user_id, purpose, session_hash, csrf_hash,
          issued_security_epoch, issued_global_epoch,
          issued_at, expires_at, revoked_at, version
        ) VALUES (?, ?, 'initial_enrollment', ?, ?, 1, 1, ?, ?, NULL, 1)
      `, [
        RESTRICTED,
        USER,
        keyedHash(SESSION_KEY, "secretsauce.restricted-session.v1", RESTRICTED_TOKEN),
        keyedHash(SESSION_KEY, "secretsauce.restricted-csrf.v1", RESTRICTED_CSRF),
        NOW,
        NOW + 300_000,
      ]);
    }),
  });
}

async function addActor(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      insertUser(transaction, ACTOR, "active", "superadmin", "configured", "configured");
      transaction.run(`
        INSERT INTO browser_sessions (
          id, user_id, session_hash, csrf_hash, role_class,
          issued_security_epoch, issued_global_epoch,
          issued_absolute_ms, issued_inactivity_ms,
          issued_at, last_activity_at, absolute_expires_at,
          step_up_at, revoked_at, version
        ) VALUES (?, ?, ?, ?, 'admin', 1, 1, 43200000, 900000, ?, ?, ?, ?, NULL, 1)
      `, [
        ACTOR_SESSION,
        ACTOR,
        keyedHash(SESSION_KEY, "secretsauce.browser-session.v1", ADMIN_TOKEN),
        keyedHash(SESSION_KEY, "secretsauce.browser-csrf.v1", ADMIN_CSRF),
        NOW - 1_000,
        NOW - 1_000,
        NOW + 300_000,
        NOW,
      ]);
    }),
  });
}

async function seedAdmin(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      insertUser(transaction, ACTOR, "active", "superadmin", "configured", "configured");
      insertUser(transaction, USER, "active", "user", "disabled", "disabled");
      insertBrowserSession(transaction, ACTOR_SESSION, ACTOR, "admin", "e", NOW - 1_000);
      insertBrowserSession(transaction, TARGET_SESSION, USER, "user", "f", NOW - 1_000);
    }),
  });
}

function insertUser(
  transaction: { run(sql: string, values?: readonly unknown[]): unknown },
  id: string,
  status: string,
  role: string,
  passwordState: string,
  totpState: string,
): void {
  transaction.run(`
    INSERT INTO users (
      id, email, normalized_email, given_name, family_name, role, status,
      security_epoch, password_policy_version, version, created_at, updated_at
    ) VALUES (?, ?, ?, 'Local', 'Person', ?, ?, 1, 1, 1, ?, ?)
  `, [id, `${id.slice(-4)}@example.org`, `${id.slice(-4)}@example.org`, role, status, NOW, NOW]);
  transaction.run(`
    INSERT INTO local_authenticator_states (
      user_id, password_state, totp_state, version, created_at, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?)
  `, [id, passwordState, totpState, NOW, NOW]);
}

function insertBrowserSession(
  transaction: { run(sql: string, values?: readonly unknown[]): unknown },
  id: string,
  userId: string,
  roleClass: string,
  fill: string,
  issuedAt: number,
): void {
  transaction.run(`
    INSERT INTO browser_sessions (
      id, user_id, session_hash, csrf_hash, role_class,
      issued_security_epoch, issued_global_epoch,
      issued_absolute_ms, issued_inactivity_ms,
      issued_at, last_activity_at, absolute_expires_at,
      step_up_at, revoked_at, version
    ) VALUES (?, ?, ?, ?, ?, 1, 1, 43200000, 900000, ?, ?, ?, ?, NULL, 1)
  `, [
    id,
    userId,
    fill.repeat(64),
    (fill === "f" ? "0" : "f").repeat(64),
    roleClass,
    issuedAt,
    issuedAt,
    NOW + 300_000,
    NOW,
  ]);
}

async function addSecondLink(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO external_identities (
          id, user_id, provider_id, issuer, subject, version, created_at, updated_at
        ) VALUES (
          '019f9a4a-7a00-7000-8000-000000000040',
          ?, 'backup', 'https://backup.example.org', 'backup-subject', 1, ?, ?
        )
      `, [USER, NOW, NOW]);
    }),
  });
}

async function addSubjectCollision(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO external_identities (
          id, user_id, provider_id, issuer, subject, version, created_at, updated_at
        ) VALUES (
          '019f9a4a-7a00-7000-8000-000000000041',
          ?, 'workforce', ?, 'immutable-subject', 1, ?, ?
        )
      `, [ACTOR, provider().issuer, NOW, NOW]);
    }),
  });
}

function assertion(): ProviderAssertion {
  return {
    providerId: "workforce",
    issuer: provider().issuer,
    subject: "immutable-subject",
    authenticationTime: NOW - 30_000,
    mfa: { verified: true, evidence: ["amr.pwd", "amr.otp"] },
    profile: {
      email: "provider@example.org",
      emailVerified: true,
      givenName: "Provider",
      familyName: "Person",
    },
  };
}

function provider(): OidcProviderConfig {
  return {
    id: "workforce",
    displayName: "Workforce",
    issuer: "https://id.example.org/tenant",
    clientId: "secretsauce",
    redirectOrigin: "https://control.example.org",
    scopes: ["openid", "profile", "email"],
    allowedSigningAlgorithms: ["RS256"],
    clockSkewSeconds: 60,
    maxAuthenticationAgeMs: 43_200_000,
    assuranceAnyOf: [{ amr: ["pwd", "otp"] }],
    profileClaims: {
      email: "email",
      emailVerified: "email_verified",
      givenName: "given_name",
      familyName: "family_name",
      providerOwnedFields: ["email", "given_name", "family_name"],
    },
  };
}

function config(): IdentityConfig {
  return {
    activeRootKeyId: "root",
    rootKeyFiles: {},
    sessionHmacKeyFile: "/unused",
    temporaryPasswordTtlMs: 900_000,
    restrictedSessionTtlMs: 900_000,
    password: { minimumLength: 15 },
    sessions: {
      adminAbsoluteMs: 43_200_000,
      adminInactivityMs: 900_000,
      userAbsoluteMs: 86_400_000,
      userInactivityMs: 1_800_000,
    },
    stepUpMode: "five_minutes",
    oidc: {
      providers: { workforce: provider() },
      flowTtlMs: 300_000,
      networkTimeoutMs: 5_000,
      maxResponseBodyBytes: 262_144,
      maxInflight: 4,
      maxInflightPerProvider: 2,
      maxFlowRecords: 10_000,
      maxCacheRecords: 64,
    },
    limits: {
      loginAttempts: 20,
      loginWindowMs: 300_000,
      passwordAttempts: 20,
      passwordWindowMs: 300_000,
      totpAttempts: 20,
      totpWindowMs: 300_000,
      maxPasswordVerifications: 4,
      maxPasswordVerificationsPerSource: 2,
      maxTotpVerifications: 4,
      maxTotpVerificationsPerSource: 2,
    },
  };
}

function controlConfig(): GatewayConfig {
  const base = registryConfig();
  return {
    ...base,
    control: {
      listen: "127.0.0.1:8081",
      host: "127.0.0.1",
      port: 8081,
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/unused",
    },
    persistence: { databaseFile: "/unused" },
    identity: config(),
  };
}

function uuidSource(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? "019f9a4a-7a00-7000-8000-000000000099";
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value).digest("hex");
}

async function snapshot(worker: PersistenceWorker, userId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<Record<string, unknown>>(`
      SELECT
        u.status, u.security_epoch, u.version, u.email,
        u.email_source, u.given_name_source, u.family_name_source,
        a.password_state, a.totp_state,
        (SELECT count(*) FROM external_identities e WHERE e.user_id = u.id) AS link_count,
        (SELECT count(*) FROM browser_sessions bs
          WHERE bs.user_id = u.id AND bs.revoked_at IS NOT NULL) AS browser_revoked,
        (SELECT count(*) FROM identity_restricted_sessions rs
          WHERE rs.user_id = u.id AND rs.revoked_at IS NOT NULL) AS restricted_revoked,
        (SELECT reason FROM identity_invalidation_events i
          WHERE i.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS invalidation_reason
      FROM users u
      JOIN local_authenticator_states a ON a.user_id = u.id
      WHERE u.id = ?
    `, [userId]))!,
  });
}

async function sessionState(worker: PersistenceWorker, sessionId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{ revoked_at: number | null }>(
      "SELECT revoked_at FROM browser_sessions WHERE id = ?",
      [sessionId],
    ))!,
  });
}

async function auditText(worker: PersistenceWorker): Promise<string> {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{ value: string }>(`
      SELECT group_concat(
        actor_label_snapshot || target_label_snapshot || changes_json ||
        source_json || coalesce(justification, ''),
        ''
      ) AS value
      FROM administrative_audit_events
    `)?.value ?? ""),
  });
}
