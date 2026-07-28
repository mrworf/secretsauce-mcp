import {
  chmodSync,
  chownSync,
  existsSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { vaultError } from "./errors.js";
import type { ProvisioningErrorCategory } from "./provisioning.js";

export interface VaultProvisioningStatus {
  state: "preparing" | "ready" | "configuration_error";
  retryPending: boolean;
  errorCategory?: ProvisioningErrorCategory;
}

export class VaultProvisioningStatusServer {
  readonly #path: string;
  readonly #mode: 0o600 | 0o660;
  readonly #gid: number | undefined;
  readonly #uid: number | undefined;
  #status: VaultProvisioningStatus = {
    state: "preparing",
    retryPending: false,
  };
  #server: FastifyInstance | undefined;

  constructor(options: {
    path: string;
    mode: 0o600 | 0o660;
    gid?: number;
    uid?: number;
  }) {
    this.#path = options.path;
    this.#mode = options.mode;
    this.#gid = options.gid;
    this.#uid = options.uid;
  }

  setStatus(status: VaultProvisioningStatus): void {
    this.#status = Object.freeze({ ...status });
  }

  async listen(): Promise<void> {
    if (this.#server !== undefined) throw vaultError("vault_store_unavailable");
    validateParent(this.#path, this.#uid);
    removeSocket(this.#path, this.#uid);
    const server = Fastify({
      logger: false,
      exposeHeadRoutes: false,
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
      return reply.code(200).type("application/json").send({
        state: this.#status.state,
        retry_pending: this.#status.retryPending,
        ...(this.#status.errorCategory === undefined
          ? {}
          : { error_category: this.#status.errorCategory }),
      });
    });
    this.#server = server;
    try {
      await server.listen({ path: this.#path });
      if (this.#gid !== undefined || this.#uid !== undefined) {
        chownSync(
          this.#path,
          this.#uid ?? process.getuid?.() ?? 0,
          this.#gid ?? process.getgid?.() ?? 0,
        );
      }
      chmodSync(this.#path, this.#mode);
    } catch {
      await this.close();
      throw vaultError("vault_store_unavailable");
    }
  }

  async close(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    if (server !== undefined) await server.close().catch(() => undefined);
    try {
      const metadata = lstatSync(this.#path);
      if (metadata.isSocket() && allowedOwner(metadata.uid, this.#uid)) {
        unlinkSync(this.#path);
      }
    } catch {
      // Already absent.
    }
  }
}

function validateParent(path: string, expectedUid: number | undefined): void {
  try {
    const metadata = lstatSync(dirname(path));
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || (metadata.mode & 0o022) !== 0
      || !allowedOwner(metadata.uid, expectedUid)
    ) throw new Error("unsafe");
  } catch {
    throw vaultError("vault_store_unavailable");
  }
}

function removeSocket(path: string, expectedUid: number | undefined): void {
  if (!existsSync(path)) return;
  const metadata = lstatSync(path);
  if (!metadata.isSocket() || !allowedOwner(metadata.uid, expectedUid)) {
    throw vaultError("vault_store_unavailable");
  }
  unlinkSync(path);
}

function allowedOwner(uid: number, expectedUid?: number): boolean {
  const current = process.getuid?.();
  return current === undefined
    || uid === current
    || uid === 0
    || uid === expectedUid;
}
