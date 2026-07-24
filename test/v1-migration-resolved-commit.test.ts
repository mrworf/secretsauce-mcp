import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  V1MigrationCommitRepository,
} from "../src/v1MigrationCommit.js";
import { createV1MigrationPlan } from "../src/v1MigrationPlan.js";
import {
  resolveV1MigrationCredentials,
  V1MigrationResolutionContext,
} from "../src/v1MigrationSecrets.js";
import {
  V1MigrationResolvedCommitCoordinator,
  V1MigrationResolvedCommitError,
} from "../src/v1MigrationResolvedCommit.js";
import { readV1MigrationSource } from "../src/v1MigrationSource.js";
import type { VaultCredentialBinding, VaultRecordMetadata } from "../src/vault/recordStore.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const CORRELATION_ID = "req_018f1f2e-7b3c-4a10-8000-000000000099";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("recovery-coordinated resolved v1 migration", () => {
  it("journals before the first exact vault create and commits configured metadata only after health", async () => {
    const fixture = await context();
    const order: string[] = [];
    const records = new Map<string, {
      binding: VaultCredentialBinding;
      metadata: VaultRecordMetadata;
    }>();
    const vault = {
      create: vi.fn(async (input: {
        binding: VaultCredentialBinding;
        locator: string;
        secret: Uint8Array;
      }) => {
        order.push("vault:create");
        expect(Buffer.from(input.secret).toString()).toBe("resolved-value");
        const metadata = metadataRecord();
        records.set(input.locator, { binding: input.binding, metadata });
        return { locator: input.locator, metadata };
      }),
      metadata: vi.fn(async (locator: string, binding: VaultCredentialBinding) => {
        order.push("vault:metadata");
        const record = records.get(locator);
        expect(record?.binding).toEqual(binding);
        return record!.metadata;
      }),
      readiness: vi.fn(async () => {
        order.push("vault:health");
        return { status: "ready" as const, recordCount: records.size };
      }),
    };
    const recovery = {
      prepare: vi.fn(async () => {
        order.push("snapshot");
        return {};
      }),
      advance: vi.fn((_id: string, phase: string) => {
        order.push(`journal:${phase}`);
        return {};
      }),
      rollback: vi.fn(async () => {
        order.push("rollback");
      }),
      remove: vi.fn(() => {
        order.push("remove");
      }),
    };
    const commits = new V1MigrationCommitRepository(
      fixture.worker,
      () => NOW,
      deterministicUuid(0x72),
      (phase) => {
        if (phase === "after_remediations") order.push("database");
      },
    );
    const retained = fixture.resolved.credentialValue(
      fixture.resolved.configuredCredentialIds()[0]!,
    )!;
    const coordinator = new V1MigrationResolvedCommitCoordinator(
      fixture.databaseFile,
      commits,
      recovery as never,
      vault,
      async () => {
        order.push("database:health");
        return true;
      },
      () => NOW,
      deterministicUuid(0x73),
    );

    const result = await coordinator.commit({
      resolved: fixture.resolved,
      correlationId: CORRELATION_ID,
      osActor: "migration-operator",
    });

    expect(result).toMatchObject({
      serviceCount: 1,
      remediationCount: 4,
    });
    expect(order).toEqual([
      "snapshot",
      "journal:vault_applied",
      "vault:create",
      "database",
      "journal:database_committed",
      "database:health",
      "vault:health",
      "vault:metadata",
      "journal:health_passed",
      "remove",
    ]);
    expect(recovery.rollback).not.toHaveBeenCalled();
    expect(retained.every((byte) => byte === 0)).toBe(true);
    const state = await fixture.worker.execute({
      run: (database) => database.read((query) => ({
        credential: query.get<{
          status: string;
          vault_locator: string | null;
          vault_generation: number | null;
        }>("SELECT status, vault_locator, vault_generation FROM service_credentials"),
        marker: query.get<{
          resolution_mode: string;
          plan_digest: string;
          configured_credential_count: number;
        }>("SELECT resolution_mode, plan_digest, configured_credential_count FROM v1_migration_state WHERE singleton = 1"),
        supplies: query.get<{ count: number }>(`
          SELECT count(*) AS count FROM migration_remediations
          WHERE task_kind = 'supply_credential'
        `)!.count,
      })),
    });
    expect(state.credential).toMatchObject({
      status: "configured",
      vault_locator: expect.stringMatching(/^[0-9a-f-]{36}$/),
      vault_generation: 1,
    });
    expect(state.marker).toEqual({
      resolution_mode: "resolved_credentials",
      plan_digest: fixture.digest,
      configured_credential_count: 1,
    });
    expect(state.supplies).toBe(0);
    fixture.resolutionContext.dispose();
  });

  it("rolls back after partial vault, database, and health failures and always wipes values", async () => {
    for (const failure of ["vault", "database", "health"] as const) {
      const fixture = await context();
      const order: string[] = [];
      const retained = fixture.resolved.credentialValue(
        fixture.resolved.configuredCredentialIds()[0]!,
      )!;
      const recovery = {
        prepare: vi.fn(async () => (order.push("snapshot"), {})),
        advance: vi.fn((_id: string, phase: string) => (
          order.push(`journal:${phase}`), {}
        )),
        rollback: vi.fn(async () => {
          order.push("rollback");
        }),
        remove: vi.fn(() => {
          order.push("remove");
        }),
      };
      const vault = {
        create: vi.fn(async (input: {
          locator: string;
          binding: VaultCredentialBinding;
        }) => {
          order.push("vault");
          if (failure === "vault") throw new Error("injected");
          return { locator: input.locator, metadata: metadataRecord() };
        }),
        metadata: vi.fn(async () => metadataRecord()),
        readiness: vi.fn(async () => ({
          status: "ready" as const,
          recordCount: 1,
        })),
      };
      const commits = new V1MigrationCommitRepository(
        fixture.worker,
        () => NOW,
        deterministicUuid(0x74),
        failure === "database"
          ? (phase) => {
              if (phase === "after_portable_rows") throw new Error("injected");
            }
          : undefined,
      );
      const coordinator = new V1MigrationResolvedCommitCoordinator(
        fixture.databaseFile,
        commits,
        recovery as never,
        vault,
        async () => failure !== "health",
        () => NOW,
        deterministicUuid(0x75),
      );
      await expect(coordinator.commit({
        resolved: fixture.resolved,
        correlationId: CORRELATION_ID,
        osActor: "operator",
      })).rejects.toBeInstanceOf(V1MigrationResolvedCommitError);
      expect(order.slice(0, 2)).toEqual(["snapshot", "journal:vault_applied"]);
      expect(order).toContain("rollback");
      expect(retained.every((byte) => byte === 0)).toBe(true);
      fixture.resolutionContext.dispose();
      await fixture.worker.close();
      workers.delete(fixture.worker);
    }
  });

  it("fails closed when recovery cannot restore both stores", async () => {
    const fixture = await context();
    const coordinator = new V1MigrationResolvedCommitCoordinator(
      fixture.databaseFile,
      new V1MigrationCommitRepository(fixture.worker),
      {
        prepare: vi.fn(async () => ({})),
        advance: vi.fn(() => ({})),
        rollback: vi.fn(async () => {
          throw new Error("injected");
        }),
        remove: vi.fn(),
      } as never,
      {
        create: vi.fn(async () => {
          throw new Error("injected");
        }),
        metadata: vi.fn(),
        readiness: vi.fn(),
      } as never,
      async () => true,
      () => NOW,
      deterministicUuid(0x76),
    );
    await expect(coordinator.commit({
      resolved: fixture.resolved,
      correlationId: CORRELATION_ID,
      osActor: "operator",
    })).rejects.toEqual(new V1MigrationResolvedCommitError("rollback_failed"));
    fixture.resolutionContext.dispose();
  });
});

async function context() {
  const directory = mkdtempSync(join(tmpdir(), "v1-migration-resolved-"));
  const databaseFile = join(directory, "control.sqlite");
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at,
          updated_at
        ) VALUES (?, 'root@example.org', 'root@example.org', 'Root', 'Admin',
          'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [SUPERADMIN_ID, NOW, NOW]);
    }),
  });
  const sourceFile = join(directory, "source.yaml");
  writeFileSync(sourceFile, `services:
  example:
    name: Example
    destinations:
      - name: primary
        base_url: https://api.example.org/
    credentials:
      - id: token
        usage: {kind: header, name: X-Token}
        source: {kind: env, name: SELECTED_TOKEN}
`);
  const plan = createV1MigrationPlan(readV1MigrationSource(sourceFile), {
    uuid: deterministicUuid(0x70),
  });
  const allowlist = join(directory, "allowlist.yaml");
  writeFileSync(
    allowlist,
    "version: 1\nenvironment: [SELECTED_TOKEN]\nfiles: []\n",
    { mode: 0o400 },
  );
  const resolutionContext = new V1MigrationResolutionContext(
    Buffer.alloc(32, 0x71),
  );
  const resolved = resolveV1MigrationCredentials(plan, {
    allowlistFile: allowlist,
    environment: { SELECTED_TOKEN: "resolved-value" },
    context: resolutionContext,
  });
  return {
    worker,
    databaseFile,
    resolved,
    digest: resolved.digest,
    resolutionContext,
  };
}

function deterministicUuid(byte: number): () => string {
  const generator = new UuidV7Generator({
    now: () => NOW,
    random: () => Buffer.alloc(10, byte),
  });
  return () => generator.next();
}

function metadataRecord(): VaultRecordMetadata {
  return {
    status: "configured",
    generation: 1,
    sizeClass: "up_to_32_bytes",
    createdAt: NOW,
    updatedAt: NOW,
  };
}
