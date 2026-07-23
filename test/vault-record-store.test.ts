import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  VaultRecordStore,
  type VaultCredentialBinding,
  type VaultRecordStoreOptions,
} from "../src/vault/recordStore.js";

const timestamp = 1_800_000_000_000;

describe("encrypted vault record store", () => {
  it("accepts a control-selected locator and rejects invalid or duplicate locators", () => {
    const fixture = storeFixture("selected-locator");
    const locator = "12345678-1234-4234-8234-123456789abc";
    expect(fixture.store.create(
      fixture.binding,
      Buffer.from("selected-value"),
      { locator },
    ).locator).toBe(locator);
    expect(() => fixture.store.create(
      fixture.binding,
      Buffer.from("duplicate-value"),
      { locator },
    )).toThrowError(expect.objectContaining({ code: "vault_record_conflict" }));
    expect(() => fixture.store.create(
      fixture.binding,
      Buffer.from("invalid-value"),
      { locator: "not-a-locator" },
    )).toThrowError(expect.objectContaining({ code: "vault_record_invalid" }));
    fixture.store.close();
  });

  it("creates, masks, resolves, and persists an envelope-encrypted credential", () => {
    const fixture = storeFixture();
    const secret = Buffer.from("credential-private-1234");
    const created = fixture.store.create(fixture.binding, secret, { captureLastFour: true });

    expect(created.metadata).toEqual({
      status: "configured",
      generation: 1,
      sizeClass: "up_to_32_bytes",
      lastFour: "1234",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(created.locator).toMatch(/^[0-9a-f-]{36}$/);
    const recordFile = join(fixture.directory, `${created.locator}.ssvr`);
    const stored = readFileSync(recordFile);
    expect(stored.includes(secret)).toBe(false);
    expect(stored.toString("utf8")).not.toContain("credential-private-1234");
    expect(lstatSync(recordFile).mode & 0o777).toBe(0o600);
    expect(lstatSync(fixture.directory).mode & 0o777).toBe(0o700);
    expect(fixture.store.resolve(created.locator, 1, fixture.binding)).toEqual(secret);
    expect(JSON.stringify(created)).not.toContain("credential-private");

    const restarted = createStore({ directory: fixture.directory, rootKeys: fixture.rootKeys });
    expect(restarted.readiness()).toEqual({ status: "ready", recordCount: 1 });
    expect(restarted.metadata(created.locator, fixture.binding)).toEqual(created.metadata);
    expect(restarted.resolve(created.locator, 1, fixture.binding)).toEqual(secret);
  });

  it("replaces atomically, retains the locator, rejects stale/cross-binding access, and deletes", () => {
    let clock = timestamp;
    const fixture = storeFixture({ now: () => clock });
    const created = fixture.store.create(fixture.binding, Buffer.from("old-value-0001"), { captureLastFour: true });
    const oldBytes = readFileSync(join(fixture.directory, `${created.locator}.ssvr`));
    clock += 1_000;

    const metadata = fixture.store.replace(
      created.locator,
      1,
      fixture.binding,
      Buffer.from("new-value-0002"),
      { captureLastFour: true },
    );
    expect(metadata).toMatchObject({ generation: 2, lastFour: "0002", createdAt: timestamp, updatedAt: clock });
    expect(fixture.store.resolve(created.locator, 2, fixture.binding).toString()).toBe("new-value-0002");
    expect(readFileSync(join(fixture.directory, `${created.locator}.ssvr`))).not.toEqual(oldBytes);
    expect(() => fixture.store.resolve(created.locator, 1, fixture.binding))
      .toThrowError(expect.objectContaining({ code: "vault_record_conflict" }));
    expect(() => fixture.store.resolve(created.locator, 2, { ...fixture.binding, credentialId: fixture.otherCredentialId }))
      .toThrowError(expect.objectContaining({ code: "vault_record_invalid" }));

    fixture.store.delete(created.locator, 2, fixture.binding);
    expect(fixture.store.readiness().recordCount).toBe(0);
    expect(() => fixture.store.metadata(created.locator, fixture.binding))
      .toThrowError(expect.objectContaining({ code: "vault_record_not_found" }));
  });

  it("uses exact secret boundaries and pads ciphertext to size classes", () => {
    const fixture = storeFixture();
    const one = fixture.store.create(fixture.binding, Buffer.alloc(1, 1));
    const thirtyTwo = fixture.store.create(fixture.binding, Buffer.alloc(32, 2));
    const thirtyThree = fixture.store.create(fixture.binding, Buffer.alloc(33, 3));
    const oneTwentyEight = fixture.store.create(fixture.binding, Buffer.alloc(128, 4));
    const maximum = fixture.store.create(fixture.binding, Buffer.alloc(65_536, 5));

    expect(one.metadata.sizeClass).toBe("up_to_32_bytes");
    expect(maximum.metadata.sizeClass).toBe("up_to_64_kib");
    expect(recordSize(fixture.directory, one.locator)).toBe(recordSize(fixture.directory, thirtyTwo.locator));
    expect(recordSize(fixture.directory, thirtyThree.locator)).toBe(recordSize(fixture.directory, oneTwentyEight.locator));
    expect(() => fixture.store.create(fixture.binding, Buffer.alloc(0)))
      .toThrowError(expect.objectContaining({ code: "vault_record_invalid" }));
    expect(() => fixture.store.create(fixture.binding, Buffer.alloc(65_537)))
      .toThrowError(expect.objectContaining({ code: "vault_record_invalid" }));
  });

  it("supports multiple root keys and makes a retired key unnecessary after replacement", () => {
    const directory = secureDirectory("vault-record-rotation");
    const rootA = Buffer.alloc(32, 11);
    const rootB = Buffer.alloc(32, 12);
    const both = new Map([["root-a", rootA], ["root-b", rootB]]);
    const first = createStore({ directory, rootKeys: both, activeRootKey: "root-a" });
    const binding = bindings();
    const created = first.create(binding, Buffer.from("before-rewrap"));

    const second = createStore({ directory, rootKeys: both, activeRootKey: "root-b" });
    expect(second.resolve(created.locator, 1, binding).toString()).toBe("before-rewrap");
    second.replace(created.locator, 1, binding, Buffer.from("after-rewrap"));

    const retired = createStore({
      directory,
      rootKeys: new Map([["root-b", rootB]]),
      activeRootKey: "root-b",
    });
    expect(retired.readiness().status).toBe("ready");
    expect(retired.resolve(created.locator, 2, binding).toString()).toBe("after-rewrap");
  });

  it("reports sanitized locked/degraded readiness for missing keys and corruption", () => {
    const fixture = storeFixture();
    const secret = Buffer.from("do-not-expose-this");
    const created = fixture.store.create(fixture.binding, secret);

    const missing = createStore({
      directory: fixture.directory,
      rootKeys: new Map([["root-b", Buffer.alloc(32, 8)]]),
      activeRootKey: "root-b",
    });
    expect(missing.readiness()).toEqual({ status: "locked", recordCount: 0 });
    expect(() => missing.resolve(created.locator, 1, fixture.binding))
      .toThrowError(expect.objectContaining({ code: "vault_store_unavailable" }));

    const wrong = createStore({
      directory: fixture.directory,
      rootKeys: new Map([["root-a", Buffer.alloc(32, 99)]]),
    });
    expect(wrong.readiness().status).toBe("degraded");
    expect(JSON.stringify(wrong.readiness())).not.toContain(secret.toString());

    const record = join(fixture.directory, `${created.locator}.ssvr`);
    const bytes = readFileSync(record);
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(record, bytes, { mode: 0o600 });
    const tampered = createStore({ directory: fixture.directory, rootKeys: fixture.rootKeys });
    expect(tampered.readiness().status).toBe("degraded");
    expect(() => tampered.metadata(created.locator, fixture.binding))
      .toThrowError(expect.objectContaining({ code: "vault_store_unavailable" }));
  });

  it("preserves the authoritative record when failure occurs before atomic replacement", () => {
    const fixture = storeFixture();
    const created = fixture.store.create(fixture.binding, Buffer.from("authoritative-old"));
    const failing = createStore({
      directory: fixture.directory,
      rootKeys: fixture.rootKeys,
      failureInjector: () => { throw new Error("injected"); },
    });

    expect(() => failing.replace(created.locator, 1, fixture.binding, Buffer.from("uncommitted-new")))
      .toThrowError(expect.objectContaining({ code: "vault_store_unavailable" }));
    expect(readdirSync(fixture.directory)).toEqual([`${created.locator}.ssvr`]);
    const restarted = createStore({ directory: fixture.directory, rootKeys: fixture.rootKeys });
    expect(restarted.resolve(created.locator, 1, fixture.binding).toString()).toBe("authoritative-old");
  });

  it("fails closed on unsafe record and store filesystem objects", () => {
    const fixture = storeFixture();
    const created = fixture.store.create(fixture.binding, Buffer.from("filesystem-secret"));
    const record = join(fixture.directory, `${created.locator}.ssvr`);
    chmodSync(record, 0o644);
    expect(createStore({ directory: fixture.directory, rootKeys: fixture.rootKeys }).readiness().status).toBe("degraded");

    chmodSync(record, 0o600);
    const extraLink = join(fixture.directory, "outside-link");
    linkSync(record, extraLink);
    expect(createStore({ directory: fixture.directory, rootKeys: fixture.rootKeys }).readiness().status).toBe("degraded");

    const target = secureDirectory("vault-store-target");
    const symlink = join(secureDirectory("vault-store-parent"), "store");
    symlinkSync(target, symlink);
    expect(createStore({ directory: symlink, rootKeys: fixture.rootKeys }).readiness().status).toBe("degraded");
  });
});

function storeFixture(overrides: Partial<VaultRecordStoreOptions> = {}): {
  directory: string;
  rootKeys: ReadonlyMap<string, Buffer>;
  binding: VaultCredentialBinding;
  otherCredentialId: string;
  store: VaultRecordStore;
} {
  const directory = overrides.directory ?? secureDirectory("vault-record-store");
  const rootKeys = overrides.rootKeys ?? new Map([["root-a", Buffer.alloc(32, 7)]]);
  const binding = bindings();
  return {
    directory,
    rootKeys,
    binding,
    otherCredentialId: uuidGenerator().next(),
    store: createStore({ directory, rootKeys, ...overrides }),
  };
}

function createStore(options: {
  directory: string;
  rootKeys: ReadonlyMap<string, Uint8Array>;
  activeRootKey?: string;
  now?: () => number;
  failureInjector?: VaultRecordStoreOptions["failureInjector"];
}): VaultRecordStore {
  return new VaultRecordStore({
    directory: options.directory,
    rootKeys: options.rootKeys,
    activeRootKey: options.activeRootKey ?? "root-a",
    now: options.now ?? (() => timestamp),
    ...(options.failureInjector === undefined ? {} : { failureInjector: options.failureInjector }),
  });
}

function bindings(): VaultCredentialBinding {
  const generator = uuidGenerator();
  return {
    serviceId: generator.next(),
    destinationId: generator.next(),
    credentialId: generator.next(),
  };
}

function uuidGenerator(): UuidV7Generator {
  return new UuidV7Generator({ now: () => timestamp, random: (size) => Buffer.alloc(size, 6) });
}

function secureDirectory(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), `${name}-`));
  chmodSync(directory, 0o700);
  return directory;
}

function recordSize(directory: string, locator: string): number {
  return lstatSync(join(directory, `${locator}.ssvr`)).size;
}
