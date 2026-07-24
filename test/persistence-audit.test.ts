import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sanitizeAuditText } from "../src/auditSanitizer.js";
import type { AdministrativeAuditEventInput } from "../src/persistence/administrativeAudit.js";
import { PersistenceError } from "../src/persistence/errors.js";
import {
  PERSISTENCE_MIGRATIONS,
  type PersistenceMigration,
} from "../src/persistence/migrations.js";
import { UuidV7Generator, isUuidV7 } from "../src/persistence/uuidV7.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const ACTOR_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const CORRELATION_ID = "req_8ca2d86c-541c-4484-bcc0-feebb54f6311";

const fixtureMigration: PersistenceMigration = {
  version: 24,
  name: "test_repository_fixtures",
  sql: `
    CREATE TABLE test_parent (
      id TEXT PRIMARY KEY
    ) STRICT;
    CREATE TABLE test_child (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES test_parent(id)
    ) STRICT;
    CREATE TABLE test_versioned_record (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL CHECK (version > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
  `,
};

describe("transactional administrative audit", () => {
  it("indexes sanitized administrative fields in the same transaction without indexing time", async () => {
    const worker = open(databasePath("administrative-fts"));
    try {
      const event = await worker.execute({
        run: (database) => database.appendAdministrativeAudit(auditEvent({
          category: "security",
          serviceLabel: "Payments Gateway",
          justification: "Quarterly access review",
        })),
      });
      const matches = await worker.execute({
        run: (database) => database.read((query) => ({
          label: query.all(`
            SELECT events.event_id
            FROM administrative_audit_fts AS search
            JOIN administrative_audit_events AS events ON events.sequence = search.rowid
            WHERE administrative_audit_fts MATCH ?
          `, ['"payments" AND "quarterly"']),
          timestamp: query.all(`
            SELECT events.event_id
            FROM administrative_audit_fts AS search
            JOIN administrative_audit_events AS events ON events.sequence = search.rowid
            WHERE administrative_audit_fts MATCH ?
          `, ['"1785000000000"']),
        })),
      });
      expect(matches.label).toEqual([{ event_id: event.eventId }]);
      expect(matches.timestamp).toEqual([]);
    } finally {
      await worker.close();
    }
  });

  it("persists a strict runtime projection and its FTS document atomically", async () => {
    const worker = open(databasePath("runtime-fts"));
    const runtimeId = "018f1f2e-7b3c-7a10-8000-000000000004";
    try {
      await expect(worker.execute({
        run: (database) => database.appendRuntimeAudit({
          eventId: runtimeId,
          occurredAt: 1_785_000_000_000,
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
          method: "POST",
          targetHost: "api.example.org",
          targetPath: "/v1/widgets",
          correlationId: CORRELATION_ID,
          source: { category: "mcp", client: "ChatGPT" },
          details: { policy_decision: "allow" },
        }),
      })).resolves.toMatchObject({ eventId: runtimeId });

      const state = await worker.execute({
        run: (database) => database.read((query) => ({
          events: query.all("SELECT event_id FROM runtime_audit_events"),
          matches: query.all(`
            SELECT events.event_id
            FROM runtime_audit_fts AS search
            JOIN runtime_audit_events AS events ON events.sequence = search.rowid
            WHERE runtime_audit_fts MATCH ?
          `, ['"payments" AND "widgets"']),
        })),
      });
      expect(state).toEqual({
        events: [{ event_id: runtimeId }],
        matches: [{ event_id: runtimeId }],
      });
    } finally {
      await worker.close();
    }
  });

  it("projects bounded service activity counters without raw request dimensions", async () => {
    const worker = open(databasePath("runtime-activity"));
    const base = {
      occurredAt: 1_785_000_000_000,
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
      method: "POST",
      targetHost: "api.example.org",
      targetPath: "/private/customer/42",
      downstreamStatus: 201,
      policyRule: "widgets.write",
      source: { category: "mcp" },
      details: { policy_decision: "allow" },
    } as const;
    try {
      await worker.execute({
        run: (database) => database.appendRuntimeAudit({
          ...base,
          eventId: "018f1f2e-7b3c-7a10-8000-000000000004",
          credentialUseCount: 2,
          tokenizationCount: 3,
          durationMs: 20,
        }),
      });
      await worker.execute({
        run: (database) => database.appendRuntimeAudit({
          ...base,
          eventId: "018f1f2e-7b3c-7a10-8000-000000000005",
          occurredAt: base.occurredAt + 1_000,
          credentialUseCount: 1,
          tokenizationCount: 4,
          durationMs: 30,
        }),
      });

      const state = await worker.execute({
        run: (database) => database.read((query) => ({
          activity: query.all(`
            SELECT
              service_id, service_label_snapshot, destination, method,
              endpoint_category_kind, endpoint_category, decision, status_class,
              request_count, credential_use_count, tokenization_count,
              duration_sum_ms, duration_count
            FROM activity_hourly
          `),
          subjects: query.get(
            "SELECT count(*) AS count FROM activity_hourly_subjects",
          ),
          projected: query.get(
            "SELECT count(*) AS count FROM activity_projected_events",
          ),
          columns: query.all("PRAGMA table_info(activity_hourly)"),
        })),
      });
      expect(state.activity).toEqual([{
        service_id: SERVICE_ID,
        service_label_snapshot: "Payments Gateway",
        destination: "primary",
        method: "POST",
        endpoint_category_kind: "policy_rule",
        endpoint_category: "widgets.write",
        decision: "allow",
        status_class: "2xx",
        request_count: 2,
        credential_use_count: 3,
        tokenization_count: 7,
        duration_sum_ms: 50,
        duration_count: 2,
      }]);
      expect(state.subjects).toEqual({ count: 1 });
      expect(state.projected).toEqual({ count: 2 });
      expect(state.columns.map((column) => (column as { name: string }).name))
        .not.toEqual(expect.arrayContaining(["target_host", "target_path", "correlation_id"]));
      expect(JSON.stringify(state.activity)).not.toContain("/private/customer/42");
    } finally {
      await worker.close();
    }
  });

  it("classifies default-boundary denials and rejects unbounded counters", async () => {
    const worker = open(databasePath("runtime-activity-boundary"));
    const base = {
      occurredAt: 1_785_000_000_000,
      eventType: "service_request",
      outcome: "deny",
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
    } as const;
    try {
      await worker.execute({
        run: (database) => database.appendRuntimeAudit({
          ...base,
          eventId: "018f1f2e-7b3c-7a10-8000-000000000004",
        }),
      });
      await expect(worker.execute({
        run: (database) => database.appendRuntimeAudit({
          ...base,
          eventId: "018f1f2e-7b3c-7a10-8000-000000000005",
          credentialUseCount: 100_001,
        }),
      })).rejects.toMatchObject({ code: "invalid_audit_event" });

      const state = await worker.execute({
        run: (database) => database.read((query) => ({
          activity: query.get(`
            SELECT endpoint_category_kind, endpoint_category, decision,
              status_class, request_count
            FROM activity_hourly
          `),
          events: query.get("SELECT count(*) AS count FROM runtime_audit_events"),
        })),
      });
      expect(state).toEqual({
        activity: {
          endpoint_category_kind: "boundary_default",
          endpoint_category: "boundary_default_deny",
          decision: "deny",
          status_class: "none",
          request_count: 1,
        },
        events: { count: 1 },
      });
    } finally {
      await worker.close();
    }
  });

  it("rolls runtime event and search writes back when activity projection fails", async () => {
    const worker = open(databasePath("runtime-activity-rollback"));
    try {
      await worker.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          transaction.run("DROP TABLE activity_hourly");
        }),
      });
      await expect(worker.execute({
        run: (database) => database.appendRuntimeAudit({
          eventId: "018f1f2e-7b3c-7a10-8000-000000000004",
          occurredAt: 1_785_000_000_000,
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
          method: "POST",
          source: {},
          details: {},
        }),
      })).rejects.toMatchObject({ code: "audit_persistence_failed" });
      const state = await worker.execute({
        run: (database) => database.read((query) => ({
          events: query.get("SELECT count(*) AS count FROM runtime_audit_events"),
          index: query.get("SELECT count(*) AS count FROM runtime_audit_fts"),
          projected: query.get("SELECT count(*) AS count FROM activity_projected_events"),
        })),
      });
      expect(state).toEqual({
        events: { count: 0 },
        index: { count: 0 },
        projected: { count: 0 },
      });
    } finally {
      await worker.close();
    }
  });

  it("rejects secret-bearing runtime fields and values before event or index insertion", async () => {
    const worker = open(databasePath("runtime-rejection"));
    const base = {
      eventId: "018f1f2e-7b3c-7a10-8000-000000000004",
      occurredAt: 1_785_000_000_000,
      eventType: "service_request",
      outcome: "deny",
      category: "authorization",
      actorType: "oauth_user",
      subjectLabel: "Ada User",
      source: {},
      details: {},
    };
    try {
      const invalid = [
        { ...base, requestBody: "not stored" },
        { ...base, details: { authorization_header: "redacted" } },
        { ...base, reason: "Bearer abcdefghijklmnopqrstuvwxyz" },
        { ...base, reason: "gref_do-not-store" },
      ];
      for (const input of invalid) {
        await expect(worker.execute({
          run: (database) => database.appendRuntimeAudit(input),
        })).rejects.toMatchObject({ code: "invalid_audit_event" });
      }
      const counts = await worker.execute({
        run: (database) => database.read((query) => ({
          events: query.get("SELECT count(*) AS count FROM runtime_audit_events"),
          index: query.get("SELECT count(*) AS count FROM runtime_audit_fts"),
        })),
      });
      expect(counts).toEqual({ events: { count: 0 }, index: { count: 0 } });
    } finally {
      await worker.close();
    }
  });

  it("commits a repository mutation and sanitized denormalized audit atomically", async () => {
    const worker = open(databasePath("commit"));
    try {
      const result = await worker.execute({
        run: (database) => database.withAdministrativeAudit(
          auditEvent({
            justification: "Use raw-secret gref_forged and ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
            changes: [{ field: "display_name", before: "old", after: "raw-secret" }],
            source: { category: "control", client: "Basic dXNlcjpwYXNzd29yZA==" },
          }),
          (transaction) => {
            transaction.run(`
              INSERT INTO test_versioned_record (id, name, version, created_at, updated_at)
              VALUES (?, ?, 1, ?, ?)
            `, [TARGET_ID, "stored", 1_785_000_000_000, 1_785_000_000_000]);
            return "committed";
          },
        ),
      });

      expect(result).toBe("committed");
      const state = await worker.execute({
        run: (database) => database.read((query) => ({
          record: query.get("SELECT id, name, version FROM test_versioned_record WHERE id = ?", [TARGET_ID]),
          count: database.administrativeAuditCount(),
        })),
      });
      expect(state).toEqual({
        record: { id: TARGET_ID, name: "stored", version: 1 },
        count: 1,
      });

      const row = await worker.execute({
        run: (database) => database.read((query) =>
          query.get<Record<string, unknown>>("SELECT * FROM administrative_audit_events LIMIT 1")),
      });
      expect(row).toMatchObject({
        actor_type: "browser_session",
        actor_id_snapshot: ACTOR_ID,
        actor_label_snapshot: "Ada Admin",
        actor_role_snapshot: "admin",
        authentication_method: "password_totp",
        action: "fixture.create",
        result: "allow",
        target_id_snapshot: TARGET_ID,
        service_id_snapshot: SERVICE_ID,
        correlation_id: CORRELATION_ID,
      });
      expect(isUuidV7(String(row?.event_id))).toBe(true);
      const serialized = JSON.stringify(row);
      expect(serialized).toContain("[REDACTED]");
      expect(serialized).not.toContain("raw-secret");
      expect(serialized).not.toContain("gref_forged");
      expect(serialized).not.toContain("ghp_");
      expect(serialized).not.toContain("dXNlcjpwYXNzd29yZA");
    } finally {
      await worker.close();
    }
  });

  it("rejects a missing audit event before invoking or committing a mutation", async () => {
    const worker = open(databasePath("required"));
    const mutation = vi.fn((transaction: any) => {
      transaction.run(`
        INSERT INTO test_versioned_record (id, name, version, created_at, updated_at)
        VALUES (?, 'not-stored', 1, 1, 1)
      `, [TARGET_ID]);
    });
    try {
      await expect(worker.execute({
        run: (database) => database.withAdministrativeAudit(undefined, mutation),
      })).rejects.toMatchObject({ code: "administrative_audit_required" });
      expect(mutation).not.toHaveBeenCalled();
      await expect(recordCount(worker)).resolves.toBe(0);
      await expect(auditCount(worker)).resolves.toBe(0);
    } finally {
      await worker.close();
    }
  });

  it("rolls a mutation back and degrades readiness when audit insertion fails", async () => {
    const failureMigration: PersistenceMigration = {
      version: 25,
      name: "test_audit_failure",
      sql: `
        CREATE TRIGGER reject_test_audit
        BEFORE INSERT ON administrative_audit_events
        BEGIN
          SELECT RAISE(ABORT, 'raw-secret audit failure');
        END;
      `,
    };
    const file = databasePath("audit-failure");
    const worker = open(file, [...PERSISTENCE_MIGRATIONS, fixtureMigration, failureMigration]);
    try {
      await expect(worker.execute({
        run: (database) => database.withAdministrativeAudit(auditEvent(), (transaction) => {
          transaction.run(`
            INSERT INTO test_versioned_record (id, name, version, created_at, updated_at)
            VALUES (?, 'must-rollback', 1, 1, 1)
          `, [TARGET_ID]);
        }),
      })).rejects.toEqual(new PersistenceError("audit_persistence_failed"));
      await expect(recordCount(worker)).resolves.toBe(0);
      await expect(auditCount(worker)).resolves.toBe(0);
      expect(worker.readiness).toEqual({
        database: "ready",
        schema: "ready",
        administrativeAudit: "unavailable",
      });
    } finally {
      await worker.close();
    }
  });

  it("appends denied and failed sensitive actions without a product mutation", async () => {
    const worker = open(databasePath("denied"));
    try {
      const denied = await worker.execute({
        run: (database) => database.appendAdministrativeAudit(auditEvent({
          result: "deny",
          failureCode: "authorization_denied",
          changes: [],
        })),
      });
      const failed = await worker.execute({
        run: (database) => database.appendAdministrativeAudit(auditEvent({
          result: "error",
          failureCode: "validation_failed",
          changes: [],
        })),
      });
      expect(denied.result).toBe("deny");
      expect(failed.result).toBe("error");
      await expect(auditCount(worker)).resolves.toBe(2);
      await expect(recordCount(worker)).resolves.toBe(0);
    } finally {
      await worker.close();
    }
  });

  it("accepts bounded audit fields and rejects limit-plus-one or secret-bearing shapes", async () => {
    const worker = open(databasePath("bounds"));
    try {
      await expect(worker.execute({
        run: (database) => database.appendAdministrativeAudit(auditEvent({
          actor: {
            type: "browser_session",
            id: ACTOR_ID,
            label: "a".repeat(256),
            role: "admin",
            authenticationMethod: "password_totp",
          },
          target: { type: "fixture", id: TARGET_ID, label: "t".repeat(256) },
          justification: "j".repeat(1024),
          changes: Array.from({ length: 100 }, (_, index) => ({
            field: `field_${index}`,
            after: index,
          })),
          source: { category: "control", client: "c".repeat(256) },
        })),
      })).resolves.toMatchObject({ result: "allow" });

      const invalid: unknown[] = [
        auditEvent({ justification: "j".repeat(1025) }),
        auditEvent({ actor: { ...auditEvent().actor, label: "a".repeat(257) } }),
        auditEvent({ target: { ...auditEvent().target, label: "t".repeat(257) } }),
        auditEvent({ changes: Array.from({ length: 101 }, (_, index) => ({ field: `field_${index}`, after: index })) }),
        auditEvent({ changes: [{ field: "password_hash", after: "value" }] }),
        auditEvent({ result: "deny", changes: [] }),
        auditEvent({ failureCode: "unexpected_failure" }),
        { ...auditEvent(), password: "do-not-store" },
        { ...auditEvent(), source: { unexpected: "do-not-store" } },
      ];
      for (const input of invalid) {
        await expect(worker.execute({
          run: (database) => database.appendAdministrativeAudit(input),
        })).rejects.toMatchObject({ code: "invalid_audit_event" });
      }
      await expect(auditCount(worker)).resolves.toBe(1);
    } finally {
      await worker.close();
    }
  });

  it("enforces foreign keys and leaves no audit when the mutation fails", async () => {
    const worker = open(databasePath("foreign-key"));
    try {
      await expect(worker.execute({
        run: (database) => database.withAdministrativeAudit(auditEvent(), (transaction) => {
          transaction.run(
            "INSERT INTO test_child (id, parent_id) VALUES (?, ?)",
            [TARGET_ID, SERVICE_ID],
          );
        }),
      })).rejects.toMatchObject({ code: "database_unavailable" });
      const child = await worker.execute({
        run: (database) => database.read((query) =>
          query.get("SELECT id FROM test_child WHERE id = ?", [TARGET_ID])),
      });
      expect(child).toBeUndefined();
      await expect(auditCount(worker)).resolves.toBe(0);
    } finally {
      await worker.close();
    }
  });

  it("increments optimistic versions and reports stale expected versions", async () => {
    const worker = open(databasePath("optimistic"));
    try {
      await worker.execute({
        run: (database) => database.withAdministrativeAudit(auditEvent(), (transaction) => {
          transaction.run(`
            INSERT INTO test_versioned_record (id, name, version, created_at, updated_at)
            VALUES (?, 'initial', 1, 1, 1)
          `, [TARGET_ID]);
        }),
      });
      const updated = await worker.execute({
        run: (database) => database.withAdministrativeAudit(
          auditEvent({ action: "fixture.update" }),
          (transaction) => transaction.optimisticUpdate(
            "test_versioned_record",
            TARGET_ID,
            1,
            { name: "updated" },
          ),
        ),
      });
      const stale = await worker.execute({
        run: (database) => database.withAdministrativeAudit(
          auditEvent({ action: "fixture.stale_check", changes: [] }),
          (transaction) => transaction.optimisticUpdate(
            "test_versioned_record",
            TARGET_ID,
            1,
            { name: "must-not-write" },
          ),
        ),
      });
      expect(updated).toEqual({ status: "updated", version: 2 });
      expect(stale).toEqual({ status: "stale" });
      const record = await worker.execute({
        run: (database) => database.read((query) =>
          query.get("SELECT name, version, updated_at FROM test_versioned_record WHERE id = ?", [TARGET_ID])),
      });
      expect(record).toEqual({
        name: "updated",
        version: 2,
        updated_at: 1_785_000_000_000,
      });
    } finally {
      await worker.close();
    }
  });

  it("persists administrative audit across restart", async () => {
    const file = databasePath("restart");
    const first = open(file);
    const event = await first.execute({
      run: (database) => database.appendAdministrativeAudit(auditEvent({
        result: "deny",
        failureCode: "authorization_denied",
      })),
    });
    await first.close();

    const restarted = open(file);
    try {
      await expect(auditCount(restarted)).resolves.toBe(1);
      await expect(restarted.execute({
        run: (database) => database.administrativeAuditEvent(event.eventId),
      })).resolves.toMatchObject({
        event_id: event.eventId,
        actor_id_snapshot: ACTOR_ID,
        target_id_snapshot: TARGET_ID,
      });
    } finally {
      await restarted.close();
    }
  });
});

describe("UUIDv7 generation", () => {
  it("generates ordered RFC 9562 UUIDv7 values under equal or regressing clocks", () => {
    const times = [1_715_000_000_000, 1_715_000_000_000, 1_714_000_000_000];
    const generator = new UuidV7Generator({
      now: () => times.shift() ?? 1_715_000_000_000,
      random: () => new Uint8Array(10),
    });
    const values = [generator.next(), generator.next(), generator.next()];

    expect(values.every(isUuidV7)).toBe(true);
    expect([...values].sort()).toEqual(values);
    expect(new Set(values).size).toBe(3);
  });

  it("rejects invalid time and randomness sources", () => {
    expect(() => new UuidV7Generator({ now: () => -1 }).next()).toThrow(
      "UUIDv7 time source is outside the supported range.",
    );
    expect(() => new UuidV7Generator({
      now: () => 1,
      random: () => new Uint8Array(9),
    }).next()).toThrow("UUIDv7 randomness source returned the wrong length.");
  });
});

function open(
  databaseFile: string,
  migrations: readonly PersistenceMigration[] = [...PERSISTENCE_MIGRATIONS, fixtureMigration],
): PersistenceWorker {
  return PersistenceWorker.open({
    databaseFile,
    migrations,
    productVersion: "0.1.0-test",
    now: () => 1_785_000_000_000,
    sanitizeAuditText: (value) => sanitizeAuditText(value, ["raw-secret"]),
  });
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-audit-${name}-`)), "control.sqlite");
}

function auditEvent(overrides: Partial<AdministrativeAuditEventInput> = {}): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: ACTOR_ID,
      label: "Ada Admin",
      role: "admin",
      authenticationMethod: "password_totp",
    },
    action: "fixture.create",
    result: "allow",
    target: {
      type: "fixture",
      id: TARGET_ID,
      label: "Example fixture",
    },
    serviceId: SERVICE_ID,
    justification: "Test the audited unit of work.",
    changes: [{ field: "display_name", after: "Example fixture" }],
    correlationId: CORRELATION_ID,
    source: { category: "control", client: "integration-test" },
    ...overrides,
  };
}

function auditCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({ run: (database) => database.administrativeAuditCount() });
}

function recordCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ count: number }>("SELECT count(*) AS count FROM test_versioned_record")?.count ?? 0),
  });
}
