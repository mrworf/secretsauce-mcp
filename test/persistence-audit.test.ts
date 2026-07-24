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
  version: 19,
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
      version: 20,
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
