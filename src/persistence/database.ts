import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { PersistenceError, mapPersistenceError } from "./errors.js";
import {
  buildAdministrativeAuditEvent,
  type AdministrativeAuditEvent,
} from "./administrativeAudit.js";
import {
  canonicalAdministrativeAuditDocument,
  canonicalRuntimeAuditDocument,
  validateRuntimeAuditProjection,
  type RuntimeAuditProjection,
} from "./auditDocuments.js";
import {
  migrationChecksum,
  PERSISTENCE_MIGRATIONS,
  type PersistenceMigration,
  validateMigrationRegistry,
} from "./migrations.js";
import { PersistenceQuery, PersistenceTransaction } from "./transaction.js";
import { UuidV7Generator } from "./uuidV7.js";
import {
  IDEMPOTENCY_PRUNE_LIMIT,
  type IdempotencyExecutionInput,
  type IdempotencyExecutionResult,
  type IdempotencyMutationResult,
} from "./idempotency.js";
import { projectHourlyActivity } from "../activityProjection.js";

export interface PersistenceDatabaseOptions {
  databaseFile: string;
  productVersion: string;
  migrations?: readonly PersistenceMigration[];
  now?: () => number;
  uuid?: () => string;
  sanitizeAuditText?: (value: string) => string;
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
  readonly #now: () => number;
  readonly #uuid: () => string;
  readonly #sanitizeAuditText: (value: string) => string;
  readonly #expectedSchemaVersion: number;
  #administrativeAuditDegraded = false;
  #closed = false;

  private constructor(
    database: Database.Database,
    now: () => number,
    uuid: () => string,
    sanitizeAuditText: (value: string) => string,
    expectedSchemaVersion: number,
  ) {
    this.#database = database;
    this.#now = now;
    this.#uuid = uuid;
    this.#sanitizeAuditText = sanitizeAuditText;
    this.#expectedSchemaVersion = expectedSchemaVersion;
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
      const now = options.now ?? Date.now;
      const uuidGenerator = new UuidV7Generator({ now });
      applyMigrations(database, migrations, options.productVersion, now);
      validateCurrentSchema(database, migrations);
      return new PersistenceDatabase(
        database,
        now,
        options.uuid ?? (() => uuidGenerator.next()),
        options.sanitizeAuditText ?? ((value) => value),
        migrations.length,
      );
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

  readiness(): PersistenceReadiness {
    if (this.#closed) return unavailableReadiness();
    try {
      const databaseReady = this.#database.prepare("SELECT 1 AS ready").get() !== undefined;
      const schemaReady =
        this.schemaVersion === this.#expectedSchemaVersion &&
        this.#database.pragma("quick_check", { simple: true }) === "ok" &&
        tableExists(this.#database, "administrative_audit_events") &&
        tableExists(this.#database, "control_idempotency_records");
      const auditReady = tableExists(this.#database, "administrative_audit_events");
      return {
        database: databaseReady ? "ready" : "unavailable",
        schema: schemaReady ? "ready" : "unsupported",
        administrativeAudit: auditReady && !this.#administrativeAuditDegraded ? "ready" : "unavailable",
      };
    } catch {
      return unavailableReadiness();
    }
  }

  withAdministrativeAudit<T>(
    input: unknown,
    mutation: (transaction: PersistenceTransaction) => T,
  ): T {
    this.assertOpen();
    const event = this.buildAuditEvent(input);
    if (event.result !== "allow") throw new PersistenceError("invalid_audit_event");
    const execute = this.#database.transaction(() => {
      const result = mutation(new PersistenceTransaction(this.#database, this.#now));
      if (isPromiseLike(result)) throw new PersistenceError("database_unavailable");
      this.insertAdministrativeAudit(event);
      return result;
    });
    try {
      return execute.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  withGeneratedAdministrativeAudit<T>(
    mutation: (transaction: PersistenceTransaction) => {
      value: T;
      auditInput: unknown;
    },
  ): T {
    this.assertOpen();
    const execute = this.#database.transaction(() => {
      const result = mutation(new PersistenceTransaction(this.#database, this.#now));
      if (isPromiseLike(result) || isPromiseLike(result.value)) {
        throw new PersistenceError("database_unavailable");
      }
      const event = this.buildAuditEvent(result.auditInput);
      if (event.result !== "allow") throw new PersistenceError("invalid_audit_event");
      this.insertAdministrativeAudit(event);
      return result.value;
    });
    try {
      return execute.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  withGeneratedAdministrativeAuditOutcome<T>(
    mutation: (transaction: PersistenceTransaction) => {
      value: T;
      auditInput: unknown;
    },
  ): T {
    this.assertOpen();
    const execute = this.#database.transaction(() => {
      const result = mutation(new PersistenceTransaction(this.#database, this.#now));
      if (isPromiseLike(result) || isPromiseLike(result.value)) {
        throw new PersistenceError("database_unavailable");
      }
      const event = this.buildAuditEvent(result.auditInput);
      this.insertAdministrativeAudit(event);
      return result.value;
    });
    try {
      return execute.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  withOperationalTransaction<T>(
    mutation: (transaction: PersistenceTransaction) => T,
  ): T {
    this.assertOpen();
    const execute = this.#database.transaction(() => {
      const result = mutation(new PersistenceTransaction(this.#database, this.#now));
      if (isPromiseLike(result)) throw new PersistenceError("database_unavailable");
      return result;
    });
    try {
      return execute.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  withIdempotentAdministrativeAudit<T>(
    idempotencyInput: IdempotencyExecutionInput,
    auditInput: unknown,
    mutation: (transaction: PersistenceTransaction) => IdempotencyMutationResult<T>,
  ): IdempotencyExecutionResult<T> {
    this.assertOpen();
    const event = this.buildAuditEvent(auditInput);
    if (event.result !== "allow") throw new PersistenceError("invalid_audit_event");
    const execute = this.#database.transaction((): IdempotencyExecutionResult<T> => {
      const transaction = new PersistenceTransaction(this.#database, this.#now);
      const result = transaction.idempotent(
        idempotencyInput,
        () => mutation(transaction),
      );
      if (result.kind === "executed") this.insertAdministrativeAudit(event);
      return result;
    });
    try {
      return execute.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  pruneExpiredIdempotency(): number {
    this.assertOpen();
    const now = this.safeNow();
    const prune = this.#database.transaction(() => this.#database.prepare(`
      DELETE FROM control_idempotency_records
      WHERE key_hash IN (
        SELECT key_hash
        FROM control_idempotency_records
        WHERE expires_at <= ?
        ORDER BY expires_at, key_hash
        LIMIT ?
      )
    `).run(now, IDEMPOTENCY_PRUNE_LIMIT).changes);
    try {
      return prune.immediate();
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  read<T>(query: (context: PersistenceQuery) => T): T {
    this.assertOpen();
    try {
      const result = query(new PersistenceQuery(this.#database));
      if (isPromiseLike(result)) throw new PersistenceError("database_unavailable");
      return result;
    } catch (error) {
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  appendAdministrativeAudit(input: unknown): AdministrativeAuditEvent {
    this.assertOpen();
    const event = this.buildAuditEvent(input);
    const append = this.#database.transaction(() => this.insertAdministrativeAudit(event));
    try {
      append.immediate();
      return event;
    } catch (error) {
      throw mapPersistenceError(error, "audit_persistence_failed");
    }
  }

  appendRuntimeAudit(input: unknown): RuntimeAuditProjection {
    this.assertOpen();
    const event = validateRuntimeAuditProjection(input);
    const append = this.#database.transaction(() => {
      const result = this.#database.prepare(`
        INSERT INTO runtime_audit_events (
          event_id, occurred_at, event_type, outcome, category, actor_type,
          subject_id_snapshot, subject_label_snapshot, service_id_snapshot,
          service_label_snapshot, destination, action, method, target_host,
          target_path, downstream_status, policy_rule, reason, failure_code,
          correlation_id, source_json, duration_ms, tls_verify,
          tokenization_count, details_json, credential_use_count
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        event.eventId, event.occurredAt, event.eventType, event.outcome,
        event.category, event.actorType, event.subjectId ?? null,
        event.subjectLabel, event.serviceId ?? null, event.serviceLabel ?? null,
        event.destination ?? null, event.action ?? null, event.method ?? null,
        event.targetHost ?? null, event.targetPath ?? null,
        event.downstreamStatus ?? null, event.policyRule ?? null,
        event.reason ?? null, event.failureCode ?? null,
        event.correlationId ?? null, JSON.stringify(event.source),
        event.durationMs ?? null, event.tlsVerify === undefined ? null : Number(event.tlsVerify),
        event.tokenizationCount ?? null, JSON.stringify(event.details),
        event.credentialUseCount ?? 0,
      );
      const sequence = Number(result.lastInsertRowid);
      this.#database.prepare(`
        INSERT INTO runtime_audit_fts (rowid, event_id, document)
        VALUES (?, ?, ?)
      `).run(sequence, event.eventId, canonicalRuntimeAuditDocument(event));
      projectHourlyActivity({
        run: (sql, parameters = []) =>
          this.#database.prepare(sql).run(...parameters),
      }, sequence, event, this.safeNow());
    });
    try {
      append.immediate();
      return event;
    } catch {
      throw new PersistenceError("audit_persistence_failed");
    }
  }

  administrativeAuditEvent(eventId: string): Record<string, unknown> | undefined {
    this.assertOpen();
    try {
      return this.#database.prepare(`
        SELECT
          event_id, occurred_at, actor_type, actor_id_snapshot, actor_label_snapshot,
          actor_role_snapshot, authentication_method, action, result, target_type,
          target_id_snapshot, target_label_snapshot, service_id_snapshot,
          justification, changes_json, correlation_id, source_json, failure_code
        FROM administrative_audit_events
        WHERE event_id = ?
      `).get(eventId) as Record<string, unknown> | undefined;
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }

  administrativeAuditCount(): number {
    this.assertOpen();
    try {
      const row = this.#database.prepare(
        "SELECT count(*) AS count FROM administrative_audit_events",
      ).get() as { count: number };
      return row.count;
    } catch {
      throw new PersistenceError("database_unavailable");
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

  private buildAuditEvent(input: unknown): AdministrativeAuditEvent {
    return buildAdministrativeAuditEvent(input, {
      now: this.#now,
      uuid: this.#uuid,
      sanitizeText: this.#sanitizeAuditText,
    });
  }

  private safeNow(): number {
    const now = Math.trunc(this.#now());
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new PersistenceError("invalid_idempotency_record");
    }
    return now;
  }

  private insertAdministrativeAudit(event: AdministrativeAuditEvent): void {
    try {
      const next = this.#database.prepare(`
        SELECT coalesce(max(sequence), 0) + 1 AS sequence
        FROM administrative_audit_events
      `).get() as { sequence: number };
      this.#database.prepare(`
        INSERT INTO administrative_audit_events (
          event_id, occurred_at, actor_type, actor_id_snapshot, actor_label_snapshot,
          actor_role_snapshot, authentication_method, action, result, target_type,
          target_id_snapshot, target_label_snapshot, service_id_snapshot,
          justification, changes_json, correlation_id, source_json, failure_code,
          sequence, category, service_label_snapshot
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        event.eventId,
        event.occurredAt,
        event.actor.type,
        event.actor.id ?? null,
        event.actor.label,
        event.actor.role ?? null,
        event.actor.authenticationMethod,
        event.action,
        event.result,
        event.target.type,
        event.target.id ?? null,
        event.target.label,
        event.serviceId ?? null,
        event.justification ?? null,
        JSON.stringify(event.changes),
        event.correlationId,
        JSON.stringify(event.source),
        event.failureCode ?? null,
        next.sequence,
        event.category,
        event.serviceLabel ?? null,
      );
      this.#database.prepare(`
        INSERT INTO administrative_audit_fts (rowid, event_id, document)
        VALUES (?, ?, ?)
      `).run(
        next.sequence,
        event.eventId,
        canonicalAdministrativeAuditDocument(event),
      );
    } catch {
      this.#administrativeAuditDegraded = true;
      throw new PersistenceError("audit_persistence_failed");
    }
  }

}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === "object" && "then" in value;
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
  if (
    integrity !== "ok" ||
    !tableExists(database, "administrative_audit_events") ||
    !tableExists(database, "control_idempotency_records")
  ) {
    throw new PersistenceError("schema_unsupported");
  }
}

function tableExists(database: Database.Database, name: string): boolean {
  return database.prepare(`
    SELECT 1 AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(name) !== undefined;
}

function mapOpenError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  return new PersistenceError("database_unavailable");
}
