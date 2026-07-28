import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  VaultRecordRootRotationAdapter,
  VaultRecordStore,
  type VaultCredentialBinding,
} from "../src/vault/recordStore.js";

const timestamp = 1_800_000_000_000;
const oldRoot = Buffer.alloc(32, 31);
const newRoot = Buffer.alloc(32, 32);
const thirdRoot = Buffer.alloc(32, 33);
const locators = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
] as const;

describe("vault-record root rewrap adapter", () => {
  it("rewraps bounded batches and preserves every non-wrapping byte", () => {
    const directory = secureDirectory();
    const binding = bindings();
    const writer = store(directory, "root-a", oldRoot);
    for (const [index, locator] of locators.entries()) {
      writer.create(
        binding,
        Buffer.from(`credential-${index}-1234`),
        { locator, captureLastFour: true },
      );
    }
    writer.close();
    const before = readFileSync(recordPath(directory, locators[0]));
    const adapter = rotationAdapter(directory);

    expect(adapter.preflight()).toEqual({
      totalCount: 3,
      oldRootCount: 3,
      newRootCount: 0,
    });
    const first = adapter.rewrapBatch(undefined, 2);
    expect(first).toEqual({
      scannedCount: 2,
      rewrappedCount: 2,
      cursor: locators[1],
    });
    expect(adapter.inventory()).toEqual({
      totalCount: 3,
      oldRootCount: 1,
      newRootCount: 2,
    });
    expect(adapter.rewrapBatch(first.cursor, 2)).toEqual({
      scannedCount: 1,
      rewrappedCount: 1,
    });
    expect(adapter.verifyZero()).toEqual({
      totalCount: 3,
      oldRootCount: 0,
      newRootCount: 3,
    });
    expect(adapter.rewrapBatch(undefined, 10)).toEqual({
      scannedCount: 3,
      rewrappedCount: 0,
    });

    const after = readFileSync(recordPath(directory, locators[0]));
    const headerLength = 52 + "root-a".length + 4;
    const wrappedEnd = headerLength + 12 + 32 + 16;
    expect(after.subarray(0, headerLength))
      .toEqual(before.subarray(0, headerLength));
    expect(after.subarray(wrappedEnd)).toEqual(before.subarray(wrappedEnd));
    expect(after.subarray(headerLength, wrappedEnd))
      .not.toEqual(before.subarray(headerLength, wrappedEnd));

    const restarted = store(directory, "root-a", newRoot);
    for (const [index, locator] of locators.entries()) {
      expect(restarted.resolve(locator, 1, binding).toString())
        .toBe(`credential-${index}-1234`);
      expect(restarted.metadata(locator, binding)).toMatchObject({
        generation: 1,
        lastFour: "1234",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    restarted.close();
    expect(store(directory, "root-a", oldRoot).readiness().status)
      .toBe("degraded");
    adapter.close();
    expect(() => adapter.inventory()).toThrow();
  });

  it("accepts an empty store and rejects invalid cursors and batch sizes", () => {
    const directory = secureDirectory();
    const adapter = rotationAdapter(directory);
    expect(adapter.preflight()).toEqual({
      totalCount: 0,
      oldRootCount: 0,
      newRootCount: 0,
    });
    expect(adapter.rewrapBatch(undefined, 10)).toEqual({
      scannedCount: 0,
      rewrappedCount: 0,
    });
    expect(adapter.verifyZero().oldRootCount).toBe(0);
    expect(() => adapter.rewrapBatch("not-a-locator", 1)).toThrow();
    expect(() => adapter.rewrapBatch(undefined, 0)).toThrow();
    expect(() => adapter.rewrapBatch(undefined, 1_001)).toThrow();
  });

  it("rejects unexpected logical roots, unknown physical roots, and tamper", () => {
    const logicalDirectory = secureDirectory();
    store(logicalDirectory, "root-b", oldRoot).create(
      bindings(),
      Buffer.from("unexpected-logical-root"),
      { locator: locators[0] },
    );
    expect(() => rotationAdapter(logicalDirectory).preflight()).toThrow();

    const physicalDirectory = secureDirectory();
    store(physicalDirectory, "root-a", thirdRoot).create(
      bindings(),
      Buffer.from("unexpected-physical-root"),
      { locator: locators[0] },
    );
    expect(() => rotationAdapter(physicalDirectory).preflight()).toThrow();

    const tamperedDirectory = secureDirectory();
    store(tamperedDirectory, "root-a", oldRoot).create(
      bindings(),
      Buffer.from("tamper-protected"),
      { locator: locators[0] },
    );
    const path = recordPath(tamperedDirectory, locators[0]);
    const bytes = readFileSync(path);
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(path, bytes, { mode: 0o600 });
    expect(() => rotationAdapter(tamperedDirectory).preflight()).toThrow();
  });

  it("detects an exact-source race and preserves the concurrent record", () => {
    const directory = secureDirectory();
    const binding = bindings();
    const writer = store(directory, "root-a", oldRoot);
    writer.create(binding, Buffer.from("original-value"), {
      locator: locators[0],
    });
    let injected = false;
    const adapter = rotationAdapter(directory, (stage) => {
      if (stage === "before_rewrap_source_compare" && !injected) {
        injected = true;
        writer.replace(
          locators[0],
          1,
          binding,
          Buffer.from("concurrent-value"),
        );
      }
    });

    expect(() => adapter.rewrapBatch(undefined, 1))
      .toThrowError(expect.objectContaining({ code: "vault_record_conflict" }));
    expect(writer.resolve(locators[0], 2, binding).toString())
      .toBe("concurrent-value");
    expect(adapter.inventory()).toEqual({
      totalCount: 1,
      oldRootCount: 1,
      newRootCount: 0,
    });
  });

  it("leaves the authoritative record intact on pre-commit failure", () => {
    const directory = secureDirectory();
    const binding = bindings();
    const writer = store(directory, "root-a", oldRoot);
    writer.create(binding, Buffer.from("authoritative-value"), {
      locator: locators[0],
    });
    const before = readFileSync(recordPath(directory, locators[0]));
    const adapter = rotationAdapter(directory, (stage) => {
      if (stage === "after_rewrap_file_sync_before_compare") {
        throw new Error("injected");
      }
    });

    expect(() => adapter.rewrapBatch(undefined, 1)).toThrow();
    expect(readFileSync(recordPath(directory, locators[0]))).toEqual(before);
    expect(writer.resolve(locators[0], 1, binding).toString())
      .toBe("authoritative-value");
  });

  it("rejects invalid or identical root material", () => {
    const directory = secureDirectory();
    expect(() => new VaultRecordRootRotationAdapter({
      directory,
      logicalRootKeyId: "root-a",
      oldRoot: Buffer.alloc(31),
      newRoot,
    })).toThrow();
    expect(() => new VaultRecordRootRotationAdapter({
      directory,
      logicalRootKeyId: "root-a",
      oldRoot,
      newRoot: oldRoot,
    })).toThrow();
  });
});

function rotationAdapter(
  directory: string,
  failureInjector?: (
    stage:
      | "after_rewrap_file_sync_before_compare"
      | "before_rewrap_source_compare",
  ) => void,
): VaultRecordRootRotationAdapter {
  return new VaultRecordRootRotationAdapter({
    directory,
    logicalRootKeyId: "root-a",
    oldRoot,
    newRoot,
    ...(failureInjector === undefined ? {} : { failureInjector }),
  });
}

function store(
  directory: string,
  activeRootKey: string,
  root: Buffer,
): VaultRecordStore {
  return new VaultRecordStore({
    directory,
    activeRootKey,
    rootKeys: new Map([[activeRootKey, root]]),
    now: () => timestamp,
  });
}

function bindings(): VaultCredentialBinding {
  const generator = new UuidV7Generator({
    now: () => timestamp,
    random: (size) => Buffer.alloc(size, 9),
  });
  return {
    serviceId: generator.next(),
    destinationId: generator.next(),
    credentialId: generator.next(),
  };
}

function secureDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "vault-root-rewrap-"));
  chmodSync(directory, 0o700);
  return directory;
}

function recordPath(directory: string, locator: string): string {
  return join(directory, `${locator}.ssvr`);
}
