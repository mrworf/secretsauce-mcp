import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import {
  RestoreRecoveryError,
  RestoreRecoveryManager,
} from "../src/restoreRecovery.js";

const NOW = 1_800_000_000_000;
const OPERATION_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const ACTOR_ID = "018f1f2e-7b3c-7a10-8000-000000000001";

describe("encrypted restore recovery manager", () => {
  it("snapshots and rolls back SQLite plus vault through an authenticated journal", async () => {
    const fixture = setup();
    let exportedPassphrase: Buffer | undefined;
    const exportRecovery = vi.fn(async (
      _capability: string,
      passphrase: Uint8Array,
    ) => {
      exportedPassphrase = Buffer.from(passphrase);
      return Buffer.from("vault recovery ciphertext");
    });
    const importRecovery = vi.fn(async (
      _capability: string,
      passphrase: Uint8Array,
      archive: Uint8Array,
    ) => {
      expect(Buffer.from(passphrase)).toEqual(exportedPassphrase);
      expect(Buffer.from(archive).toString()).toBe("vault recovery ciphertext");
    });
    const manager = fixture.manager(exportRecovery, importRecovery);
    const prepared = await manager.prepare(input(fixture.databaseFile));
    expect(prepared).toMatchObject({
      operationId: OPERATION_ID,
      phase: "snapshot_ready",
      expiresAt: NOW + 24 * 60 * 60_000,
    });
    const directoryText = [
      readFileSync(join(fixture.directory, "restore-recovery.journal")),
      readFileSync(join(fixture.directory, "restore-database.enc")),
    ].join("");
    expect(directoryText).not.toContain("before restore");
    expect(directoryText).not.toContain(
      Buffer.alloc(32, 7).toString("base64url"),
    );

    updateDatabase(fixture.databaseFile, "after restore");
    manager.advance(OPERATION_ID, "vault_applied");
    manager.advance(OPERATION_ID, "database_committed");
    await manager.rollback({
      operationId: OPERATION_ID,
      databaseFile: fixture.databaseFile,
    });
    expect(readValue(fixture.databaseFile)).toBe("before restore");
    expect(importRecovery).toHaveBeenCalledOnce();
    expect(manager.journal()?.phase).toBe("rolled_back");
    manager.remove();
    expect(manager.journal()).toBeUndefined();
    exportedPassphrase?.fill(0);
    manager.close();
  });

  it("discards pre-mutation startup state and fails closed on journal tampering", async () => {
    const fixture = setup();
    const manager = fixture.manager(
      vi.fn(async () => Buffer.from("vault recovery ciphertext")),
      vi.fn(async () => undefined),
    );
    await manager.prepare(input(fixture.databaseFile));
    expect(await manager.resume({
      databaseFile: fixture.databaseFile,
    })).toBe("discarded");
    expect(manager.journal()).toBeUndefined();

    await manager.prepare(input(fixture.databaseFile));
    const journal = join(fixture.directory, "restore-recovery.journal");
    const bytes = readFileSync(journal);
    bytes[20] ^= 1;
    writeFileSync(journal, bytes);
    expect(() => manager.journal())
      .toThrowError(expect.objectContaining({
        code: expect.stringMatching(/invalid|authentication_failed/),
      }));
    manager.close();
  });

  it("requires a private directory and exact stable recovery key file", () => {
    const fixture = setup();
    chmodSync(fixture.directory, 0o755);
    expect(() => fixture.manager(vi.fn(), vi.fn()))
      .toThrowError(new RestoreRecoveryError("invalid"));
    chmodSync(fixture.directory, 0o700);
    chmodSync(fixture.keyFile, 0o600);
    expect(() => fixture.manager(vi.fn(), vi.fn())).toThrow();
  });

  it("removes every partial artifact when vault snapshot creation fails", async () => {
    const fixture = setup();
    const manager = fixture.manager(
      vi.fn(async () => {
        throw new Error("injected vault failure");
      }),
      vi.fn(),
    );
    await expect(manager.prepare(input(fixture.databaseFile)))
      .rejects.toEqual(new RestoreRecoveryError("unavailable"));
    expect(manager.journal()).toBeUndefined();
    expect(readValue(fixture.databaseFile)).toBe("before restore");
    manager.close();
  });
});

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "restore-recovery-"));
  const databaseFile = join(directory, "control.sqlite");
  const database = new Database(databaseFile);
  database.exec("CREATE TABLE state (value TEXT NOT NULL)");
  database.prepare("INSERT INTO state (value) VALUES (?)").run("before restore");
  database.close();
  const keyFile = join(directory, "recovery.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 7).toString("base64url")}\n`);
  chmodSync(keyFile, 0o400);
  return {
    directory,
    databaseFile,
    keyFile,
    manager: (
      exportRecovery: ReturnType<typeof vi.fn>,
      importRecovery: ReturnType<typeof vi.fn>,
    ) => new RestoreRecoveryManager(
      directory,
      keyFile,
      { exportRecovery, importRecovery },
      { issueBackup: vi.fn(() => "capability") } as never,
      () => NOW,
    ),
  };
}

function input(databaseFile: string) {
  return {
    operationId: OPERATION_ID,
    actorId: ACTOR_ID,
    archiveSha256: "a".repeat(64),
    planDigest: "b".repeat(64),
    databaseFile,
  };
}

function updateDatabase(databaseFile: string, value: string): void {
  const database = new Database(databaseFile);
  database.prepare("UPDATE state SET value = ?").run(value);
  database.close();
}

function readValue(databaseFile: string): string {
  const database = new Database(databaseFile, { readonly: true });
  try {
    return database.prepare("SELECT value FROM state").pluck().get() as string;
  } finally {
    database.close();
  }
}
