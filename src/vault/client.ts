import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import type { z } from "zod";
import {
  createResultSchema,
  deleteResultSchema,
  transferFinishResultSchema,
  transferReadResultSchema,
  transferStartResultSchema,
  transferWriteResultSchema,
  failureResponseSchema,
  metadataResultSchema,
  readinessResultSchema,
  replaceResultSchema,
  resolveResultSchema,
  successResponseSchema,
} from "./contracts.js";
import { VaultError, vaultError, type VaultErrorCode } from "./errors.js";
import {
  decodeVaultFrame,
  encodeVaultFrame,
  MAX_VAULT_FRAME_BYTES,
  type VaultCaller,
  type VaultOperation,
} from "./protocol.js";
import { BoundedReplayCache } from "./replayCache.js";
import type { VaultCredentialBinding, VaultRecordMetadata } from "./recordStore.js";

const REQUEST_DEADLINE_MS = 5_000;
const MIN_FRAME_BYTES = 88;

export interface VaultClientOptions {
  socketPath: string;
  key: Uint8Array;
}

export interface ControlCreateInput {
  binding: VaultCredentialBinding;
  secret: Uint8Array;
  captureLastFour?: boolean;
}

export interface ControlReplaceInput extends ControlCreateInput {
  locator: string;
  generation: number;
}

export interface VaultResolveInput {
  capability: string;
  locator: string;
  generation: number;
  binding: VaultCredentialBinding;
}

export class VaultRemoteError extends VaultError {
  constructor(code: VaultErrorCode) {
    super(code, "Vault operation failed.");
    this.name = "VaultRemoteError";
  }
}

abstract class VaultClient {
  readonly #socketPath: string;
  readonly #key: Buffer;
  readonly #caller: VaultCaller;
  readonly #replayCache = new BoundedReplayCache();
  #closed = false;

  constructor(caller: VaultCaller, options: VaultClientOptions) {
    if (options.key.byteLength !== 32) throw vaultError("vault_key_invalid");
    this.#socketPath = options.socketPath;
    this.#key = Buffer.from(options.key);
    this.#caller = caller;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#key.fill(0);
  }

  protected async readinessRequest(): Promise<z.infer<typeof readinessResultSchema>> {
    return this.request("readiness", {}, readinessResultSchema);
  }

  protected async request<T>(operation: VaultOperation, payload: unknown, resultSchema: z.ZodType<T>): Promise<T> {
    if (this.#closed) throw vaultError("vault_store_unavailable");
    const requestId = randomUUID();
    const frame = encodeVaultFrame({
      kind: "request",
      caller: this.#caller,
      operation,
      requestId,
      payload,
      key: this.#key,
    });
    let responseBytes: Buffer;
    try {
      responseBytes = await exchange(this.#socketPath, frame);
    } finally {
      frame.fill(0);
    }
    try {
      const response = decodeVaultFrame(responseBytes, {
        keys: {
          data_plane: this.#caller === "data_plane" ? this.#key : zeroKey,
          control_plane: this.#caller === "control_plane" ? this.#key : zeroKey,
          backup: this.#caller === "backup" ? this.#key : zeroKey,
        },
        replayCache: this.#replayCache,
      });
      if (
        response.kind !== "response"
        || response.caller !== this.#caller
        || response.operation !== operation
        || response.requestId !== requestId
      ) {
        throw vaultError("vault_protocol_error");
      }
      const failure = failureResponseSchema.safeParse(response.payload);
      if (failure.success) throw remoteError(failure.data.error.code);
      const success = successResponseSchema.safeParse(response.payload);
      if (!success.success) throw vaultError("vault_protocol_error");
      const result = resultSchema.safeParse(success.data.result);
      if (!result.success) throw vaultError("vault_protocol_error");
      return result.data;
    } finally {
      responseBytes.fill(0);
    }
  }
}

const zeroKey = Buffer.alloc(32);

export class ControlVaultClient extends VaultClient {
  constructor(options: VaultClientOptions) {
    super("control_plane", options);
  }

  readiness(): Promise<z.infer<typeof readinessResultSchema>> {
    return this.readinessRequest();
  }

  create(input: ControlCreateInput): Promise<z.infer<typeof createResultSchema>> {
    return this.request("create", {
      binding: input.binding,
      secret: asBufferView(input.secret).toString("base64url"),
      captureLastFour: input.captureLastFour ?? false,
    }, createResultSchema);
  }

  replace(input: ControlReplaceInput): Promise<VaultRecordMetadata> {
    return this.request("replace", {
      locator: input.locator,
      generation: input.generation,
      binding: input.binding,
      secret: asBufferView(input.secret).toString("base64url"),
      captureLastFour: input.captureLastFour ?? false,
    }, replaceResultSchema);
  }

  delete(locator: string, generation: number, binding: VaultCredentialBinding): Promise<{ deleted: true }> {
    return this.request("delete", { locator, generation, binding }, deleteResultSchema);
  }

  metadata(locator: string, binding: VaultCredentialBinding): Promise<VaultRecordMetadata> {
    return this.request("metadata", { locator, binding }, metadataResultSchema);
  }
}

export class DataVaultClient extends VaultClient {
  constructor(options: VaultClientOptions) {
    super("data_plane", options);
  }

  readiness(): Promise<z.infer<typeof readinessResultSchema>> {
    return this.readinessRequest();
  }

  async resolveForRequest<T>(input: VaultResolveInput, callback: (secret: Buffer) => T | Promise<T>): Promise<T> {
    const result = await this.request("resolve_for_request", input, resolveResultSchema);
    const secret = Buffer.from(result.secret, "base64url");
    try {
      return await callback(secret);
    } finally {
      secret.fill(0);
    }
  }
}

export class BackupVaultClient extends VaultClient {
  constructor(options: VaultClientOptions) {
    super("backup", options);
  }

  readiness(): Promise<z.infer<typeof readinessResultSchema>> {
    return this.readinessRequest();
  }

  async exportEncrypted(capability: string, passphraseValue: Uint8Array): Promise<Buffer> {
    const passphrase = asBufferView(passphraseValue).toString("base64url");
    const start = await this.request("export_encrypted", {
      action: "start",
      capability,
      passphrase,
    }, transferStartResultSchema);
    const chunks: Buffer[] = [];
    let total = 0;
    let sequence = 0;
    try {
      while (true) {
        const result = await this.request("export_encrypted", {
          action: "read",
          transferId: start.transferId,
          transferToken: capability,
          sequence,
        }, transferReadResultSchema);
        const chunk = Buffer.from(result.chunk, "base64url");
        chunks.push(chunk);
        total += chunk.byteLength;
        if (total > 1024 * 1024 * 1024) throw vaultError("vault_archive_invalid");
        sequence += 1;
        if (result.done) break;
      }
      if (start.totalBytes !== undefined && start.totalBytes !== total) throw vaultError("vault_protocol_error");
      return Buffer.concat(chunks, total);
    } finally {
      for (const chunk of chunks) chunk.fill(0);
    }
  }

  async importEncrypted(capability: string, passphraseValue: Uint8Array, archiveValue: Uint8Array): Promise<void> {
    if (archiveValue.byteLength < 1 || archiveValue.byteLength > 1024 * 1024 * 1024) {
      throw vaultError("vault_archive_invalid");
    }
    const start = await this.request("import_encrypted", {
      action: "start",
      capability,
    }, transferStartResultSchema);
    let sequence = 0;
    for (let offset = 0; offset < archiveValue.byteLength; offset += start.chunkBytes) {
      const end = Math.min(archiveValue.byteLength, offset + start.chunkBytes);
      const chunk = asBufferView(archiveValue.subarray(offset, end)).toString("base64url");
      const result = await this.request("import_encrypted", {
        action: "write",
        transferId: start.transferId,
        transferToken: capability,
        sequence,
        chunk,
      }, transferWriteResultSchema);
      if (result.nextSequence !== sequence + 1) throw vaultError("vault_protocol_error");
      sequence += 1;
    }
    await this.request("import_encrypted", {
      action: "finish",
      transferId: start.transferId,
      transferToken: capability,
      sequence,
      passphrase: asBufferView(passphraseValue).toString("base64url"),
    }, transferFinishResultSchema);
  }
}

async function exchange(socketPath: string, request: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const socket = createConnection(socketPath);
    const chunks: Buffer[] = [];
    let received = 0;
    let expected: number | undefined;
    let settled = false;
    const fail = (): void => {
      if (settled) return;
      settled = true;
      for (const chunk of chunks) chunk.fill(0);
      socket.destroy();
      reject(vaultError("vault_store_unavailable"));
    };
    socket.setTimeout(REQUEST_DEADLINE_MS, fail);
    socket.once("error", fail);
    socket.once("connect", () => socket.write(request));
    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      received += chunk.byteLength;
      if (received > MAX_VAULT_FRAME_BYTES) return fail();
      chunks.push(chunk);
      if (expected === undefined && received >= 12) {
        const prefix = Buffer.concat(chunks, received);
        expected = prefix.readUInt32BE(8);
        prefix.fill(0);
        if (expected < MIN_FRAME_BYTES || expected > MAX_VAULT_FRAME_BYTES) return fail();
      }
      if (expected !== undefined && received > expected) return fail();
      if (expected !== undefined && received === expected) {
        settled = true;
        const response = Buffer.concat(chunks, received);
        for (const item of chunks) item.fill(0);
        socket.end();
        resolve(response);
      }
    });
    socket.once("end", () => {
      if (!settled) fail();
    });
  });
}

function remoteError(code: string): VaultRemoteError {
  const known: VaultErrorCode[] = [
    "vault_config_invalid",
    "vault_key_invalid",
    "vault_frame_invalid",
    "vault_authentication_failed",
    "vault_request_stale",
    "vault_replay_detected",
    "vault_capacity_exceeded",
    "vault_capability_invalid",
    "vault_store_unavailable",
    "vault_record_invalid",
    "vault_record_conflict",
    "vault_record_not_found",
    "vault_protocol_error",
    "vault_operation_denied",
    "vault_archive_invalid",
    "vault_archive_authentication_failed",
  ];
  return new VaultRemoteError(known.includes(code as VaultErrorCode) ? code as VaultErrorCode : "vault_protocol_error");
}

function asBufferView(value: Uint8Array): Buffer {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
