import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { generateControlOpenApi } from "../src/control/openapi.js";
import { registerRecoveryRoutes } from "../src/control/recoveryRoutes.js";
import { ControlRouteRegistry } from "../src/control/routeRegistry.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  RecoveryRemediationError,
  RecoveryRemediationService,
} from "../src/recoveryRemediations.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const MIGRATION_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const TASK_ADMIN = "018f1f2e-7b3c-7a10-8000-000000000030";
const TASK_ACCESS = "018f1f2e-7b3c-7a10-8000-000000000031";
const STAGE_ID = "018f1f2e-7b3c-7a10-8000-000000000040";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000041";
const STORAGE_ID = "018f1f2e-7b3c-7a10-8000-000000000042";
const RESTORE_ID = "018f1f2e-7b3c-7a10-8000-000000000050";
const RESTORE_TASK = "018f1f2e-7b3c-7a10-8000-000000000060";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("durable recovery remediation projection", () => {
  it("merges bounded migration and restore work and derives completed tasks from current state", async () => {
    const worker = fixture();
    await seed(worker);
    const recovery = new RecoveryRemediationService(worker);

    const first = await recovery.snapshot(superadmin(), { limit: 2 });

    expect(first).toMatchObject({
      migration: {
        state: "completed",
        migrationId: MIGRATION_ID,
        services: 1,
        discardedAclEntries: 3,
      },
      latestRestore: {
        restoreId: RESTORE_ID,
        state: "completed",
        outcomeCode: "completed",
      },
      counts: { total: 3, open: 2, completed: 1, dismissed: 0 },
    });
    expect(first.tasks).toEqual([
      expect.objectContaining({
        kind: "migration",
        id: TASK_ADMIN,
        serviceSlug: "migrated-service",
        state: "completed",
        derivedFromCurrentState: true,
      }),
      expect.objectContaining({
        kind: "migration",
        id: TASK_ACCESS,
        state: "open",
      }),
    ]);
    expect(first.nextCursor).toBe(`migration:${TASK_ACCESS}`);

    const second = await recovery.snapshot(superadmin(), {
      cursor: first.nextCursor,
    });
    expect(second.tasks).toEqual([
      expect.objectContaining({
        kind: "restore",
        id: RESTORE_TASK,
        state: "open",
      }),
    ]);
    expect(second.nextCursor).toBeUndefined();

    const rendered = JSON.stringify({ first, second });
    for (const forbidden of [
      "private-user@example.org",
      "/private/v1.yaml",
      "api.private.example",
      "credential-value",
      "vault-locator",
      "a".repeat(64),
      "b".repeat(64),
    ]) expect(rendered).not.toContain(forbidden);
  });

  it("rejects non-browser/non-superadmin actors and malformed bounds safely", async () => {
    const worker = fixture();
    await seed(worker);
    const recovery = new RecoveryRemediationService(worker);

    for (const actor of [
      { ...superadmin(), role: "admin" as const },
      { ...superadmin(), method: "api_key" as const },
    ]) {
      await expect(recovery.snapshot(actor)).rejects.toEqual(
        new RecoveryRemediationError("forbidden"),
      );
    }
    for (const input of [
      { limit: 0 },
      { limit: 101 },
      { cursor: "restore:not-a-uuid" },
      { cursor: `unknown:${RESTORE_TASK}` },
    ]) {
      await expect(recovery.snapshot(superadmin(), input)).rejects.toEqual(
        new RecoveryRemediationError("invalid_input"),
      );
    }
  });

  it("publishes a strict browser-only no-store OpenAPI contract", () => {
    const registry = new ControlRouteRegistry();
    registerRecoveryRoutes(registry, {} as never);
    const route = registry.definitions()[0]!;
    expect(route).toMatchObject({
      id: "recovery.remediations.get",
      authentication: ["browser_session"],
      expandApiKeyAuthentication: false,
      permission: "manage_global_settings",
      stepUp: "none",
      cache: "no-store",
    });
    expect(route.schemas.query!.safeParse({
      limit: "100",
      cursor: `restore:${RESTORE_TASK}`,
    }).success).toBe(true);
    for (const query of [
      { limit: "0" },
      { limit: "101" },
      { cursor: "not-a-cursor" },
      { unexpected: "field" },
    ]) expect(route.schemas.query!.safeParse(query).success).toBe(false);

    const document = generateControlOpenApi(
      registry,
      "https://control.example.org",
    );
    expect(document.paths["/api/v2/recovery/remediations"]?.get)
      .toMatchObject({
        "x-authentication-methods": ["browser_session"],
        "x-permission": "manage_global_settings",
      });
  });
});

function fixture(): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "recovery-remediation-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

async function seed(worker: PersistenceWorker): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at,
          updated_at
        ) VALUES (?, 'root@example.org', 'root@example.org', 'Root', 'Admin',
          'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [USER_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO services (
          id, slug, name, lifecycle, draft_digest, publication_generation,
          version, created_at, updated_at
        ) VALUES (?, 'migrated-service', 'Migrated service', 'draft', ?, 0, 1, ?, ?)
      `, [SERVICE_ID, "c".repeat(64), NOW, NOW]);
      transaction.run(`
        INSERT INTO service_assignment_states (
          service_id, version, authorization_generation, created_at, updated_at
        ) VALUES (?, 1, 0, ?, ?)
      `, [SERVICE_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO service_admins (
          service_id, user_id, assigned_by_user_id, created_at
        ) VALUES (?, ?, ?, ?)
      `, [SERVICE_ID, USER_ID, USER_ID, NOW]);
      transaction.run(`
        UPDATE v1_migration_state SET
          state = 'completed', migration_id = ?, source_sha256 = ?,
          plan_digest = ?, source_schema_version = 1,
          resolution_mode = 'definitions_only',
          service_count = 1, credential_count = 1,
          configured_credential_count = 0, discarded_acl_count = 3,
          retained_slug_count = 1, activation_generation = 1,
          completed_at = ?, updated_at = ?
        WHERE singleton = 1
      `, [MIGRATION_ID, "a".repeat(64), "b".repeat(64), NOW, NOW]);
      for (const [id, kind] of [
        [TASK_ADMIN, "assign_service_admin"],
        [TASK_ACCESS, "assign_service_access"],
      ]) {
        transaction.run(`
          INSERT INTO migration_remediations (
            id, migration_id, service_id, task_kind, state, version,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'open', 1, ?, ?)
        `, [id, MIGRATION_ID, SERVICE_ID, kind, NOW, NOW]);
      }
      transaction.run(`
        INSERT INTO restore_stages (
          id, subject_user_id, archive_id, archive_type, schema_version,
          storage_key, archive_sha256, archive_bytes, state, expires_at,
          completed_at, version, created_at, updated_at
        ) VALUES (?, ?, ?, 'secretsauce-portable-configuration', 1, ?, ?, 100,
          'completed', ?, ?, 1, ?, ?)
      `, [
        STAGE_ID,
        USER_ID,
        ARCHIVE_ID,
        STORAGE_ID,
        "d".repeat(64),
        NOW + 60_000,
        NOW,
        NOW,
        NOW,
      ]);
      transaction.run(`
        INSERT INTO restore_previews (
          id, stage_id, subject_user_id, archive_sha256, plan_digest,
          secret_disposition, service_count, destination_count,
          credential_count, policy_count, rule_count, available_secret_count,
          unavailable_secret_count, replacement_count, removal_count,
          revoked_api_key_count, revoked_session_count,
          revoked_oauth_grant_count, remediation_count, confirmation_phrase,
          state, expires_at, claimed_at, completed_at, outcome_code, version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'configuration_only', 1, 1, 1, 1, 1, 0, 1,
          1, 0, 0, 0, 0, 1, ?, 'completed', ?, ?, ?, 'completed', 1, ?, ?)
      `, [
        RESTORE_ID,
        STAGE_ID,
        USER_ID,
        "d".repeat(64),
        "e".repeat(64),
        `RESTORE ${ARCHIVE_ID}`,
        NOW + 60_000,
        NOW,
        NOW,
        NOW,
        NOW,
      ]);
      transaction.run(`
        INSERT INTO restore_remediations (
          id, restore_id, service_id, task_kind, state, version,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'validate_publish_service', 'open', 1, ?, ?)
      `, [RESTORE_TASK, RESTORE_ID, SERVICE_ID, NOW, NOW]);
    }),
  });
}

function superadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: USER_ID,
    role: "superadmin",
  };
}
