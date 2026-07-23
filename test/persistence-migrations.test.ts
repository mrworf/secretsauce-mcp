import { chmodSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { PersistenceDatabase } from "../src/persistence/database.js";
import { PersistenceError } from "../src/persistence/errors.js";
import {
  PERSISTENCE_MIGRATIONS,
  type PersistenceMigration,
} from "../src/persistence/migrations.js";

describe("persistence migrations", () => {
  it("initializes an empty database with the production schema and restrictive permissions", () => {
    const file = databasePath("fresh");
    const persistence = open(file);
    try {
      expect(persistence.schemaVersion).toBe(8);
      expect(persistence.migrationHistory()).toEqual([
        {
          version: 1,
          name: "persistence_and_administrative_audit_foundation",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 2,
          name: "control_idempotency_foundation",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 3,
          name: "identity_bootstrap_foundation",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 4,
          name: "local_authentication_foundation",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 5,
          name: "enrollment_recovery_self_service",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 6,
          name: "user_administration_lifecycle",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 7,
          name: "generic_oidc_provider",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          version: 8,
          name: "service_management",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ]);
      expect(statSync(file).mode & 0o777).toBe(0o600);

      const inspection = new Database(file, { readonly: true });
      try {
        expect(inspection.pragma("journal_mode", { simple: true })).toBe("wal");
        expect(inspection.prepare(`
          SELECT name FROM sqlite_master
          WHERE type = 'table' ORDER BY name
        `).pluck().all()).toEqual([
          "administrative_audit_events",
          "control_idempotency_records",
          "external_identities",
          "identity_bootstrap",
          "identity_invalidation_events",
          "identity_oidc_flows",
          "identity_pending_totp",
          "identity_restricted_sessions",
          "identity_security_state",
          "identity_step_up_proofs",
          "identity_temporary_passwords",
          "local_authenticator_states",
          "local_password_credentials",
          "local_totp_authenticators",
          "schema_migrations",
          "service_admins",
          "service_config_versions",
          "service_destinations",
          "service_invalidation_events",
          "services",
          "users",
          "accepted_totp_steps",
          "browser_sessions",
        ].sort());
        expect(inspection.prepare(
          "PRAGMA table_info(local_authenticator_states)",
        ).all().map((row) => (row as { name: string }).name)).toEqual([
          "user_id",
          "password_state",
          "totp_state",
          "version",
          "created_at",
          "updated_at",
        ]);
        expect(inspection.prepare(
          "PRAGMA table_info(users)",
        ).all().map((row) => (row as { name: string }).name)).toEqual(
          expect.arrayContaining([
            "email_source",
            "given_name_source",
            "family_name_source",
          ]),
        );
        expect(inspection.prepare(
          "PRAGMA table_info(identity_oidc_flows)",
        ).all().map((row) => (row as { name: string }).name)).toEqual(
          expect.arrayContaining([
            "state_hash",
            "envelope_json",
            "claimed_at",
            "consumed_at",
          ]),
        );
      } finally {
        inspection.close();
      }
    } finally {
      persistence.close();
    }
  });

  it("applies internal migrations in order and restarts at the current schema", () => {
    const file = databasePath("ordered");
    const migrations = [
      ...PERSISTENCE_MIGRATIONS,
      testMigration(9, "ninth", "CREATE TABLE ninth_fixture (id INTEGER PRIMARY KEY) STRICT;"),
      testMigration(10, "tenth", "CREATE TABLE tenth_fixture (id INTEGER PRIMARY KEY) STRICT;"),
    ];
    const first = open(file, migrations);
    expect(first.schemaVersion).toBe(10);
    expect(first.migrationHistory().map(({ version }) => version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    first.close();

    const restarted = open(file, migrations);
    try {
      expect(restarted.schemaVersion).toBe(10);
      expect(restarted.migrationHistory().map(({ name }) => name)).toEqual([
        "persistence_and_administrative_audit_foundation",
        "control_idempotency_foundation",
        "identity_bootstrap_foundation",
        "local_authentication_foundation",
        "enrollment_recovery_self_service",
        "user_administration_lifecycle",
        "generic_oidc_provider",
        "service_management",
        "ninth",
        "tenth",
      ]);
    } finally {
      restarted.close();
    }
  });

  it("rejects unknown future, partial, and checksum-drifted schemas safely", () => {
    const futureFile = initializedPath("future");
    edit(futureFile, (database) => database.pragma("user_version = 9"));
    expectPersistenceError(() => open(futureFile), "schema_unsupported", futureFile);

    const partialFile = databasePath("partial");
    edit(partialFile, (database) => database.pragma("user_version = 1"));
    expectPersistenceError(() => open(partialFile), "schema_unsupported", partialFile);

    const driftFile = initializedPath("drift");
    edit(driftFile, (database) => {
      database.prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1")
        .run("0".repeat(64));
    });
    expectPersistenceError(() => open(driftFile), "schema_unsupported", driftFile);

    const missingTableFile = initializedPath("missing-table");
    edit(missingTableFile, (database) => {
      database.exec("DROP TABLE control_idempotency_records");
    });
    expectPersistenceError(() => open(missingTableFile), "schema_unsupported", missingTableFile);
  });

  it("rolls a failed migration back without leaving its schema or history", () => {
    const file = initializedPath("rollback");
    const migrations = [
      ...PERSISTENCE_MIGRATIONS,
      testMigration(9, "broken", `
        CREATE TABLE should_rollback (id INTEGER PRIMARY KEY) STRICT;
        INSERT INTO table_that_does_not_exist (id) VALUES (1);
      `),
    ];

    expectPersistenceError(() => open(file, migrations), "migration_failed", file);

    const inspection = new Database(file);
    try {
      expect(inspection.pragma("user_version", { simple: true })).toBe(8);
      expect(inspection.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'",
      ).get()).toBeUndefined();
      expect(inspection.prepare("SELECT count(*) AS count FROM schema_migrations").get())
        .toEqual({ count: 8 });
    } finally {
      inspection.close();
    }
  });

  it("rejects invalid internal migration registries before changing the database", () => {
    const file = databasePath("registry");
    const invalidRegistries: PersistenceMigration[][] = [
      [testMigration(2, "gap", "SELECT 1;")],
      [
        testMigration(1, "first", "SELECT 1;"),
        testMigration(1, "duplicate", "SELECT 1;"),
      ],
      [testMigration(1, "", "SELECT 1;")],
      [testMigration(1, "blank", "   ")],
    ];

    for (const migrations of invalidRegistries) {
      expectPersistenceError(() => open(file, migrations), "schema_unsupported", file);
    }
  });

  it("maps misconfigured or unreadable database targets to sanitized errors", () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-db-directory-"));
    chmodSync(directory, 0o700);

    expectPersistenceError(
      () => open(directory),
      "database_unavailable",
      directory,
    );
  });

  it("closes idempotently and rejects access after close", () => {
    const persistence = open(databasePath("close"));
    persistence.close();
    persistence.close();

    expect(() => persistence.schemaVersion).toThrowError(
      expect.objectContaining({ code: "persistence_closed" }),
    );
  });
});

function open(
  databaseFile: string,
  migrations: readonly PersistenceMigration[] = PERSISTENCE_MIGRATIONS,
): PersistenceDatabase {
  return PersistenceDatabase.open({
    databaseFile,
    migrations,
    productVersion: "0.1.0-test",
    now: () => 1_785_000_000_000,
  });
}

function initializedPath(name: string): string {
  const file = databasePath(name);
  open(file).close();
  return file;
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-${name}-`)), "control.sqlite");
}

function edit(file: string, callback: (database: Database.Database) => void): void {
  const database = new Database(file);
  try {
    callback(database);
  } finally {
    database.close();
  }
}

function testMigration(version: number, name: string, sql: string): PersistenceMigration {
  return { version, name, sql };
}

function expectPersistenceError(
  operation: () => unknown,
  code: PersistenceError["code"],
  prohibitedPath: string,
): void {
  try {
    operation();
    throw new Error("Expected persistence operation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain(prohibitedPath);
    expect(String(error)).not.toContain("SELECT");
    expect(String(error)).not.toContain("INSERT");
    expect(String(error)).not.toContain("CREATE TABLE");
  }
}
