import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
} from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { VaultCapabilityAuthority } from "../src/vault/capabilities.js";
import { VaultBrokerServer } from "../src/vault/broker.js";
import { ControlVaultClient, DataVaultClient } from "../src/vault/client.js";
import { encodeVaultFrame } from "../src/vault/protocol.js";
import { VaultRecordStore, type VaultCredentialBinding } from "../src/vault/recordStore.js";

describe("isolated vault broker and typed clients", () => {
  it("serves control metadata and capability-bound data resolution over a private Unix socket", async () => {
    const fixture = await brokerFixture();
    const secret = Buffer.from("broker-private-value-9876");
    try {
      expect(lstatSync(fixture.socketPath).isSocket()).toBe(true);
      expect(lstatSync(fixture.socketPath).mode & 0o777).toBe(0o600);
      const created = await fixture.control.create({
        binding: fixture.binding,
        secret,
        captureLastFour: true,
      });
      expect(created.metadata).toMatchObject({ generation: 1, lastFour: "9876" });
      expect(JSON.stringify(created)).not.toContain("broker-private-value");
      expect(await fixture.control.metadata(created.locator, fixture.binding)).toEqual(created.metadata);

      const capability = issueResolve(fixture, created.locator, 1);
      let callbackBuffer: Buffer | undefined;
      const result = await fixture.data.resolveForRequest({
        capability,
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
      }, (value) => {
        callbackBuffer = value;
        return value.toString("utf8");
      });
      expect(result).toBe(secret.toString());
      expect(callbackBuffer).toEqual(Buffer.alloc(secret.length));
      expect(() => fixture.authority.consumeResolve(capability))
        .toThrowError(expect.objectContaining({ code: "vault_replay_detected" }));
    } finally {
      secret.fill(0);
      await fixture.close();
    }
    expect(existsSync(fixture.socketPath)).toBe(false);
  });

  it("supports create/replace/delete while never returning plaintext to control callers", async () => {
    const fixture = await brokerFixture();
    try {
      const firstSecret = Buffer.from("first-control-secret");
      const created = await fixture.control.create({ binding: fixture.binding, secret: firstSecret });
      const secondSecret = Buffer.from("second-control-secret");
      const replaced = await fixture.control.replace({
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
        secret: secondSecret,
      });
      expect(replaced.generation).toBe(2);
      expect(JSON.stringify([created, replaced])).not.toContain("control-secret");
      await expect(fixture.data.resolveForRequest({
        capability: issueResolve(fixture, created.locator, 2),
        locator: created.locator,
        generation: 2,
        binding: fixture.binding,
      }, (value) => value.toString())).resolves.toBe("second-control-secret");
      await expect(fixture.control.delete(created.locator, 1, fixture.binding))
        .rejects.toMatchObject({ code: "vault_record_conflict" });
      await expect(fixture.control.delete(created.locator, 2, fixture.binding)).resolves.toEqual({ deleted: true });
    } finally {
      await fixture.close();
    }
  });

  it("rejects malformed schemas, cross-role operations, wrong caller keys, stale frames, and replay", async () => {
    const fixture = await brokerFixture();
    try {
      const malformed = encodeVaultFrame({
        kind: "request",
        caller: "control_plane",
        operation: "create",
        requestId: randomUUID(),
        payload: { unexpected: true },
        key: fixture.keys.control_plane,
      });
      const malformedResponse = await rawExchange(fixture.socketPath, malformed);
      expect(malformedResponse.toString("utf8")).not.toContain("unexpected");

      const crossRole = encodeVaultFrame({
        kind: "request",
        caller: "control_plane",
        operation: "metadata",
        requestId: randomUUID(),
        payload: {},
        key: fixture.keys.control_plane,
      });
      crossRole[7] = 2; // resolve_for_request is not in the authenticated control caller's matrix.
      resign(crossRole, fixture.keys.control_plane);
      await expect(rawExchange(fixture.socketPath, crossRole)).rejects.toMatchObject({ code: "vault_store_unavailable" });

      const wrongKey = encodeVaultFrame({
        kind: "request",
        caller: "data_plane",
        operation: "readiness",
        requestId: randomUUID(),
        payload: {},
        key: fixture.keys.control_plane,
      });
      await expect(rawExchange(fixture.socketPath, wrongKey)).rejects.toMatchObject({ code: "vault_store_unavailable" });

      const replay = encodeVaultFrame({
        kind: "request",
        caller: "data_plane",
        operation: "readiness",
        requestId: randomUUID(),
        nonce: Buffer.alloc(16, 33),
        payload: {},
        key: fixture.keys.data_plane,
      });
      await rawExchange(fixture.socketPath, replay);
      await expect(rawExchange(fixture.socketPath, replay)).rejects.toMatchObject({ code: "vault_store_unavailable" });

      const stale = encodeVaultFrame({
        kind: "request",
        caller: "backup",
        operation: "readiness",
        requestId: randomUUID(),
        timestampMs: Date.now() - 30_001,
        payload: {},
        key: fixture.keys.backup,
      });
      await expect(rawExchange(fixture.socketPath, stale)).rejects.toMatchObject({ code: "vault_store_unavailable" });
    } finally {
      await fixture.close();
    }
  });

  it("rejects forged, replayed, and cross-locator resolve capabilities", async () => {
    const fixture = await brokerFixture();
    try {
      const first = await fixture.control.create({ binding: fixture.binding, secret: Buffer.from("first-private") });
      const second = await fixture.control.create({ binding: fixture.binding, secret: Buffer.from("second-private") });
      const firstCapability = issueResolve(fixture, first.locator, 1);
      await expect(fixture.data.resolveForRequest({
        capability: firstCapability,
        locator: second.locator,
        generation: 1,
        binding: fixture.binding,
      }, () => "should-not-run")).rejects.toMatchObject({ code: "vault_capability_invalid" });
      await expect(fixture.data.resolveForRequest({
        capability: firstCapability,
        locator: first.locator,
        generation: 1,
        binding: fixture.binding,
      }, () => "should-not-run")).rejects.toMatchObject({ code: "vault_replay_detected" });

      const valid = issueResolve(fixture, first.locator, 1);
      const forged = nonCanonicalSignature(valid);
      await expect(fixture.data.resolveForRequest({
        capability: forged,
        locator: first.locator,
        generation: 1,
        binding: fixture.binding,
      }, () => "should-not-run")).rejects.toMatchObject({ code: "vault_capability_invalid" });
    } finally {
      await fixture.close();
    }
  });

  it("reports unavailable after idempotent lifecycle shutdown", async () => {
    const fixture = await brokerFixture();
    expect(await fixture.control.readiness()).toEqual({ status: "ready", recordCount: 0 });
    await fixture.server.close();
    await fixture.server.close();
    await expect(fixture.control.readiness()).rejects.toMatchObject({ code: "vault_store_unavailable" });
    fixture.control.close();
    fixture.control.close();
    fixture.data.close();
  });

  it("enforces connection, active-work, and five-second incomplete-frame limits", async () => {
    const fixture = await brokerFixture();
    const idleSockets = await Promise.all(Array.from({ length: 32 }, () => openIdleSocket(fixture.socketPath)));
    try {
      await expect(fixture.control.readiness()).rejects.toMatchObject({ code: "vault_store_unavailable" });
    } finally {
      for (const socket of idleSockets) socket.destroy();
    }
    await waitForReadiness(fixture.control);

    const started = Date.now();
    await incompleteExchange(fixture.socketPath);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4_500);
    await fixture.close();

    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    const gated = await brokerFixture({ operationGate: () => gate });
    const requests = Array.from({ length: 9 }, () => encodeVaultFrame({
      kind: "request" as const,
      caller: "data_plane" as const,
      operation: "readiness" as const,
      requestId: randomUUID(),
      payload: {},
      key: gated.keys.data_plane,
    }));
    const pending = requests.map((frame) => rawExchange(gated.socketPath, frame));
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseGate();
    const responses = await Promise.all(pending);
    expect(responses.filter((response) => response.includes(Buffer.from("vault_capacity_exceeded")))).toHaveLength(1);
    await gated.close();
  }, 8_000);
});

interface BrokerFixture {
  socketPath: string;
  keys: { data_plane: Buffer; control_plane: Buffer; backup: Buffer };
  binding: VaultCredentialBinding;
  authority: VaultCapabilityAuthority;
  server: VaultBrokerServer;
  control: ControlVaultClient;
  data: DataVaultClient;
  close: () => Promise<void>;
}

async function brokerFixture(overrides: { operationGate?: () => Promise<void> } = {}): Promise<BrokerFixture> {
  const directory = mkdtempSync(join(tmpdir(), "vault-broker-"));
  chmodSync(directory, 0o700);
  const run = join(directory, "run");
  const storeDirectory = join(directory, "store");
  mkdirSync(run, { mode: 0o700 });
  mkdirSync(storeDirectory, { mode: 0o700 });
  const socketPath = join(run, "vault.sock");
  const keys = {
    data_plane: Buffer.alloc(32, 1),
    control_plane: Buffer.alloc(32, 2),
    backup: Buffer.alloc(32, 3),
  };
  const resolveKey = Buffer.alloc(32, 4);
  const backupKey = Buffer.alloc(32, 5);
  const authority = new VaultCapabilityAuthority({ resolveKey, backupKey });
  const store = new VaultRecordStore({
    directory: storeDirectory,
    activeRootKey: "root-a",
    rootKeys: new Map([["root-a", Buffer.alloc(32, 6)]]),
  });
  const server = new VaultBrokerServer({
    socketPath,
    socketMode: 0o600,
    callerKeys: keys,
    capabilityAuthority: authority,
    store,
    ...(overrides.operationGate === undefined ? {} : { operationGate: overrides.operationGate }),
  });
  await server.listen();
  const control = new ControlVaultClient({ socketPath, key: keys.control_plane });
  const data = new DataVaultClient({ socketPath, key: keys.data_plane });
  const generator = new UuidV7Generator();
  const binding = {
    serviceId: generator.next(),
    destinationId: generator.next(),
    credentialId: generator.next(),
  };
  return {
    socketPath,
    keys,
    binding,
    authority,
    server,
    control,
    data,
    close: async () => {
      control.close();
      data.close();
      await server.close();
    },
  };
}

function issueResolve(fixture: BrokerFixture, locator: string, generation: number): string {
  return fixture.authority.issueResolve({
    subjectId: new UuidV7Generator().next(),
    grantEpoch: 1,
    securityEpoch: 1,
    ...fixture.binding,
    locator,
    generation,
    method: "POST",
    pathDigest: "a".repeat(64),
    requestId: `req_${randomUUID()}`,
    operationDigest: "b".repeat(64),
  });
}

async function rawExchange(socketPath: string, frame: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(Object.assign(new Error("unavailable"), { code: "vault_store_unavailable" }));
    }, 1_000);
    socket.once("connect", () => socket.write(frame));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.once("end", () => {
      clearTimeout(timer);
      const response = Buffer.concat(chunks);
      if (response.length === 0) reject(Object.assign(new Error("unavailable"), { code: "vault_store_unavailable" }));
      else resolve(response);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("unavailable"), { code: "vault_store_unavailable" }));
    });
  });
}

function resign(frame: Buffer, key: Buffer): void {
  createHmac("sha256", key).update(frame.subarray(0, frame.length - 32)).digest().copy(frame, frame.length - 32);
}

function nonCanonicalSignature(token: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = token.at(-1)!;
  const index = alphabet.indexOf(last);
  return `${token.slice(0, -1)}${alphabet[(index & ~3) | ((index + 1) & 3)]}`;
}

function openIdleSocket(socketPath: string): Promise<import("node:net").Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function waitForReadiness(control: ControlVaultClient): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await control.readiness();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error("Broker did not release connection capacity.");
}

function incompleteExchange(socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Broker did not enforce its request deadline."));
    }, 6_000);
    socket.once("connect", () => {
      const prefix = Buffer.alloc(12);
      prefix.write("SSVB", 0, "ascii");
      prefix[4] = 1;
      prefix.writeUInt32BE(100, 8);
      socket.write(prefix);
    });
    socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("error", () => {});
  });
}
