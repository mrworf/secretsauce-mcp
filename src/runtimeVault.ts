import { createHash } from "node:crypto";
import type { DataVaultClient } from "./vault/client.js";
import type {
  ResolveCapabilityInput,
} from "./vault/capabilities.js";
import type { VaultCredentialBinding } from "./vault/recordStore.js";

export interface RuntimeVaultResolveInput {
  subjectId: string;
  grantEpoch: number;
  securityEpoch: number;
  serviceId: string;
  destinationId: string;
  credentialId: string;
  locator: string;
  generation: number;
  method: "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
  canonicalPath: string;
  requestId: string;
  operationDigest: string;
}

export interface RuntimeVault {
  readiness(): Promise<"ready" | "unavailable">;
  resolve<T>(
    input: RuntimeVaultResolveInput,
    callback: (secret: Buffer) => T | Promise<T>,
  ): Promise<T>;
  close(): void;
}

export interface RuntimeResolveCapabilityIssuer {
  issueResolve(input: ResolveCapabilityInput, ttlMs?: number): string;
}

export class CapabilityRuntimeVault implements RuntimeVault {
  constructor(
    private readonly client: DataVaultClient,
    private readonly authority: RuntimeResolveCapabilityIssuer,
  ) {}

  async readiness(): Promise<"ready" | "unavailable"> {
    try {
      const result = await this.client.readiness();
      return result.status === "ready" ? "ready" : "unavailable";
    } catch {
      return "unavailable";
    }
  }

  resolve<T>(
    input: RuntimeVaultResolveInput,
    callback: (secret: Buffer) => T | Promise<T>,
  ): Promise<T> {
    const binding: VaultCredentialBinding = {
      serviceId: input.serviceId,
      destinationId: input.destinationId,
      credentialId: input.credentialId,
    };
    const capability = this.authority.issueResolve({
      subjectId: input.subjectId,
      grantEpoch: input.grantEpoch,
      securityEpoch: input.securityEpoch,
      serviceId: input.serviceId,
      destinationId: input.destinationId,
      credentialId: input.credentialId,
      locator: input.locator,
      generation: input.generation,
      method: input.method,
      pathDigest: createHash("sha256")
        .update(input.canonicalPath, "utf8")
        .digest("hex"),
      requestId: input.requestId,
      operationDigest: input.operationDigest,
    });
    return this.client.resolveForRequest({
      capability,
      locator: input.locator,
      generation: input.generation,
      binding,
    }, callback);
  }

  close(): void {
    this.client.close();
  }
}
