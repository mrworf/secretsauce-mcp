import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import {
  OidcFlowError,
  OidcFlowRepository,
  OidcFlowService,
} from "../src/identity/oidcFlow.js";
import {
  OidcTrustClient,
  type OidcNetwork,
  type OidcNetworkRequest,
  type OidcNetworkResponse,
} from "../src/identity/oidcTrust.js";
import { IdentityKeyRing } from "../src/identity/totp.js";
import { AlwaysStepUpHandle, StepUpRepository } from "../src/identity/stepUp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { IdentityConfig, OidcProviderConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("durable verified OIDC flow", () => {
  it("binds an MCP OAuth flow to one durable intent without exposing it in provider state", async () => {
    const fixture = flowFixture(oidcNetwork({
      kid: "unused",
      kty: "RSA",
      alg: "RS256",
      n: "sXchDaQebH_MnDfqRzL4n9bAm0HDiJAsA0hHYq1Z9Q",
      e: "AQAB",
    }, (request) => jsonResponse({ id_token: "unused" }, request.url.toString())));
    const intentId = "018f1f2e-7b3c-7a10-8000-000000000299";
    const started = await fixture.service.begin("workforce", {
      purpose: "mcp_oauth",
      oauthIntentId: intentId,
    });
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        purpose: string;
        oauth_intent_id: string;
        database_text: string;
      }>(`
        SELECT purpose, oauth_intent_id,
          (SELECT group_concat(sql, ' ') FROM sqlite_master) AS database_text
        FROM identity_oidc_flows
      `)),
    });
    expect(stored).toMatchObject({
      purpose: "mcp_oauth",
      oauth_intent_id: intentId,
    });
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toContain(intentId);
    await expect(fixture.service.begin("workforce", {
      purpose: "mcp_oauth",
    })).rejects.toEqual(new OidcFlowError());
    fixture.close();
  });

  it("stores only a state hash and encrypted PKCE/nonce, then verifies and consumes one callback", async () => {
    const signing = await generateKeyPair("RS256");
    const jwk = {
      ...await exportJWK(signing.publicKey),
      kid: "signing-key",
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
    };
    let idToken = "";
    let tokenRequest: OidcNetworkRequest | undefined;
    const network = oidcNetwork(jwk, (request) => {
      tokenRequest = request;
      return jsonResponse({ id_token: idToken }, request.url.toString());
    });
    const fixture = flowFixture(network);
    const started = await fixture.service.begin("workforce", { purpose: "login" });
    const authorization = new URL(started.authorizationUrl);
    const state = authorization.searchParams.get("state")!;
    const nonce = authorization.searchParams.get("nonce")!;
    const challenge = authorization.searchParams.get("code_challenge")!;
    expect(authorization.origin + authorization.pathname)
      .toBe("https://id.example.org/authorize");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("scope")).toBe("openid profile email");

    const before = await flowSnapshot(fixture.worker);
    expect(before.state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(before.envelope_json).not.toContain(state);
    expect(before.envelope_json).not.toContain(nonce);
    expect(before.database_text).not.toContain(state);
    expect(before.database_text).not.toContain(nonce);

    const issuedAt = Math.trunc(NOW / 1_000);
    idToken = await new SignJWT({
      nonce,
      auth_time: issuedAt - 30,
      amr: ["pwd", "otp"],
      email: "linked@example.org",
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: "signing-key" })
      .setIssuer(provider().issuer)
      .setAudience(provider().clientId)
      .setSubject("immutable-subject")
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 300)
      .sign(signing.privateKey);

    const completed = await fixture.service.callback(
      "workforce",
      state,
      "authorization-code",
      CORRELATION,
    );
    expect(completed).toMatchObject({
      assertion: {
        providerId: "workforce",
        issuer: provider().issuer,
        subject: "immutable-subject",
        mfa: { verified: true, evidence: ["amr.pwd", "amr.otp"] },
      },
      binding: { purpose: "login" },
    });
    const form = new URLSearchParams(Buffer.from(tokenRequest!.body!).toString("utf8"));
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("authorization-code");
    expect(form.get("client_id")).toBe(provider().clientId);
    expect(form.get("redirect_uri"))
      .toBe("https://control.example.org/api/v2/auth/oidc/workforce/callback");
    expect(createHash("sha256").update(form.get("code_verifier")!, "ascii").digest("base64url"))
      .toBe(challenge);

    const after = await flowSnapshot(fixture.worker);
    expect(after.claimed_at).toBe(NOW);
    expect(after.consumed_at).toBe(NOW);
    expect(after.audit_text).not.toContain(state);
    expect(after.audit_text).not.toContain(nonce);
    expect(after.audit_text).not.toContain("authorization-code");
    expect(after.audit_text).not.toContain(idToken);
    await expect(fixture.service.callback(
      "workforce",
      state,
      "authorization-code",
      CORRELATION,
    )).rejects.toEqual(new OidcFlowError());
    expect((await flowSnapshot(fixture.worker)).deny_count).toBe(1);
    fixture.close();
  });

  it("rejects wrong, expired, and concurrent state before repeating token exchange", async () => {
    let tokenCalls = 0;
    const network = oidcNetwork({
      kid: "unused",
      kty: "RSA",
      alg: "RS256",
      n: "sXchDaQebH_MnDfqRzL4n9bAm0HDiJAsA0hHYq1Z9Q",
      e: "AQAB",
    }, (request) => {
      tokenCalls += 1;
      return jsonResponse({ id_token: "invalid" }, request.url.toString());
    });
    const fixture = flowFixture(network);
    const started = await fixture.service.begin("workforce", { purpose: "login" });
    const state = new URL(started.authorizationUrl).searchParams.get("state")!;
    await expect(fixture.service.callback(
      "workforce",
      "w".repeat(43),
      "code",
      CORRELATION,
    )).rejects.toEqual(new OidcFlowError());
    expect(tokenCalls).toBe(0);

    const attempts = await Promise.allSettled([
      fixture.service.callback("workforce", state, "code", CORRELATION),
      fixture.service.callback("workforce", state, "code", CORRELATION),
    ]);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(2);
    expect(tokenCalls).toBe(1);

    const expired = flowFixture(network, NOW + 301_000);
    const expiredStart = await expired.service.begin("workforce", { purpose: "login" });
    const expiredState = new URL(expiredStart.authorizationUrl).searchParams.get("state")!;
    expired.now.value += 301_000;
    await expect(expired.service.callback(
      "workforce",
      expiredState,
      "code",
      CORRELATION,
    )).rejects.toEqual(new OidcFlowError());
    expect(tokenCalls).toBe(1);
    fixture.close();
    expired.close();
  });

  it("consumes always-step-up proof atomically with guarded flow creation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-oidc-proof-"));
    const worker = PersistenceWorker.open({
      databaseFile: join(directory, "control.sqlite"),
      productVersion: "test",
      now: () => NOW,
    });
    workers.add(worker);
    const userId = "019f9a4a-7a00-7000-8000-000000000061";
    const sessionId = "019f9a4a-7a00-7000-8000-000000000062";
    const firstProof = "019f9a4a-7a00-7000-8000-000000000063";
    const secondProof = "019f9a4a-7a00-7000-8000-000000000064";
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (?, 'admin@example.org', 'admin@example.org', 'Admin', 'User',
            'superadmin', 'active', 1, 1, 1, ?, ?)
        `, [userId, NOW, NOW]);
        transaction.run(`
          INSERT INTO local_authenticator_states (
            user_id, password_state, totp_state, version, created_at, updated_at
          ) VALUES (?, 'configured', 'configured', 1, ?, ?)
        `, [userId, NOW, NOW]);
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (
            '019f9a4a-7a00-7000-8000-000000000065',
            'target@example.org', 'target@example.org', 'Target', 'User',
            'user', 'active', 1, 1, 1, ?, ?
          )
        `, [NOW, NOW]);
        transaction.run(`
          INSERT INTO local_authenticator_states (
            user_id, password_state, totp_state, version, created_at, updated_at
          ) VALUES (
            '019f9a4a-7a00-7000-8000-000000000065',
            'disabled', 'disabled', 1, ?, ?
          )
        `, [NOW, NOW]);
        transaction.run(`
          INSERT INTO browser_sessions (
            id, user_id, session_hash, csrf_hash, role_class,
            issued_security_epoch, issued_global_epoch,
            issued_absolute_ms, issued_inactivity_ms,
            issued_at, last_activity_at, absolute_expires_at,
            step_up_at, revoked_at, version
          ) VALUES (?, ?, ?, ?, 'admin', 1, 1, 43200000, 900000,
            ?, ?, ?, ?, NULL, 1)
        `, [sessionId, userId, "a".repeat(64), "b".repeat(64), NOW, NOW, NOW + 300_000, NOW]);
        for (const [id, hash] of [[firstProof, "c".repeat(64)], [secondProof, "d".repeat(64)]]) {
          transaction.run(`
            INSERT INTO identity_step_up_proofs (
              id, proof_hash, session_id, user_id, method, route_id,
              targets_json, expected_version, idempotency_key_hash, body_digest,
              issued_security_epoch, issued_global_epoch,
              issued_at, expires_at, consumed_at
            ) VALUES (?, ?, ?, ?, 'POST', 'users.oidc_link_begin',
              '[]', 1, NULL, ?, 1, 1, ?, ?, NULL)
          `, [id, hash, sessionId, userId, "e".repeat(64), NOW, NOW + 300_000]);
        }
      }),
    });
    const stepUps = new StepUpRepository(worker, () => NOW);
    const repository = new OidcFlowRepository(worker, () => NOW, stepUps);
    const create = (id: string, proofId: string) => repository.create({
      id,
      providerId: "workforce",
      purpose: "superadmin_link",
      stateHash: "f".repeat(64),
      envelopeJson: "{}",
      redirectUri: "https://control.example.org/api/v2/auth/oidc/workforce/callback",
      expiresAt: NOW + 300_000,
      maxRecords: 10,
      binding: {
        purpose: "superadmin_link",
        targetUserId: "019f9a4a-7a00-7000-8000-000000000065",
        actorUserId: userId,
        actorSessionId: sessionId,
        targetVersion: 1,
      },
      stepUp: {
        proof: new AlwaysStepUpHandle(proofId, sessionId, userId),
        audit: {
          actor: {
            type: "browser_session",
            id: userId,
            label: `user:${userId}`,
            role: "superadmin",
            authenticationMethod: "browser_session",
          },
          action: "identity.oidc_link_begin",
          result: "allow",
          target: {
            type: "user",
            id: "019f9a4a-7a00-7000-8000-000000000065",
            label: "guarded target",
          },
          changes: [{ field: "provider", after: "workforce" }],
          correlationId: CORRELATION,
          source: { category: "identity" },
        },
      },
    });
    await create("019f9a4a-7a00-7000-8000-000000000066", firstProof);
    await expect(create("019f9a4a-7a00-7000-8000-000000000067", secondProof))
      .rejects.toEqual(new OidcFlowError());
    await expect(worker.execute({
      run: (database) => database.read((query) => query.all<{
        id: string;
        consumed_at: number | null;
      }>(`
        SELECT id, consumed_at FROM identity_step_up_proofs ORDER BY id
      `)),
    })).resolves.toEqual([
      { id: firstProof, consumed_at: NOW },
      { id: secondProof, consumed_at: null },
    ]);
  });
});

function flowFixture(network: OidcNetwork, initialNow = NOW) {
  const now = { value: initialNow };
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-oidc-flow-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
    productVersion: "test",
    now: () => now.value,
  });
  workers.add(worker);
  const keyRing = new IdentityKeyRing("current", { current: Buffer.alloc(32, 71) });
  const config = limits();
  const service = new OidcFlowService(
    new OidcFlowRepository(worker, () => now.value),
    new OidcTrustClient(config, network, () => now.value),
    keyRing,
    config,
    Buffer.alloc(32, 72),
    { now: () => now.value, random: randomBytes },
  );
  return {
    worker,
    service,
    keyRing,
    now,
    close: () => {
      service.close();
      keyRing.destroy();
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
      providerOwnedFields: ["email"],
    },
  };
}

function limits(): NonNullable<IdentityConfig["oidc"]> {
  return {
    providers: { workforce: provider() },
    flowTtlMs: 300_000,
    networkTimeoutMs: 5_000,
    maxResponseBodyBytes: 262_144,
    maxInflight: 4,
    maxInflightPerProvider: 2,
    maxFlowRecords: 10_000,
    maxCacheRecords: 64,
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
      throw new Error("unexpected OIDC request");
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

async function flowSnapshot(worker: PersistenceWorker) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      state_hash: string;
      envelope_json: string;
      claimed_at: number | null;
      consumed_at: number | null;
      database_text: string;
      audit_text: string;
      deny_count: number;
    }>(`
      SELECT
        f.state_hash,
        f.envelope_json,
        f.claimed_at,
        f.consumed_at,
        (
          SELECT group_concat(state_hash || envelope_json || redirect_uri, '')
          FROM identity_oidc_flows
        ) AS database_text,
        (
          SELECT group_concat(
            actor_label_snapshot || target_label_snapshot || changes_json ||
            source_json || coalesce(failure_code, ''),
            ''
          )
          FROM administrative_audit_events
        ) AS audit_text,
        (
          SELECT count(*) FROM administrative_audit_events
          WHERE action = 'identity.oidc_assertion' AND result = 'deny'
        ) AS deny_count
      FROM identity_oidc_flows f
      ORDER BY created_at, id
      LIMIT 1
    `))!,
  });
}
