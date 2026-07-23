import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  PersistenceDatabase,
  type PersistenceDatabaseOptions,
  type PersistenceReadiness,
} from "./database.js";
import { PersistenceError, mapPersistenceError } from "./errors.js";

export interface PersistenceCommand<T> {
  run(database: PersistenceDatabase): T | Promise<T>;
}

export interface PersistenceOwner {
  readonly readiness: PersistenceReadiness;
  execute<T>(command: PersistenceCommand<T>): Promise<T>;
  close(): Promise<void>;
}

export class PersistenceWorker implements PersistenceOwner {
  readonly #database: PersistenceDatabase;
  readonly #ownershipLock: Database.Database;
  #tail: Promise<void> = Promise.resolve();
  #closing = false;
  #closePromise: Promise<void> | undefined;

  private constructor(database: PersistenceDatabase, ownershipLock: Database.Database) {
    this.#database = database;
    this.#ownershipLock = ownershipLock;
  }

  static open(options: PersistenceDatabaseOptions): PersistenceWorker {
    let ownershipLock: Database.Database | undefined;
    let database: PersistenceDatabase | undefined;
    try {
      ownershipLock = acquireOwnershipLock(options.databaseFile);
      database = PersistenceDatabase.open(options);
      return new PersistenceWorker(database, ownershipLock);
    } catch (error) {
      try {
        database?.close();
      } catch {
        // Preserve the sanitized startup error.
      }
      try {
        ownershipLock?.close();
      } catch {
        // Preserve the sanitized startup error.
      }
      throw mapPersistenceError(error, "database_unavailable");
    }
  }

  get readiness(): PersistenceReadiness {
    return this.#database.readiness();
  }

  execute<T>(command: PersistenceCommand<T>): Promise<T> {
    if (this.#closing) return Promise.reject(new PersistenceError("persistence_closed"));
    const result = this.#tail.then(() => command.run(this.#database));
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  close(): Promise<void> {
    this.#closePromise ??= this.closeOwnedResources();
    return this.#closePromise;
  }

  private async closeOwnedResources(): Promise<void> {
    this.#closing = true;
    await this.#tail;
    const errors: unknown[] = [];
    try {
      this.#database.close();
    } catch (error) {
      errors.push(error);
    }
    try {
      this.#ownershipLock.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) throw new PersistenceError("database_unavailable");
  }
}

function acquireOwnershipLock(databaseFile: string): Database.Database {
  const lockFile = `${databaseFile}.writer-lock`;
  let lock: Database.Database | undefined;
  try {
    mkdirSync(dirname(lockFile), { recursive: true, mode: 0o700 });
    lock = new Database(lockFile);
    chmodSync(lockFile, 0o600);
    lock.pragma("busy_timeout = 0");
    lock.pragma("journal_mode = DELETE");
    lock.exec(`
      CREATE TABLE IF NOT EXISTS application_writer_lock (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1)
      ) STRICT;
      BEGIN EXCLUSIVE;
    `);
    return lock;
  } catch {
    try {
      lock?.close();
    } catch {
      // The lock-acquisition error is intentionally stable.
    }
    throw new PersistenceError("database_unavailable");
  }
}
