import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuditRetentionError,
  AuditRetentionService,
} from "../src/auditRetention.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const ACTOR_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const EVENT_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("audit retention and maintenance", () => {
  it("reports defaults and validates superadmin-only bounded updates", async () => {
    const fixture = open();
    const initial = await fixture.service.overview(superadmin());
    expect(initial.settings).toMatchObject({
      administrativeDays: 400,
      runtimeDays: 400,
      version: 1,
    });
    expect(initial.administrative.warnings).toEqual([]);

    const updated = await fixture.service.update({
      actor: superadmin(),
      expectedVersion: 1,
      administrativeDays: null,
      runtimeDays: 401,
      justification: "Capacity plan approved",
      correlationId: CORRELATION,
    });
    expect(updated.settings.version).toBe(2);
    expect(updated.administrative.warnings).toContain(
      "unlimited_retention_requires_capacity_planning",
    );
    expect(updated.runtime.warnings).toContain("retention_above_default");

    await expect(fixture.service.update({
      actor: superadmin(),
      expectedVersion: 1,
      administrativeDays: 400,
      runtimeDays: 400,
      justification: "Stale",
      correlationId: CORRELATION,
    })).rejects.toEqual(new AuditRetentionError("stale"));
    await expect(fixture.service.overview(user()))
      .rejects.toEqual(new AuditRetentionError("forbidden"));
  });

  it("deletes exact-cutoff rows with their FTS entries and repairs missing indexes", async () => {
    let clock = NOW - 400 * DAY;
    const fixture = open(() => clock);
    await appendAdministrative(fixture.worker);
    await fixture.worker.execute({
      run: (database) => database.appendRuntimeAudit({
        eventId: EVENT_ID,
        occurredAt: clock,
        eventType: "service_request",
        outcome: "allow",
        category: "authorization",
        actorType: "oauth_user",
        subjectId: ACTOR_ID,
        subjectLabel: "Ada User",
        action: "service_request",
        correlationId: CORRELATION,
        source: { category: "mcp" },
        details: {},
      }),
    });
    clock = NOW;
    const result = await fixture.service.run();
    expect(result.maintenance).toMatchObject({
      lastOutcome: "completed",
      retainedAdministrativeCount: 1,
      retainedRuntimeCount: 1,
      repairedIndexCount: 0,
    });
    const counts = await fixture.worker.execute({
      run: (database) => database.read((query) => ({
        runtime: query.get<{ count: number }>(
          "SELECT count(*) AS count FROM runtime_audit_events",
        )!.count,
        runtimeIndex: query.get<{ count: number }>(
          "SELECT count(*) AS count FROM runtime_audit_fts",
        )!.count,
      })),
    });
    expect(counts).toEqual({ runtime: 0, runtimeIndex: 0 });

    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM administrative_audit_fts WHERE rowid = (SELECT max(sequence) FROM administrative_audit_events)",
        );
      }),
    });
    const repaired = await fixture.service.run();
    expect(repaired.maintenance.repairedIndexCount).toBe(1);
  });
});

function open(now: () => number = () => NOW) {
  const worker = PersistenceWorker.open({
    databaseFile: join(mkdtempSync(join(tmpdir(), "audit-retention-")), "control.sqlite"),
    productVersion: "test",
    now,
  });
  workers.add(worker);
  return {
    worker,
    service: new AuditRetentionService(worker, now, () =>
      "018f1f2e-7b3c-7a10-8000-000000000010"),
  };
}

async function appendAdministrative(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.appendAdministrativeAudit({
      actor: {
        type: "browser_session",
        id: ACTOR_ID,
        label: "Ada Admin",
        role: "superadmin",
        authenticationMethod: "password_totp",
      },
      category: "security",
      action: "security.password_change",
      result: "allow",
      target: { type: "user", id: TARGET_ID, label: "Deleted User" },
      changes: [{ field: "security_epoch", before: 1, after: 2 }],
      correlationId: CORRELATION,
      source: { category: "control" },
    }),
  });
}

function superadmin(): ControlAuthenticationContext {
  return { method: "browser_session", principalId: ACTOR_ID, role: "superadmin" };
}

function user(): ControlAuthenticationContext {
  return { method: "browser_session", principalId: ACTOR_ID, role: "user" };
}
