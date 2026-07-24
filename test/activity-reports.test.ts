import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityAggregationService } from "../src/activityAggregation.js";
import {
  ActivityReportError,
  ActivityReportService,
} from "../src/activityReports.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const ADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const USER_ONE = "018f1f2e-7b3c-7a10-8000-000000000003";
const USER_TWO = "018f1f2e-7b3c-7a10-8000-000000000004";
const SERVICE_ONE = "018f1f2e-7b3c-7a10-8000-000000000010";
const SERVICE_TWO = "018f1f2e-7b3c-7a10-8000-000000000011";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("scope-first activity reports", () => {
  it("returns fixed zero-filled trends, deterministic ranks, and safe totals", async () => {
    const fixture = await seeded();
    await new ActivityAggregationService(
      fixture.worker,
      () => NOW,
      () => "activity-worker",
    ).run();

    const report = await fixture.reports.report(superadmin(), {
      window: "24h",
      limit: 100,
    });
    expect(report.totals).toEqual({
      requests: 3,
      allow: 2,
      deny: 1,
      error: 0,
      credentialUses: 3,
      tokenizations: 6,
      apiKeyActivity: 1,
      activeUsers: { value: 2, suppressed: false, threshold: 3 },
    });
    expect(report.trend).toHaveLength(24);
    expect(report.trend.reduce((sum, row) => sum + row.requests, 0)).toBe(3);
    expect(report.services.map((row) => [row.serviceName, row.requests]))
      .toEqual([["Alpha Service", 2], ["Beta Service", 1]]);
    expect(report.endpoints).toEqual([
      {
        serviceId: SERVICE_ONE,
        serviceName: "Alpha Service",
        category: "widgets.read",
        requests: 2,
      },
    ]);
    expect(report.freshness).toMatchObject({
      cursorSequence: 3,
      sourceSequence: 3,
      partial: false,
    });
    expect(JSON.stringify(report)).not.toContain("/private");
    expect(JSON.stringify(report)).not.toContain("api.example.org");
  });

  it("filters assigned services before totals and suppresses tiny user counts", async () => {
    const fixture = await seeded();
    const report = await fixture.reports.report(admin(), { window: "7d" });
    expect(report.totals).toMatchObject({
      requests: 2,
      credentialUses: 2,
      apiKeyActivity: 1,
      activeUsers: { value: null, suppressed: true, threshold: 3 },
    });
    expect(report.services).toEqual([expect.objectContaining({
      serviceId: SERVICE_ONE,
      serviceName: "Alpha Service",
      requests: 2,
      activeUsers: { value: null, suppressed: true, threshold: 3 },
    })]);
    expect(report.trend).toHaveLength(168);
    expect(JSON.stringify(report)).not.toContain(SERVICE_TWO);
    expect(JSON.stringify(report)).not.toContain("Beta Service");

    const crossScope = await fixture.reports.report(admin(), {
      serviceId: SERVICE_TWO,
    });
    expect(crossScope.totals.requests).toBe(0);
    expect(crossScope.services).toEqual([]);
    expect(crossScope.endpoints).toEqual([]);
  });

  it("rejects non-human roles and every malformed or expensive filter", async () => {
    const fixture = await seeded();
    for (const actor of [
      { ...admin(), role: "user" as const },
      { ...admin(), method: "api_key" as const, role: "service" as const },
    ]) {
      await expect(fixture.reports.report(actor))
        .rejects.toEqual(new ActivityReportError("forbidden"));
    }
    for (const input of [
      { window: "1y" as "24h" },
      { limit: 0 },
      { limit: 101 },
      { serviceId: "not-a-uuid" },
    ]) {
      await expect(fixture.reports.report(superadmin(), input))
        .rejects.toEqual(new ActivityReportError("invalid"));
    }
  });

  it("keeps fixed broad windows bounded at a 10,000-event aggregate fixture", async () => {
    const fixture = await seeded();
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE activity_hourly
          SET request_count = 10000, credential_use_count = 10000,
              tokenization_count = 20000
          WHERE service_id = ?
        `, [SERVICE_ONE]);
      }),
    });
    const started = performance.now();
    const month = await fixture.reports.report(superadmin(), {
      window: "30d",
      limit: 1,
    });
    const elapsed = performance.now() - started;
    expect(month.trend).toHaveLength(30);
    expect(month.services).toHaveLength(1);
    expect(month.totals.requests).toBeGreaterThanOrEqual(10_000);
    expect(elapsed).toBeLessThan(1_000);

    const quarter = await fixture.reports.report(superadmin(), {
      window: "90d",
      limit: 100,
    });
    expect(quarter.trend).toHaveLength(90);
  });
});

async function seeded() {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "activity-reports-")),
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
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000020',
          'AAAAAAAAAAAAAAAA', ?, 'Report key', 'AAAA', 'service',
          ?, 'forever', NULL, 'active', ?, 1, ?, ?
        )
      `, [`$argon2id$${"x".repeat(64)}`, SERVICE_ONE, SUPERADMIN_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO api_key_activity (
          id, api_key_id, nickname_snapshot, last_four_snapshot,
          api_role_snapshot, service_id_snapshot, action, outcome, target_type,
          target_id, request_id, source_digest, failure_code, occurred_at
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000021',
          '018f1f2e-7b3c-7a10-8000-000000000020',
          'Report key', 'AAAA', 'service', ?, 'services.read', 'allow',
          'service', ?, 'request-one', NULL, NULL, ?
        )
      `, [SERVICE_ONE, SERVICE_ONE, NOW - HOUR]);
    }),
  });
  await append(worker, {
    eventId: "018f1f2e-7b3c-7a10-8000-000000000030",
    subjectId: USER_ONE,
    serviceId: SERVICE_ONE,
    serviceLabel: "Historical Alpha",
    outcome: "allow",
    policyRule: "widgets.read",
    status: 200,
  });
  await append(worker, {
    eventId: "018f1f2e-7b3c-7a10-8000-000000000031",
    subjectId: USER_TWO,
    serviceId: SERVICE_ONE,
    serviceLabel: "Historical Alpha",
    outcome: "allow",
    policyRule: "widgets.read",
    status: 204,
  });
  await append(worker, {
    eventId: "018f1f2e-7b3c-7a10-8000-000000000032",
    subjectId: USER_ONE,
    serviceId: SERVICE_TWO,
    serviceLabel: "Historical Beta",
    outcome: "deny",
  });
  return {
    worker,
    reports: new ActivityReportService(worker, () => NOW),
  };
}

async function append(
  worker: PersistenceWorker,
  input: {
    eventId: string;
    subjectId: string;
    serviceId: string;
    serviceLabel: string;
    outcome: "allow" | "deny";
    policyRule?: string;
    status?: number;
  },
): Promise<void> {
  await worker.execute({
    run: (database) => database.appendRuntimeAudit({
      eventId: input.eventId,
      occurredAt: NOW - HOUR,
      eventType: "service_request",
      outcome: input.outcome,
      category: "authorization",
      actorType: "oauth_user",
      subjectId: input.subjectId,
      subjectLabel: "Private User",
      serviceId: input.serviceId,
      serviceLabel: input.serviceLabel,
      destination: "primary",
      action: "service_request",
      method: "GET",
      targetHost: "api.example.org",
      targetPath: "/private/customer",
      ...(input.status === undefined ? {} : { downstreamStatus: input.status }),
      ...(input.policyRule === undefined ? {} : { policyRule: input.policyRule }),
      credentialUseCount: 1,
      tokenizationCount: 2,
      source: {},
      details: {},
    }),
  });
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
