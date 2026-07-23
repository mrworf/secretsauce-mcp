import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeVaultFrame,
  encodeVaultFrame,
  FRAME_FRESHNESS_MS,
  isOperationAllowed,
  MAX_VAULT_FRAME_BYTES,
  MAX_VAULT_PAYLOAD_BYTES,
  type VaultCaller,
  type VaultOperation,
} from "../src/vault/protocol.js";
import { BoundedReplayCache } from "../src/vault/replayCache.js";

const now = 1_800_000_000_000;
const keys = {
  data_plane: Buffer.alloc(32, 1),
  control_plane: Buffer.alloc(32, 2),
  backup: Buffer.alloc(32, 3),
};

describe("vault authenticated binary protocol", () => {
  it("round-trips the authenticated original bytes at minimum and maximum size", () => {
    const requestId = randomUUID();
    const nonce = Buffer.alloc(16, 9);
    const minimum = encodeVaultFrame({
      kind: "request",
      caller: "control_plane",
      operation: "metadata",
      requestId,
      timestampMs: now,
      nonce,
      payload: {},
      key: keys.control_plane,
    });
    const decoded = decodeVaultFrame(minimum, { keys, replayCache: new BoundedReplayCache(), now });
    expect(decoded).toMatchObject({
      kind: "request",
      caller: "control_plane",
      operation: "metadata",
      requestId,
      timestampMs: now,
      payload: {},
    });
    expect(decoded.nonce).toEqual(nonce);

    const maximum = encodeVaultFrame({
      kind: "request",
      caller: "control_plane",
      operation: "create",
      requestId: randomUUID(),
      timestampMs: now,
      payload: "x".repeat(MAX_VAULT_PAYLOAD_BYTES - 2),
      key: keys.control_plane,
    });
    expect(maximum).toHaveLength(MAX_VAULT_FRAME_BYTES);
    expect(decodeVaultFrame(maximum, { keys, replayCache: new BoundedReplayCache(), now }).payload)
      .toHaveLength(MAX_VAULT_PAYLOAD_BYTES - 2);
  });

  it("enforces the exact caller/operation matrix", () => {
    const allowed: Record<VaultCaller, VaultOperation[]> = {
      data_plane: ["readiness", "resolve_for_request"],
      control_plane: ["readiness", "create", "replace", "delete", "metadata"],
      backup: ["readiness", "export_encrypted", "import_encrypted"],
    };
    const operations = ["readiness", "resolve_for_request", "create", "replace", "delete", "metadata", "export_encrypted", "import_encrypted"] as const;
    for (const caller of Object.keys(allowed) as VaultCaller[]) {
      for (const operation of operations) {
        expect(isOperationAllowed(caller, operation)).toBe(allowed[caller].includes(operation));
      }
    }
    expect(() => encodeVaultFrame({
      kind: "request",
      caller: "data_plane",
      operation: "create",
      requestId: randomUUID(),
      payload: {},
      key: keys.data_plane,
    })).toThrowError(expect.objectContaining({ code: "vault_frame_invalid" }));
  });

  it("rejects bad MACs, stale frames, replayed nonces, length disagreements, and unknown fields", () => {
    const frame = encodeVaultFrame({
      kind: "request",
      caller: "data_plane",
      operation: "readiness",
      requestId: randomUUID(),
      timestampMs: now,
      nonce: Buffer.alloc(16, 4),
      payload: {},
      key: keys.data_plane,
    });
    const badMac = Buffer.from(frame);
    badMac[badMac.length - 1] ^= 1;
    expect(() => decodeVaultFrame(badMac, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_authentication_failed" }));
    expect(() => decodeVaultFrame(frame, { keys, replayCache: new BoundedReplayCache(), now: now + FRAME_FRESHNESS_MS + 1 }))
      .toThrowError(expect.objectContaining({ code: "vault_request_stale" }));

    const replay = new BoundedReplayCache();
    decodeVaultFrame(frame, { keys, replayCache: replay, now });
    expect(() => decodeVaultFrame(frame, { keys, replayCache: replay, now }))
      .toThrowError(expect.objectContaining({ code: "vault_replay_detected" }));

    const badLength = resign(Buffer.from(frame), keys.data_plane, (value) => value.writeUInt32BE(value.length + 1, 8));
    expect(() => decodeVaultFrame(badLength, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_frame_invalid" }));
    const unknownFlags = resign(Buffer.from(frame), keys.data_plane, (value) => { value[5] = 2; });
    expect(() => decodeVaultFrame(unknownFlags, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_frame_invalid" }));
  });

  it("authenticates before parsing and rejects non-canonical or invalid UTF-8 JSON", () => {
    const frame = encodeVaultFrame({
      kind: "request",
      caller: "backup",
      operation: "readiness",
      requestId: randomUUID(),
      timestampMs: now,
      payload: { a: 1 },
      key: keys.backup,
    });
    const unauthenticated = Buffer.from(frame);
    unauthenticated[56] = 0xff;
    expect(() => decodeVaultFrame(unauthenticated, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_authentication_failed" }));

    const invalidUtf8 = resign(Buffer.from(frame), keys.backup, (value) => { value[56] = 0xff; });
    expect(() => decodeVaultFrame(invalidUtf8, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_frame_invalid" }));

    const nonCanonical = frameWithPayload(frame, Buffer.from('{"a": 1}', "utf8"), keys.backup);
    expect(() => decodeVaultFrame(nonCanonical, { keys, replayCache: new BoundedReplayCache(), now }))
      .toThrowError(expect.objectContaining({ code: "vault_frame_invalid" }));
  });

  it("bounds replay-cache capacity and reclaims expired entries", () => {
    const cache = new BoundedReplayCache(1);
    cache.consume("first", now + 10, now);
    expect(() => cache.consume("second", now + 10, now))
      .toThrowError(expect.objectContaining({ code: "vault_capacity_exceeded" }));
    cache.consume("second", now + 20, now + 10);
    expect(cache.size).toBe(1);
  });
});

function resign(frame: Buffer, key: Buffer, mutate: (value: Buffer) => void): Buffer {
  mutate(frame);
  createHmac("sha256", key).update(frame.subarray(0, frame.length - 32)).digest().copy(frame, frame.length - 32);
  return frame;
}

function frameWithPayload(original: Buffer, payload: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(56 + payload.length + 32);
  original.copy(result, 0, 0, 56);
  result.writeUInt32BE(result.length, 8);
  result.writeUInt32BE(payload.length, 52);
  payload.copy(result, 56);
  return resign(result, key, () => {});
}
