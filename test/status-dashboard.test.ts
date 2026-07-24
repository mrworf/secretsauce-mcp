import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  StatusDashboardError,
  StatusDashboardService,
} from "../src/statusDashboard.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const ADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SERVICE_ONE = "018f1f2e-7b3c-7a10-8000-000000000010";
const SERVICE_TWO = "018f1f2e-7b3c-7a10-8000-000000000011";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("role-scoped status dashboard", () => {
  it("returns only assigned service state to admins with sanitized references", async () => {
    const worker = await seeded();
    const references = vi.fn(async ({ serviceId }: { serviceId?: string }) => ({
      gref: { active: serviceId === SERVICE_ONE ? 2 : 9, expired: 1, invalid: 0 },
      sec: { active: 3, expired: 0, invalid: 0 },
    }));
    const status = new StatusDashboardService(worker, {
      now: () => NOW,
      referenceAggregates: { referenceAggregates: references },
    });
    const snapshot = await status.snapshot(admin());

    expect(snapshot.system).toBeUndefined();
    expect(snapshot.serviceCount).toBe(1);
    expect(snapshot.services).toEqual([expect.objectContaining({
      serviceId: SERVICE_ONE,
      name: "Alpha Service",
      lifecycle: "published",
      publicationGeneration: 1,
      credentials: {
        configured: 1,
        unconfigured: 1,
        disabled: 1,
        archived: 1,
      },
      references: {
        state: "available",
        gref: { active: 2, expiring: 0, expired: 1 },
        sec: { active: 3, expiring: 0, expired: 0 },
      },
      apiKeys: { active: 1, expiring: 0, expired: 0 },
      pendingRemediationCount: 1,
    })]);
    expect(references).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(snapshot)).not.toContain(SERVICE_TWO);
    expect(JSON.stringify(snapshot)).not.toContain("vault_locator");
  });

  it("adds stable superadmin component, job, capacity, key, and user categories", async () => {
    const worker = await seeded();
    const status = new StatusDashboardService(worker, {
      now: () => NOW,
      vaultReadiness: async () => "ready",
      identityReadiness: async () => {
        throw new Error("raw-secret /private/identity.key");
      },
      referenceAggregates: {
        referenceAggregates: async () => ({
          gref: { active: 0, expired: 0, invalid: 0 },
          sec: { active: 0, expired: 0, invalid: 0 },
        }),
      },
    });
    const snapshot = await status.snapshot(superadmin());
    expect(snapshot.serviceCount).toBe(2);
    expect(snapshot.system).toMatchObject({
      components: {
        database: "ready",
        schema: "ready",
        vault: "ready",
        audit: "ready",
        identity: "unavailable",
      },
      jobs: {
        audit: { state: "ready" },
        activity: { state: "ready" },
        inactivity: { state: "unavailable" },
      },
      apiKeys: {
        active: 1,
        expiring: 1,
        expired: 1,
        nonExpiring: 1,
      },
      users: {
        suspended: 0,
        deactivated: 0,
        pendingEnrollment: 0,
        activeWithoutServices: 0,
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain("raw-secret");
    expect(JSON.stringify(snapshot)).not.toContain("/private");
  });

  it("reports absent or invalid adapters as unavailable and denies other roles", async () => {
    const worker = await seeded();
    const status = new StatusDashboardService(worker, {
      now: () => NOW,
      vaultReadiness: async () => "broken" as "ready",
      referenceAggregates: {
        referenceAggregates: async () => ({
          gref: { active: -1, expired: 0, invalid: 0 },
          sec: { active: 0, expired: 0, invalid: 0 },
        }),
      },
    });
    const snapshot = await status.snapshot(superadmin());
    expect(snapshot.system?.components).toMatchObject({
      vault: "unavailable",
      identity: "unavailable",
    });
    expect(snapshot.services[0]?.references.state).toBe("unavailable");

    await expect(status.snapshot({ ...admin(), role: "user" }))
      .rejects.toEqual(new StatusDashboardError("forbidden"));
    await expect(status.snapshot({
      ...admin(),
      method: "api_key",
      role: "service",
    })).rejects.toEqual(new StatusDashboardError("forbidden"));
  });
});

async function seeded(): Promise<PersistenceWorker> {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "status-dashboard-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
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
      for (const [id, slug, name] of [
        [SERVICE_ONE, "alpha", "Alpha Service"],
        [SERVICE_TWO, "beta", "Beta Service"],
      ] as const) {
        transaction.run(`
          INSERT INTO services (
            id, slug, name, lifecycle, draft_digest, publication_generation,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, 'published', ?, 1, 1, ?, ?)
        `, [id, slug, name, "a".repeat(64), NOW, NOW]);
      }
      transaction.run(`
        INSERT INTO service_admins (
          service_id, user_id, assigned_by_user_id, created_at
        ) VALUES (?, ?, ?, ?)
      `, [SERVICE_ONE, ADMIN_ID, SUPERADMIN_ID, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, usage_kind, usage_name,
          status, vault_state, authorization_generation, version, created_at,
          updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000020', ?, 'Unset', 'unset',
          'header', 'X-Key', 'unconfigured', 'idle', 0, 1, ?, ?
        )
      `, [SERVICE_ONE, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, usage_kind, usage_name,
          status, vault_state, vault_locator, vault_generation, last_four,
          value_updated_at, authorization_generation, version, created_at,
          updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000021', ?, 'Ready', 'ready',
          'header', 'X-Ready', 'configured', 'idle',
          '018f1f2e-7b3c-4a10-8000-000000000021', 1, 'last', ?,
          1, 1, ?, ?
        )
      `, [SERVICE_ONE, NOW, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, usage_kind, usage_name,
          status, vault_state, vault_locator, vault_generation, last_four,
          value_updated_at, authorization_generation, version, created_at,
          updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000022', ?, 'Paused', 'paused',
          'header', 'X-Paused', 'disabled', 'idle',
          '018f1f2e-7b3c-4a10-8000-000000000022', 1, 'last', ?,
          1, 1, ?, ?
        )
      `, [SERVICE_ONE, NOW, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, usage_kind, usage_name,
          status, vault_state, authorization_generation, version, created_at,
          updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000023', ?, 'Old', 'old',
          'header', 'X-Old', 'archived', 'idle', 0, 1, ?, ?
        )
      `, [SERVICE_ONE, NOW, NOW]);
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000030',
          'AAAAAAAAAAAAAAAA', ?, 'Status key', 'AAAA', 'service', ?,
          'forever', NULL, 'active', ?, 1, ?, ?
        )
      `, [`$argon2id$${"x".repeat(64)}`, SERVICE_ONE, SUPERADMIN_ID, NOW, NOW]);
      for (const [id, identifier, status, expiresAt] of [
        [
          "018f1f2e-7b3c-7a10-8000-000000000031",
          "BBBBBBBBBBBBBBBB",
          "active",
          NOW + 86_400_000,
        ],
        [
          "018f1f2e-7b3c-7a10-8000-000000000032",
          "CCCCCCCCCCCCCCCC",
          "expired",
          NOW,
        ],
      ] as const) {
        transaction.run(`
          INSERT INTO api_keys (
            id, identifier, verifier_hash, nickname, last_four, api_role,
            service_id, expiration_policy, expires_at, status, creator_id,
            version, created_at, updated_at
          ) VALUES (
            ?, ?, ?, 'Timed key', 'BBBB', 'service', ?,
            'timestamp', ?, ?, ?, 1, ?, ?
          )
        `, [
          id,
          identifier,
          `$argon2id$${"y".repeat(64)}`,
          SERVICE_TWO,
          expiresAt,
          status,
          SUPERADMIN_ID,
          NOW,
          NOW,
        ]);
      }
      transaction.run(`
        INSERT INTO dashboard_remediations (
          id, finding_key_hash, code, category, severity, service_id,
          generation, state, first_seen_at, last_seen_at, version,
          created_at, updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000040', ?, 'credential.missing',
          'credential', 'warning', ?, 1, 'open', ?, ?, 1, ?, ?
        )
      `, ["b".repeat(64), SERVICE_ONE, NOW, NOW, NOW, NOW]);
    }),
  });
  return worker;
}

function superadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: SUPERADMIN_ID,
    role: "superadmin",
  };
}

function admin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: ADMIN_ID,
    role: "admin",
  };
}
