import {
  chmodSync,
  existsSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { VaultCapabilityAuthority } from "./capabilities.js";
import { VaultDomainHandler } from "./domain.js";
import { VaultError, vaultError } from "./errors.js";
import {
  signVaultHttpResponse,
  verifyVaultHttpRequest,
  type VaultHttpRequestAuthentication,
} from "./httpProtocol.js";
import type { VaultCaller, VaultOperation } from "./protocol.js";
import { BoundedReplayCache } from "./replayCache.js";
import type { VaultRecordStore } from "./recordStore.js";

const MAX_ACTIVE_WORK = 8;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const SECRET_MEDIA = "application/vnd.secretsauce.vault-secret+octet-stream";
const JSON_MEDIA = "application/json";
const SECURITY_HEADERS = new Set([
  "x-vault-caller",
  "x-vault-boot-id",
  "x-vault-request-id",
  "x-vault-timestamp",
  "x-vault-nonce",
  "x-vault-request-mac",
  "x-vault-capability",
  "x-vault-service-id",
  "x-vault-destination-id",
  "x-vault-credential-id",
  "x-vault-capture-last-four",
  "x-vault-requested-locator",
  "x-vault-expected-generation",
]);

export interface VaultBrokerOptions {
  /** Transitional alias for credentialSocketPath. */
  socketPath?: string;
  credentialSocketPath?: string;
  statusSocketPath?: string;
  socketMode: 0o600 | 0o660;
  callerKeys: Readonly<Record<VaultCaller, Uint8Array>>;
  capabilityAuthority: VaultCapabilityAuthority;
  store: VaultRecordStore;
  /** Deterministic test hook for holding authenticated work without bypassing dispatch. */
  operationGate?: () => Promise<void>;
}

interface AuthenticatedRequest {
  authentication: VaultHttpRequestAuthentication;
  timestampMs: number;
  key: Buffer;
}

export class VaultBrokerServer {
  readonly #credentialSocketPath: string;
  readonly #statusSocketPath: string;
  readonly #socketMode: 0o600 | 0o660;
  readonly #callerKeys: Readonly<Record<VaultCaller, Buffer>>;
  readonly #domain: VaultDomainHandler;
  readonly #operationGate?: () => Promise<void>;
  readonly #replayCache = new BoundedReplayCache();
  #credentialServer: FastifyInstance | undefined;
  #statusServer: FastifyInstance | undefined;
  #activeWork = 0;
  #closed = false;

  constructor(options: VaultBrokerOptions) {
    const credential = options.credentialSocketPath ?? options.socketPath;
    if (credential === undefined) throw vaultError("vault_config_invalid");
    this.#credentialSocketPath = credential;
    this.#statusSocketPath = options.statusSocketPath ?? `${credential}.status`;
    if (this.#statusSocketPath === this.#credentialSocketPath) {
      throw vaultError("vault_config_invalid");
    }
    this.#socketMode = options.socketMode;
    this.#callerKeys = {
      data_plane: copyKey(options.callerKeys.data_plane),
      control_plane: copyKey(options.callerKeys.control_plane),
      backup: copyKey(options.callerKeys.backup),
    };
    this.#domain = new VaultDomainHandler({
      capabilityAuthority: options.capabilityAuthority,
      store: options.store,
    });
    if (options.operationGate !== undefined) {
      this.#operationGate = options.operationGate;
    }
  }

  get bootId(): string {
    return this.#domain.bootId;
  }

  async listen(): Promise<void> {
    if (this.#closed || this.#credentialServer !== undefined) {
      throw vaultError("vault_store_unavailable");
    }
    for (const path of [this.#credentialSocketPath, this.#statusSocketPath]) {
      validateSocketParent(path);
      removeStaleSocket(path);
    }
    const credential = this.#createCredentialServer();
    const status = this.#createStatusServer();
    this.#credentialServer = credential;
    this.#statusServer = status;
    try {
      await status.listen({ path: this.#statusSocketPath });
      secureSocket(this.#statusSocketPath, this.#socketMode);
      await credential.listen({ path: this.#credentialSocketPath });
      secureSocket(this.#credentialSocketPath, this.#socketMode);
    } catch {
      await this.close();
      throw vaultError("vault_store_unavailable");
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const servers = [this.#credentialServer, this.#statusServer];
    this.#credentialServer = undefined;
    this.#statusServer = undefined;
    await Promise.all(servers.map(async (server) => {
      if (server !== undefined) await server.close().catch(() => undefined);
    }));
    for (const path of [this.#credentialSocketPath, this.#statusSocketPath]) {
      removeOwnedSocket(path);
    }
    for (const key of Object.values(this.#callerKeys)) key.fill(0);
    this.#domain.close();
  }

  #createStatusServer(): FastifyInstance {
    const server = Fastify({
      logger: false,
      bodyLimit: 1,
      requestTimeout: 5_000,
      connectionTimeout: 5_000,
    });
    server.get("/v1/status", async (request, reply) => {
      if (
        request.raw.url !== "/v1/status"
        || request.headers["content-length"] !== undefined
        || request.headers["transfer-encoding"] !== undefined
      ) return reply.code(400).send();
      const readiness = await this.#dispatchInternal(
        "control_plane",
        "readiness",
        {},
      ) as { status: string };
      return reply
        .code(200)
        .type(JSON_MEDIA)
        .send({
          state: readiness.status === "ready" ? "ready" : "configuration_error",
          retry_pending: false,
        });
    });
    return server;
  }

  #createCredentialServer(): FastifyInstance {
    const server = Fastify({
      logger: false,
      bodyLimit: MAX_BODY_BYTES,
      requestTimeout: 5_000,
      connectionTimeout: 5_000,
    });
    server.addContentTypeParser(
      SECRET_MEDIA,
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    server.addContentTypeParser(
      JSON_MEDIA,
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );

    server.post("/v1/readiness", async (request, reply) => {
      const auth = this.#authenticate(request, true);
      requireJsonObject(request.body);
      const readiness = await this.#dispatch(auth, "readiness", {});
      return this.#respond(reply, auth, 200, {
        ...(readiness as object),
        boot_id: this.#domain.bootId,
      });
    });

    server.post("/v1/credentials", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "control_plane");
      const secret = requireSecretBody(request);
      return this.#respond(reply, auth, 201, await this.#dispatch(auth, "create", {
        binding: bindingHeaders(request),
        secret: secret.toString("base64url"),
        ...optionalHeader(request, "x-vault-requested-locator", "locator"),
        captureLastFour: booleanHeader(request, "x-vault-capture-last-four", false),
      }));
    });

    server.get("/v1/credentials/:locator", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "control_plane");
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "metadata", {
        locator: routeParameter(request, "locator"),
        binding: bindingHeaders(request),
      }));
    });

    server.put("/v1/credentials/:locator", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "control_plane");
      const secret = requireSecretBody(request);
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "replace", {
        locator: routeParameter(request, "locator"),
        generation: positiveIntegerHeader(request, "x-vault-expected-generation"),
        binding: bindingHeaders(request),
        secret: secret.toString("base64url"),
        captureLastFour: booleanHeader(request, "x-vault-capture-last-four", false),
      }));
    });

    server.delete("/v1/credentials/:locator", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "control_plane");
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "delete", {
        locator: routeParameter(request, "locator"),
        generation: positiveIntegerHeader(request, "x-vault-expected-generation"),
        binding: bindingHeaders(request),
      }));
    });

    server.post("/v1/resolutions", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "data_plane");
      const body = requireJsonObject(request.body);
      const result = await this.#dispatch(auth, "resolve_for_request", {
        ...body,
        capability: requiredHeader(request, "x-vault-capability"),
      }) as { secret: string };
      const secret = Buffer.from(result.secret, "base64url");
      try {
        return this.#respond(reply, auth, 200, secret, SECRET_MEDIA);
      } finally {
        secret.fill(0);
      }
    });

    server.post("/v1/transfers", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "backup");
      const body = requireJsonObject(request.body);
      const capability = requiredHeader(request, "x-vault-capability");
      if (body.action === "replace_empty") {
        return this.#respond(reply, auth, 200, await this.#dispatch(
          auth,
          "replace_empty",
          { capability },
        ));
      }
      const operation = body.direction === "export"
        ? "export_encrypted"
        : body.direction === "import"
          ? "import_encrypted"
          : undefined;
      if (operation === undefined) throw vaultError("vault_frame_invalid");
      const { direction: _direction, ...input } = body;
      return this.#respond(reply, auth, 201, await this.#dispatch(auth, operation, {
        ...input,
        action: "start",
        capability,
      }));
    });

    server.get("/v1/transfers/:transferId", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "backup");
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "export_encrypted", {
        action: "read",
        transferId: routeParameter(request, "transferId"),
        transferToken: requiredHeader(request, "x-vault-capability"),
        sequence: querySequence(request),
      }));
    });

    server.put("/v1/transfers/:transferId", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "backup");
      const body = requireJsonObject(request.body);
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "import_encrypted", {
        ...body,
        action: "write",
        transferId: routeParameter(request, "transferId"),
        transferToken: requiredHeader(request, "x-vault-capability"),
      }));
    });

    server.post("/v1/transfers/:transferId", async (request, reply) => {
      const auth = this.#authenticate(request);
      requireCaller(auth, "backup");
      const body = requireJsonObject(request.body);
      return this.#respond(reply, auth, 200, await this.#dispatch(auth, "import_encrypted", {
        ...body,
        action: "finish",
        transferId: routeParameter(request, "transferId"),
        transferToken: requiredHeader(request, "x-vault-capability"),
      }));
    });

    server.setErrorHandler((error, request, reply) => {
      const auth = (request as FastifyRequest & {
        vaultAuthentication?: AuthenticatedRequest;
      }).vaultAuthentication;
      const code = error instanceof VaultError ? error.code : "vault_protocol_error";
      if (auth === undefined) {
        void reply.code(401).type(JSON_MEDIA).send({ ok: false });
        return;
      }
      void this.#respond(reply, auth, statusFor(code), {
        ok: false,
        error: { code },
      });
    });
    return server;
  }

  #authenticate(
    request: FastifyRequest,
    bootUnbound = false,
  ): AuthenticatedRequest {
    rejectDuplicateSecurityHeaders(request);
    const caller = requiredHeader(request, "x-vault-caller") as VaultCaller;
    if (!(caller in this.#callerKeys)) throw vaultError("vault_authentication_failed");
    const contentType = contentTypeHeader(request);
    const body = bodyBytes(request.body, contentType);
    const authentication: VaultHttpRequestAuthentication = {
      caller,
      method: request.method,
      target: request.raw.url ?? "",
      contentType,
      body,
      requestId: requiredHeader(request, "x-vault-request-id"),
      timestamp: requiredHeader(request, "x-vault-timestamp"),
      nonce: requiredHeader(request, "x-vault-nonce"),
      ...(!bootUnbound
        ? { bootId: requiredHeader(request, "x-vault-boot-id") }
        : {}),
      representationHeaders: representationHeaders(request),
    };
    const verified = verifyVaultHttpRequest(
      authentication,
      requiredHeader(request, "x-vault-request-mac"),
      this.#callerKeys[caller],
    );
    if (!bootUnbound && authentication.bootId !== this.#domain.bootId) {
      throw vaultError("vault_authentication_failed");
    }
    this.#replayCache.consume(
      `http:${caller}:${authentication.nonce}`,
      verified.timestampMs + 30_001,
      Date.now(),
    );
    const result = {
      authentication,
      timestampMs: verified.timestampMs,
      key: this.#callerKeys[caller],
    };
    (request as FastifyRequest & {
      vaultAuthentication?: AuthenticatedRequest;
    }).vaultAuthentication = result;
    return result;
  }

  async #dispatch(
    auth: AuthenticatedRequest,
    operation: VaultOperation,
    input: unknown,
  ): Promise<unknown> {
    if (this.#activeWork >= MAX_ACTIVE_WORK) {
      throw vaultError("vault_capacity_exceeded");
    }
    this.#activeWork += 1;
    try {
      await this.#operationGate?.();
      return await this.#domain.handle({
        caller: {
          caller: auth.authentication.caller,
          bootId: this.#domain.bootId,
        },
        operation,
        metadata: {
          requestId: auth.authentication.requestId,
          timestampMs: auth.timestampMs,
        },
        input,
      });
    } finally {
      this.#activeWork -= 1;
    }
  }

  #dispatchInternal(
    caller: VaultCaller,
    operation: VaultOperation,
    input: unknown,
  ): Promise<unknown> {
    return this.#domain.handle({
      caller: { caller, bootId: this.#domain.bootId },
      operation,
      metadata: { requestId: "status", timestampMs: Date.now() },
      input,
    });
  }

  #respond(
    reply: FastifyReply,
    auth: AuthenticatedRequest,
    status: number,
    value: unknown,
    contentType = JSON_MEDIA,
  ): FastifyReply {
    const body = Buffer.isBuffer(value)
      ? value
      : Buffer.from(JSON.stringify(value), "utf8");
    const responseMac = signVaultHttpResponse({
      caller: auth.authentication.caller,
      bootId: this.#domain.bootId,
      requestId: auth.authentication.requestId,
      status,
      contentType,
      body,
    }, auth.key);
    return reply
      .code(status)
      .header("x-vault-boot-id", this.#domain.bootId)
      .header("x-vault-response-mac", responseMac)
      .type(contentType)
      .send(body);
  }
}

function requiredHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  if (typeof value !== "string" || value.length < 1 || value.length > 8192) {
    throw vaultError("vault_frame_invalid");
  }
  return value;
}

function optionalHeader(
  request: FastifyRequest,
  header: string,
  property: string,
): Record<string, string> {
  const value = request.headers[header];
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw vaultError("vault_frame_invalid");
  }
  return { [property]: value };
}

function contentTypeHeader(request: FastifyRequest): string {
  const value = request.headers["content-type"];
  if (typeof value !== "string" || value.includes(";")) {
    throw vaultError("vault_frame_invalid");
  }
  return value;
}

function bodyBytes(body: unknown, contentType: string): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (body === undefined && contentType === JSON_MEDIA) return Buffer.alloc(0);
  throw vaultError("vault_frame_invalid");
}

function requireJsonObject(value: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(value)) {
    try {
      const source = value.toString("utf8");
      if (Buffer.from(source, "utf8").byteLength !== value.byteLength) {
        throw new Error("invalid utf8");
      }
      return requireJsonObject(JSON.parse(source));
    } catch {
      throw vaultError("vault_frame_invalid");
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw vaultError("vault_frame_invalid");
  }
  return value as Record<string, unknown>;
}

function requireSecretBody(request: FastifyRequest): Buffer {
  if (contentTypeHeader(request) !== SECRET_MEDIA || !Buffer.isBuffer(request.body)) {
    throw vaultError("vault_frame_invalid");
  }
  if (request.body.byteLength < 1 || request.body.byteLength > 65_536) {
    throw vaultError("vault_frame_invalid");
  }
  return request.body;
}

function requireCaller(auth: AuthenticatedRequest, caller: VaultCaller): void {
  if (auth.authentication.caller !== caller) throw vaultError("vault_operation_denied");
}

function bindingHeaders(request: FastifyRequest): {
  serviceId: string;
  destinationId: string;
  credentialId: string;
} {
  return {
    serviceId: requiredHeader(request, "x-vault-service-id"),
    destinationId: requiredHeader(request, "x-vault-destination-id"),
    credentialId: requiredHeader(request, "x-vault-credential-id"),
  };
}

function booleanHeader(
  request: FastifyRequest,
  name: string,
  fallback: boolean,
): boolean {
  const value = request.headers[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw vaultError("vault_frame_invalid");
}

function positiveIntegerHeader(request: FastifyRequest, name: string): number {
  const value = requiredHeader(request, name);
  if (!/^[1-9][0-9]{0,15}$/.test(value)) throw vaultError("vault_frame_invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw vaultError("vault_frame_invalid");
  return parsed;
}

function routeParameter(request: FastifyRequest, name: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[name];
  if (typeof value !== "string") throw vaultError("vault_frame_invalid");
  return value;
}

function querySequence(request: FastifyRequest): number {
  const query = request.query as Record<string, unknown>;
  if (Object.keys(query).length !== 1 || typeof query.sequence !== "string") {
    throw vaultError("vault_frame_invalid");
  }
  if (!/^(0|[1-9][0-9]{0,15})$/.test(query.sequence)) {
    throw vaultError("vault_frame_invalid");
  }
  const sequence = Number(query.sequence);
  if (!Number.isSafeInteger(sequence)) throw vaultError("vault_frame_invalid");
  return sequence;
}

function rejectDuplicateSecurityHeaders(request: FastifyRequest): void {
  const seen = new Set<string>();
  for (let index = 0; index < request.raw.rawHeaders.length; index += 2) {
    const name = request.raw.rawHeaders[index]!.toLowerCase();
    if (
      SECURITY_HEADERS.has(name)
      || name === "content-type"
      || name === "content-length"
      || name === "transfer-encoding"
    ) {
      if (seen.has(name)) throw vaultError("vault_authentication_failed");
      seen.add(name);
    }
  }
}

function representationHeaders(
  request: FastifyRequest,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of SECURITY_HEADERS) {
    if ([
      "x-vault-caller",
      "x-vault-boot-id",
      "x-vault-request-id",
      "x-vault-timestamp",
      "x-vault-nonce",
      "x-vault-request-mac",
    ].includes(name)) continue;
    const value = request.headers[name];
    if (value !== undefined) {
      if (typeof value !== "string") throw vaultError("vault_frame_invalid");
      result[name] = value;
    }
  }
  return result;
}

function statusFor(code: string): number {
  if (code === "vault_authentication_failed" || code === "vault_request_stale" || code === "vault_replay_detected") return 401;
  if (code === "vault_operation_denied" || code === "vault_capability_invalid") return 403;
  if (code === "vault_record_not_found") return 404;
  if (code === "vault_record_conflict") return 409;
  if (code === "vault_capacity_exceeded" || code === "vault_store_unavailable") return 503;
  return 400;
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
    ) throw new Error("unsafe");
  } catch {
    throw vaultError("vault_store_unavailable");
  }
}

function secureSocket(socketPath: string, mode: 0o600 | 0o660): void {
  chmodSync(socketPath, mode);
  const metadata = lstatSync(socketPath);
  if (
    !metadata.isSocket()
    || (metadata.mode & 0o777) !== mode
    || !isAllowedOwner(metadata.uid)
  ) throw vaultError("vault_store_unavailable");
}

function removeStaleSocket(socketPath: string): void {
  if (!existsSync(socketPath)) return;
  const metadata = lstatSync(socketPath);
  if (!metadata.isSocket() || !isAllowedOwner(metadata.uid)) {
    throw vaultError("vault_store_unavailable");
  }
  unlinkSync(socketPath);
}

function removeOwnedSocket(socketPath: string): void {
  try {
    const metadata = lstatSync(socketPath);
    if (metadata.isSocket() && isAllowedOwner(metadata.uid)) unlinkSync(socketPath);
  } catch {
    // Already absent.
  }
}

function isAllowedOwner(uid: number): boolean {
  const current = process.getuid?.();
  return current === undefined || uid === current || uid === 0;
}
