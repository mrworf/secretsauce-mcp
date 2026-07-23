import {
  chmodSync,
  existsSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";
import type { z } from "zod";
import { VaultCapabilityAuthority } from "./capabilities.js";
import {
  createRequestSchema,
  deleteRequestSchema,
  metadataRequestSchema,
  readinessRequestSchema,
  replaceRequestSchema,
  resolveRequestSchema,
} from "./contracts.js";
import { VaultError, vaultError } from "./errors.js";
import {
  decodeVaultFrame,
  encodeVaultFrame,
  MAX_VAULT_FRAME_BYTES,
  type VaultCaller,
  type VaultFrame,
} from "./protocol.js";
import { BoundedReplayCache } from "./replayCache.js";
import { VaultRecordStore } from "./recordStore.js";

const REQUEST_DEADLINE_MS = 5_000;
const MAX_CONNECTIONS = 32;
const MAX_ACTIVE_WORK = 8;
const MIN_FRAME_BYTES = 88;

export interface VaultBrokerOptions {
  socketPath: string;
  socketMode: 0o600 | 0o660;
  callerKeys: Readonly<Record<VaultCaller, Uint8Array>>;
  capabilityAuthority: VaultCapabilityAuthority;
  store: VaultRecordStore;
  /** Deterministic test hook for holding authenticated work without bypassing dispatch. */
  operationGate?: () => Promise<void>;
}

export class VaultBrokerServer {
  readonly #socketPath: string;
  readonly #socketMode: 0o600 | 0o660;
  readonly #callerKeys: Readonly<Record<VaultCaller, Buffer>>;
  readonly #capabilities: VaultCapabilityAuthority;
  readonly #store: VaultRecordStore;
  readonly #operationGate?: () => Promise<void>;
  readonly #replayCache = new BoundedReplayCache();
  readonly #sockets = new Set<Socket>();
  #server: Server | undefined;
  #activeWork = 0;
  #closed = false;

  constructor(options: VaultBrokerOptions) {
    this.#socketPath = options.socketPath;
    this.#socketMode = options.socketMode;
    this.#callerKeys = {
      data_plane: copyKey(options.callerKeys.data_plane),
      control_plane: copyKey(options.callerKeys.control_plane),
      backup: copyKey(options.callerKeys.backup),
    };
    this.#capabilities = options.capabilityAuthority;
    this.#store = options.store;
    if (options.operationGate !== undefined) this.#operationGate = options.operationGate;
  }

  async listen(): Promise<void> {
    if (this.#closed || this.#server !== undefined) throw vaultError("vault_store_unavailable");
    validateSocketParent(this.#socketPath);
    removeStaleSocket(this.#socketPath);
    const server = createServer((socket) => this.#accept(socket));
    this.#server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(this.#socketPath);
      });
      chmodSync(this.#socketPath, this.#socketMode);
      const metadata = lstatSync(this.#socketPath);
      if (!metadata.isSocket() || (metadata.mode & 0o777) !== this.#socketMode || !isAllowedOwner(metadata.uid)) {
        throw vaultError("vault_store_unavailable");
      }
    } catch {
      await this.close();
      throw vaultError("vault_store_unavailable");
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    for (const socket of this.#sockets) socket.destroy();
    const server = this.#server;
    this.#server = undefined;
    if (server !== undefined) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const metadata = lstatSync(this.#socketPath);
      if (metadata.isSocket() && isAllowedOwner(metadata.uid)) unlinkSync(this.#socketPath);
    } catch {
      // The runtime removes Unix sockets on normal close on supported platforms.
    }
    for (const key of Object.values(this.#callerKeys)) key.fill(0);
    this.#store.close();
  }

  #accept(socket: Socket): void {
    if (this.#closed || this.#sockets.size >= MAX_CONNECTIONS) {
      socket.destroy();
      return;
    }
    this.#sockets.add(socket);
    socket.setTimeout(REQUEST_DEADLINE_MS, () => socket.destroy());
    socket.once("close", () => this.#sockets.delete(socket));
    socket.on("error", () => {});

    const chunks: Buffer[] = [];
    let received = 0;
    let expected: number | undefined;
    let handled = false;
    socket.on("data", (chunk: Buffer) => {
      if (handled) {
        socket.destroy();
        return;
      }
      received += chunk.byteLength;
      if (received > MAX_VAULT_FRAME_BYTES) {
        socket.destroy();
        return;
      }
      chunks.push(chunk);
      if (expected === undefined && received >= 12) {
        const prefix = Buffer.concat(chunks, received);
        expected = prefix.readUInt32BE(8);
        if (expected < MIN_FRAME_BYTES || expected > MAX_VAULT_FRAME_BYTES) {
          prefix.fill(0);
          socket.destroy();
          return;
        }
        prefix.fill(0);
      }
      if (expected !== undefined && received > expected) {
        socket.destroy();
        return;
      }
      if (expected !== undefined && received === expected) {
        handled = true;
        socket.pause();
        const frame = Buffer.concat(chunks, received);
        for (const item of chunks) item.fill(0);
        this.#authenticateAndSchedule(socket, frame);
      }
    });
  }

  #authenticateAndSchedule(socket: Socket, bytes: Buffer): void {
    let request: VaultFrame;
    try {
      request = decodeVaultFrame(bytes, {
        keys: this.#callerKeys,
        replayCache: this.#replayCache,
      });
      if (request.kind !== "request") throw vaultError("vault_frame_invalid");
    } catch {
      bytes.fill(0);
      socket.destroy();
      return;
    }
    bytes.fill(0);
    if (this.#activeWork >= MAX_ACTIVE_WORK) {
      this.#respondFailure(socket, request, "vault_capacity_exceeded");
      return;
    }
    this.#activeWork += 1;
    setImmediate(() => void this.#runOperation(socket, request));
  }

  async #runOperation(socket: Socket, request: VaultFrame): Promise<void> {
    try {
      await this.#operationGate?.();
      const result = this.#dispatch(request);
      this.#respondSuccess(socket, request, result);
    } catch (error) {
      const code = error instanceof VaultError ? error.code : "vault_protocol_error";
      this.#respondFailure(socket, request, code);
    } finally {
      this.#activeWork -= 1;
    }
  }

  #dispatch(request: VaultFrame): unknown {
    if (request.operation === "readiness") {
      parse(readinessRequestSchema, request.payload);
      return this.#store.readiness();
    }
    if (request.caller === "control_plane") {
      if (request.operation === "create") {
        const payload = parse(createRequestSchema, request.payload);
        const secret = decodeSecret(payload.secret);
        try {
          return this.#store.create(payload.binding, secret, { captureLastFour: payload.captureLastFour });
        } finally {
          secret.fill(0);
        }
      }
      if (request.operation === "replace") {
        const payload = parse(replaceRequestSchema, request.payload);
        const secret = decodeSecret(payload.secret);
        try {
          return this.#store.replace(
            payload.locator,
            payload.generation,
            payload.binding,
            secret,
            { captureLastFour: payload.captureLastFour },
          );
        } finally {
          secret.fill(0);
        }
      }
      if (request.operation === "delete") {
        const payload = parse(deleteRequestSchema, request.payload);
        this.#store.delete(payload.locator, payload.generation, payload.binding);
        return { deleted: true };
      }
      if (request.operation === "metadata") {
        const payload = parse(metadataRequestSchema, request.payload);
        return this.#store.metadata(payload.locator, payload.binding);
      }
    }
    if (request.caller === "data_plane" && request.operation === "resolve_for_request") {
      const payload = parse(resolveRequestSchema, request.payload);
      const capability = this.#capabilities.consumeResolve(payload.capability);
      if (
        capability.locator !== payload.locator
        || capability.generation !== payload.generation
        || capability.serviceId !== payload.binding.serviceId
        || capability.destinationId !== payload.binding.destinationId
        || capability.credentialId !== payload.binding.credentialId
      ) {
        throw vaultError("vault_capability_invalid");
      }
      const secret = this.#store.resolve(payload.locator, payload.generation, payload.binding);
      try {
        return { secret: secret.toString("base64url") };
      } finally {
        secret.fill(0);
      }
    }
    throw vaultError("vault_operation_denied");
  }

  #respondSuccess(socket: Socket, request: VaultFrame, result: unknown): void {
    this.#respond(socket, request, { ok: true, result });
  }

  #respondFailure(socket: Socket, request: VaultFrame, code: string): void {
    this.#respond(socket, request, { ok: false, error: { code } });
  }

  #respond(socket: Socket, request: VaultFrame, payload: unknown): void {
    let response: Buffer;
    try {
      response = encodeVaultFrame({
        kind: "response",
        caller: request.caller,
        operation: request.operation,
        requestId: request.requestId,
        payload,
        key: this.#callerKeys[request.caller],
      });
    } catch {
      socket.destroy();
      return;
    }
    const clear = (): void => {
      response.fill(0);
    };
    socket.once("close", clear);
    socket.end(response, clear);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_frame_invalid");
  return parsed.data;
}

function decodeSecret(value: string): Buffer {
  const secret = Buffer.from(value, "base64url");
  if (secret.toString("base64url") !== value || secret.byteLength < 1 || secret.byteLength > 65_536) {
    secret.fill(0);
    throw vaultError("vault_frame_invalid");
  }
  return secret;
}

function copyKey(value: Uint8Array): Buffer {
  if (value.byteLength !== 32) throw vaultError("vault_key_invalid");
  return Buffer.from(value);
}

function validateSocketParent(socketPath: string): void {
  try {
    const metadata = lstatSync(dirname(socketPath));
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || (metadata.mode & 0o022) !== 0
      || (metadata.mode & 0o111) === 0
      || !isAllowedOwner(metadata.uid)
    ) {
      throw new Error("unsafe");
    }
  } catch {
    throw vaultError("vault_store_unavailable");
  }
}

function removeStaleSocket(socketPath: string): void {
  if (!existsSync(socketPath)) return;
  try {
    const metadata = lstatSync(socketPath);
    if (!metadata.isSocket() || !isAllowedOwner(metadata.uid)) throw new Error("unsafe");
    unlinkSync(socketPath);
  } catch {
    throw vaultError("vault_store_unavailable");
  }
}

function isAllowedOwner(uid: number): boolean {
  const current = process.getuid?.();
  return current === undefined || uid === current || uid === 0;
}
