import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActivityAggregationService,
} from "../src/activityAggregation.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import { PersistenceError } from "../src/persistence/errors.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const ACTOR_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("activity aggregation maintenance", () => {
  it("rebuilds a missing projection once and advances durably across runs", async () => {
    const file = databasePath();
    const { worker, service } = open(file);
    await appendServiceRequest(
      worker,
      "018f1f2e-7b3c-7a10-8000-000000000004",
      NOW - HOUR,
    );
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run("DELETE FROM activity_hourly_subjects");
        transaction.run("DELETE FROM activity_hourly");
        transaction.run("DELETE FROM activity_projected_events");
      }),
    });

    const rebuilt = await service.run();
    expect(rebuilt).toMatchObject({
      cursorSequence: 1,
      lastOutcome: "completed",
      lastCode: "ok",
      projectedCount: 1,
    });
    expect(await activityCount(worker)).toBe(1);

    await worker.close();
    workers.delete(worker);
    const restarted = open(file);
    const replay = await restarted.service.run();
    expect(replay).toMatchObject({
      cursorSequence: 1,
      lastOutcome: "completed",
      projectedCount: 0,
    });
    expect(await activityCount(restarted.worker)).toBe(1);
  });

  it("skips an overlapping lease without projecting or exposing its owner", async () => {
    const { worker, service } = open();
    await appendServiceRequest(
      worker,
      "018f1f2e-7b3c-7a10-8000-000000000004",
      NOW - HOUR,
    );
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run("DELETE FROM activity_hourly_subjects");
        transaction.run("DELETE FROM activity_hourly");
        transaction.run("DELETE FROM activity_projected_events");
        transaction.run(`
          UPDATE activity_projection_state
          SET lease_owner = 'private-worker-id', lease_expires_at = ?
          WHERE singleton = 1
        `, [NOW + 1]);
      }),
    });

    const state = await service.run();
    expect(state.cursorSequence).toBe(0);
    expect(state.leaseExpiresAt).toBe(NOW + 1);
    expect(state).toMatchObject({
      lastOutcome: "skipped",
      lastCode: "lease_active",
    });
    expect(JSON.stringify(state)).not.toContain("private-worker-id");
    expect(await activityCount(worker)).toBe(0);
  });

  it("retains the exact 400-day boundary bucket and removes older buckets", async () => {
    const { worker, service } = open();
    const cutoff = NOW - 400 * DAY;
    await appendServiceRequest(
      worker,
      "018f1f2e-7b3c-7a10-8000-000000000004",
      cutoff - 1,
    );
    await appendServiceRequest(
      worker,
      "018f1f2e-7b3c-7a10-8000-000000000005",
      cutoff,
    );

    const state = await service.run();
    expect(state.deletedBucketCount).toBe(1);
    const buckets = await worker.execute({
      run: (database) => database.read((query) =>
        query.all<{ bucket_start: number; request_count: number }>(`
          SELECT bucket_start, request_count
          FROM activity_hourly ORDER BY bucket_start
        `)),
    });
    expect(buckets).toEqual([{
      bucket_start: cutoff,
      request_count: 1,
    }]);
  });

  it("bounds rebuild work to 1,000 source events and resumes the cursor", async () => {
    const { worker, service } = open();
    const generator = new UuidV7Generator({
      now: () => NOW,
      random: () => new Uint8Array(10),
    });
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        for (let index = 0; index < 1_001; index += 1) {
          transaction.run(`
            INSERT INTO runtime_audit_events (
              event_id, occurred_at, event_type, outcome, category, actor_type,
              subject_id_snapshot, subject_label_snapshot, service_id_snapshot,
              service_label_snapshot, destination, action, method, source_json,
              details_json, credential_use_count
            ) VALUES (?, ?, 'service_request', 'allow', 'authorization',
              'oauth_user', ?, 'Ada User', ?, 'Payments Gateway', 'primary',
              'service_request', 'GET', '{}', '{}', 1)
          `, [generator.next(), NOW - HOUR, ACTOR_ID, SERVICE_ID]);
        }
      }),
    });

    const first = await service.run();
    expect(first).toMatchObject({
      cursorSequence: 1_000,
      lastOutcome: "partial",
      lastCode: "batch_limit",
      projectedCount: 1_000,
    });
    const second = await service.run();
    expect(second).toMatchObject({
      cursorSequence: 1_001,
      lastOutcome: "completed",
      lastCode: "ok",
      projectedCount: 1,
    });
    expect(await activityCount(worker)).toBe(1_001);
  });

  it("requires a superadmin proof and audits a manual rebuild atomically", async () => {
    const { worker } = open();
    const stepUps = {
      withConsumedProofGenerated: async <T>(
        _proof: AlwaysStepUpHandle,
        mutation: unknown,
      ): Promise<T> => worker.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          mutation as never,
        ) as T,
      }),
    };
    const service = new ActivityAggregationService(
      worker,
      () => NOW,
      () => "activity-worker",
      stepUps as never,
    );
    const actor = superadmin();
    const state = await service.run({
      actor,
      justification: "Repair delayed activity aggregates.",
      correlationId: "req_12345678-1234-4234-8234-123456789abc",
      proof: new AlwaysStepUpHandle(
        "018f1f2e-7b3c-7a10-8000-000000000090",
        "018f1f2e-7b3c-7a10-8000-000000000091",
        actor.principalId,
      ),
    });
    expect(state.lastOutcome).toBe("completed");
    const audit = await worker.execute({
      run: (database) => database.read((query) => query.get<{
        action: string;
        justification: string;
      }>(`
        SELECT action, justification FROM administrative_audit_events
        WHERE action = 'activity.projection.run'
      `)),
    });
    expect(audit).toEqual({
      action: "activity.projection.run",
      justification: "Repair delayed activity aggregates.",
    });
    await expect(service.run({
      actor: { ...actor, role: "admin" },
      justification: "Unauthorized.",
      correlationId: "req_22345678-1234-4234-8234-123456789abc",
      proof: new AlwaysStepUpHandle(
        "018f1f2e-7b3c-7a10-8000-000000000092",
        "018f1f2e-7b3c-7a10-8000-000000000093",
        actor.principalId,
      ),
    })).rejects.toEqual(new PersistenceError("authentication_failed"));
  });
});

function open(databaseFile = databasePath()) {
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return {
    worker,
    service: new ActivityAggregationService(
      worker,
      () => NOW,
      () => "activity-worker",
    ),
  };
}

function databasePath(): string {
  return join(
    mkdtempSync(join(tmpdir(), "activity-aggregation-")),
    "control.sqlite",
  );
}

async function appendServiceRequest(
  worker: PersistenceWorker,
  eventId: string,
  occurredAt: number,
): Promise<void> {
  await worker.execute({
    run: (database) => database.appendRuntimeAudit({
      eventId,
      occurredAt,
      eventType: "service_request",
      outcome: "allow",
      category: "authorization",
      actorType: "oauth_user",
      subjectId: ACTOR_ID,
      subjectLabel: "Ada User",
      serviceId: SERVICE_ID,
      serviceLabel: "Payments Gateway",
      destination: "primary",
      action: "service_request",
      method: "GET",
      source: {},
      details: {},
    }),
  });
}

async function activityCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ count: number }>(
        "SELECT sum(request_count) AS count FROM activity_hourly",
      )?.count ?? 0),
  });
}

function superadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: ACTOR_ID,
    role: "superadmin",
  };
}
