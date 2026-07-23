import type Database from "better-sqlite3";
import { PersistenceError } from "./errors.js";
import {
  IDEMPOTENCY_RETENTION_MS,
  type IdempotencyExecutionInput,
  type IdempotencyExecutionResult,
  type IdempotencyMutationResult,
  type StoredIdempotencyRecord,
  validateIdempotencyExecutionInput,
  validateIdempotencyMutationResult,
} from "./idempotency.js";

type SqlValue = string | number | bigint | Buffer | null;

export interface OptimisticUpdateResult {
  status: "updated" | "stale";
  version?: number;
}

export class PersistenceQuery {
  constructor(
    protected readonly database: Database.Database,
  ) {}

  get<T>(sql: string, parameters: readonly SqlValue[] = []): T | undefined {
    try {
      return this.database.prepare(sql).get(...parameters) as T | undefined;
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }

  all<T>(sql: string, parameters: readonly SqlValue[] = []): T[] {
    try {
      return this.database.prepare(sql).all(...parameters) as T[];
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }
}

export class PersistenceTransaction extends PersistenceQuery {
  constructor(
    database: Database.Database,
    private readonly now: () => number,
  ) {
    super(database);
  }

  run(sql: string, parameters: readonly SqlValue[] = []): Database.RunResult {
    try {
      return this.database.prepare(sql).run(...parameters);
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }

  timestamp(): number {
    const value = Math.trunc(this.now());
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PersistenceError("database_unavailable");
    }
    return value;
  }

  idempotent<T>(
    input: IdempotencyExecutionInput,
    mutation: () => IdempotencyMutationResult<T>,
  ): IdempotencyExecutionResult<T> {
    const idempotency = validateIdempotencyExecutionInput(input);
    const now = this.timestamp();
    const expiresAt = now + IDEMPOTENCY_RETENTION_MS;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new PersistenceError("invalid_idempotency_record");
    }
    const existing = this.get<StoredIdempotencyRecord>(`
      SELECT
        key_hash, principal_id, route_id, request_digest,
        result_reference, response_status, expires_at
      FROM control_idempotency_records
      WHERE key_hash = ?
    `, [idempotency.keyHash]);
    if (existing !== undefined && existing.expires_at > now) {
      if (
        existing.principal_id !== idempotency.principalId ||
        existing.route_id !== idempotency.routeId ||
        existing.request_digest !== idempotency.requestDigest
      ) {
        throw new PersistenceError("idempotency_conflict");
      }
      return {
        kind: "replayed",
        resultReference: existing.result_reference,
        responseStatus: existing.response_status,
      };
    }
    if (existing !== undefined) {
      this.run("DELETE FROM control_idempotency_records WHERE key_hash = ?", [
        idempotency.keyHash,
      ]);
    }
    const result = validateIdempotencyMutationResult(mutation());
    if (
      result.value !== null &&
      (typeof result.value === "object" || typeof result.value === "function") &&
      "then" in result.value &&
      typeof result.value.then === "function"
    ) {
      throw new PersistenceError("database_unavailable");
    }
    this.run(`
      INSERT INTO control_idempotency_records (
        key_hash, principal_id, route_id, request_digest, result_reference,
        response_status, created_at, completed_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      idempotency.keyHash,
      idempotency.principalId,
      idempotency.routeId,
      idempotency.requestDigest,
      result.resultReference,
      result.responseStatus,
      now,
      now,
      expiresAt,
    ]);
    return { kind: "executed", ...result };
  }

  optimisticUpdate(
    table: string,
    id: string,
    expectedVersion: number,
    changes: Readonly<Record<string, SqlValue>>,
  ): OptimisticUpdateResult {
    if (
      !identifierPattern.test(table) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1 ||
      Object.keys(changes).length === 0 ||
      Object.keys(changes).some((column) =>
        !identifierPattern.test(column) || column === "id" || column === "version" || column === "updated_at")
    ) {
      throw new PersistenceError("database_unavailable");
    }
    const columns = Object.keys(changes).sort();
    const assignments = columns.map((column) => `"${column}" = ?`);
    const updatedAt = Math.trunc(this.now());
    if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) {
      throw new PersistenceError("database_unavailable");
    }
    const row = this.get<{ version: number }>(`
      UPDATE "${table}"
      SET ${assignments.join(", ")}, "updated_at" = ?, "version" = "version" + 1
      WHERE "id" = ? AND "version" = ?
      RETURNING "version"
    `, [...columns.map((column) => changes[column] ?? null), updatedAt, id, expectedVersion]);
    return row === undefined ? { status: "stale" } : { status: "updated", version: row.version };
  }
}

const identifierPattern = /^[a-z][a-z0-9_]{0,63}$/;
