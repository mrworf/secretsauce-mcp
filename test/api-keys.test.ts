import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_SERVICES_KEY_CONFIRMATION,
  ApiKeyCursorCodec,
  ApiKeyError,
  ApiKeyRepository,
  ApiKeyService,
  ApiKeyVerifierPool,
  SystemApiKeyAuthenticator,
  generateApiKey,
  hashApiKey,
  isSupportedApiKeyHash,
  normalizeNickname,
  parseApiKey,
  parseExpiration,
} from "../src/apiKeys.js";
import type {
  ControlApiKeyActivityRecorder,
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import { defineControlRoute } from "../src/control/routeRegistry.js";
import { createControlApplication } from "../src/control/server.js";
import { z } from "../src/control/zod.js";
import { validateConfig } from "../src/config.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const ADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const OTHER_SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000004";
const KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000005";
const OTHER_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000006";
const THIRD_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000007";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("system API key primitives", () => {
  it("generates a recognizable canonical 256-bit key and verifies only its exact value", async () => {
    let call = 0;
    const generated = generateApiKey((size) => {
      call += 1;
      return Buffer.alloc(size, call);
    });
    expect(generated.value).toBe(
      "ssk_v1_AQEBAQEBAQEBAQEB_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
    );
    expect(generated.identifier).toBe("AQEBAQEBAQEBAQEB");
    expect(generated.lastFour).toBe("CAgI");
    expect(parseApiKey(generated.value).identifier).toBe(generated.identifier);

    const verifier = await hashApiKey(Buffer.from(generated.value, "utf8"));
    expect(isSupportedApiKeyHash(verifier)).toBe(true);
    const pool = new ApiKeyVerifierPool();
    expect(await pool.check(Buffer.from(generated.value, "utf8"), verifier)).toBe(true);
    expect(await pool.check(
      Buffer.from(`${generated.value.slice(0, -1)}A`, "utf8"),
      verifier,
    )).toBe(false);
  });

  it("rejects malformed, noncanonical, oversized, and wrongly scoped external inputs", () => {
    const valid = generateApiKey((size) => Buffer.alloc(size, 7)).value;
    for (const candidate of [
      undefined,
      "",
      ` ${valid}`,
      valid.toUpperCase(),
      valid.slice(0, -1),
      `${valid}x`,
      valid.replace("ssk_v1", "ssk_v2"),
      valid.replace(/.$/, "+"),
      valid.replace(/.$/, "/"),
    ]) {
      expectApiKeyError(() => parseApiKey(candidate), "invalid_request");
    }
    expect(normalizeNickname("  Deployment bot  ")).toBe("Deployment bot");
    for (const nickname of ["", " \n ", "x".repeat(129), `safe\0unsafe`]) {
      expectApiKeyError(() => normalizeNickname(nickname), "invalid_request");
    }
    expect(parseExpiration({ policy: "forever" })).toEqual({ policy: "forever" });
    expect(parseExpiration({ policy: "days", days: 1 })).toEqual({ policy: "days", days: 1 });
    expect(parseExpiration({ policy: "days", days: 3650 })).toEqual({
      policy: "days",
      days: 3650,
    });
    for (const expiration of [
      {},
      { policy: "days", days: 0 },
      { policy: "days", days: 3651 },
      { policy: "days", days: 1.5 },
      { policy: "forever", days: 1 },
      { policy: "unknown" },
    ]) {
      expectApiKeyError(() => parseExpiration(expiration), "invalid_request");
    }
  });

  it("binds canonical metadata cursors to browser actor, filters, resource, and expiry", () => {
    const clock = { value: NOW };
    const cursors = new ApiKeyCursorCodec(Buffer.alloc(32, 60), () => clock.value);
    const binding = {
      kind: "list" as const,
      actorId: SUPERADMIN_ID,
      actorRole: "superadmin" as const,
      filter: '{"role":null}',
    };
    const cursor = cursors.encode(binding, { time: NOW, id: KEY_ID });
    expect(cursors.decode(cursor, binding)).toEqual({ time: NOW, id: KEY_ID });
    expectApiKeyError(
      () => cursors.decode(cursor, { ...binding, filter: '{"role":"system"}' }),
      "invalid_request",
    );
    expectApiKeyError(
      () => cursors.decode(`${cursor.slice(0, -1)}0`, binding),
      "invalid_request",
    );
    clock.value += 15 * 60_000;
    expectApiKeyError(() => cursors.decode(cursor, binding), "invalid_request");
    cursors.close();
  });

  it("zeros candidates and fails closed when verifier concurrency is saturated", async () => {
    const encoded =
      `$argon2id$v=19$m=65536,p=1,t=3$${"A".repeat(22)}$${"B".repeat(43)}`;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pool = new ApiKeyVerifierPool(1, async () => {
      await gate;
      return true;
    });
    const firstCandidate = Buffer.from("first");
    const first = pool.check(firstCandidate, encoded);
    const rejectedCandidate = Buffer.from("second");
    await expect(pool.check(rejectedCandidate, encoded)).rejects.toMatchObject({
      code: "rate_limited",
    });
    expect(rejectedCandidate.equals(Buffer.alloc(6))).toBe(true);
    release?.();
    await expect(first).resolves.toBe(true);
    expect(firstCandidate.equals(Buffer.alloc(5))).toBe(true);

    const invalidCandidate = Buffer.from("invalid");
    await expect(pool.check(invalidCandidate, "not-a-verifier")).resolves.toBe(false);
    expect(invalidCandidate.equals(Buffer.alloc(7))).toBe(true);
  });
});

describe("system API key creation and metadata", () => {
  it("creates assigned service keys and returns raw material only from the one-time result", async () => {
    const fixture = await apiKeyFixture("assigned");
    const result = await fixture.service.create(fixture.admin, {
      nickname: "  Service automation  ",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "days", days: 1 },
    }, CORRELATION);
    expect(result.oneTimeKey).toMatch(/^ssk_v1_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/);
    expect(result.apiKey).toMatchObject({
      id: KEY_ID,
      nickname: "Service automation",
      apiRole: "service",
      serviceId: SERVICE_ID,
      status: "active",
      expiresAt: NOW + 86_400_000,
      creatorId: ADMIN_ID,
      version: 1,
    });
    expect(result.apiKey).not.toHaveProperty("verifierHash");
    expect(JSON.stringify(result.apiKey)).not.toContain(result.oneTimeKey);

    const metadata = await fixture.repository.metadata(KEY_ID, fixture.admin);
    expect(metadata).toEqual(result.apiKey);
    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        verifier_hash: string;
        identifier: string;
      }>("SELECT verifier_hash, identifier FROM api_keys WHERE id = ?", [KEY_ID])),
    });
    expect(stored?.verifier_hash).not.toContain(result.oneTimeKey);
    expect(stored?.verifier_hash).toMatch(/^\$argon2id\$/);
    expect(result.oneTimeKey).toContain(stored?.identifier ?? "missing");
  });

  it("lists only browser-visible metadata before filtering and pagination", async () => {
    const fixture = await apiKeyFixture("list");
    const serviceKey = await fixture.service.create(fixture.admin, {
      nickname: "Scoped deployment",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "forever" },
    }, CORRELATION);
    const systemKey = await fixture.service.create(fixture.superadmin, {
      nickname: "System automation",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);

    expect(await fixture.repository.list({
      actor: fixture.admin,
      limit: 1,
    })).toEqual({ apiKeys: [serviceKey.apiKey] });
    const global = await fixture.repository.list({
      actor: fixture.superadmin,
      limit: 1,
    });
    expect(global.apiKeys).toEqual([systemKey.apiKey]);
    expect(global.last).toEqual({
      createdAt: systemKey.apiKey.createdAt,
      id: systemKey.apiKey.id,
    });
    expect(await fixture.repository.list({
      actor: fixture.superadmin,
      limit: 10,
      role: "service",
      serviceId: SERVICE_ID,
      q: "deployment",
    })).toEqual({ apiKeys: [serviceKey.apiKey] });
    await expect(fixture.repository.list({
      actor: { ...fixture.admin, role: "user" },
      limit: 10,
    })).rejects.toMatchObject({ code: "forbidden" });
    await expect(fixture.repository.list({
      actor: fixture.superadmin,
      limit: 0,
    })).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("updates nickname and only shortens finite expiry with strong concurrency", async () => {
    const fixture = await apiKeyFixture("update");
    const created = await fixture.service.create(fixture.admin, {
      nickname: "Original name",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "days", days: 10 },
    }, CORRELATION);
    const shortened = await fixture.repository.update({
      actor: fixture.admin,
      id: created.apiKey.id,
      expectedVersion: 1,
      nickname: "Renamed automation",
      expiresAt: NOW + 5 * 86_400_000,
      correlationId: CORRELATION,
    });
    expect(shortened).toMatchObject({
      nickname: "Renamed automation",
      expiresAt: NOW + 5 * 86_400_000,
      version: 2,
    });
    await expect(fixture.repository.update({
      actor: fixture.admin,
      id: created.apiKey.id,
      expectedVersion: 1,
      nickname: "Stale",
      correlationId: CORRELATION,
    })).rejects.toMatchObject({ code: "stale" });
    await expect(fixture.repository.update({
      actor: fixture.admin,
      id: created.apiKey.id,
      expectedVersion: 2,
      expiresAt: NOW + 6 * 86_400_000,
      correlationId: CORRELATION,
    })).rejects.toMatchObject({ code: "conflict" });

    const forever = await fixture.service.create(fixture.superadmin, {
      nickname: "Forever key",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);
    await expect(fixture.repository.update({
      actor: fixture.superadmin,
      id: forever.apiKey.id,
      expectedVersion: 1,
      expiresAt: NOW + 86_400_000,
      correlationId: CORRELATION,
    })).rejects.toMatchObject({ code: "conflict" });
  });

  it("revokes idempotently and rotates as an atomic replacement without extending expiry", async () => {
    const fixture = await apiKeyFixture("lifecycle");
    const created = await fixture.service.create(fixture.admin, {
      nickname: "Rotate me",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "days", days: 10 },
    }, CORRELATION);
    const rotated = await fixture.service.rotate(fixture.admin, {
      id: created.apiKey.id,
      expectedVersion: 1,
      justification: "Scheduled credential replacement",
    }, CORRELATION);
    expect(rotated.oneTimeKey).toMatch(/^ssk_v1_/);
    expect(rotated.apiKey).toMatchObject({
      id: OTHER_KEY_ID,
      nickname: "Rotate me",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expirationPolicy: "timestamp",
      expiresAt: created.apiKey.expiresAt,
      version: 1,
    });
    expect(await fixture.repository.metadata(created.apiKey.id, fixture.admin))
      .toMatchObject({ status: "revoked", version: 2 });
    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.all<{
        id: string;
        verifier_hash: string;
      }>("SELECT id, verifier_hash FROM api_keys ORDER BY id")),
    });
    expect(stored).toHaveLength(2);
    expect(JSON.stringify(stored)).not.toContain(rotated.oneTimeKey);

    const revoked = await fixture.repository.revoke({
      actor: fixture.admin,
      id: rotated.apiKey.id,
      expectedVersion: 1,
      justification: "Automation retired",
      correlationId: CORRELATION,
    });
    expect(revoked).toMatchObject({ changed: true, apiKey: { status: "revoked", version: 2 } });
    const repeated = await fixture.repository.revoke({
      actor: fixture.admin,
      id: rotated.apiKey.id,
      expectedVersion: 1,
      justification: "Automation retired",
      correlationId: CORRELATION,
    });
    expect(repeated).toMatchObject({ changed: false, apiKey: { status: "revoked", version: 2 } });
    await expect(fixture.service.rotate(fixture.admin, {
      id: rotated.apiKey.id,
      expectedVersion: 2,
      justification: "Cannot revive",
    }, CORRELATION)).rejects.toMatchObject({ code: "conflict" });
  });

  it("retains safe activity snapshots across nickname changes without raw material", async () => {
    const fixture = await apiKeyFixture("activity");
    const created = await fixture.service.create(fixture.admin, {
      nickname: "Historical name",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "days", days: 10 },
    }, CORRELATION);
    await fixture.repository.update({
      actor: fixture.admin,
      id: created.apiKey.id,
      expectedVersion: 1,
      nickname: "Current name",
      correlationId: CORRELATION,
    });
    const activity = await fixture.repository.activity({
      actor: fixture.admin,
      id: created.apiKey.id,
      limit: 10,
    });
    expect(activity.activity.map(({ action, nickname }) => ({ action, nickname })))
      .toEqual([
        { action: "api_keys.update", nickname: "Current name" },
        { action: "api_keys.create", nickname: "Historical name" },
      ]);
    expect(JSON.stringify(activity)).not.toContain(created.oneTimeKey);
    expect(JSON.stringify(activity)).not.toContain("$argon2id");
    await expect(fixture.repository.recordControlActivity({
      apiKeyId: created.apiKey.id,
      action: "Invalid route",
      outcome: "allow",
      requestId: CORRELATION,
    })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(fixture.repository.activity({
      actor: fixture.superadmin,
      id: created.apiKey.id,
      limit: 101,
    })).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("allows superadmin global roles with exact warning and enforces browser/service scope", async () => {
    const fixture = await apiKeyFixture("roles");
    const global = await fixture.service.create(fixture.superadmin, {
      nickname: "All service automation",
      apiRole: "all_services",
      expiration: { policy: "forever" },
      allServicesConfirmation: ALL_SERVICES_KEY_CONFIRMATION,
    }, CORRELATION);
    expect(global.apiKey).toMatchObject({
      id: KEY_ID,
      apiRole: "all_services",
      expirationPolicy: "forever",
      status: "active",
    });
    expect(global.apiKey).not.toHaveProperty("serviceId");
    expect(global.apiKey).not.toHaveProperty("expiresAt");

    await expect(fixture.service.create(fixture.admin, {
      nickname: "Too broad",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION)).rejects.toMatchObject({ code: "forbidden" });
    await expect(fixture.service.create(fixture.admin, {
      nickname: "Wrong service",
      apiRole: "service",
      serviceId: OTHER_SERVICE_ID,
      expiration: { policy: "forever" },
    }, CORRELATION)).rejects.toMatchObject({ code: "forbidden" });
    await expect(fixture.service.create(fixture.superadmin, {
      nickname: "Missing warning",
      apiRole: "all_services",
      expiration: { policy: "forever" },
    }, CORRELATION)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(fixture.repository.metadata(KEY_ID, fixture.admin)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(fixture.repository.metadata(KEY_ID, {
      ...fixture.superadmin,
      method: "api_key",
      role: "system",
    })).rejects.toMatchObject({ code: "not_found" });
  });

  it("projects expiry at the exact instant and remains independent of creator role changes", async () => {
    let now = NOW;
    const fixture = await apiKeyFixture("expiry", () => now);
    const result = await fixture.service.create(fixture.admin, {
      nickname: "Daily key",
      apiRole: "service",
      serviceId: SERVICE_ID,
      expiration: { policy: "days", days: 1 },
    }, CORRELATION);
    now += 86_400_000;
    expect(await fixture.repository.metadata(result.apiKey.id, fixture.admin))
      .toMatchObject({ status: "expired" });

    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE users SET role = 'user', updated_at = ?, version = version + 1 WHERE id = ?",
          [now, ADMIN_ID],
        );
      }),
    });
    await expect(fixture.repository.metadata(result.apiKey.id, fixture.admin))
      .rejects.toMatchObject({ code: "not_found" });
    expect(await fixture.repository.metadata(result.apiKey.id, fixture.superadmin))
      .toMatchObject({ status: "expired", creatorId: ADMIN_ID });
  });
});

describe("system API key control authentication", () => {
  it("authenticates an exact bearer independently of its creator and records safe use", async () => {
    const fixture = await apiKeyFixture("authenticate");
    const created = await fixture.service.create(fixture.superadmin, {
      nickname: "Control client",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE users SET status = 'deactivated', updated_at = ?, version = version + 1 WHERE id = ?",
          [NOW, SUPERADMIN_ID],
        );
      }),
    });
    const authenticator = await SystemApiKeyAuthenticator.create(
      fixture.repository,
      browserDelegate(),
    );
    const application = apiKeyApplication(authenticator, ["api_key"], fixture.repository);
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/test/api-principal",
      headers: {
        host: "control.example.org",
        authorization: `Bearer ${created.oneTimeKey}`,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        method: "api_key",
        principal_id: created.apiKey.id,
        role: "system",
        nickname: "Control client",
        last_four: created.apiKey.lastFour,
      },
    });
    const activity = await fixture.repository.activity({
      actor: {
        ...fixture.superadmin,
        principalId: ADMIN_ID,
        role: "admin",
      },
      id: created.apiKey.id,
      limit: 10,
    }).catch(() => undefined);
    expect(activity).toBeUndefined();
    const safeRows = await fixture.worker.execute({
      run: (database) => database.read((query) => query.all<{
        action: string;
        outcome: string;
        source_digest: string | null;
      }>(`
        SELECT action, outcome, source_digest
        FROM api_key_activity
        WHERE api_key_id = ?
        ORDER BY occurred_at DESC, id DESC
      `, [created.apiKey.id])),
    });
    expect(safeRows).toEqual(expect.arrayContaining([
      {
        action: "api_keys.authenticate",
        outcome: "allow",
        source_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      {
        action: "test.api_key_principal",
        outcome: "allow",
        source_digest: null,
      },
    ]));
    expect(JSON.stringify(safeRows)).not.toContain(created.oneTimeKey);
    await application.close();
  });

  it("rejects malformed, wrong, expired, and revoked keys without browser fallback", async () => {
    let now = NOW;
    const fixture = await apiKeyFixture("auth-denials", () => now);
    const created = await fixture.service.create(fixture.superadmin, {
      nickname: "Short lived",
      apiRole: "system",
      expiration: { policy: "days", days: 1 },
    }, CORRELATION);
    const authenticator = await SystemApiKeyAuthenticator.create(
      fixture.repository,
      browserDelegate(),
    );
    const application = apiKeyApplication(authenticator);
    const wrong = `${created.oneTimeKey.slice(0, -1)}${
      created.oneTimeKey.endsWith("A") ? "B" : "A"
    }`;
    for (const authorization of [
      "Basic ignored",
      "Bearer malformed",
      `Bearer ${wrong}`,
    ]) {
      const response = await application.inject({
        method: "GET",
        url: "/api/v2/test/api-principal",
        headers: {
          host: "control.example.org",
          cookie: "browser=ok",
          authorization,
        },
      });
      expect(response.statusCode).toBe(401);
    }
    now += 86_400_000;
    expect((await application.inject({
      method: "GET",
      url: "/api/v2/test/api-principal",
      headers: { host: "control.example.org", authorization: `Bearer ${created.oneTimeKey}` },
    })).statusCode).toBe(401);
    expect(await fixture.repository.metadata(created.apiKey.id, fixture.superadmin))
      .toMatchObject({ status: "expired", version: 2 });
    await application.close();

    const revokedFixture = await apiKeyFixture("auth-revoked");
    const revoked = await revokedFixture.service.create(revokedFixture.superadmin, {
      nickname: "Revoked client",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);
    await revokedFixture.repository.revoke({
      actor: revokedFixture.superadmin,
      id: revoked.apiKey.id,
      expectedVersion: 1,
      justification: "No longer needed",
      correlationId: CORRELATION,
    });
    const revokedApplication = apiKeyApplication(await SystemApiKeyAuthenticator.create(
      revokedFixture.repository,
      browserDelegate(),
    ));
    expect((await revokedApplication.inject({
      method: "GET",
      url: "/api/v2/test/api-principal",
      headers: { host: "control.example.org", authorization: `Bearer ${revoked.oneTimeKey}` },
    })).statusCode).toBe(401);
    await revokedApplication.close();
  });

  it("delegates requests without Authorization and audits browser-only API-key denial", async () => {
    const fixture = await apiKeyFixture("auth-delegate");
    const created = await fixture.service.create(fixture.superadmin, {
      nickname: "Denied client",
      apiRole: "system",
      expiration: { policy: "forever" },
    }, CORRELATION);
    const authenticator = await SystemApiKeyAuthenticator.create(
      fixture.repository,
      browserDelegate(),
    );
    const application = apiKeyApplication(
      authenticator,
      ["browser_session"],
      fixture.repository,
    );
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/test/api-principal",
      headers: { host: "control.example.org", cookie: "browser=ok" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { method: "browser_session", role: "superadmin" },
    });
    const denied = await application.inject({
      method: "GET",
      url: "/api/v2/test/api-principal",
      headers: {
        host: "control.example.org",
        authorization: `Bearer ${created.oneTimeKey}`,
      },
    });
    expect(denied.statusCode).toBe(403);
    const activity = await fixture.repository.activity({
      actor: fixture.superadmin,
      id: created.apiKey.id,
      limit: 10,
    });
    expect(activity.activity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "test.api_key_principal",
        outcome: "deny",
        targetType: "management_route",
        failureCode: "authentication_method_not_permitted",
      }),
    ]));
    expect(JSON.stringify(activity)).not.toContain(created.oneTimeKey);
    await application.close();
  });
});

describe("system API key HTTP lifecycle", () => {
  it("serves strict browser-only create, metadata, update, activity, revoke, and rotation contracts", async () => {
    const fixture = await apiKeyFixture("routes");
    const cursors = new ApiKeyCursorCodec(Buffer.alloc(32, 61), () => NOW);
    const authenticator = await SystemApiKeyAuthenticator.create(
      fixture.repository,
      browserDelegate(),
    );
    const application = createControlApplication(controlConfig(), {
      persistence: fixture.worker,
      authenticator,
      authorization: {
        authorizeScope: async () => true,
        verifyStepUp: async () => true,
      },
      apiKeys: {
        repository: fixture.repository,
        service: fixture.service,
        cursors,
      },
    });
    const created = await application.inject({
      method: "POST",
      url: "/api/v2/api-keys",
      headers: mutationHeaders(),
      payload: {
        nickname: "Route automation",
        api_role: "system",
        expiration: { policy: "days", days: 2 },
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(created.headers.etag).toBe('"1"');
    const createdBody = created.json().data;
    expect(createdBody).toMatchObject({
      one_time_value_displayed: true,
      api_key: {
        id: KEY_ID,
        nickname: "Route automation",
        api_role: "system",
        expiration_policy: "timestamp",
      },
    });
    expect(createdBody.one_time_key).toMatch(
      /^ssk_v1_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/,
    );

    const detail = await application.inject({
      method: "GET",
      url: `/api/v2/api-keys/${KEY_ID}`,
      headers: browserHeaders(),
    });
    expect(detail.statusCode).toBe(200);
    expect(JSON.stringify(detail.json())).not.toContain(createdBody.one_time_key);

    const shortenedExpiry = NOW + 86_400_000;
    const updated = await application.inject({
      method: "PATCH",
      url: `/api/v2/api-keys/${KEY_ID}`,
      headers: mutationHeaders({ "if-match": '"1"' }),
      payload: {
        nickname: "Renamed route automation",
        expires_at: shortenedExpiry,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({
      nickname: "Renamed route automation",
      expires_at: shortenedExpiry,
      version: 2,
    });

    const activity = await application.inject({
      method: "GET",
      url: `/api/v2/api-keys/${KEY_ID}/activity?limit=1`,
      headers: browserHeaders(),
    });
    expect(activity.statusCode).toBe(200);
    expect(activity.json().data.activity).toHaveLength(1);
    expect(JSON.stringify(activity.json())).not.toContain(createdBody.one_time_key);

    const rotated = await application.inject({
      method: "POST",
      url: `/api/v2/api-keys/${KEY_ID}/rotate`,
      headers: mutationHeaders({ "if-match": '"2"' }),
      payload: { justification: "Scheduled credential rotation." },
    });
    expect(rotated.statusCode).toBe(201);
    expect(rotated.headers["cache-control"]).toBe("no-store");
    expect(rotated.json().data).toMatchObject({
      one_time_value_displayed: true,
      api_key: { id: OTHER_KEY_ID, version: 1 },
    });
    expect(rotated.json().data.one_time_key).not.toBe(createdBody.one_time_key);

    const page = await application.inject({
      method: "GET",
      url: "/api/v2/api-keys?limit=1",
      headers: browserHeaders(),
    });
    expect(page.statusCode).toBe(200);
    expect(page.json().data.api_keys).toHaveLength(1);
    expect(page.json().data.next_cursor).toMatch(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
    const next = await application.inject({
      method: "GET",
      url: `/api/v2/api-keys?limit=1&cursor=${
        encodeURIComponent(page.json().data.next_cursor)
      }`,
      headers: browserHeaders(),
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().data.api_keys).toHaveLength(1);
    const altered = `${page.json().data.next_cursor.slice(0, -1)}0`;
    expect((await application.inject({
      method: "GET",
      url: `/api/v2/api-keys?limit=1&cursor=${encodeURIComponent(altered)}`,
      headers: browserHeaders(),
    })).statusCode).toBe(400);

    const apiKeyDenied = await application.inject({
      method: "GET",
      url: "/api/v2/api-keys",
      headers: {
        host: "control.example.org",
        authorization: `Bearer ${rotated.json().data.one_time_key}`,
      },
    });
    expect(apiKeyDenied.statusCode).toBe(403);

    const revoked = await application.inject({
      method: "POST",
      url: `/api/v2/api-keys/${OTHER_KEY_ID}/revoke`,
      headers: mutationHeaders({ "if-match": '"1"' }),
      payload: { justification: "Automation was retired." },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().data).toMatchObject({
      changed: true,
      api_key: { id: OTHER_KEY_ID, status: "revoked", version: 2 },
    });

    const openapi = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths["/api/v2/api-keys"]).toHaveProperty("post");
    expect(openapi.json().paths["/api/v2/api-keys/{api_key_id}/rotate"])
      .toHaveProperty("post");
    expect(JSON.stringify(openapi.json())).not.toContain("ssk_v1_example");

    await application.close();
    cursors.close();
  });
});

async function apiKeyFixture(
  name: string,
  now: () => number = () => NOW,
): Promise<{
  worker: PersistenceWorker;
  repository: ApiKeyRepository;
  service: ApiKeyService;
  superadmin: ControlAuthenticationContext;
  admin: ControlAuthenticationContext;
}> {
  const file = join(mkdtempSync(join(tmpdir(), `secretsauce-api-keys-${name}-`)), "control.sqlite");
  const worker = PersistenceWorker.open({
    databaseFile: file,
    productVersion: "0.1.0-test",
    now,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      for (const [id, email, role] of [
        [SUPERADMIN_ID, "root@example.org", "superadmin"],
        [ADMIN_ID, "admin@example.org", "admin"],
      ] as const) {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (?, ?, ?, '', '', ?, 'active', 1, 1, 1, ?, ?)
        `, [id, email, email, role, NOW, NOW]);
      }
      for (const [id, slug] of [
        [SERVICE_ID, "service-one"],
        [OTHER_SERVICE_ID, "service-two"],
      ] as const) {
        transaction.run(`
          INSERT INTO services (
            id, slug, name, description, documentation_url, lifecycle,
            draft_digest, published_revision_id, published_digest,
            publication_generation, version, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, NULL, 'draft', ?, NULL, NULL, 0, 1, ?, ?)
        `, [id, slug, slug, "a".repeat(64), NOW, NOW]);
      }
      transaction.run(`
        INSERT INTO service_admins (service_id, user_id, assigned_by_user_id, created_at)
        VALUES (?, ?, ?, ?)
      `, [SERVICE_ID, ADMIN_ID, SUPERADMIN_ID, NOW]);
    }),
  });
  const repository = new ApiKeyRepository(worker, now);
  const ids = [KEY_ID, OTHER_KEY_ID, THIRD_KEY_ID];
  let idIndex = 0;
  let randomCall = 0;
  const service = new ApiKeyService(repository, {
    now,
    uuid: () => {
      const id = ids[idIndex];
      idIndex += 1;
      if (id === undefined) throw new Error("API key test UUIDs exhausted.");
      return id;
    },
    random: (size) => {
      const keySequence = Math.floor(randomCall / 2);
      const value = 3 + keySequence * 2 + (size === 12 ? 0 : 1);
      randomCall += 1;
      return Buffer.alloc(size, value);
    },
  });
  return {
    worker,
    repository,
    service,
    superadmin: {
      method: "browser_session",
      principalId: SUPERADMIN_ID,
      role: "superadmin",
    },
    admin: {
      method: "browser_session",
      principalId: ADMIN_ID,
      role: "admin",
    },
  };
}

function expectApiKeyError(operation: () => unknown, code: ApiKeyError["code"]): void {
  try {
    operation();
    throw new Error("Expected API key error.");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiKeyError);
    expect(error).toMatchObject({ code });
  }
}

function browserDelegate(): ControlAuthenticator {
  return {
    authenticate: async (request) => request.headers.cookie === "browser=ok"
      ? {
          method: "browser_session",
          principalId: SUPERADMIN_ID,
          role: "superadmin",
        }
      : undefined,
    verifyCsrf: async () => true,
  };
}

function browserHeaders() {
  return {
    host: "control.example.org",
    cookie: "browser=ok",
  };
}

function mutationHeaders(extra: Record<string, string> = {}) {
  return {
    ...browserHeaders(),
    origin: "https://control.example.org",
    "x-csrf-token": "x".repeat(43),
    ...extra,
  };
}

function apiKeyApplication(
  authenticator: ControlAuthenticator,
  authentication: Array<"api_key" | "browser_session"> = ["api_key"],
  apiKeyActivity?: ControlApiKeyActivityRecorder,
) {
  return createControlApplication(controlConfig(), {
    authenticator,
    apiKeyActivity,
    registerControlRoutes: (registry) => {
      registry.register(defineControlRoute({
        id: "test.api_key_principal",
        method: "GET",
        path: "/api/v2/test/api-principal",
        summary: "Return the safe authenticated principal.",
        tags: ["Test"],
        authentication,
        permission: "authenticated",
        stepUp: "none",
        schemas: {
          response: z.object({
            method: z.enum(["api_key", "browser_session"]),
            principal_id: z.string(),
            role: z.enum(["superadmin", "service", "all_services", "system"]),
            nickname: z.string().optional(),
            last_four: z.string().optional(),
          }).strict(),
        },
        rateLimit: "management",
        secretFields: [],
        cache: "no-store",
        concurrency: "none",
        idempotency: "none",
        handler: ({ authentication: context }) => ({
          data: {
            method: context!.method as "api_key" | "browser_session",
            principal_id: context!.principalId,
            role: context!.role as "superadmin" | "service" | "all_services" | "system",
            ...(context!.apiKey === undefined
              ? {}
              : {
                  nickname: context!.apiKey.nickname,
                  last_four: context!.apiKey.lastFour,
                }),
          },
        }),
      }));
    },
  });
}

function controlConfig() {
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-api-key-control-"));
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  return validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: "127.0.0.1:8081",
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: keyFile,
    },
    persistence: {
      database_file: join(directory, "control.sqlite"),
    },
    auth: {
      mode: "bearer",
      bearer: { token_env: "TEST_GATEWAY_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{ name: "primary", base_url: "https://api.example.org" }],
      },
    },
  }, { TEST_GATEWAY_TOKEN: "data-plane-test-token" });
}
