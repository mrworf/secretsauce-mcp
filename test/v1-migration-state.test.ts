import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  V1MigrationStateError,
  V1MigrationStateRepository,
} from "../src/v1MigrationState.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const MIGRATION_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const REMEDIATION_ID = "018f1f2e-7b3c-7a10-8000-000000000030";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("v1 migration state", () => {
  it("accepts only an empty inactive target with an active superadmin", async () => {
    const worker = fixture();
    await activeSuperadmin(worker);
    await expect(new V1MigrationStateRepository(worker).preflight())
      .resolves.toEqual({
        guardianSuperadminId: SUPERADMIN_ID,
        migrationStateVersion: 1,
        activationVersion: 1,
        activationGeneration: 0,
        globalReferenceEpoch: 0,
      });
  });

  it("rejects missing bootstrap, nonempty targets, active runtime, and rerun", async () => {
    const missing = fixture();
    await expect(new V1MigrationStateRepository(missing).preflight())
      .rejects.toEqual(new V1MigrationStateError("bootstrap_required"));

    const nonempty = fixture();
    await activeSuperadmin(nonempty);
    await insertService(nonempty);
    await expect(new V1MigrationStateRepository(nonempty).preflight())
      .rejects.toEqual(new V1MigrationStateError("target_not_empty"));

    const active = fixture();
    await activeSuperadmin(active);
    await active.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE runtime_activation
          SET state = 'active', activated_at = ?, updated_at = ?
          WHERE singleton = 1
        `, [NOW, NOW]);
      }),
    });
    await expect(new V1MigrationStateRepository(active).preflight())
      .rejects.toEqual(new V1MigrationStateError("runtime_active"));

    const completed = fixture();
    await activeSuperadmin(completed);
    await completed.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE v1_migration_state SET
            state = 'completed', migration_id = ?, source_sha256 = ?,
            plan_digest = ?, source_schema_version = 1,
            resolution_mode = 'definitions_only',
            activation_generation = 1, completed_at = ?, updated_at = ?
          WHERE singleton = 1
        `, [MIGRATION_ID, "a".repeat(64), "b".repeat(64), NOW, NOW]);
      }),
    });
    await expect(new V1MigrationStateRepository(completed).preflight())
      .rejects.toEqual(new V1MigrationStateError("already_completed"));
  });

  it("enforces completed marker and remediation target invariants", async () => {
    const worker = fixture();
    await activeSuperadmin(worker);
    await insertService(worker);
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        expect(() => transaction.run(`
          UPDATE v1_migration_state SET
            state = 'completed', migration_id = ?, source_sha256 = ?,
            plan_digest = ?, source_schema_version = 1,
            resolution_mode = 'resolved_credentials',
            service_count = 1, retained_slug_count = 1,
            configured_credential_count = 2,
            activation_generation = 1, completed_at = ?, updated_at = ?
          WHERE singleton = 1
        `, [MIGRATION_ID, "a".repeat(64), "b".repeat(64), NOW, NOW]))
          .toThrow();

        transaction.run(`
          UPDATE v1_migration_state SET
            state = 'completed', migration_id = ?, source_sha256 = ?,
            plan_digest = ?, source_schema_version = 1,
            resolution_mode = 'definitions_only',
            service_count = 1, retained_slug_count = 1,
            activation_generation = 1, completed_at = ?, updated_at = ?
          WHERE singleton = 1
        `, [MIGRATION_ID, "a".repeat(64), "b".repeat(64), NOW, NOW]);
        transaction.run(`
          INSERT INTO migration_remediations (
            id, migration_id, service_id, target_id, task_kind, state,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, 'assign_service_admin', 'open', 1, ?, ?)
        `, [REMEDIATION_ID, MIGRATION_ID, SERVICE_ID, NOW, NOW]);
        expect(() => transaction.run(`
          INSERT INTO migration_remediations (
            id, migration_id, service_id, target_id, task_kind, state,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, 'assign_service_admin', 'open', 1, ?, ?)
        `, [
          "018f1f2e-7b3c-7a10-8000-000000000031",
          MIGRATION_ID,
          SERVICE_ID,
          NOW,
          NOW,
        ])).toThrow();
      }),
    });
  });
});

function fixture(): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "v1-migration-state-")),
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

async function insertService(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO services (
          id, slug, name, lifecycle, draft_digest, publication_generation,
          version, created_at, updated_at
        ) VALUES (?, 'legacy-service', 'Legacy service', 'draft', ?, 0, 1, ?, ?)
      `, [SERVICE_ID, "c".repeat(64), NOW, NOW]);
      transaction.run(`
        INSERT INTO service_assignment_states (
          service_id, version, authorization_generation, created_at, updated_at
        ) VALUES (?, 1, 0, ?, ?)
      `, [SERVICE_ID, NOW, NOW]);
    }),
  });
}
