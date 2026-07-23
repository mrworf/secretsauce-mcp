import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";
import { canonicalJson } from "./canonicalJson.js";
import { vaultError } from "./errors.js";
import { BoundedReplayCache } from "./replayCache.js";

const MAGIC = Buffer.from("SSVB", "ascii");
const VERSION = 1;
const HEADER_BYTES = 56;
const MAC_BYTES = 32;
export const MAX_VAULT_FRAME_BYTES = 1024 * 1024;
export const MAX_VAULT_PAYLOAD_BYTES = MAX_VAULT_FRAME_BYTES - HEADER_BYTES - MAC_BYTES;
export const FRAME_FRESHNESS_MS = 30_000;

export const VAULT_CALLERS = {
  data_plane: 1,
  control_plane: 2,
  backup: 3,
} as const;
export type VaultCaller = keyof typeof VAULT_CALLERS;

export const VAULT_OPERATIONS = {
  readiness: 1,
  resolve_for_request: 2,
  create: 3,
  replace: 4,
  delete: 5,
  metadata: 6,
  export_encrypted: 7,
  import_encrypted: 8,
} as const;
export type VaultOperation = keyof typeof VAULT_OPERATIONS;

const allowedOperations: Record<VaultCaller, ReadonlySet<VaultOperation>> = {
  data_plane: new Set(["readiness", "resolve_for_request"]),
  control_plane: new Set(["readiness", "create", "replace", "delete", "metadata"]),
  backup: new Set(["readiness", "export_encrypted", "import_encrypted"]),
};
const callersByCode = reverse(VAULT_CALLERS);
const operationsByCode = reverse(VAULT_OPERATIONS);

export interface VaultFrame<T = unknown> {
  kind: "request" | "response";
  caller: VaultCaller;
  operation: VaultOperation;
  requestId: string;
  timestampMs: number;
  nonce: Buffer;
  payload: T;
}

export interface EncodeVaultFrameOptions<T> extends Omit<VaultFrame<T>, "timestampMs" | "nonce"> {
  key: Uint8Array;
  timestampMs?: number;
  nonce?: Uint8Array;
}

export interface DecodeVaultFrameOptions {
  keys: Readonly<Record<VaultCaller, Uint8Array>>;
  replayCache: BoundedReplayCache;
  now?: number;
}

export function isOperationAllowed(caller: VaultCaller, operation: VaultOperation): boolean {
  return allowedOperations[caller].has(operation);
}

export function encodeVaultFrame<T>(options: EncodeVaultFrameOptions<T>): Buffer {
  validateKey(options.key);
  if (!isOperationAllowed(options.caller, options.operation)) throw vaultError("vault_frame_invalid");
  const requestId = uuidToBytes(options.requestId);
  const timestampMs = options.timestampMs ?? Date.now();
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) throw vaultError("vault_frame_invalid");
  const nonce = Buffer.from(options.nonce ?? randomBytes(16));
  if (nonce.byteLength !== 16) throw vaultError("vault_frame_invalid");
  let payload: Buffer;
  try {
    payload = Buffer.from(canonicalJson(options.payload), "utf8");
  } catch {
    throw vaultError("vault_frame_invalid");
  }
  if (payload.byteLength > MAX_VAULT_PAYLOAD_BYTES) throw vaultError("vault_frame_invalid");
  const totalLength = HEADER_BYTES + payload.byteLength + MAC_BYTES;
  const frame = Buffer.allocUnsafe(totalLength);
  MAGIC.copy(frame, 0);
  frame[4] = VERSION;
  frame[5] = options.kind === "request" ? 0 : 1;
  frame[6] = VAULT_CALLERS[options.caller];
  frame[7] = VAULT_OPERATIONS[options.operation];
  frame.writeUInt32BE(totalLength, 8);
  requestId.copy(frame, 12);
  frame.writeBigUInt64BE(BigInt(timestampMs), 28);
  nonce.copy(frame, 36);
  frame.writeUInt32BE(payload.byteLength, 52);
  payload.copy(frame, HEADER_BYTES);
  createHmac("sha256", options.key).update(frame.subarray(0, totalLength - MAC_BYTES)).digest().copy(frame, totalLength - MAC_BYTES);
  return frame;
}

export function decodeVaultFrame<T = unknown>(frame: Uint8Array, options: DecodeVaultFrameOptions): VaultFrame<T> {
  const bytes = Buffer.from(frame);
  if (bytes.byteLength < HEADER_BYTES + MAC_BYTES || bytes.byteLength > MAX_VAULT_FRAME_BYTES) {
    throw vaultError("vault_frame_invalid");
  }
  if (!bytes.subarray(0, 4).equals(MAGIC) || bytes[4] !== VERSION || (bytes[5] !== 0 && bytes[5] !== 1)) {
    throw vaultError("vault_frame_invalid");
  }
  const caller = callersByCode.get(bytes[6] ?? -1);
  const operation = operationsByCode.get(bytes[7] ?? -1);
  if (caller === undefined || operation === undefined || !isOperationAllowed(caller, operation)) {
    throw vaultError("vault_frame_invalid");
  }
  const totalLength = bytes.readUInt32BE(8);
  const payloadLength = bytes.readUInt32BE(52);
  if (totalLength !== bytes.byteLength || payloadLength !== totalLength - HEADER_BYTES - MAC_BYTES) {
    throw vaultError("vault_frame_invalid");
  }
  const key = options.keys[caller];
  validateKey(key);
  const expectedMac = createHmac("sha256", key).update(bytes.subarray(0, totalLength - MAC_BYTES)).digest();
  if (!timingSafeEqual(expectedMac, bytes.subarray(totalLength - MAC_BYTES))) {
    throw vaultError("vault_authentication_failed");
  }

  const now = options.now ?? Date.now();
  const timestampBig = bytes.readBigUInt64BE(28);
  if (timestampBig > BigInt(Number.MAX_SAFE_INTEGER)) throw vaultError("vault_request_stale");
  const timestampMs = Number(timestampBig);
  if (Math.abs(now - timestampMs) > FRAME_FRESHNESS_MS) throw vaultError("vault_request_stale");
  const nonce = Buffer.from(bytes.subarray(36, 52));
  options.replayCache.consume(`${caller}:${nonce.toString("hex")}`, timestampMs + FRAME_FRESHNESS_MS + 1, now);

  const payloadBytes = bytes.subarray(HEADER_BYTES, totalLength - MAC_BYTES);
  let payload: unknown;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
    payload = JSON.parse(source);
    if (canonicalJson(payload) !== source) throw new Error("Non-canonical JSON.");
  } catch {
    throw vaultError("vault_frame_invalid");
  }
  return {
    kind: bytes[5] === 0 ? "request" : "response",
    caller,
    operation,
    requestId: bytesToUuid(bytes.subarray(12, 28)),
    timestampMs,
    nonce,
    payload: payload as T,
  };
}

function reverse<T extends string>(value: Readonly<Record<T, number>>): Map<number, T> {
  return new Map(Object.entries(value).map(([name, code]) => [code as number, name as T]));
}

function validateKey(key: Uint8Array): void {
  if (key.byteLength !== 32) throw vaultError("vault_key_invalid");
}

function uuidToBytes(value: string): Buffer {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw vaultError("vault_frame_invalid");
  }
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function bytesToUuid(value: Uint8Array): string {
  const hex = Buffer.from(value).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
