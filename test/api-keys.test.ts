import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_SERVICES_KEY_CONFIRMATION,
  ApiKeyError,
  ApiKeyRepository,
  ApiKeyService,
  ApiKeyVerifierPool,
  generateApiKey,
  hashApiKey,
  isSupportedApiKeyHash,
  normalizeNickname,
  parseApiKey,
  parseExpiration,
} from "../src/apiKeys.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
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
