import { chmodSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  exportEncryptedVaultArchive,
  importEncryptedVaultArchive,
} from "../src/vault/archive.js";
import { VaultRecordStore, type VaultCredentialBinding } from "../src/vault/recordStore.js";

describe("passphrase-encrypted vault archives", () => {
  it("exports chunk-authenticated ciphertext and atomically restores it under a different root key", async () => {
    const source = storeFixture("archive-source", 10);
    const firstSecret = Buffer.from("archive-private-first-1111");
    const secondSecret = Buffer.alloc(65_536, 0x5a);
    const first = source.store.create(source.binding, firstSecret, { captureLastFour: true });
    const second = source.store.create(source.binding, secondSecret);
    source.store.replace(first.locator, 1, source.binding, Buffer.from("archive-private-replaced-2222"), {
      captureLastFour: true,
    });
    const passphrase = Buffer.from("correct horse battery staple");

    const archive = await exportEncryptedVaultArchive(source.store, passphrase);
    expect(archive.subarray(0, 8).toString("ascii")).toBe("SSVA0001");
    expect(archive.readUInt32BE(12)).toBe(65_536);
    expect(archive.readUInt32BE(16)).toBe(3);
    expect(archive[20]).toBe(1);
    expect(archive.includes(firstSecret)).toBe(false);
    expect(archive.includes(Buffer.from("archive-private-replaced-2222"))).toBe(false);
    expect(archive.includes(passphrase)).toBe(false);

    const destination = storeFixture("archive-destination", 90);
    const stale = destination.store.create(destination.binding, Buffer.from("stale-destination-value"));
    await importEncryptedVaultArchive(destination.store, passphrase, archive);

    expect(destination.store.readiness()).toEqual({ status: "ready", recordCount: 2 });
    expect(() => destination.store.metadata(stale.locator, destination.binding))
      .toThrowError(expect.objectContaining({ code: "vault_record_not_found" }));
    expect(destination.store.resolve(first.locator, 2, source.binding).toString()).toBe("archive-private-replaced-2222");
    expect(destination.store.resolve(second.locator, 1, source.binding)).toEqual(secondSecret);
    expect(destination.store.metadata(first.locator, source.binding)).toMatchObject({
      generation: 2,
      lastFour: "2222",
    });
    firstSecret.fill(0);
    secondSecret.fill(0);
    passphrase.fill(0);
    archive.fill(0);
  });

  it("returns one uniform authentication failure for wrong passphrases and tampering without changing the active store", async () => {
    const source = storeFixture("archive-auth-source", 20);
    const created = source.store.create(source.binding, Buffer.from("source-secret"));
    const passphrase = Buffer.from("valid archive passphrase");
    const archive = await exportEncryptedVaultArchive(source.store, passphrase);
    const destination = storeFixture("archive-auth-destination", 30);
    const active = destination.store.create(destination.binding, Buffer.from("active-secret"));

    await expect(importEncryptedVaultArchive(
      destination.store,
      Buffer.from("incorrect passphrase"),
      archive,
    )).rejects.toMatchObject({ code: "vault_archive_authentication_failed" });
    expect(destination.store.resolve(active.locator, 1, destination.binding).toString()).toBe("active-secret");

    const tampered = Buffer.from(archive);
    tampered[tampered.length - 1] ^= 1;
    await expect(importEncryptedVaultArchive(destination.store, passphrase, tampered))
      .rejects.toMatchObject({ code: "vault_archive_authentication_failed" });
    expect(destination.store.resolve(active.locator, 1, destination.binding).toString()).toBe("active-secret");
    expect(() => destination.store.metadata(created.locator, source.binding))
      .toThrowError(expect.objectContaining({ code: "vault_record_not_found" }));
    expect(readdirSync(join(destination.directory, "..")).some((name) => name.includes(".restore."))).toBe(false);
  });

  it("rejects truncated, reordered, duplicate-nonce, and downgraded-parameter archives", async () => {
    const source = storeFixture("archive-malformed", 40);
    source.store.create(source.binding, Buffer.alloc(65_536, 7));
    const passphrase = Buffer.from("malformed archive passphrase");
    const archive = await exportEncryptedVaultArchive(source.store, passphrase);
    const destination = storeFixture("archive-malformed-destination", 41);

    await expect(importEncryptedVaultArchive(destination.store, passphrase, archive.subarray(0, archive.length - 1)))
      .rejects.toMatchObject({ code: "vault_archive_authentication_failed" });

    const duplicateNonce = Buffer.from(archive);
    const firstChunkLength = 24 + duplicateNonce.readUInt32BE(64 + 8) + 16;
    const secondChunk = 64 + firstChunkLength;
    duplicateNonce.subarray(64 + 12, 64 + 24).copy(duplicateNonce, secondChunk + 12);
    await expect(importEncryptedVaultArchive(destination.store, passphrase, duplicateNonce))
      .rejects.toMatchObject({ code: "vault_archive_authentication_failed" });

    const downgraded = Buffer.from(archive);
    downgraded.writeUInt32BE(32_768, 12);
    await expect(importEncryptedVaultArchive(destination.store, passphrase, downgraded))
      .rejects.toMatchObject({ code: "vault_archive_invalid" });

    const excessRecords = Buffer.from(archive);
    excessRecords.writeUInt32BE(100_001, 28);
    await expect(importEncryptedVaultArchive(destination.store, passphrase, excessRecords))
      .rejects.toMatchObject({ code: "vault_archive_invalid" });
  });

  it("supports empty stores and exact passphrase boundaries while rejecting limit-plus/minus-one", async () => {
    const source = storeFixture("archive-empty", 50);
    const minimum = Buffer.alloc(12, 1);
    const archive = await exportEncryptedVaultArchive(source.store, minimum);
    const destination = storeFixture("archive-empty-destination", 51);
    await importEncryptedVaultArchive(destination.store, minimum, archive);
    expect(destination.store.readiness()).toEqual({ status: "ready", recordCount: 0 });

    await expect(exportEncryptedVaultArchive(source.store, Buffer.alloc(11)))
      .rejects.toMatchObject({ code: "vault_archive_invalid" });
    const maximum = Buffer.alloc(1_024, 2);
    await expect(exportEncryptedVaultArchive(source.store, maximum)).resolves.toBeInstanceOf(Buffer);
    await expect(exportEncryptedVaultArchive(source.store, Buffer.alloc(1_025)))
      .rejects.toMatchObject({ code: "vault_archive_invalid" });
  });
});

function storeFixture(name: string, keyByte: number): {
  directory: string;
  store: VaultRecordStore;
  binding: VaultCredentialBinding;
} {
  const directory = mkdtempSync(join(tmpdir(), `${name}-`));
  chmodSync(directory, 0o700);
  const generator = new UuidV7Generator();
  return {
    directory,
    binding: {
      serviceId: generator.next(),
      destinationId: generator.next(),
      credentialId: generator.next(),
    },
    store: new VaultRecordStore({
      directory,
      activeRootKey: "root-a",
      rootKeys: new Map([["root-a", Buffer.alloc(32, keyByte)]]),
    }),
  };
}
