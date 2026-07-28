import { chmodSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { VaultCapabilityAuthority } from "../src/vault/capabilities.js";
import { VaultDomainHandler } from "../src/vault/domain.js";
import { VaultRecordStore } from "../src/vault/recordStore.js";

describe("transport-neutral vault domain handler", () => {
  it("serves allowed callers without receiving HTTP or socket authority", async () => {
    const fixture = domainFixture();
    try {
      await expect(fixture.handle("control_plane", "readiness", {}))
        .resolves.toEqual({ status: "ready", recordCount: 0 });
      const created = await fixture.handle("control_plane", "create", {
        binding: fixture.binding,
        secret: Buffer.from("domain-secret").toString("base64url"),
        captureLastFour: true,
      }) as { locator: string; metadata: { generation: number } };
      await expect(fixture.handle("control_plane", "metadata", {
        locator: created.locator,
        binding: fixture.binding,
      })).resolves.toMatchObject({
        generation: 1,
        lastFour: "cret",
      });

      const capability = fixture.authority.issueResolve({
        subjectId: fixture.subjectId,
        grantEpoch: 1,
        securityEpoch: 2,
        serviceId: fixture.binding.serviceId,
        destinationId: fixture.binding.destinationId,
        credentialId: fixture.binding.credentialId,
        locator: created.locator,
        generation: 1,
        method: "POST",
        pathDigest: "a".repeat(64),
        requestId: "req_123e4567-e89b-42d3-a456-426614174000",
        operationDigest: "b".repeat(64),
      });
      await expect(fixture.handle("data_plane", "resolve_for_request", {
        capability,
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
      })).resolves.toEqual({
        secret: Buffer.from("domain-secret").toString("base64url"),
      });

      expect(Object.keys(fixture.context)).toEqual(["caller", "bootId"]);
      expect("request" in fixture.context).toBe(false);
      expect("socket" in fixture.context).toBe(false);
    } finally {
      fixture.domain.close();
    }
  });

  it("rejects cross-caller, wrong-boot, malformed, and replayed authority before store use", async () => {
    const fixture = domainFixture();
    try {
      await expect(fixture.handle("data_plane", "create", {}))
        .rejects.toMatchObject({ code: "vault_operation_denied" });
      await expect(fixture.domain.handle({
        caller: { caller: "control_plane", bootId: "wrong-boot" },
        operation: "readiness",
        metadata: fixture.metadata,
        input: {},
      })).rejects.toMatchObject({ code: "vault_operation_denied" });
      await expect(fixture.handle("control_plane", "create", {
        binding: fixture.binding,
        secret: "***",
      })).rejects.toMatchObject({ code: "vault_frame_invalid" });
      await expect(fixture.handle("control_plane", "readiness", {}))
        .resolves.toEqual({ status: "ready", recordCount: 0 });
    } finally {
      fixture.domain.close();
    }
  });
});

function domainFixture() {
  const directory = mkdtempSync(join(tmpdir(), "vault-domain-"));
  chmodSync(directory, 0o700);
  const storeDirectory = join(directory, "store");
  mkdirSync(storeDirectory, { mode: 0o700 });
  const now = 1_800_000_000_000;
  const generator = new UuidV7Generator({
    now: () => now,
    random: () => Buffer.alloc(10, 7),
  });
  const authority = new VaultCapabilityAuthority({
    resolveKey: Buffer.alloc(32, 1),
    backupKey: Buffer.alloc(32, 2),
    now: () => now,
  });
  const domain = new VaultDomainHandler({
    capabilityAuthority: authority,
    store: new VaultRecordStore({
      directory: storeDirectory,
      activeRootKey: "root-a",
      rootKeys: new Map([["root-a", Buffer.alloc(32, 3)]]),
    }),
    bootId: "123e4567-e89b-42d3-a456-426614174000",
    now: () => now,
  });
  const context = {
    caller: "control_plane" as const,
    bootId: domain.bootId,
  };
  const metadata = {
    requestId: "123e4567-e89b-42d3-a456-426614174001",
    timestampMs: now,
  };
  return {
    domain,
    authority,
    context,
    metadata,
    subjectId: generator.next(),
    binding: {
      serviceId: generator.next(),
      destinationId: generator.next(),
      credentialId: generator.next(),
    },
    handle: (
      caller: "data_plane" | "control_plane" | "backup",
      operation:
        | "readiness"
        | "resolve_for_request"
        | "create"
        | "replace"
        | "delete"
        | "metadata"
        | "export_encrypted"
        | "import_encrypted"
        | "replace_empty",
      input: unknown,
    ) => domain.handle({
      caller: { caller, bootId: domain.bootId },
      operation,
      metadata,
      input,
    }),
  };
}
