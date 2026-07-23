import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createControlApplication } from "../src/control/server.js";
import { BrowserSessionRepository } from "../src/identity/browserSessions.js";
import { BrowserSessionAuthenticator } from "../src/identity/browserSessions.js";
import type { LocalAuthenticationService } from "../src/identity/localAuthentication.js";
import { OidcFlowRepository, OidcFlowService } from "../src/identity/oidcFlow.js";
import {
  OidcLoginError,
  OidcLoginRepository,
  OidcLoginService,
} from "../src/identity/oidcLogin.js";
import {
  OidcTrustClient,
  type OidcNetwork,
  type OidcNetworkRequest,
  type OidcNetworkResponse,
} from "../src/identity/oidcTrust.js";
import type { ProviderAssertion } from "../src/identity/provider.js";
import { IdentityKeyRing } from "../src/identity/totp.js";
import { createLogger } from "../src/logger.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig, IdentityConfig, OidcProviderConfig } from "../src/types.js";
import { registryConfig } from "./helpers.js";

const NOW = 1_785_000_000_000;
const USER_ID = "019f9a4a-7a00-7000-8000-000000000001";
const LINK_ID = "019f9a4a-7a00-7000-8000-000000000002";
const REQUEST_ID = "req_12345678-1234-4234-8234-123456789abc";
const SESSION_KEY = Buffer.alloc(32, 81);
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("linked OIDC browser login", () => {
  it("maps only an immutable provider link and issues a provider-independent session", async () => {
    const fixture = await setup();
    const result = await fixture.service.login(assertion(), REQUEST_ID);
    expect(result).toMatchObject({
      userId: USER_ID,
      role: "user",
      issuedAt: NOW,
      absoluteExpiresAt: NOW + 86_400_000,
    });
    const sessionHash = keyedHash(
      SESSION_KEY,
      "secretsauce.browser-session.v1",
      result.sessionToken,
    );
    await expect(new BrowserSessionRepository(fixture.worker, () => NOW + 1)
      .authenticate(sessionHash, fixture.config.sessions))
      .resolves.toMatchObject({ userId: USER_ID, role: "user" });
    const stored = await snapshot(fixture.worker);
    expect(stored.session_hash).toBe(sessionHash);
    expect(stored.session_hash).not.toBe(result.sessionToken);
    expect(stored.last_authenticated_at).toBe(NOW);
    expect(stored.login_at).toBe(NOW);
    expect(stored.allow_count).toBe(1);
    fixture.service.close();
  });

  it("never authenticates an email-only match, inactive link, or insufficient assertion", async () => {
    const unlinked = await setup({ linkedSubject: "different-subject" });
    await expect(unlinked.service.login(assertion(), REQUEST_ID))
      .rejects.toEqual(new OidcLoginError());
    expect((await snapshot(unlinked.worker)).session_count).toBe(0);

    const inactive = await setup({ status: "suspended" });
    await expect(inactive.service.login(assertion(), REQUEST_ID))
      .rejects.toEqual(new OidcLoginError());
    expect((await snapshot(inactive.worker)).session_count).toBe(0);

    const insufficient = await setup();
    await expect(insufficient.service.login({
      ...assertion(),
      mfa: { verified: false, evidence: [] },
    }, REQUEST_ID)).rejects.toEqual(new OidcLoginError());
    expect((await snapshot(insufficient.worker)).session_count).toBe(0);
    expect((await snapshot(insufficient.worker)).deny_count).toBe(1);
    unlinked.service.close();
    inactive.service.close();
    insufficient.service.close();
  });

  it("updates only fields still owned by the provider and skips a conflicting email safely", async () => {
    const owned = await setup({ ownedSources: true });
    await owned.service.login(assertion({
      email: "changed@example.org",
      emailVerified: true,
      givenName: "Provider",
      familyName: "Updated",
    }), REQUEST_ID);
    await expect(profile(owned.worker)).resolves.toEqual({
      email: "changed@example.org",
      given_name: "Provider",
      family_name: "Updated",
      email_source: "oidc:workforce",
      given_name_source: "oidc:workforce",
      family_name_source: "oidc:workforce",
    });

    const local = await setup();
    await local.service.login(assertion({
      email: "ignored@example.org",
      emailVerified: true,
      givenName: "Ignored",
      familyName: "Ignored",
    }), REQUEST_ID);
    await expect(profile(local.worker)).resolves.toMatchObject({
      email: "linked@example.org",
      given_name: "Local",
      family_name: "Person",
      email_source: "local",
    });

    const conflict = await setup({ ownedSources: true, conflictingEmail: true });
    await expect(conflict.service.login(assertion({
      email: "occupied@example.org",
      emailVerified: true,
      givenName: "Would",
      familyName: "Conflict",
    }), REQUEST_ID)).resolves.toMatchObject({ userId: USER_ID });
    await expect(profile(conflict.worker)).resolves.toMatchObject({
      email: "linked@example.org",
      given_name: "Local",
      family_name: "Person",
    });
    owned.service.close();
    local.service.close();
    conflict.service.close();
  });

  it("serves a browser-bound public begin/callback flow with one fixed observable redirect", async () => {
    const signing = await generateKeyPair("RS256");
    const jwk = {
      ...await exportJWK(signing.publicKey),
      kid: "signing-key",
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
    };
    let idToken = "";
    let tokenCalls = 0;
    const network = oidcNetwork(jwk, (request) => {
      tokenCalls += 1;
      return jsonResponse({ id_token: idToken }, request.url.toString());
    });
    const fixture = await setup();
    const keyRing = new IdentityKeyRing("root", { root: Buffer.alloc(32, 82) });
    const flow = new OidcFlowService(
      new OidcFlowRepository(fixture.worker, () => NOW),
      new OidcTrustClient(fixture.config.oidc!, network, () => NOW),
      keyRing,
      fixture.config.oidc!,
      SESSION_KEY,
      { now: () => NOW, random: randomBytes },
    );
    const lines: string[] = [];
    const application = createControlApplication(controlConfig(fixture.config), {
      persistence: fixture.worker,
      logger: createLogger({ level: "debug" }, (line) => lines.push(line)),
      localIdentity: {
        authentication: {} as LocalAuthenticationService,
        browserSessions: new BrowserSessionAuthenticator(
          new BrowserSessionRepository(fixture.worker, () => NOW),
          fixture.config.sessions,
          SESSION_KEY,
        ),
        oidc: {
          flow,
          login: fixture.service,
          providers: fixture.config.oidc!.providers,
          flowTtlMs: fixture.config.oidc!.flowTtlMs,
        },
      },
    });
    const providers = await application.inject({
      method: "GET",
      url: "/api/v2/auth/oidc/providers",
      headers: { host: "control.example.org" },
    });
    expect(providers.statusCode).toBe(200);
    expect(providers.json().data).toEqual({
      providers: [{ id: "workforce", display_name: "Workforce" }],
    });
    expect(JSON.stringify(providers.json())).not.toContain("clientId");

    const begin = await application.inject({
      method: "POST",
      url: "/api/v2/auth/oidc/workforce/begin",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(begin.statusCode).toBe(200);
    const authorizationUrl = begin.json().data.authorization_url as string;
    const authorization = new URL(authorizationUrl);
    const state = authorization.searchParams.get("state")!;
    const nonce = authorization.searchParams.get("nonce")!;
    const flowCookie = String(begin.headers["set-cookie"]).split(";")[0]!;
    expect(flowCookie).toBe(`__Host-secretsauce_oidc=${state}`);
    expect(String(begin.headers["set-cookie"])).toContain("SameSite=Lax");
    const issuedAt = Math.trunc(NOW / 1_000);
    idToken = await new SignJWT({
      nonce,
      auth_time: issuedAt - 30,
      amr: ["pwd", "otp"],
    })
      .setProtectedHeader({ alg: "RS256", kid: "signing-key" })
      .setIssuer(provider().issuer)
      .setAudience(provider().clientId)
      .setSubject("immutable-subject")
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 300)
      .sign(signing.privateKey);

    const malformed = await application.inject({
      method: "GET",
      url: "/api/v2/auth/oidc/workforce/callback?state=short&error=denied",
      headers: { host: "control.example.org" },
    });
    expect(malformed.statusCode).toBe(302);
    expect(malformed.headers.location).toBe("/control/");
    expect(tokenCalls).toBe(0);

    const wrongBrowser = await application.inject({
      method: "GET",
      url: `/api/v2/auth/oidc/workforce/callback?state=${state}&code=authorization-code`,
      headers: {
        host: "control.example.org",
        cookie: "__Host-secretsauce_oidc=w".repeat(1) + "w".repeat(42),
      },
    });
    expect(wrongBrowser.statusCode).toBe(302);
    expect(wrongBrowser.headers.location).toBe("/control/");
    expect(tokenCalls).toBe(0);

    const callback = await application.inject({
      method: "GET",
      url: `/api/v2/auth/oidc/workforce/callback?state=${state}&code=authorization-code`,
      headers: { host: "control.example.org", cookie: flowCookie },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("/control/");
    expect(String(callback.headers["set-cookie"])).toContain("__Host-secretsauce_session=");
    expect(tokenCalls).toBe(1);
    const observable = lines.join("\n");
    expect(observable).not.toContain(state);
    expect(observable).not.toContain("authorization-code");
    expect(observable).not.toContain(idToken);
    const openApi = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openApi.json().paths).toMatchObject({
      "/api/v2/auth/oidc/providers": { get: { operationId: "identity.oidc_providers" } },
      "/api/v2/auth/oidc/{provider_id}/begin": { post: { operationId: "identity.oidc_begin" } },
      "/api/v2/auth/oidc/{provider_id}/callback": { get: { operationId: "identity.oidc_callback" } },
    });
    await application.close();
    fixture.service.close();
    flow.close();
    keyRing.destroy();
  });
});

async function setup(options: {
  linkedSubject?: string;
  status?: string;
  ownedSources?: boolean;
  conflictingEmail?: boolean;
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-oidc-login-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at, updated_at,
          email_source, given_name_source, family_name_source
        ) VALUES (?, 'linked@example.org', 'linked@example.org', 'Local', 'Person',
          'user', ?, 1, 1, 1, ?, ?, ?, ?, ?)
      `, [
        USER_ID,
        options.status ?? "active",
        NOW,
        NOW,
        options.ownedSources ? "oidc:workforce" : "local",
        options.ownedSources ? "oidc:workforce" : "local",
        options.ownedSources ? "oidc:workforce" : "local",
      ]);
      transaction.run(`
        INSERT INTO local_authenticator_states (
          user_id, password_state, totp_state, version, created_at, updated_at
        ) VALUES (?, 'disabled', 'disabled', 1, ?, ?)
      `, [USER_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO external_identities (
          id, user_id, provider_id, issuer, subject, version, created_at, updated_at
        ) VALUES (?, ?, 'workforce', ?, ?, 1, ?, ?)
      `, [LINK_ID, USER_ID, provider().issuer, options.linkedSubject ?? "immutable-subject", NOW, NOW]);
      if (options.conflictingEmail) {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (
            '019f9a4a-7a00-7000-8000-000000000003',
            'occupied@example.org', 'occupied@example.org', 'Other', 'User',
            'user', 'active', 1, 1, 1, ?, ?
          )
        `, [NOW, NOW]);
        transaction.run(`
          INSERT INTO local_authenticator_states (
            user_id, password_state, totp_state, version, created_at, updated_at
          ) VALUES (
            '019f9a4a-7a00-7000-8000-000000000003',
            'configured', 'configured', 1, ?, ?
          )
        `, [NOW, NOW]);
      }
    }),
  });
  const config = identityConfig();
  return {
    worker,
    config,
    service: new OidcLoginService(
      new OidcLoginRepository(worker, () => NOW),
      config,
      SESSION_KEY,
      { now: () => NOW },
    ),
  };
}

function assertion(profileValue?: ProviderAssertion["profile"]): ProviderAssertion {
  return {
    providerId: "workforce",
    issuer: provider().issuer,
    subject: "immutable-subject",
    authenticationTime: NOW - 30_000,
    mfa: { verified: true, evidence: ["amr.pwd", "amr.otp"] },
    profile: profileValue ?? {
      email: "linked@example.org",
      emailVerified: true,
      givenName: "Linked",
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

function identityConfig(): IdentityConfig {
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

function controlConfig(identity: IdentityConfig): GatewayConfig {
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
    identity,
  };
}

function oidcNetwork(
  jwk: Record<string, unknown>,
  token: (request: OidcNetworkRequest) => OidcNetworkResponse,
): OidcNetwork {
  return {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async (request) => {
      const url = request.url.toString();
      if (url.endsWith("/.well-known/openid-configuration")) {
        return jsonResponse({
          issuer: provider().issuer,
          authorization_endpoint: "https://id.example.org/authorize",
          token_endpoint: "https://id.example.org/token",
          jwks_uri: "https://id.example.org/jwks",
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          id_token_signing_alg_values_supported: ["RS256"],
        }, url);
      }
      if (url === "https://id.example.org/jwks") {
        return jsonResponse({ keys: [jwk] }, url);
      }
      if (url === "https://id.example.org/token") return token(request);
      throw new Error("unexpected request");
    },
  };
}

function jsonResponse(value: unknown, url: string): OidcNetworkResponse {
  return {
    status: 200,
    headers: new Headers({
      "content-type": "application/json",
      "cache-control": "max-age=300",
    }),
    body: Buffer.from(JSON.stringify(value)),
    url,
  };
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value).digest("hex");
}

async function snapshot(worker: PersistenceWorker) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      session_hash: string | null;
      last_authenticated_at: number | null;
      login_at: number | null;
      session_count: number;
      allow_count: number;
      deny_count: number;
    }>(`
      SELECT
        (SELECT session_hash FROM browser_sessions LIMIT 1) AS session_hash,
        (SELECT last_authenticated_at FROM external_identities LIMIT 1) AS last_authenticated_at,
        (SELECT last_login_at FROM users WHERE id = ?) AS login_at,
        (SELECT count(*) FROM browser_sessions) AS session_count,
        (SELECT count(*) FROM administrative_audit_events
          WHERE action = 'identity.login' AND result = 'allow') AS allow_count,
        (SELECT count(*) FROM administrative_audit_events
          WHERE action = 'identity.login' AND result = 'deny') AS deny_count
    `, [USER_ID]))!,
  });
}

async function profile(worker: PersistenceWorker) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      email: string;
      given_name: string;
      family_name: string;
      email_source: string;
      given_name_source: string;
      family_name_source: string;
    }>(`
      SELECT email, given_name, family_name,
        email_source, given_name_source, family_name_source
      FROM users WHERE id = ?
    `, [USER_ID]))!,
  });
}
