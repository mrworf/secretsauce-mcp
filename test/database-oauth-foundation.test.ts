import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  DatabaseOAuthError,
  DatabaseOAuthEligibilityRepository,
  DatabaseOAuthRepository,
  DatabaseOAuthTokenHasher,
  isCanonicalOpaqueOAuthValue,
} from "../src/oauth/databaseOAuth.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { OAuthIntentStateCodec } from "../src/oauth/intentState.js";

const NOW = 1_785_100_000_000;
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000101";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000102";
const ASSIGNMENT_ID = "018f1f2e-7b3c-7a10-8000-000000000103";
const LINK_ID = "018f1f2e-7b3c-7a10-8000-000000000104";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("database OAuth foundation", () => {
  it("encrypts client state with canonical authenticated envelopes and rejects tampering", () => {
    const codec = new OAuthIntentStateCodec(Buffer.alloc(32, 90));
    const envelope = codec.encrypt(
      "client-state-value",
      "workforce",
      () => Buffer.alloc(12, 89),
    );
    expect(envelope).toBeTypeOf("string");
    expect(envelope).not.toContain("client-state-value");
    expect(codec.decrypt(envelope, "workforce")).toBe("client-state-value");
    expect(() => codec.decrypt(envelope, "other-provider")).toThrow();
    const parsed = JSON.parse(envelope!) as { tag: string };
    parsed.tag = `${parsed.tag.slice(0, -1)}${parsed.tag.endsWith("A") ? "B" : "A"}`;
    expect(() => codec.decrypt(JSON.stringify(parsed), "workforce")).toThrow();
    codec.close();
  });

  it("uses canonical, domain-separated, key-only opaque token hashes", () => {
    const key = Buffer.alloc(32, 91);
    const hasher = new DatabaseOAuthTokenHasher(key);
    const value = Buffer.alloc(32, 92).toString("base64url");

    expect(isCanonicalOpaqueOAuthValue(value)).toBe(true);
    expect(hasher.hash("access", value)).toMatch(/^[a-f0-9]{64}$/);
    expect(hasher.hash("access", value)).not.toBe(hasher.hash("refresh", value));
    expect(() => hasher.hash("access", `${value}=`)).toThrow();
    expect(() => new DatabaseOAuthTokenHasher(key.subarray(0, 31))).toThrow();
    hasher.close();
    expect(JSON.stringify(hasher)).not.toContain(key.toString("base64url"));
  });

  it("requires an active ordinary user with configured local proof and current activated access", async () => {
    const worker = open("eligibility");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const user = await identities.createLocalIdentity({
      profile: {
        email: "eligible@example.org",
        givenName: "Eligible",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    const admin = await identities.createLocalIdentity({
      profile: {
        email: "admin@example.org",
        givenName: "Service",
        familyName: "Admin",
      },
      role: "admin",
      status: "active",
    }, audit());
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'configured', totp_state = 'configured',
              version = version + 1, updated_at = ?
          WHERE user_id IN (?, ?)
        `, [NOW, user.id, admin.id]);
        insertActiveService(transaction, user.id);
        transaction.run(`
          INSERT INTO external_identities (
            id, user_id, provider_id, issuer, subject,
            version, created_at, updated_at
          ) VALUES (?, ?, 'workforce', 'https://id.example.org',
            'external-subject', 1, ?, ?)
        `, [LINK_ID, user.id, NOW, NOW]);
      }),
    });
    const repository = new DatabaseOAuthEligibilityRepository(worker);

    await expect(repository.byEmail(" Eligible@Example.org "))
      .resolves.toMatchObject({
        userId: user.id,
        role: "user",
        status: "active",
        hasEffectiveService: true,
        localEligible: true,
      });
    await expect(repository.byExternalIdentity(
      "workforce",
      "https://id.example.org",
      "external-subject",
    )).resolves.toMatchObject({
      userId: user.id,
      hasEffectiveService: true,
    });
    await expect(repository.byUserId(admin.id)).resolves.toMatchObject({
      role: "admin",
      localEligible: false,
    });
    await expect(repository.byEmail("missing@example.org"))
      .resolves.toBeUndefined();
    await expect(repository.byExternalIdentity(
      "workforce",
      "https://id.example.org",
      "wrong-subject",
    )).resolves.toBeUndefined();
  });

  it("fails eligibility when activation or the final assignment disappears", async () => {
    const worker = open("dynamic");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const user = await identities.createLocalIdentity({
      profile: {
        email: "dynamic@example.org",
        givenName: "Dynamic",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'configured', totp_state = 'configured',
              version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [NOW, user.id]);
        insertActiveService(transaction, user.id);
      }),
    });
    const repository = new DatabaseOAuthEligibilityRepository(worker);
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      localEligible: true,
    });

    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE id = ?",
          [ASSIGNMENT_ID],
        );
      }),
    });
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      hasEffectiveService: false,
      localEligible: false,
    });

    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO service_principal_assignments (
            id, service_id, selector_kind, group_id, user_id,
            assigned_by_user_id, created_at
          ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
        `, [ASSIGNMENT_ID, SERVICE_ID, user.id, user.id, NOW]);
        transaction.run(`
          UPDATE runtime_activation SET state = 'inactive',
            activated_at = NULL, version = version + 1, updated_at = ?
          WHERE singleton = 1
        `, [NOW]);
      }),
    });
    await expect(repository.byUserId(user.id)).resolves.toMatchObject({
      hasEffectiveService: false,
      localEligible: false,
    });
  });

  it("atomically creates a local grant and exchanges a single-use code without persisting raw values", async () => {
    const fixture = await eligibleLocalUser("grant");
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 93));
    const repository = oauthRepository(fixture.worker, hasher);
    const verifier = "v".repeat(43);
    const authorization = await repository.authorizeLocal({
      proof: proof(fixture.userId, 59_503_333),
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
    });

    const authorized = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        grants: number;
        codes: number;
        code_hash: string;
        purpose: string;
      }>(`
        SELECT
          (SELECT count(*) FROM oauth_grants) AS grants,
          (SELECT count(*) FROM oauth_authorization_codes) AS codes,
          (SELECT code_hash FROM oauth_authorization_codes) AS code_hash,
          (SELECT purpose FROM accepted_totp_steps) AS purpose
      `)),
    });
    expect(authorized).toEqual({
      grants: 1,
      codes: 1,
      code_hash: hasher.hash("authorization_code", authorization.code),
      purpose: "oauth",
    });
    expect(JSON.stringify(authorized)).not.toContain(authorization.code);

    const tokens = await repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      codeVerifier: verifier,
    });
    expect(tokens).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 300,
      scopes: ["mcp:access"],
      grantId: authorization.grantId,
    });
    expect(tokens.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        consumed_at: number;
        access_hash: string;
        refresh_hash: string;
        audit: string;
      }>(`
        SELECT
          (SELECT consumed_at FROM oauth_authorization_codes) AS consumed_at,
          (SELECT token_hash FROM oauth_access_tokens) AS access_hash,
          (SELECT token_hash FROM oauth_refresh_tokens) AS refresh_hash,
          (SELECT group_concat(action || ':' || target_label_snapshot)
             FROM administrative_audit_events
             WHERE action LIKE 'oauth.%') AS audit
      `)),
    });
    expect(stored).toMatchObject({
      consumed_at: NOW,
      access_hash: hasher.hash("access", tokens.accessToken),
      refresh_hash: hasher.hash("refresh", tokens.refreshToken),
    });
    expect(stored?.audit).toContain("oauth.grant_authorize");
    expect(stored?.audit).toContain("oauth.code_exchange");
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(authorization.code);
    expect(serialized).not.toContain(tokens.accessToken);
    expect(serialized).not.toContain(tokens.refreshToken);

    await expect(repository.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).resolves.toEqual({
      subject: fixture.userId,
      scopes: ["mcp:access"],
      mode: "builtin_oauth",
    });
    await expect(repository.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://wrong.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    const rotated = await repository.rotateRefreshToken({
      refreshToken: tokens.refreshToken,
      clientIdentifier: "https://client.example.org/metadata.json",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      correlationId: "req_12345678-1234-4234-8234-123456789abd",
    });
    await expect(repository.authenticateAccessToken({
      accessToken: rotated.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).resolves.toMatchObject({ subject: fixture.userId });

    await expect(repository.rotateRefreshToken({
      refreshToken: tokens.refreshToken,
      clientIdentifier: "https://client.example.org/metadata.json",
      resource: "https://mcp.example.org",
      correlationId: "req_12345678-1234-4234-8234-123456789abe",
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    await expect(repository.authenticateAccessToken({
      accessToken: rotated.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    const replayed = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        family_status: string;
        live_access: number;
        active_refresh: number;
        replay_audits: number;
      }>(`
        SELECT
          (SELECT status FROM oauth_refresh_families) AS family_status,
          (SELECT count(*) FROM oauth_access_tokens
            WHERE status = 'active') AS live_access,
          (SELECT count(*) FROM oauth_refresh_tokens
            WHERE status = 'active') AS active_refresh,
          (SELECT count(*) FROM administrative_audit_events
            WHERE action = 'oauth.refresh_replay'
              AND result = 'deny') AS replay_audits
      `)),
    });
    expect(replayed).toEqual({
      family_status: "revoked",
      live_access: 0,
      active_refresh: 0,
      replay_audits: 1,
    });
    await expect(repository.sweepExpired(1)).resolves.toBe(3);
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        codes: number;
        access_records: number;
        grants: number;
        families: number;
      }>(`
        SELECT
          (SELECT count(*) FROM oauth_authorization_codes) AS codes,
          (SELECT count(*) FROM oauth_access_tokens) AS access_records,
          (SELECT count(*) FROM oauth_grants) AS grants,
          (SELECT count(*) FROM oauth_refresh_families) AS families
      `)),
    })).toEqual({
      codes: 0,
      access_records: 1,
      grants: 1,
      families: 1,
    });

    await expect(repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/callback",
      codeVerifier: verifier,
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    hasher.close();
  });

  it("applies live OAuth lifetime reductions without extending issued tokens", async () => {
    const fixture = await eligibleLocalUser("live-lifetimes");
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 109));
    const clock = { value: NOW };
    const settings = {
      accessTokenTtlMs: 5 * 60_000,
      authorizationCodeTtlMs: 10 * 60_000,
      refreshTokenIdleTtlMs: 30 * 86_400_000,
      refreshTokenMaxTtlMs: 90 * 86_400_000,
      maxAuthorizationCodes: 100,
      maxTokenRecords: 1_000,
    };
    const repository = new DatabaseOAuthRepository(
      fixture.worker,
      hasher,
      () => settings,
      { now: () => clock.value },
    );
    const verifier = "l".repeat(43);
    const authorization = await repository.authorizeLocal({
      proof: proof(fixture.userId, 59_503_334),
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
    });
    const tokens = await repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: client().identifier,
      redirectUri: client().redirectUris[0]!,
      resource: "https://mcp.example.org",
      codeVerifier: verifier,
    });
    expect(tokens.expiresIn).toBe(300);

    settings.accessTokenTtlMs = 60_000;
    clock.value += 60_000;
    await expect(repository.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));

    const shortVerifier = "s".repeat(43);
    const shortAuthorization = await repository.authorizeLocal({
      proof: {
        ...proof(fixture.userId, 59_503_336),
        verifiedAt: clock.value,
      },
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(shortVerifier),
    });
    const shortTokens = await repository.exchangeAuthorizationCode({
      code: shortAuthorization.code,
      clientIdentifier: client().identifier,
      redirectUri: client().redirectUris[0]!,
      resource: "https://mcp.example.org",
      codeVerifier: shortVerifier,
    });
    expect(shortTokens.expiresIn).toBe(60);
    settings.accessTokenTtlMs = 15 * 60_000;
    clock.value += 60_000;
    await expect(repository.authenticateAccessToken({
      accessToken: shortTokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    hasher.close();
  });

  it("rejects noncanonical PKCE, stale proofs, lost eligibility, and mismatched exchanges without partial mutation", async () => {
    const fixture = await eligibleLocalUser("deny");
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 94));
    const repository = oauthRepository(fixture.worker, hasher);
    const verifier = "w".repeat(43);
    const request = {
      proof: proof(fixture.userId, 59_503_334),
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
    };
    await expect(repository.authorizeLocal({
      ...request,
      codeChallenge: `${"A".repeat(42)}B`,
    })).rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));
    await expect(repository.authorizeLocal({
      ...request,
      proof: { ...request.proof, securityEpoch: 999 },
    })).rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));

    const authorization = await repository.authorizeLocal(request);
    await expect(repository.authorizeLocal(request))
      .rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));
    await expect(repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/wrong",
      codeVerifier: verifier,
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE id = ?",
          [ASSIGNMENT_ID],
        );
      }),
    });
    await expect(repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/callback",
      codeVerifier: verifier,
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        consumed_at: null;
        families: number;
        tokens: number;
      }>(`
        SELECT
          (SELECT consumed_at FROM oauth_authorization_codes) AS consumed_at,
          (SELECT count(*) FROM oauth_refresh_families) AS families,
          ((SELECT count(*) FROM oauth_refresh_tokens)
            + (SELECT count(*) FROM oauth_access_tokens)) AS tokens
      `)),
    })).toEqual({ consumed_at: null, families: 0, tokens: 0 });
    hasher.close();
  });

  it("serializes racing refreshes so one rotates and replay revokes the winning family", async () => {
    const fixture = await eligibleLocalUser("refresh-race");
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 95));
    const repository = oauthRepository(fixture.worker, hasher);
    const verifier = "r".repeat(43);
    const authorization = await repository.authorizeLocal({
      proof: proof(fixture.userId, 59_503_335),
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
    });
    const tokens = await repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/callback",
      codeVerifier: verifier,
    });
    const rotations = await Promise.allSettled([
      repository.rotateRefreshToken({
        refreshToken: tokens.refreshToken,
        clientIdentifier: "https://client.example.org/metadata.json",
        resource: "https://mcp.example.org",
        correlationId: "req_12345678-1234-4234-8234-123456789ab1",
      }),
      repository.rotateRefreshToken({
        refreshToken: tokens.refreshToken,
        clientIdentifier: "https://client.example.org/metadata.json",
        resource: "https://mcp.example.org",
        correlationId: "req_12345678-1234-4234-8234-123456789ab2",
      }),
    ]);
    expect(rotations.filter((outcome) => outcome.status === "fulfilled"))
      .toHaveLength(1);
    expect(rotations.filter((outcome) =>
      outcome.status === "rejected"
      && outcome.reason instanceof DatabaseOAuthError
      && outcome.reason.code === "invalid_grant")).toHaveLength(1);
    const winning = rotations.find(
      (outcome): outcome is PromiseFulfilledResult<Awaited<typeof tokens>> =>
        outcome.status === "fulfilled",
    );
    if (winning === undefined) throw new Error("missing winning rotation");
    await expect(repository.authenticateAccessToken({
      accessToken: winning.value.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    hasher.close();
  });

  it("survives restart with a stable HMAC key and applies reduced access lifetimes at the exact boundary", async () => {
    const fixture = await eligibleLocalUser("restart-token");
    const key = Buffer.alloc(32, 96);
    const hasher = new DatabaseOAuthTokenHasher(key);
    const repository = oauthRepository(fixture.worker, hasher);
    const verifier = "s".repeat(43);
    const authorization = await repository.authorizeLocal({
      proof: proof(fixture.userId, 59_503_336),
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
    });
    const tokens = await repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: "https://client.example.org/callback",
      codeVerifier: verifier,
    });
    await fixture.worker.close();
    workers.delete(fixture.worker);
    hasher.close();

    const restartedWorker = openFile(fixture.databaseFile);
    const restartedHasher = new DatabaseOAuthTokenHasher(key);
    const restarted = oauthRepository(
      restartedWorker,
      restartedHasher,
      () => NOW + 59_999,
      { accessTokenTtlMs: 60_000 },
    );
    await expect(restarted.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).resolves.toMatchObject({ subject: fixture.userId });
    await expect(restarted.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:admin"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    await restartedWorker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE id = ?",
          [ASSIGNMENT_ID],
        );
      }),
    });
    await expect(restarted.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    await restartedWorker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO service_principal_assignments (
            id, service_id, selector_kind, group_id, user_id,
            assigned_by_user_id, created_at
          ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
        `, [
          ASSIGNMENT_ID,
          SERVICE_ID,
          fixture.userId,
          fixture.userId,
          NOW + 59_999,
        ]);
      }),
    });

    const atBoundary = oauthRepository(
      restartedWorker,
      restartedHasher,
      () => NOW + 60_000,
      { accessTokenTtlMs: 60_000 },
    );
    await expect(atBoundary.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).rejects.toEqual(new DatabaseOAuthError("invalid_grant"));
    restartedHasher.close();
  });

  it("binds an external intent to one linked eligible UUID and issues a single-use code after verified MFA", async () => {
    const fixture = await eligibleLocalUser("external-intent");
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO external_identities (
            id, user_id, provider_id, issuer, subject,
            version, created_at, updated_at
          ) VALUES (?, ?, 'workforce', 'https://id.example.org',
            'linked-subject', 1, ?, ?)
        `, [LINK_ID, fixture.userId, NOW, NOW]);
      }),
    });
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 97));
    const repository = oauthRepository(fixture.worker, hasher);
    const verifier = "o".repeat(43);
    const intent = await repository.createExternalIntent({
      client: client(),
      redirectUri: "https://client.example.org/callback",
      resource: "https://mcp.example.org",
      scopes: ["mcp:access"],
      codeChallenge: challenge(verifier),
      providerId: "workforce",
      stateEnvelopeJson: JSON.stringify({ encrypted: "client-state" }),
    });
    await expect(repository.resolveExternalIntent(
      intent.handle,
      "workforce",
    )).resolves.toEqual({ id: intent.id });
    await expect(repository.resolveExternalIntent(
      `${intent.handle.slice(0, -1)}${intent.handle.endsWith("A") ? "B" : "A"}`,
      "workforce",
    )).rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));
    await expect(repository.authorizeExternalIntent(intent.id, {
      providerId: "workforce",
      issuer: "https://id.example.org",
      subject: "linked-subject",
      authenticationTime: NOW,
      mfa: { verified: false, evidence: [] },
    }, "req_12345678-1234-4234-8234-123456789ab3"))
      .rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));

    const authorization = await repository.authorizeExternalIntent(intent.id, {
      providerId: "workforce",
      issuer: "https://id.example.org",
      subject: "linked-subject",
      authenticationTime: NOW,
      mfa: { verified: true, evidence: ["acr"] },
    }, "req_12345678-1234-4234-8234-123456789ab4");
    expect(authorization).toMatchObject({
      redirectUri: "https://client.example.org/callback",
      stateEnvelopeJson: JSON.stringify({ encrypted: "client-state" }),
    });
    const tokens = await repository.exchangeAuthorizationCode({
      code: authorization.code,
      clientIdentifier: "https://client.example.org/metadata.json",
      redirectUri: authorization.redirectUri,
      codeVerifier: verifier,
    });
    await expect(repository.authenticateAccessToken({
      accessToken: tokens.accessToken,
      resource: "https://mcp.example.org",
      requiredScopes: ["mcp:access"],
    })).resolves.toMatchObject({ subject: fixture.userId });
    await expect(repository.authorizeExternalIntent(intent.id, {
      providerId: "workforce",
      issuer: "https://id.example.org",
      subject: "linked-subject",
      authenticationTime: NOW,
      mfa: { verified: true, evidence: ["acr"] },
    }, "req_12345678-1234-4234-8234-123456789ab5"))
      .rejects.toEqual(new DatabaseOAuthError("invalid_authorization"));
    hasher.close();
  });
});

async function eligibleLocalUser(label: string): Promise<{
  worker: PersistenceWorker;
  userId: string;
  databaseFile: string;
}> {
  const databaseFile = join(
    mkdtempSync(join(tmpdir(), `secretsauce-oauth-${label}-`)),
    "control.sqlite",
  );
  const worker = openFile(databaseFile);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const user = await identities.createLocalIdentity({
    profile: {
      email: `${label}@example.org`,
      givenName: "OAuth",
      familyName: "User",
    },
    role: "user",
    status: "active",
  }, audit());
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        UPDATE local_authenticator_states
        SET password_state = 'configured', totp_state = 'configured',
            version = version + 1, updated_at = ?
        WHERE user_id = ?
      `, [NOW, user.id]);
      insertActiveService(transaction, user.id);
    }),
  });
  return { worker, userId: user.id, databaseFile };
}

function oauthRepository(
  worker: PersistenceWorker,
  hasher: DatabaseOAuthTokenHasher,
  now: () => number = () => NOW,
  overrides: Partial<{
    accessTokenTtlMs: number;
    authorizationCodeTtlMs: number;
    refreshTokenIdleTtlMs: number;
    refreshTokenMaxTtlMs: number;
    maxAuthorizationCodes: number;
    maxTokenRecords: number;
  }> = {},
): DatabaseOAuthRepository {
  return new DatabaseOAuthRepository(worker, hasher, {
    accessTokenTtlMs: 5 * 60_000,
    authorizationCodeTtlMs: 10 * 60_000,
    refreshTokenIdleTtlMs: 30 * 86_400_000,
    refreshTokenMaxTtlMs: 90 * 86_400_000,
    maxAuthorizationCodes: 100,
    maxTokenRecords: 1_000,
    ...overrides,
  }, { now });
}

function client() {
  return {
    identifier: "https://client.example.org/metadata.json",
    displayName: "Example Client",
    redirectUris: ["https://client.example.org/callback"],
  };
}

function proof(userId: string, acceptedTotpStep: number) {
  return {
    userId,
    role: "user" as const,
    securityEpoch: 1,
    globalSecurityEpoch: 1,
    acceptedTotpStep,
    verifiedAt: NOW,
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
  };
}

function challenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function open(label: string): PersistenceWorker {
  return openFile(join(
    mkdtempSync(join(tmpdir(), `secretsauce-oauth-${label}-`)),
    "control.sqlite",
  ));
}

function openFile(databaseFile: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function insertActiveService(
  transaction: {
    run(sql: string, parameters?: unknown[]): unknown;
  },
  userId: string,
): void {
  transaction.run(`
    INSERT INTO services (
      id, slug, name, description, documentation_url, lifecycle,
      draft_digest, published_revision_id, published_digest,
      publication_generation, version, created_at, updated_at
    ) VALUES (?, 'oauth-api', 'OAuth API', NULL, NULL, 'published',
      ?, ?, ?, 1, 1, ?, ?)
  `, [
    SERVICE_ID,
    "a".repeat(64),
    "018f1f2e-7b3c-7a10-8000-000000000105",
    "b".repeat(64),
    NOW,
    NOW,
  ]);
  transaction.run(`
    INSERT INTO runtime_service_snapshots (
      id, service_id, publication_generation, document_json, digest, created_at
    ) VALUES (?, ?, 1, '{}', ?, ?)
  `, [SNAPSHOT_ID, SERVICE_ID, "c".repeat(64), NOW]);
  transaction.run(`
    UPDATE runtime_activation
    SET state = 'active', activation_generation = 1,
      global_reference_epoch = 1, version = 2,
      activated_at = ?, updated_at = ?
    WHERE singleton = 1
  `, [NOW, NOW]);
  transaction.run(`
    INSERT INTO runtime_active_services (
      service_id, snapshot_id, publication_generation, activated_at
    ) VALUES (?, ?, 1, ?)
  `, [SERVICE_ID, SNAPSHOT_ID, NOW]);
  transaction.run(`
    INSERT INTO service_principal_assignments (
      id, service_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
  `, [ASSIGNMENT_ID, SERVICE_ID, userId, userId, NOW]);
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "oauth-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
    source: { category: "identity" },
  };
}
