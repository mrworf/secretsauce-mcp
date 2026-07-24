import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PersistenceError } from "../src/persistence/errors.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

describe("persistence worker ownership", () => {
  it("owns one database writer and releases its crash-safe SQLite lock on close", async () => {
    const file = databasePath("exclusive");
    const first = open(file);
    try {
      expect(() => open(file)).toThrowError(expect.objectContaining({
        code: "database_unavailable",
        message: "Persistence database is unavailable.",
      }));
      expect(statSync(`${file}.writer-lock`).mode & 0o777).toBe(0o600);
    } finally {
      await first.close();
    }

    const replacement = open(file);
    await replacement.close();
  });

  it("serializes accepted commands, drains them before close, and rejects later work", async () => {
    const worker = open(databasePath("queue"));
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = worker.execute({
      run: async () => {
        order.push("first:start");
        await gate;
        order.push("first:end");
        return 1;
      },
    });
    const second = worker.execute({
      run: () => {
        order.push("second");
        return 2;
      },
    });
    const close = worker.close();
    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    releaseFirst?.();

    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    await close;
    expect(order).toEqual(["first:start", "first:end", "second"]);
    await expect(worker.execute({ run: () => 3 })).rejects.toMatchObject({
      code: "persistence_closed",
    });
  });

  it("keeps the command queue usable after a sanitized command failure", async () => {
    const worker = open(databasePath("failure"));
    try {
      await expect(worker.execute({
        run: () => {
          throw new PersistenceError("database_unavailable");
        },
      })).rejects.toMatchObject({ code: "database_unavailable" });
      await expect(worker.execute({ run: (database) => database.schemaVersion }))
        .resolves.toBe(17);
    } finally {
      await worker.close();
    }
  });

  it("reports stable readiness and persists through restart", async () => {
    const file = databasePath("readiness");
    const first = open(file);
    expect(first.readiness).toEqual({
      database: "ready",
      schema: "ready",
      administrativeAudit: "ready",
    });
    await first.close();
    expect(first.readiness).toEqual({
      database: "unavailable",
      schema: "unsupported",
      administrativeAudit: "unavailable",
    });

    const restarted = open(file);
    try {
      expect(restarted.readiness).toEqual({
        database: "ready",
        schema: "ready",
        administrativeAudit: "ready",
      });
      await expect(restarted.execute({ run: (database) => database.schemaVersion }))
        .resolves.toBe(17);
    } finally {
      await restarted.close();
    }
  });

  it("maps a failed partial initialization without retaining the ownership lock", () => {
    const directory = mkdtempSync(join(tmpdir(), "secretsauce-worker-target-"));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        open(directory);
        throw new Error("Expected worker startup to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(PersistenceError);
        expect(error).toMatchObject({ code: "database_unavailable" });
        expect(String(error)).not.toContain(directory);
      }
    }
  });

  it("closes idempotently", async () => {
    const worker = open(databasePath("close"));
    await Promise.all([worker.close(), worker.close()]);
    expect(worker.readiness.database).toBe("unavailable");
  });
});

function open(databaseFile: string): PersistenceWorker {
  return PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => 1_785_000_000_000,
  });
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-worker-${name}-`)), "control.sqlite");
}
