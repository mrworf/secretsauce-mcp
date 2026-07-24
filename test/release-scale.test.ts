import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import {
  DatabaseOAuthRepository,
  DatabaseOAuthTokenHasher,
} from "../src/oauth/databaseOAuth.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { evaluatePolicySnapshot, type PolicyRuleSnapshot } from "../src/policy.js";
import { StatusDashboardService } from "../src/statusDashboard.js";

const NOW = 1_800_000_000_000;
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("deterministic release scale gates", () => {
  it("serves scoped status at 1,000 users, 500 services, and 5,000 credentials", async () => {
    const worker = open("status");
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        for (let index = 0; index < 1_000; index += 1) {
          const id = uuid(index + 1);
          const email = `user-${index}@example.org`;
          transaction.run(`
            INSERT INTO users (
              id, email, normalized_email, given_name, family_name, role, status,
              security_epoch, password_policy_version, version, created_at, updated_at
            ) VALUES (?, ?, ?, 'Scale', 'User', ?, 'active', 1, 1, 1, ?, ?)
          `, [
            id,
            email,
            email,
            index === 0 ? "superadmin" : index === 1 ? "admin" : "user",
            NOW,
            NOW,
          ]);
        }
        for (let serviceIndex = 0; serviceIndex < 500; serviceIndex += 1) {
          const serviceId = uuid(2_000 + serviceIndex);
          transaction.run(`
            INSERT INTO services (
              id, slug, name, lifecycle, draft_digest, publication_generation,
              version, created_at, updated_at
            ) VALUES (?, ?, ?, 'published', ?, 1, 1, ?, ?)
          `, [
            serviceId,
            `service-${serviceIndex}`,
            `Service ${serviceIndex.toString().padStart(3, "0")}`,
            "a".repeat(64),
            NOW,
            NOW,
          ]);
          transaction.run(`
            INSERT INTO service_admins (
              service_id, user_id, assigned_by_user_id, created_at
            ) VALUES (?, ?, ?, ?)
          `, [serviceId, uuid(2), uuid(1), NOW]);
          for (let credentialIndex = 0; credentialIndex < 10; credentialIndex += 1) {
            transaction.run(`
              INSERT INTO service_credentials (
                id, service_id, name, normalized_name, usage_kind, usage_name,
                enforce_header_ownership, status, vault_state,
                authorization_generation, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 'header', 'X-Release-Key', 1,
                'unconfigured', 'idle', 0, 1, ?, ?)
            `, [
              uuid(10_000 + serviceIndex * 10 + credentialIndex),
              serviceId,
              `Credential ${credentialIndex}`,
              `credential-${credentialIndex}`,
              NOW,
              NOW,
            ]);
          }
        }
      }),
    });
    const service = new StatusDashboardService(worker, {
      now: () => NOW,
      vaultReadiness: async () => "ready",
      identityReadiness: async () => "ready",
    });
    await service.snapshot(admin());
    const started = performance.now();
    const snapshot = await service.snapshot(admin());
    const elapsed = performance.now() - started;
    expect(snapshot.serviceCount).toBe(500);
    expect(snapshot.services).toHaveLength(100);
    expect(snapshot.servicesTruncated).toBe(true);
    expect(snapshot.services.reduce(
      (count, item) => count + item.credentials.unconfigured,
      0,
    )).toBe(1_000);
    expect(snapshot.system).toBeUndefined();
    await expect(worker.execute({
      run: (database) => database.read((query) => ({
        users: query.get<{ count: number }>("SELECT count(*) AS count FROM users")?.count,
        services: query.get<{ count: number }>("SELECT count(*) AS count FROM services")?.count,
        credentials: query.get<{ count: number }>(
          "SELECT count(*) AS count FROM service_credentials",
        )?.count,
      })),
    })).resolves.toEqual({ users: 1_000, services: 500, credentials: 5_000 });
    expect(elapsed).toBeLessThan(1_000);
  }, 30_000);

  it("evaluates and explains the exact 20,000-rule policy ceiling", () => {
    const rules: PolicyRuleSnapshot[] = Array.from(
      { length: 20_000 },
      (_, index) => ({
        id: `rule-${index.toString().padStart(5, "0")}`,
        effect: index === 19_999 ? "allow" : "deny",
        priority: index,
        enabled: true,
        methods: ["GET"],
        hosts: [{ type: "exact", value: "api.example.org" }],
        paths: [{ type: "exact", value: `/v1/item/${index}` }],
        selector: { kind: "all" },
      }),
    );
    const input = {
      subjectId: uuid(1),
      groupIds: [],
      method: "GET",
      host: "api.example.org",
      pathname: "/v1/item/19999",
      service: {
        id: uuid(2),
        kind: "service" as const,
        mode: "deny" as const,
        assignmentAllowed: true,
        rules,
      },
      credentials: [],
    };
    evaluatePolicySnapshot(input);
    const started = performance.now();
    const result = evaluatePolicySnapshot(input);
    const elapsed = performance.now() - started;
    expect(result.allowed).toBe(true);
    expect(result.boundaries[0]?.rules).toHaveLength(20_000);
    expect(result.boundaries[0]?.decisiveRuleId).toBe("rule-19999");
    expect(elapsed).toBeLessThan(1_000);
  }, 10_000);

  it("looks up and batch-cleans 10,000 OAuth grant/token records", async () => {
    const worker = open("oauth");
    const actorId = uuid(1);
    const clientId = uuid(2);
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const email = "oauth-scale@example.org";
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at, updated_at
          ) VALUES (?, ?, ?, 'OAuth', 'Scale', 'user', 'active', 1, 1, 1, ?, ?)
        `, [actorId, email, email, NOW, NOW]);
        transaction.run(`
          INSERT INTO oauth_clients (
            id, client_identifier, display_name, metadata_json, metadata_digest,
            lifecycle, first_seen_at, last_seen_at, version
          ) VALUES (?, 'release-scale-client', 'Release scale client', '{}', ?,
            'active', ?, ?, 1)
        `, [clientId, "b".repeat(64), NOW, NOW]);
        for (let index = 0; index < 5_000; index += 1) {
          const grantId = uuid(20_000 + index);
          transaction.run(`
            INSERT INTO oauth_grants (
              id, user_id, client_id, resource, scopes_json,
              authentication_method, issued_security_epoch, issued_global_epoch,
              issued_access_ttl_ms, issued_refresh_idle_ms,
              issued_refresh_absolute_ms, status, issued_at, last_used_at,
              absolute_expires_at, idle_expires_at, revoked_at,
              revocation_reason, version
            ) VALUES (?, ?, ?, 'https://mcp.example.org', '["gateway.read"]',
              'local_password_totp', 1, 1, 60000, 86400000, 604800000,
              'active', ?, ?, ?, ?, NULL, NULL, 1)
          `, [grantId, actorId, clientId, NOW - 1, NOW - 1, NOW + 604800000, NOW + 86400000]);
          transaction.run(`
            INSERT INTO oauth_access_tokens (
              id, token_hash, grant_id, family_id, scopes_json, issued_at,
              expires_at, last_used_at, status
            ) VALUES (?, ?, ?, NULL, '["gateway.read"]', ?, ?, ?, 'revoked')
          `, [
            uuid(30_000 + index),
            index.toString(16).padStart(64, "0"),
            grantId,
            NOW - 1,
            NOW + 60_000,
            NOW - 1,
          ]);
        }
      }),
    });
    const hasher = new DatabaseOAuthTokenHasher(Buffer.alloc(32, 7));
    const repository = new DatabaseOAuthRepository(worker, hasher, {
      accessTokenTtlMs: 60_000,
      authorizationCodeTtlMs: 60_000,
      refreshTokenIdleTtlMs: 86_400_000,
      refreshTokenMaxTtlMs: 604_800_000,
      maxAuthorizationCodes: 10_000,
      maxTokenRecords: 10_000,
    }, { now: () => NOW });
    const started = performance.now();
    const removed = await repository.sweepExpired(1_000);
    const elapsed = performance.now() - started;
    expect(removed).toBe(1_000);
    expect(elapsed).toBeLessThan(1_000);
    await expect(repository.sweepExpired(1_001)).rejects.toMatchObject({
      code: "unavailable",
    });
    hasher.close();
  }, 30_000);
});

function open(label: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `release-scale-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function uuid(value: number): string {
  return `018f1f2e-7b3c-7a10-8000-${value.toString(16).padStart(12, "0")}`;
}

function superadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    role: "superadmin",
    principalId: uuid(1),
    csrfValidated: true,
  };
}

function admin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    role: "admin",
    principalId: uuid(2),
    csrfValidated: true,
  };
}
