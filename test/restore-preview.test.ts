import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPortableArchive } from "../src/portableArchive.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  RestorePreviewCoordinator,
  RestorePreviewError,
} from "../src/restorePreview.js";
import {
  PrivateRestoreStageStore,
  RestoreStageCoordinator,
} from "../src/restoreStaging.js";
import { RestoreStateRepository } from "../src/restoreState.js";
import { VaultRemoteError } from "../src/vault/client.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
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

describe("restore preview coordinator", () => {
  it("binds deterministic comparison counts and falls back for missing or wrong passphrases", async () => {
    const validateRestore = vi.fn(async (
      _capability: string,
      passphrase: Uint8Array,
    ) => {
      if (Buffer.from(passphrase).toString("utf8") !== "correct passphrase") {
        throw new VaultRemoteError("vault_archive_authentication_failed");
      }
      return { validated: true as const, recordCount: 1 };
    });
    const context = await fixture(validateRestore);
    const stage = await context.stages.stage({
      actor: actor(),
      archive: encryptedArchive(),
    });

    const missing = await context.previews.preview({
      actor: actor(),
      stageId: stage.id,
    });
    expect(missing).toMatchObject({
      secretDisposition: "configuration_only",
      confirmationPhrase: `RESTORE ${ARCHIVE_ID}`,
      counts: {
        services: 1,
        destinations: 1,
        credentials: 1,
        policies: 1,
        rules: 1,
        availableSecrets: 0,
        unavailableSecrets: 1,
        replacements: 0,
        removals: 0,
        revokedApiKeys: 0,
        revokedSessions: 0,
        revokedOauthGrants: 0,
        remediations: 6,
      },
    });
    expect(validateRestore).not.toHaveBeenCalled();

    const wrongPassphrase = Buffer.from("incorrect passphrase");
    const wrong = await context.previews.preview({
      actor: actor(),
      stageId: stage.id,
      passphrase: wrongPassphrase,
    });
    expect(wrong.secretDisposition).toBe("configuration_only");
    expect(wrong.planDigest).toBe(missing.planDigest);
    expect(wrongPassphrase.every((byte) => byte === 0)).toBe(true);

    const correctPassphrase = Buffer.from("correct passphrase");
    const correct = await context.previews.preview({
      actor: actor(),
      stageId: stage.id,
      passphrase: correctPassphrase,
    });
    expect(correct).toMatchObject({
      secretDisposition: "encrypted_secrets",
      counts: {
        availableSecrets: 1,
        unavailableSecrets: 0,
        remediations: 4,
      },
    });
    expect(correct.planDigest).not.toBe(missing.planDigest);
    expect(correctPassphrase.every((byte) => byte === 0)).toBe(true);
    expect(validateRestore).toHaveBeenCalledTimes(2);
  });

  it("fails before archive or vault work when no active superadmin remains", async () => {
    const validateRestore = vi.fn();
    const context = await fixture(validateRestore);
    const stage = await context.stages.stage({
      actor: actor(),
      archive: encryptedArchive(),
    });
    await context.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE users SET status = 'deactivated', updated_at = ?, version = version + 1 WHERE id = ?",
          [NOW, USER_ID],
        );
      }),
    });
    await expect(context.previews.preview({
      actor: actor(),
      stageId: stage.id,
      passphrase: Buffer.from("correct passphrase"),
    })).rejects.toEqual(new RestorePreviewError("conflict"));
    expect(validateRestore).not.toHaveBeenCalled();
  });
});

async function fixture(validateRestore: ReturnType<typeof vi.fn>) {
  const directory = mkdtempSync(join(tmpdir(), "restore-preview-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
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
  const repository = new RestoreStateRepository(worker, () => NOW);
  const stages = new RestoreStageCoordinator(
    repository,
    new PrivateRestoreStageStore(directory),
    () => NOW,
  );
  return {
    worker,
    stages,
    previews: new RestorePreviewCoordinator(
      worker,
      stages,
      repository,
      { validateRestore },
      { issueBackup: vi.fn(() => "capability") } as never,
      () => NOW,
    ),
  };
}

function actor() {
  return {
    method: "browser_session" as const,
    principalId: USER_ID,
    role: "superadmin" as const,
  };
}

function encryptedArchive(): Buffer {
  const services = {
    kind: "services",
    schema_version: 1,
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
  };
  const credentials = {
    credentials: [{
      id: CREDENTIAL_ID,
      name: "Widget key",
      secret_record: { generation: 1, locator: LOCATOR },
      service_id: SERVICE_ID,
      status: "configured",
      usage: {
        enforce_header_ownership: true,
        kind: "header",
        name: "X-Widget-Key",
      },
    }],
    kind: "credentials",
    schema_version: 1,
  };
  const policies = {
    kind: "policies",
    policies: [{
      credential_id: CREDENTIAL_ID,
      id: POLICY_ID,
      lifecycle: "active",
      name: "Widget access",
      operating_mode: "allow",
      rules: [{
        effect: "allow",
        enabled: true,
        hosts: [{ kind: "exact", value: "api.example.org" }],
        id: RULE_ID,
        methods: ["GET"],
        name: "Allow widgets",
        paths: [{ kind: "prefix", value: "/widgets" }],
        priority: 100,
        response_safeguards: {
          binary_response: { max_bytes: 1024, scan: true },
          secretlint: { disabled_rule_ids: [], enabled: true },
        },
      }],
      service_id: SERVICE_ID,
    }],
    schema_version: 1,
  };
  return createPortableArchive({
    archiveId: ARCHIVE_ID,
    productVersion: "test",
    createdAtUtcMs: NOW,
    mode: "encrypted-secrets",
    counts: {
      services: 1,
      destinations: 1,
      credentials: 1,
      policies: 1,
      rules: 1,
      secrets: 1,
    },
    documents: {
      services: yaml(services),
      credentials: yaml(credentials),
      policies: yaml(policies),
    },
    secrets: Buffer.from("opaque encrypted vault archive"),
  }).archive;
}

function yaml(value: unknown): Buffer {
  return Buffer.from(stringifyYaml(value, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
    sortMapEntries: true,
  }));
}
