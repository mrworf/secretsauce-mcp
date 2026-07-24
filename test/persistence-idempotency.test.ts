import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AdministrativeAuditEventInput } from "../src/persistence/administrativeAudit.js";
import { PersistenceDatabase } from "../src/persistence/database.js";
import { PersistenceError } from "../src/persistence/errors.js";
import type { IdempotencyExecutionInput } from "../src/persistence/idempotency.js";
import {
  PERSISTENCE_MIGRATIONS,
  type PersistenceMigration,
} from "../src/persistence/migrations.js";
import {
  ControlIdempotencyHasher,
  loadControlIdempotencyKey,
} from "../src/control/idempotency.js";

const PRINCIPAL_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const TARGET_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const RESULT_ID = "018f1f2e-7b3c-7a10-8000-000000000003";
const SECOND_RESULT_ID = "018f1f2e-7b3c-7a10-8000-000000000004";
const RAW_KEY = "do-not-store-key-1234";
const RAW_BODY_MARKER = "body-marker-must-not-persist";

const fixtureMigration: PersistenceMigration = {
  version: 21,
  name: "test_idempotency_fixture",
  sql: `
    CREATE TABLE test_idempotent_mutations (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
  `,
};

describe("control idempotency hashing", () => {
  it("accepts boundary keys, binds hashes to principal and route, and canonicalizes bodies", () => {
    const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 7));
    const minimum = hasher.keyHash({
      key: "k".repeat(16),
      principalId: PRINCIPAL_ID,
      routeId: "services.create",
    });
    const maximum = hasher.keyHash({
      key: "k".repeat(128),
      principalId: PRINCIPAL_ID,
      routeId: "services.create",
    });
    expect(minimum).toMatch(/^[a-f0-9]{64}$/);
    expect(maximum).toMatch(/^[a-f0-9]{64}$/);
    expect(maximum).not.toBe(minimum);
    expect(hasher.keyHash({
      key: RAW_KEY,
      principalId: PRINCIPAL_ID,
      routeId: "services.create",
    })).not.toBe(hasher.keyHash({
      key: RAW_KEY,
      principalId: TARGET_ID,
      routeId: "services.create",
    }));
    expect(hasher.keyHash({
      key: RAW_KEY,
      principalId: PRINCIPAL_ID,
      routeId: "services.update",
    })).not.toBe(hasher.keyHash({
      key: RAW_KEY,
      principalId: PRINCIPAL_ID,
      routeId: "services.create",
    }));
    expect(hasher.requestDigest({ body: { b: 2, a: 1 }, query: {} }))
      .toBe(hasher.requestDigest({ query: {}, body: { a: 1, b: 2 } }));
    expect(hasher.requestDigest({ body: { a: 2 } }))
      .not.toBe(hasher.requestDigest({ body: { a: 1 } }));
    expect(hasher.protectedRequestDigest({ value: "short-secret" }))
      .not.toBe(hasher.requestDigest({ value: "short-secret" }));
    expect(hasher.protectedRequestDigest({ value: "short-secret" }))
      .not.toBe(new ControlIdempotencyHasher(Buffer.alloc(32, 8))
        .protectedRequestDigest({ value: "short-secret" }));
  });

  it("rejects out-of-bound keys and unsupported digest inputs without reflecting values", () => {
    const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 3));
    for (const key of ["k".repeat(15), "k".repeat(129), " key-with-spaces ", "line\nbreak-value"]) {
      expect(() => hasher.keyHash({
        key,
        principalId: PRINCIPAL_ID,
        routeId: "services.create",
      })).toThrowError(expect.objectContaining({ code: "invalid_request" }));
    }
    for (const input of [Number.NaN, 1n, { missing: undefined }, new Date(0)]) {
      try {
        hasher.requestDigest(input);
        throw new Error("Expected digest validation to fail.");
      } catch (error) {
        expect(error).toEqual(new PersistenceError("invalid_idempotency_record"));
        expect(String(error)).not.toContain(String(input));
      }
    }
    expect(() => hasher.keyHash({
      key: RAW_KEY,
      principalId: "not-a-principal",
      routeId: "services.create",
    })).toThrowError(new PersistenceError("invalid_idempotency_record"));
    expect(() => hasher.keyHash({
      key: RAW_KEY,
      principalId: PRINCIPAL_ID,
      routeId: "Services/Create",
    })).toThrowError(new PersistenceError("invalid_idempotency_record"));
  });

  it("loads only a canonical 32-byte base64url key from a restricted file", () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-idempotency-key-"));
    const valid = join(directory, "valid.key");
    writeFileSync(valid, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
    expect(loadControlIdempotencyKey(valid)).toEqual(Buffer.alloc(32, 9));

    const permissive = join(directory, "permissive.key");
    writeFileSync(permissive, Buffer.alloc(32, 1).toString("base64url"), { mode: 0o600 });
    chmodSync(permissive, 0o644);
    const malformed = join(directory, "malformed.key");
    writeFileSync(malformed, "not-a-key", { mode: 0o600 });
    for (const path of [permissive, malformed, join(directory, "missing.key")]) {
      try {
        loadControlIdempotencyKey(path);
        throw new Error("Expected key loading to fail.");
      } catch (error) {
        expect(error).toEqual(new PersistenceError("invalid_idempotency_record"));
        expect(String(error)).not.toContain(path);
      }
    }
  });
});

describe("transaction-bound idempotency", () => {
  it("executes and audits once, then replays the durable safe result after restart", () => {
    const file = databasePath("replay");
    const now = { value: 1_785_000_000_000 };
    const input = idempotencyInput();
    const mutation = vi.fn((database: PersistenceDatabase) =>
      database.withIdempotentAdministrativeAudit(input, auditEvent(), (transaction) => {
        transaction.run(
          "INSERT INTO test_idempotent_mutations (id, value) VALUES (?, ?)",
          [TARGET_ID, RAW_BODY_MARKER],
        );
        return { value: { created: true }, resultReference: RESULT_ID, responseStatus: 201 };
      }));
    const first = open(file, now);
    expect(mutation(first)).toEqual({
      kind: "executed",
      value: { created: true },
      resultReference: RESULT_ID,
      responseStatus: 201,
    });
    first.close();

    const restarted = open(file, now);
    try {
      expect(mutation(restarted)).toEqual({
        kind: "replayed",
        resultReference: RESULT_ID,
        responseStatus: 201,
      });
      expect(restarted.administrativeAuditCount()).toBe(1);
      expect(restarted.read((query) => query.get<{ count: number }>(
        "SELECT count(*) AS count FROM test_idempotent_mutations",
      )?.count)).toBe(1);
      const stored = restarted.read((query) =>
        query.get<Record<string, unknown>>("SELECT * FROM control_idempotency_records"));
      const serialized = JSON.stringify(stored);
      expect(serialized).not.toContain(RAW_KEY);
      expect(serialized).not.toContain(RAW_BODY_MARKER);
    } finally {
      restarted.close();
    }
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it("rejects a different request digest without invoking or auditing a second mutation", () => {
    const persistence = open(databasePath("conflict"));
    try {
      persistence.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        () => ({ value: true, resultReference: RESULT_ID, responseStatus: 200 }),
      );
      const mutation = vi.fn(() => ({
        value: false,
        resultReference: SECOND_RESULT_ID,
        responseStatus: 200,
      }));
      expect(() => persistence.withIdempotentAdministrativeAudit(
        { ...idempotencyInput(), requestDigest: "b".repeat(64) },
        auditEvent(),
        mutation,
      )).toThrowError(new PersistenceError("idempotency_conflict"));
      expect(mutation).not.toHaveBeenCalled();
      expect(persistence.administrativeAuditCount()).toBe(1);
    } finally {
      persistence.close();
    }
  });

  it("expires at exactly 24 hours and replaces the record with a new result", () => {
    const now = { value: 1_785_000_000_000 };
    const persistence = open(databasePath("expiry"), now);
    try {
      persistence.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        () => ({ value: 1, resultReference: RESULT_ID, responseStatus: 200 }),
      );
      now.value += 24 * 60 * 60 * 1000;
      expect(persistence.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        () => ({ value: 2, resultReference: SECOND_RESULT_ID, responseStatus: 202 }),
      )).toEqual({
        kind: "executed",
        value: 2,
        resultReference: SECOND_RESULT_ID,
        responseStatus: 202,
      });
      expect(persistence.administrativeAuditCount()).toBe(2);
    } finally {
      persistence.close();
    }
  });

  it("prunes no more than 500 expired records in one command", () => {
    const now = { value: 100 };
    const persistence = open(databasePath("prune"), now);
    try {
      persistence.withAdministrativeAudit(auditEvent(), (transaction) => {
        for (let index = 0; index < 501; index += 1) {
          transaction.run(`
            INSERT INTO control_idempotency_records (
              key_hash, principal_id, route_id, request_digest, result_reference,
              response_status, created_at, completed_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, 200, 0, 0, 1)
          `, [
            index.toString(16).padStart(64, "0"),
            PRINCIPAL_ID,
            "fixtures.create",
            "a".repeat(64),
            RESULT_ID,
          ]);
        }
      });
      expect(persistence.pruneExpiredIdempotency()).toBe(500);
      expect(recordCount(persistence, "control_idempotency_records")).toBe(1);
      expect(persistence.pruneExpiredIdempotency()).toBe(1);
      expect(persistence.pruneExpiredIdempotency()).toBe(0);
    } finally {
      persistence.close();
    }
  });

  it("rolls back domain state and idempotency state when mutation or audit fails", () => {
    const mutationFailure = open(databasePath("mutation-failure"));
    try {
      expect(() => mutationFailure.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        (transaction) => {
          transaction.run(
            "INSERT INTO test_idempotent_mutations (id, value) VALUES (?, 'rollback')",
            [TARGET_ID],
          );
          throw new Error("sensitive downstream detail");
        },
      )).toThrowError(new PersistenceError("database_unavailable"));
      expect(recordCount(mutationFailure, "test_idempotent_mutations")).toBe(0);
      expect(recordCount(mutationFailure, "control_idempotency_records")).toBe(0);
      expect(mutationFailure.administrativeAuditCount()).toBe(0);
    } finally {
      mutationFailure.close();
    }

    const failureMigration: PersistenceMigration = {
      version: 22,
      name: "test_idempotent_audit_failure",
      sql: `
        CREATE TRIGGER reject_idempotent_audit
        BEFORE INSERT ON administrative_audit_events
        BEGIN
          SELECT RAISE(ABORT, 'sensitive audit detail');
        END;
      `,
    };
    const auditFailure = open(
      databasePath("audit-failure"),
      { value: 1_785_000_000_000 },
      [...PERSISTENCE_MIGRATIONS, fixtureMigration, failureMigration],
    );
    try {
      expect(() => auditFailure.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        (transaction) => {
          transaction.run(
            "INSERT INTO test_idempotent_mutations (id, value) VALUES (?, 'rollback')",
            [TARGET_ID],
          );
          return { value: true, resultReference: RESULT_ID, responseStatus: 200 };
        },
      )).toThrowError(new PersistenceError("audit_persistence_failed"));
      expect(recordCount(auditFailure, "test_idempotent_mutations")).toBe(0);
      expect(recordCount(auditFailure, "control_idempotency_records")).toBe(0);
      expect(auditFailure.administrativeAuditCount()).toBe(0);
    } finally {
      auditFailure.close();
    }
  });

  it("rolls back the mutation when durable idempotency storage fails", () => {
    const failureMigration: PersistenceMigration = {
      version: 22,
      name: "test_idempotency_storage_failure",
      sql: `
        CREATE TRIGGER reject_idempotency_storage
        BEFORE INSERT ON control_idempotency_records
        BEGIN
          SELECT RAISE(ABORT, 'sensitive idempotency detail');
        END;
      `,
    };
    const persistence = open(
      databasePath("storage-failure"),
      { value: 1_785_000_000_000 },
      [...PERSISTENCE_MIGRATIONS, fixtureMigration, failureMigration],
    );
    try {
      expect(() => persistence.withIdempotentAdministrativeAudit(
        idempotencyInput(),
        auditEvent(),
        (transaction) => {
          transaction.run(
            "INSERT INTO test_idempotent_mutations (id, value) VALUES (?, 'rollback')",
            [TARGET_ID],
          );
          return { value: true, resultReference: RESULT_ID, responseStatus: 200 };
        },
      )).toThrowError(new PersistenceError("database_unavailable"));
      expect(recordCount(persistence, "test_idempotent_mutations")).toBe(0);
      expect(recordCount(persistence, "control_idempotency_records")).toBe(0);
      expect(persistence.administrativeAuditCount()).toBe(0);
    } finally {
      persistence.close();
    }
  });

  it("rejects invalid metadata and result bounds before commit", () => {
    const persistence = open(databasePath("validation"));
    try {
      const mutation = vi.fn(() => ({
        value: true,
        resultReference: RESULT_ID,
        responseStatus: 200,
      }));
      expect(() => persistence.withIdempotentAdministrativeAudit(
        { ...idempotencyInput(), keyHash: "not-a-hash" },
        auditEvent(),
        mutation,
      )).toThrowError(new PersistenceError("invalid_idempotency_record"));
      expect(mutation).not.toHaveBeenCalled();
      for (const result of [
        { value: true, resultReference: "not-a-reference", responseStatus: 200 },
        { value: true, resultReference: RESULT_ID, responseStatus: 199 },
        { value: true, resultReference: RESULT_ID, responseStatus: 300 },
      ]) {
        expect(() => persistence.withIdempotentAdministrativeAudit(
          idempotencyInput(),
          auditEvent(),
          () => result,
        )).toThrowError(new PersistenceError("invalid_idempotency_record"));
      }
      expect(recordCount(persistence, "control_idempotency_records")).toBe(0);
      expect(persistence.administrativeAuditCount()).toBe(0);
    } finally {
      persistence.close();
    }
  });
});

function open(
  databaseFile: string,
  now: { value: number } = { value: 1_785_000_000_000 },
  migrations: readonly PersistenceMigration[] = [...PERSISTENCE_MIGRATIONS, fixtureMigration],
): PersistenceDatabase {
  return PersistenceDatabase.open({
    databaseFile,
    migrations,
    productVersion: "0.1.0-test",
    now: () => now.value,
  });
}

function idempotencyInput(): IdempotencyExecutionInput {
  const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 5));
  return {
    keyHash: hasher.keyHash({
      key: RAW_KEY,
      principalId: PRINCIPAL_ID,
      routeId: "fixtures.create",
    }),
    principalId: PRINCIPAL_ID,
    routeId: "fixtures.create",
    requestDigest: hasher.requestDigest({ body: { value: RAW_BODY_MARKER } }),
  };
}

function auditEvent(): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: PRINCIPAL_ID,
      label: "Test administrator",
      role: "admin",
      authenticationMethod: "password_totp",
    },
    action: "fixture.create",
    result: "allow",
    target: { type: "fixture", id: TARGET_ID, label: "Test fixture" },
    changes: [{ field: "fixture", after: "created" }],
    correlationId: "req_8ca2d86c-541c-4484-bcc0-feebb54f6311",
    source: { category: "control", client: "integration-test" },
  };
}

function recordCount(persistence: PersistenceDatabase, table: string): number {
  const allowed = new Set(["test_idempotent_mutations", "control_idempotency_records"]);
  if (!allowed.has(table)) throw new Error("Unexpected fixture table.");
  return persistence.read((query) =>
    query.get<{ count: number }>(`SELECT count(*) AS count FROM ${table}`)?.count ?? 0);
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-idempotency-${name}-`)), "control.sqlite");
}
