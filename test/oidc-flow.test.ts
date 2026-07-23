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
