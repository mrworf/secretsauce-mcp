import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { PersistenceError, mapPersistenceError } from "./errors.js";
import {
  migrationChecksum,
  PERSISTENCE_MIGRATIONS,
  type PersistenceMigration,
  validateMigrationRegistry,
} from "./migrations.js";

export interface PersistenceDatabaseOptions {
  databaseFile: string;
  productVersion: string;
  migrations?: readonly PersistenceMigration[];
  now?: () => number;
}

interface MigrationRow {
  version: number;
  name: string;
  checksum: string;
}

export interface PersistenceReadiness {
  database: "ready" | "unavailable";
  schema: "ready" | "unsupported";
  administrativeAudit: "ready" | "unavailable";
}

export class PersistenceDatabase {
  readonly #database: Database.Database;
  #closed = false;

  private constructor(database: Database.Database) {
    this.#database = database;
  }

  static open(options: PersistenceDatabaseOptions): PersistenceDatabase {
    const migrations = options.migrations ?? PERSISTENCE_MIGRATIONS;
    try {
      validateMigrationRegistry(migrations);
    } catch {
      throw new PersistenceError("schema_unsupported");
    }

    let database: Database.Database | undefined;
    try {
      mkdirSync(dirname(options.databaseFile), { recursive: true, mode: 0o700 });
      database = new Database(options.databaseFile);
      chmodSync(options.databaseFile, 0o600);
      configureDatabase(database);
      applyMigrations(database, migrations, options.productVersion, options.now ?? Date.now);
      validateCurrentSchema(database, migrations);
      return new PersistenceDatabase(database);
    } catch (error) {
      try {
        database?.close();
      } catch {
        // The stable outer error is intentionally independent of close details.
      }
      throw mapOpenError(error);
    }
  }

  get closed(): boolean {
    return this.#closed;
  }

  get schemaVersion(): number {
    this.assertOpen();
    return Number(this.#database.pragma("user_version", { simple: true }));
  }

  migrationHistory(): Array<{ version: number; name: string; checksum: string }> {
    this.assertOpen();
    return this.#database.prepare(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
    ).all() as MigrationRow[];
  }

  readiness(expectedSchemaVersion = PERSISTENCE_MIGRATIONS.length): PersistenceReadiness {
    if (this.#closed) return unavailableReadiness();
    try {
      const databaseReady = this.#database.prepare("SELECT 1 AS ready").get() !== undefined;
      const schemaReady =
        this.schemaVersion === expectedSchemaVersion &&
        this.#database.pragma("quick_check", { simple: true }) === "ok";
      const auditReady = this.#database.prepare(`
        SELECT 1 AS present
        FROM sqlite_master
        WHERE type = 'table' AND name = 'administrative_audit_events'
      `).get() !== undefined;
      return {
        database: databaseReady ? "ready" : "unavailable",
        schema: schemaReady ? "ready" : "unsupported",
        administrativeAudit: auditReady ? "ready" : "unavailable",
      };
    } catch {
      return unavailableReadiness();
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#database.close();
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }

  private assertOpen(): void {
    if (this.#closed) throw new PersistenceError("persistence_closed");
  }
}

function unavailableReadiness(): PersistenceReadiness {
  return {
    database: "unavailable",
    schema: "unsupported",
    administrativeAudit: "unavailable",
  };
}

function configureDatabase(database: Database.Database): void {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("synchronous = FULL");
  database.pragma("busy_timeout = 5000");
  database.pragma("trusted_schema = OFF");
  if (
    Number(database.pragma("foreign_keys", { simple: true })) !== 1 ||
    Number(database.pragma("synchronous", { simple: true })) !== 2
  ) {
    throw new PersistenceError("database_unavailable");
  }
}

function applyMigrations(
  database: Database.Database,
  migrations: readonly PersistenceMigration[],
  productVersion: string,
  now: () => number,
): void {
  const history = readHistory(database);
  validateHistory(database, migrations, history);

  for (const migration of migrations.slice(history.length)) {
    const apply = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare(`
        INSERT INTO schema_migrations (version, name, checksum, applied_at, product_version)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        migration.version,
        migration.name,
        migrationChecksum(migration),
        now(),
        productVersion,
      );
      database.pragma(`user_version = ${migration.version}`);
    });
    try {
      apply.exclusive();
    } catch {
      throw new PersistenceError("migration_failed");
    }
  }
}

function readHistory(database: Database.Database): MigrationRow[] {
  const migrationTable = database.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = 'schema_migrations'
  `).get();
  if (migrationTable === undefined) return [];
  try {
    return database.prepare(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
    ).all() as MigrationRow[];
  } catch {
    throw new PersistenceError("schema_unsupported");
  }
}

function validateHistory(
  database: Database.Database,
  migrations: readonly PersistenceMigration[],
  history: readonly MigrationRow[],
): void {
  const userVersion = Number(database.pragma("user_version", { simple: true }));
  if (!Number.isSafeInteger(userVersion) || userVersion < 0 || userVersion > migrations.length) {
    throw new PersistenceError("schema_unsupported");
  }
  if (history.length > migrations.length || userVersion !== history.length) {
    throw new PersistenceError("schema_unsupported");
  }
  for (let index = 0; index < history.length; index += 1) {
    const row = history[index];
    const migration = migrations[index];
    if (
      row === undefined ||
      migration === undefined ||
      row.version !== migration.version ||
      row.name !== migration.name ||
      row.checksum !== migrationChecksum(migration)
    ) {
      throw new PersistenceError("schema_unsupported");
    }
  }
}

function validateCurrentSchema(
  database: Database.Database,
  migrations: readonly PersistenceMigration[],
): void {
  validateHistory(database, migrations, readHistory(database));
  const integrity = database.pragma("quick_check", { simple: true });
  const auditTable = database.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = 'administrative_audit_events'
  `).get();
  if (integrity !== "ok" || auditTable === undefined) {
    throw new PersistenceError("schema_unsupported");
  }
}

function mapOpenError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  return new PersistenceError("database_unavailable");
}
