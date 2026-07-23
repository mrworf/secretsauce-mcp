import type Database from "better-sqlite3";
import { PersistenceError } from "./errors.js";

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
