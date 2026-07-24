import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  V1MigrationCommitError,
  V1MigrationCommitRepository,
} from "../src/v1MigrationCommit.js";
import { createV1MigrationPlan } from "../src/v1MigrationPlan.js";
import { readV1MigrationSource } from "../src/v1MigrationSource.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const CORRELATION_ID = "req_018f1f2e-7b3c-4a10-8000-000000000099";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("atomic definitions-only v1 migration commit", () => {
  it("imports only draft portable rows, activates an empty runtime, and creates exact remediations", async () => {
    const worker = fixture();
    await activeSuperadmin(worker);
    const plan = migrationPlan();
    const repository = new V1MigrationCommitRepository(
      worker,
      () => NOW,
      deterministicUuid(0x61),
    );

    const result = await repository.commitDefinitions({
      plan,
      correlationId: CORRELATION_ID,
      osActor: "migration-operator",
    });

    expect(result).toMatchObject({
      activationGeneration: 1,
      globalReferenceEpoch: 1,
      serviceCount: 2,
      remediationCount: 9,
    });
    const state = await worker.execute({
      run: (database) => database.read((query) => ({
        services: query.all<{
          id: string;
          slug: string;
          lifecycle: string;
          published_revision_id: string | null;
        }>("SELECT id, slug, lifecycle, published_revision_id FROM services ORDER BY slug"),
        credentials: query.all<{
          name: string;
          status: string;
          vault_locator: string | null;
        }>("SELECT name, status, vault_locator FROM service_credentials"),
        rules: query.all<{
          enabled: number;
        }>("SELECT enabled FROM policy_rules"),
        activation: query.get<{
          state: string;
          activation_generation: number;
          global_reference_epoch: number;
        }>("SELECT state, activation_generation, global_reference_epoch FROM runtime_activation WHERE singleton = 1"),
        activeRuntime: query.get<{ count: number }>(
          "SELECT count(*) AS count FROM runtime_active_services",
        )!.count,
        marker: query.get<{
          state: string;
          migration_id: string;
          resolution_mode: string;
          service_count: number;
          credential_count: number;
          configured_credential_count: number;
          discarded_acl_count: number;
          activation_generation: number;
        }>("SELECT * FROM v1_migration_state WHERE singleton = 1"),
        remediations: query.all<{
          task_kind: string;
          target_id: string | null;
        }>("SELECT task_kind, target_id FROM migration_remediations ORDER BY task_kind, target_id"),
        excluded: {
          serviceAdmins: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM service_admins",
          )!.count,
          serviceAssignments: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM service_principal_assignments",
          )!.count,
          credentialAssignments: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM credential_principal_assignments",
          )!.count,
          ruleAssignments: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM policy_rule_principal_assignments",
          )!.count,
          groups: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM service_groups",
          )!.count,
          oauthClients: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM oauth_clients",
          )!.count,
        },
        audit: query.get<{
          action: string;
          actor_type: string;
          source_json: string;
          changes_json: string;
        }>("SELECT action, actor_type, source_json, changes_json FROM administrative_audit_events WHERE action = 'migration.v1.commit'"),
      })),
    });
    expect(state.services).toHaveLength(2);
    expect(state.services.every((service) =>
      service.lifecycle === "draft" && service.published_revision_id === null))
      .toBe(true);
    expect(state.credentials).toEqual([{
      name: "api-key",
      status: "unconfigured",
      vault_locator: null,
    }]);
    expect(state.rules).toEqual([{ enabled: 0 }]);
    expect(state.activation).toEqual({
      state: "active",
      activation_generation: 1,
      global_reference_epoch: 1,
    });
    expect(state.activeRuntime).toBe(0);
    expect(state.marker).toMatchObject({
      state: "completed",
      migration_id: result.migrationId,
      resolution_mode: "definitions_only",
      service_count: 2,
      credential_count: 1,
      configured_credential_count: 0,
      discarded_acl_count: 2,
      activation_generation: 1,
    });
    expect(state.remediations.filter(({ task_kind }) =>
      task_kind === "supply_credential")).toHaveLength(1);
    expect(state.remediations.filter(({ task_kind }) =>
      task_kind === "review_enable_policy")).toHaveLength(2);
    expect(state.excluded).toEqual({
      serviceAdmins: 0,
      serviceAssignments: 0,
      credentialAssignments: 0,
      ruleAssignments: 0,
      groups: 0,
      oauthClients: 0,
    });
    expect(state.audit).toMatchObject({
      action: "migration.v1.commit",
      actor_type: "local_cli",
    });
    expect(`${state.audit!.source_json}${state.audit!.changes_json}`)
      .not.toMatch(/SOURCE_TOKEN|private@example|api\.example\.org/i);
    await expect(repository.commitDefinitions({
      plan,
      correlationId: CORRELATION_ID,
      osActor: "migration-operator",
    })).rejects.toEqual(new V1MigrationCommitError("already_completed"));
  });

  it("rolls every portable row, activation change, marker, remediation, and audit back on failure", async () => {
    for (const phase of [
      "after_portable_rows",
      "after_activation",
      "after_marker",
      "after_remediations",
    ] as const) {
      const worker = fixture();
      await activeSuperadmin(worker);
      const repository = new V1MigrationCommitRepository(
        worker,
        () => NOW,
        deterministicUuid(0x62),
        (current) => {
          if (current === phase) throw new Error("injected");
        },
      );
      await expect(repository.commitDefinitions({
        plan: migrationPlan(),
        correlationId: CORRELATION_ID,
        osActor: "operator",
      })).rejects.toEqual(new V1MigrationCommitError("unavailable"));
      const counts = await worker.execute({
        run: (database) => database.read((query) => ({
          services: query.get<{ count: number }>("SELECT count(*) AS count FROM services")!.count,
          remediations: query.get<{ count: number }>("SELECT count(*) AS count FROM migration_remediations")!.count,
          audits: query.get<{ count: number }>("SELECT count(*) AS count FROM administrative_audit_events")!.count,
          marker: query.get<{ state: string }>("SELECT state FROM v1_migration_state WHERE singleton = 1")!.state,
          activation: query.get<{ state: string; activation_generation: number }>(
            "SELECT state, activation_generation FROM runtime_activation WHERE singleton = 1",
          ),
        })),
      });
      expect(counts).toEqual({
        services: 0,
        remediations: 0,
        audits: 0,
        marker: "pending",
        activation: { state: "inactive", activation_generation: 0 },
      });
      await worker.close();
      workers.delete(worker);
    }
  });

  it("rejects a changed target and a mutated plan before partial work", async () => {
    const changed = fixture();
    await activeSuperadmin(changed);
    const plan = migrationPlan();
    const repository = new V1MigrationCommitRepository(
      changed,
      () => NOW,
      deterministicUuid(0x63),
      (phase) => {
        if (phase !== "after_preflight") return;
        void changed.execute({
          run: (database) => database.withOperationalTransaction((transaction) => {
            transaction.run(`
              UPDATE runtime_activation
              SET version = version + 1, updated_at = ?
              WHERE singleton = 1
            `, [NOW]);
          }),
        });
      },
    );
    await expect(repository.commitDefinitions({
      plan,
      correlationId: CORRELATION_ID,
      osActor: "operator",
    })).rejects.toEqual(new V1MigrationCommitError("preflight_changed"));
    const changedCount = await changed.execute({
      run: (database) => database.read((query) =>
        query.get<{ count: number }>("SELECT count(*) AS count FROM services")!.count),
    });
    expect(changedCount).toBe(0);

    const invalid = fixture();
    await activeSuperadmin(invalid);
    const mutated = migrationPlan();
    mutated.services[0]!.profile.name = "Tampered";
    await expect(new V1MigrationCommitRepository(invalid).commitDefinitions({
      plan: mutated,
      correlationId: CORRELATION_ID,
      osActor: "operator",
    })).rejects.toEqual(new V1MigrationCommitError("invalid_plan"));
    const serviceCount = await invalid.execute({
      run: (database) => database.read((query) =>
        query.get<{ count: number }>("SELECT count(*) AS count FROM services")!.count),
    });
    expect(serviceCount).toBe(0);
  });
});

function fixture(): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "v1-migration-commit-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

async function activeSuperadmin(worker: PersistenceWorker): Promise<void> {
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
}

function migrationPlan() {
  const directory = mkdtempSync(join(tmpdir(), "v1-migration-plan-commit-"));
  const sourceFile = join(directory, "source.yaml");
  writeFileSync(sourceFile, `services:
  alpha:
    name: Alpha
    destinations:
      - name: primary
        base_url: https://api.example.org/
    credentials:
      - id: api-key
        usage: {kind: header, name: X-API-Key}
        source: {kind: env, name: SOURCE_TOKEN}
    access:
      users: [private@example.org, hidden@example.org]
    policy:
      rules:
        - id: read
          effect: allow
          priority: 1
          methods: [GET]
          paths: ['^/items$']
  beta:
    name: Beta
    destinations:
      - name: primary
        base_url: https://beta.example.org/
    no_auth: true
`);
  return createV1MigrationPlan(readV1MigrationSource(sourceFile), {
    uuid: deterministicUuid(0x60),
  });
}

function deterministicUuid(byte: number): () => string {
  const generator = new UuidV7Generator({
    now: () => NOW,
    random: () => Buffer.alloc(10, byte),
  });
  return () => generator.next();
}
