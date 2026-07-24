import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DecodedRestoreArchive } from "../src/restoreArchive.js";
import {
  RestoreReplacementError,
  RestoreReplacementRepository,
} from "../src/restoreReplacement.js";
import { RestoreStateRepository } from "../src/restoreState.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const OPERATION_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const POLICY_ID = "018f1f2e-7b3c-7a10-8000-000000000030";
const RULE_ID = "018f1f2e-7b3c-7a10-8000-000000000031";
const LOCATOR = "018f1f2e-7b3c-4a10-8000-000000000040";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("atomic portable restore replacement", () => {
  it("preserves identity while restoring draft, unassigned, disabled configuration", async () => {
    const fixture = await setup();
    const result = await fixture.replacement.replace({
      ...fixture.claim,
      decoded: archive(),
      availableSecretCredentialIds: [CREDENTIAL_ID],
    });
    expect(result).toMatchObject({
      services: 1,
      destinations: 1,
      credentials: 1,
      policies: 1,
      rules: 1,
      remediations: 4,
    });

    const state = await fixture.worker.execute({
      run: (database) => database.read((query) => ({
        user: query.get<{ status: string }>(
          "SELECT status FROM users WHERE id = ?",
          [USER_ID],
        ),
        service: query.get<{
          lifecycle: string;
          published_revision_id: string | null;
        }>("SELECT lifecycle, published_revision_id FROM services"),
        credential: query.get<{
          status: string;
          vault_locator: string | null;
          vault_generation: number | null;
        }>("SELECT status, vault_locator, vault_generation FROM service_credentials"),
        rule: query.get<{ enabled: number }>(
          "SELECT enabled FROM policy_rules",
        ),
        admins: query.get<{ total: number }>(
          "SELECT count(*) AS total FROM service_admins",
        )?.total,
        assignments: query.get<{ total: number }>(
          "SELECT count(*) AS total FROM policy_rule_principal_assignments",
        )?.total,
        remediations: query.get<{ total: number }>(
          "SELECT count(*) AS total FROM restore_remediations",
        )?.total,
        globalEpoch: query.get<{ value: number }>(
          "SELECT global_security_epoch AS value FROM identity_security_state WHERE singleton = 1",
        )?.value,
        restorePhase: query.get<{ phase: string }>(
          "SELECT phase FROM restore_state WHERE singleton = 1",
        )?.phase,
        audits: query.get<{ total: number }>(
          "SELECT count(*) AS total FROM administrative_audit_events WHERE action = 'restore.commit'",
        )?.total,
      })),
    });
    expect(state).toEqual({
      user: { status: "active" },
      service: { lifecycle: "draft", published_revision_id: null },
      credential: {
        status: "configured",
        vault_locator: LOCATOR,
        vault_generation: 1,
      },
      rule: { enabled: 0 },
      admins: 0,
      assignments: 0,
      remediations: 4,
      globalEpoch: 2,
      restorePhase: "database_committed",
      audits: 1,
    });
  });

  it("marks missing secrets unconfigured and rolls every stale-plan mutation back", async () => {
    const fixture = await setup();
    await expect(fixture.replacement.replace({
      ...fixture.claim,
      planDigest: "c".repeat(64),
      decoded: archive(),
      availableSecretCredentialIds: [],
    })).rejects.toEqual(new RestoreReplacementError("conflict"));
    expect(await count(fixture.worker, "services")).toBe(0);

    const result = await fixture.replacement.replace({
      ...fixture.claim,
      decoded: archive(),
      availableSecretCredentialIds: [],
    });
    expect(result.remediations).toBe(6);
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) =>
        query.get<{ status: string; locator: string | null }>(`
          SELECT status, vault_locator AS locator FROM service_credentials
        `)),
    })).toEqual({ status: "unconfigured", locator: null });
  });
});

async function setup() {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "restore-replacement-")),
      "control.sqlite",
    ),
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
        ) VALUES (?, 'restore@example.org', 'restore@example.org', 'Restore',
          'Admin', 'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [USER_ID, NOW, NOW]);
    }),
  });
  const state = new RestoreStateRepository(worker, () => NOW);
  const stage = await state.createStage({
    subjectUserId: USER_ID,
    archiveId: ARCHIVE_ID,
    archiveSha256: "a".repeat(64),
    archiveBytes: 100,
  });
  const preview = await state.createPreview({
    stageId: stage.id,
    subjectUserId: USER_ID,
    archiveSha256: "a".repeat(64),
    planDigest: "b".repeat(64),
    secretDisposition: "encrypted_secrets",
    counts: {
      services: 1,
      destinations: 1,
      credentials: 1,
      policies: 1,
      rules: 1,
      availableSecrets: 1,
      unavailableSecrets: 0,
      replacements: 0,
      removals: 0,
      revokedApiKeys: 0,
      revokedSessions: 0,
      revokedOauthGrants: 0,
      remediations: 4,
    },
  });
  await state.claimPreview({
    previewId: preview.id,
    stageId: stage.id,
    subjectUserId: USER_ID,
    archiveSha256: "a".repeat(64),
    planDigest: "b".repeat(64),
  });
  await state.enterMaintenance(OPERATION_ID);
  await state.advanceState(OPERATION_ID, "maintenance", "snapshot_ready");
  await state.advanceState(OPERATION_ID, "snapshot_ready", "vault_applied");
  return {
    worker,
    replacement: new RestoreReplacementRepository(worker, () => NOW),
    claim: {
      operationId: OPERATION_ID,
      previewId: preview.id,
      stageId: stage.id,
      actorId: USER_ID,
      archiveSha256: "a".repeat(64),
      planDigest: "b".repeat(64),
    },
  };
}

function archive(): DecodedRestoreArchive {
  return {
    archiveId: ARCHIVE_ID,
    archiveSha256: "a".repeat(64),
    manifest: {} as never,
    services: [{
      id: SERVICE_ID,
      slug: "widgets",
      name: "Widgets",
      lifecycle: "published",
      destinations: [{
        id: DESTINATION_ID,
        slug: "primary",
        base_url: "https://api.example.org/",
        schemes: ["https"],
        hosts: [{ kind: "exact", value: "api.example.org" }],
        ports: [443],
        tls: { verify: true },
      }],
    }],
    credentials: [{
      id: CREDENTIAL_ID,
      service_id: SERVICE_ID,
      name: "Widget key",
      usage: {
        kind: "header",
        name: "X-Widget-Key",
        enforce_header_ownership: true,
      },
      status: "configured",
      secret_record: { locator: LOCATOR, generation: 1 },
    }],
    policies: [{
      id: POLICY_ID,
      service_id: SERVICE_ID,
      credential_id: CREDENTIAL_ID,
      name: "Widget access",
      operating_mode: "allow",
      lifecycle: "active",
      rules: [{
        id: RULE_ID,
        name: "Allow widgets",
        effect: "allow",
        priority: 100,
        enabled: true,
        methods: ["GET"],
        hosts: [{ kind: "exact", value: "api.example.org" }],
        paths: [{ kind: "prefix", value: "/widgets" }],
        response_safeguards: {
          secretlint: { enabled: true, disabled_rule_ids: [] },
          binary_response: { scan: true, max_bytes: 1024 },
        },
      }],
    }],
    counts: {
      services: 1,
      destinations: 1,
      credentials: 1,
      policies: 1,
      rules: 1,
      secrets: 1,
    },
    secretSelection: [{
      serviceId: SERVICE_ID,
      destinationId: SERVICE_ID,
      credentialId: CREDENTIAL_ID,
      locator: LOCATOR,
      generation: 1,
    }],
    secrets: Buffer.from("opaque"),
  };
}

async function count(worker: PersistenceWorker, table: string): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ total: number }>(
        `SELECT count(*) AS total FROM ${table}`,
      )!.total),
  });
}
