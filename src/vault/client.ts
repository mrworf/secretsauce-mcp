import { randomBytes, randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import type { z } from "zod";
import {
  createResultSchema,
  deleteResultSchema,
  replaceEmptyResultSchema,
  restoreTransferFinishResultSchema,
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
  signVaultHttpRequest,
  verifyVaultHttpResponse,
} from "./httpProtocol.js";
import type { VaultCaller, VaultOperation } from "./protocol.js";
import type { VaultCredentialBinding, VaultRecordMetadata } from "./recordStore.js";
import type { VaultBackupSelection } from "./backupSelection.js";
import {
  sameVaultSocketEndpoint,
  validateVaultSocketEndpoint,
} from "./socketEndpoint.js";

const REQUEST_DEADLINE_MS = 5_000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const JSON_MEDIA = "application/json";
const SECRET_MEDIA = "application/vnd.secretsauce.vault-secret+octet-stream";

export interface VaultClientOptions {
  socketPath: string;
  key: Uint8Array;
}

export async function readVaultProvisioningStatus(
  socketPath: string,
): Promise<"ready" | "preparing" | "configuration_error"> {
  const endpoint = validateVaultSocketEndpoint(socketPath);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      socketPath,
      method: "GET",
      path: "/v1/status",
      headers: { host: "localhost" },
      timeout: REQUEST_DEADLINE_MS,
      setDefaultHeaders: false,
    }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer) => {
        received += chunk.byteLength;
        if (received > 4096) request.destroy();
        else chunks.push(chunk);
      });
      response.once("end", () => {
        const body = Buffer.concat(chunks, received);
        for (const chunk of chunks) chunk.fill(0);
        try {
          if (response.statusCode !== 200) throw new Error("unavailable");
          const parsed = parseJson(body) as Record<string, unknown>;
          if (
            !["ready", "preparing", "configuration_error"].includes(
              String(parsed.state),
            )
            || typeof parsed.retry_pending !== "boolean"
            || Object.keys(parsed).some((key) =>
              !["state", "retry_pending", "error_category"].includes(key)
            )
          ) throw new Error("invalid");
          resolve(parsed.state as "ready" | "preparing" | "configuration_error");
        } catch {
          reject(vaultError("vault_store_unavailable"));
        } finally {
          body.fill(0);
        }
      });
    });
    const fail = (): void => {
      request.destroy();
      reject(vaultError("vault_store_unavailable"));
    };
    request.once("socket", () => {
      if (!sameVaultSocketEndpoint(socketPath, endpoint)) fail();
    });
    request.once("timeout", fail);
    request.once("error", fail);
    request.end();
  });
}

export interface ControlCreateInput {
  binding: VaultCredentialBinding;
  secret: Uint8Array;
  locator?: string;
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
  #bootId: string | undefined;
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

  get bootId(): string | undefined {
    return this.#bootId;
  }

  protected async readinessRequest(): Promise<z.infer<typeof readinessResultSchema>> {
    return this.request("readiness", {}, readinessResultSchema);
  }

  protected async request<T>(operation: VaultOperation, payload: unknown, resultSchema: z.ZodType<T>): Promise<T> {
    if (this.#closed) throw vaultError("vault_store_unavailable");
    if (operation !== "readiness" && this.#bootId === undefined) {
      await this.request("readiness", {}, readinessResultSchema);
    }
    const requestId = randomUUID();
    const spec = requestSpec(operation, payload);
    const timestamp = String(Date.now());
    const nonce = randomBytes(16).toString("base64url");
    const authentication = {
      caller: this.#caller,
      method: spec.method,
      target: spec.target,
      contentType: spec.contentType,
      body: spec.body,
      requestId,
      timestamp,
      nonce,
      ...(operation === "readiness" ? {} : { bootId: this.#bootId! }),
      representationHeaders: spec.headers,
    } as const;
    const requestMac = signVaultHttpRequest(authentication, this.#key);
    const response = await exchange(this.#socketPath, spec, {
      "x-vault-caller": this.#caller,
      "x-vault-request-id": requestId,
      "x-vault-timestamp": timestamp,
      "x-vault-nonce": nonce,
      "x-vault-request-mac": requestMac,
      ...(operation === "readiness" ? {} : { "x-vault-boot-id": this.#bootId! }),
    });
    try {
      const responseBootId = singleResponseHeader(response.headers, "x-vault-boot-id");
      const responseMac = singleResponseHeader(response.headers, "x-vault-response-mac");
      const responseContentType = normalizedResponseContentType(response.headers);
      verifyVaultHttpResponse({
        caller: this.#caller,
        bootId: responseBootId,
        requestId,
        status: response.status,
        contentType: responseContentType,
        body: response.body,
      }, responseMac, this.#key);
      if (operation !== "readiness" && responseBootId !== this.#bootId) {
        throw vaultError("vault_authentication_failed");
      }
      let decoded: unknown;
      if (responseContentType === SECRET_MEDIA) {
        decoded = { secret: response.body.toString("base64url") };
      } else if (responseContentType === JSON_MEDIA) {
        decoded = parseJson(response.body);
      } else {
        throw vaultError("vault_protocol_error");
      }
      const failure = failureResponseSchema.safeParse(decoded);
      if (failure.success) throw remoteError(failure.data.error.code);
      if (response.status < 200 || response.status > 299) {
        throw vaultError("vault_protocol_error");
      }
      if (operation === "readiness") {
        const readiness = decoded as Record<string, unknown>;
        if (readiness.boot_id !== responseBootId) throw vaultError("vault_protocol_error");
        this.#bootId = responseBootId;
        decoded = {
          status: readiness.status,
          recordCount: readiness.recordCount,
        };
      }
      const result = resultSchema.safeParse(decoded);
      if (!result.success) throw vaultError("vault_protocol_error");
      return result.data;
    } finally {
      response.body.fill(0);
      spec.body.fill(0);
    }
  }
}

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
      ...(input.locator === undefined ? {} : { locator: input.locator }),
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

  async exportEncrypted(
    capability: string,
    passphraseValue: Uint8Array,
    selection: readonly VaultBackupSelection[],
  ): Promise<Buffer> {
    return this.exportArchive(capability, passphraseValue, selection);
  }

  exportRecovery(
    capability: string,
    passphraseValue: Uint8Array,
  ): Promise<Buffer> {
    return this.exportArchive(capability, passphraseValue);
  }

  private async exportArchive(
    capability: string,
    passphraseValue: Uint8Array,
    selection?: readonly VaultBackupSelection[],
  ): Promise<Buffer> {
    const passphrase = asBufferView(passphraseValue).toString("base64url");
    const start = await this.request("export_encrypted", {
      action: "start",
      capability,
      passphrase,
      ...(selection === undefined ? {} : { selection }),
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
    await this.importArchive(
      capability,
      passphraseValue,
      archiveValue,
      transferFinishResultSchema,
    );
  }

  async validateRestore(
    capability: string,
    passphraseValue: Uint8Array,
    archiveValue: Uint8Array,
    selection: readonly VaultBackupSelection[],
  ): Promise<{ validated: true; recordCount: number }> {
    const result = await this.importArchive(
      capability,
      passphraseValue,
      archiveValue,
      restoreTransferFinishResultSchema,
      selection,
    );
    if (!("validated" in result)) throw vaultError("vault_protocol_error");
    return result;
  }

  async replaceRestore(
    capability: string,
    passphraseValue: Uint8Array,
    archiveValue: Uint8Array,
    selection: readonly VaultBackupSelection[],
  ): Promise<{ replaced: true; recordCount: number }> {
    const result = await this.importArchive(
      capability,
      passphraseValue,
      archiveValue,
      restoreTransferFinishResultSchema,
      selection,
    );
    if (!("replaced" in result)) throw vaultError("vault_protocol_error");
    return result;
  }

  async importRecovery(
    capability: string,
    passphraseValue: Uint8Array,
    archiveValue: Uint8Array,
  ): Promise<void> {
    await this.importArchive(
      capability,
      passphraseValue,
      archiveValue,
      transferFinishResultSchema,
    );
  }

  replaceEmpty(
    capability: string,
  ): Promise<{ replaced: true; recordCount: 0 }> {
    return this.request(
      "replace_empty",
      { capability },
      replaceEmptyResultSchema,
    );
  }

  private async importArchive<T>(
    capability: string,
    passphraseValue: Uint8Array,
    archiveValue: Uint8Array,
    resultSchema: z.ZodType<T>,
    selection?: readonly VaultBackupSelection[],
  ): Promise<T> {
    if (archiveValue.byteLength < 1 || archiveValue.byteLength > 1024 * 1024 * 1024) {
      throw vaultError("vault_archive_invalid");
    }
    const start = await this.request("import_encrypted", {
      action: "start",
      capability,
      ...(selection === undefined ? {} : { selection }),
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
    return this.request("import_encrypted", {
      action: "finish",
      transferId: start.transferId,
      transferToken: capability,
      sequence,
      passphrase: asBufferView(passphraseValue).toString("base64url"),
    }, resultSchema);
  }
}

interface HttpRequestSpec {
  method: string;
  target: string;
  contentType: string;
  body: Buffer;
  headers: Record<string, string>;
}

interface HttpResponse {
  status: number;
  headers: NodeJS.Dict<string | string[]>;
  body: Buffer;
}

function requestSpec(operation: VaultOperation, payloadValue: unknown): HttpRequestSpec {
  const payload = payloadValue as Record<string, unknown>;
  if (operation === "readiness") return jsonSpec("POST", "/v1/readiness", {});
  if (operation === "create" || operation === "replace") {
    const secret = canonicalBase64Body(payload.secret);
    const binding = clientBinding(payload.binding);
    const headers = {
      "x-vault-service-id": binding.serviceId,
      "x-vault-destination-id": binding.destinationId,
      "x-vault-credential-id": binding.credentialId,
      "x-vault-capture-last-four": String(payload.captureLastFour === true),
      ...(operation === "create" && typeof payload.locator === "string"
        ? { "x-vault-requested-locator": payload.locator }
        : {}),
      ...(operation === "replace"
        ? { "x-vault-expected-generation": String(payload.generation) }
        : {}),
    };
    return {
      method: operation === "create" ? "POST" : "PUT",
      target: operation === "create"
        ? "/v1/credentials"
        : `/v1/credentials/${String(payload.locator)}`,
      contentType: SECRET_MEDIA,
      body: secret,
      headers,
    };
  }
  if (operation === "delete" || operation === "metadata") {
    const binding = clientBinding(payload.binding);
    return {
      method: operation === "delete" ? "DELETE" : "GET",
      target: `/v1/credentials/${String(payload.locator)}`,
      contentType: JSON_MEDIA,
      body: Buffer.alloc(0),
      headers: {
        "x-vault-service-id": binding.serviceId,
        "x-vault-destination-id": binding.destinationId,
        "x-vault-credential-id": binding.credentialId,
        ...(operation === "delete"
          ? { "x-vault-expected-generation": String(payload.generation) }
          : {}),
      },
    };
  }
  if (operation === "resolve_for_request") {
    const { capability, ...body } = payload;
    return jsonSpec("POST", "/v1/resolutions", body, {
      "x-vault-capability": String(capability),
    });
  }
  if (operation === "replace_empty") {
    return jsonSpec("POST", "/v1/transfers", { action: "replace_empty" }, {
      "x-vault-capability": String(payload.capability),
    });
  }
  if (operation === "export_encrypted") {
    if (payload.action === "start") {
      const { capability, action: _action, ...body } = payload;
      return jsonSpec("POST", "/v1/transfers", {
        direction: "export",
        ...body,
      }, { "x-vault-capability": String(capability) });
    }
    return {
      method: "GET",
      target: `/v1/transfers/${String(payload.transferId)}?sequence=${String(payload.sequence)}`,
      contentType: JSON_MEDIA,
      body: Buffer.alloc(0),
      headers: { "x-vault-capability": String(payload.transferToken) },
    };
  }
  if (operation === "import_encrypted") {
    if (payload.action === "start") {
      const { capability, action: _action, ...body } = payload;
      return jsonSpec("POST", "/v1/transfers", {
        direction: "import",
        ...body,
      }, { "x-vault-capability": String(capability) });
    }
    const { transferId, transferToken, action, ...body } = payload;
    return jsonSpec(
      action === "write" ? "PUT" : "POST",
      action === "write"
        ? `/v1/transfers/${String(transferId)}`
        : `/v1/transfers/${String(transferId)}`,
      body,
      { "x-vault-capability": String(transferToken) },
    );
  }
  throw vaultError("vault_operation_denied");
}

function jsonSpec(
  method: string,
  target: string,
  value: unknown,
  headers: Record<string, string> = {},
): HttpRequestSpec {
  return {
    method,
    target,
    contentType: JSON_MEDIA,
    body: Buffer.from(JSON.stringify(value), "utf8"),
    headers,
  };
}

function canonicalBase64Body(value: unknown): Buffer {
  if (typeof value !== "string") throw vaultError("vault_protocol_error");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    decoded.fill(0);
    throw vaultError("vault_protocol_error");
  }
  return decoded;
}

function clientBinding(value: unknown): {
  serviceId: string;
  destinationId: string;
  credentialId: string;
} {
  if (typeof value !== "object" || value === null) {
    throw vaultError("vault_protocol_error");
  }
  const binding = value as Record<string, unknown>;
  if (
    typeof binding.serviceId !== "string"
    || typeof binding.destinationId !== "string"
    || typeof binding.credentialId !== "string"
  ) throw vaultError("vault_protocol_error");
  return {
    serviceId: binding.serviceId,
    destinationId: binding.destinationId,
    credentialId: binding.credentialId,
  };
}

async function exchange(
  socketPath: string,
  spec: HttpRequestSpec,
  authenticationHeaders: Record<string, string>,
): Promise<HttpResponse> {
  const endpoint = validateVaultSocketEndpoint(socketPath);
  return new Promise<HttpResponse>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;
    const fail = (): void => {
      if (settled) return;
      settled = true;
      for (const chunk of chunks) chunk.fill(0);
      request.destroy();
      reject(vaultError("vault_store_unavailable"));
    };
    const request = httpRequest({
      socketPath,
      method: spec.method,
      path: spec.target,
      headers: {
        host: "localhost",
        "content-type": spec.contentType,
        "content-length": String(spec.body.byteLength),
        ...spec.headers,
        ...authenticationHeaders,
      },
      timeout: REQUEST_DEADLINE_MS,
      setDefaultHeaders: false,
    }, (response) => {
      response.on("data", (chunk: Buffer) => {
        if (settled) return;
        received += chunk.byteLength;
        if (received > MAX_RESPONSE_BYTES) return fail();
        chunks.push(chunk);
      });
      response.once("end", () => {
        if (settled) return;
        settled = true;
        const body = Buffer.concat(chunks, received);
        for (const item of chunks) item.fill(0);
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body,
        });
      });
    });
    request.once("socket", () => {
      if (!sameVaultSocketEndpoint(socketPath, endpoint)) fail();
    });
    request.once("timeout", fail);
    request.once("error", fail);
    request.end(spec.body);
  });
}

function singleResponseHeader(
  headers: NodeJS.Dict<string | string[]>,
  name: string,
): string {
  const value = headers[name];
  if (typeof value !== "string" || value.length < 1) {
    throw vaultError("vault_authentication_failed");
  }
  return value;
}

function normalizedResponseContentType(
  headers: NodeJS.Dict<string | string[]>,
): string {
  const value = singleResponseHeader(headers, "content-type");
  const normalized = value.trim().toLowerCase();
  if (normalized.includes(";")) throw vaultError("vault_authentication_failed");
  return normalized;
}

function parseJson(body: Buffer): unknown {
  try {
    const source = body.toString("utf8");
    if (Buffer.from(source, "utf8").byteLength !== body.byteLength) {
      throw new Error("invalid utf8");
    }
    return JSON.parse(source);
  } catch {
    throw vaultError("vault_protocol_error");
  }
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
