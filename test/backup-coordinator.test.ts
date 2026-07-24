import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BackupCoordinatorError,
  PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
  PortableBackupCoordinator,
  type BackupStepUpConsumer,
  type BackupVaultExporter,
} from "../src/backupCoordinator.js";
import {
  PortableBackupProjectionService,
  type PortableBackupProjection,
} from "../src/backupProjection.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import { parsePortableArchive } from "../src/portableArchive.js";
import type { AdministrativeAuditEventInput } from "../src/persistence/administrativeAudit.js";
import type { PersistenceTransaction } from "../src/persistence/transaction.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { VaultBackupSelection } from "../src/vault/backupSelection.js";
import { VaultBackupCapabilityIssuer } from "../src/vault/capabilities.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const API_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const LOCATOR = "12345678-1234-4234-8234-123456789abc";
const CORRELATION_ID = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("portable backup coordinator", () => {
  it("creates an exact stepped-up encrypted archive and finalizes safe state", async () => {
    const worker = await fixtureWorker();
    const projection = projectionSource(true);
    const vault = new CapturingVault();
    const passphrase = Buffer.from("correct horse battery staple");
    const coordinator = makeCoordinator(worker, projection.source, vault);
    const result = await coordinator.create({
      actor: browserActor(),
      includeSecrets: true,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
      passphrase,
      stepUpProof: proof(),
    });

    expect(result.mode).toBe("encrypted-secrets");
    expect(result.bytes).toBe(result.archive.byteLength);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(passphrase).toEqual(Buffer.alloc(passphrase.byteLength));
    expect(vault.calls).toEqual([{
      selection: [{
        serviceId: SERVICE_ID,
        destinationId: SERVICE_ID,
        credentialId: CREDENTIAL_ID,
        locator: LOCATOR,
        generation: 3,
      }],
      passphrase: "correct horse battery staple",
    }]);
    const parsed = parsePortableArchive(result.archive);
    expect(parsed.entries.get("secrets.enc"))
      .toEqual(Buffer.from([0x53, 0x53, 0x56, 0x41]));

    const state = await worker.execute({
      run: (database) => database.read((query) => query.get<{
        state: string;
        outcome_code: string;
        archive_sha256: string;
        archive_bytes: number;
        credential_count: number;
      }>(`
        SELECT state, outcome_code, archive_sha256, archive_bytes,
          credential_count
        FROM backup_export_authorizations WHERE id = ?
      `, [result.archiveId])),
    });
    expect(state).toEqual({
      state: "completed",
      outcome_code: "completed",
      archive_sha256: result.sha256,
      archive_bytes: result.bytes,
      credential_count: 1,
    });
    expect(await auditCount(worker)).toBe(2);
    const serializedAudit = await allAuditText(worker);
    expect(serializedAudit).not.toContain("correct horse");
    expect(serializedAudit).not.toContain(LOCATOR);
    expect(serializedAudit).not.toContain("53535641");
    expect(projection.calls).toBe(1);
    result.archive.fill(0);
  });

  it("allows a current system key to create only credential-less backups", async () => {
    const worker = await fixtureWorker();
    const projection = projectionSource(false);
    const vault = new CapturingVault();
    const coordinator = makeCoordinator(worker, projection.source, vault);
    const result = await coordinator.create({
      actor: systemActor(),
      includeSecrets: false,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
    });
    expect(result.mode).toBe("credential-less");
    expect(vault.calls).toHaveLength(0);
    expect(await authorizationCount(worker)).toBe(0);
    expect(await auditCount(worker)).toBe(1);
    result.archive.fill(0);

    const passphrase = Buffer.from("system cannot export values");
    await expect(coordinator.create({
      actor: systemActor(),
      includeSecrets: true,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
      passphrase,
    })).rejects.toEqual(new BackupCoordinatorError("forbidden"));
    expect(passphrase).toEqual(Buffer.alloc(passphrase.byteLength));
    expect(projection.calls).toBe(1);
    expect(vault.calls).toHaveLength(0);
    expect(await auditCount(worker)).toBe(2);
  });

  it("denies non-superadmins and invalid acknowledgement before projection or vault", async () => {
    const worker = await fixtureWorker();
    const projection = projectionSource(false);
    const vault = new CapturingVault();
    const coordinator = makeCoordinator(worker, projection.source, vault);
    await expect(coordinator.create({
      actor: { ...browserActor(), role: "admin" },
      includeSecrets: false,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
      stepUpProof: proof(),
    })).rejects.toEqual(new BackupCoordinatorError("forbidden"));
    await expect(coordinator.create({
      actor: browserActor(),
      includeSecrets: false,
      acknowledgement: "I understand some exclusions.",
      correlationId: CORRELATION_ID,
      stepUpProof: proof(),
    })).rejects.toEqual(new BackupCoordinatorError("invalid"));
    expect(projection.calls).toBe(0);
    expect(vault.calls).toHaveLength(0);
    expect(await auditCount(worker)).toBe(1);
  });

  it("finalizes claimed authorization as failed and returns no artifact on vault failure", async () => {
    const worker = await fixtureWorker();
    const projection = projectionSource(true);
    const vault = new CapturingVault();
    vault.failure = true;
    const passphrase = Buffer.from("failure path passphrase");
    await expect(makeCoordinator(worker, projection.source, vault).create({
      actor: browserActor(),
      includeSecrets: true,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
      passphrase,
      stepUpProof: proof(),
    })).rejects.toEqual(new BackupCoordinatorError("vault_unavailable"));
    expect(passphrase).toEqual(Buffer.alloc(passphrase.byteLength));
    const state = await worker.execute({
      run: (database) => database.read((query) => query.get<{
        state: string;
        outcome_code: string;
        archive_sha256: null;
        archive_bytes: null;
      }>(`
        SELECT state, outcome_code, archive_sha256, archive_bytes
        FROM backup_export_authorizations
      `)),
    });
    expect(state).toEqual({
      state: "failed",
      outcome_code: "vault_unavailable",
      archive_sha256: null,
      archive_bytes: null,
    });
    expect(await auditCount(worker)).toBe(2);
  });

  it("enforces three attempts per minute before projection", async () => {
    const worker = await fixtureWorker();
    const projection = projectionSource(false);
    const coordinator = makeCoordinator(worker, projection.source);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await coordinator.create({
        actor: systemActor(),
        includeSecrets: false,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
        correlationId: CORRELATION_ID,
      });
      result.archive.fill(0);
    }
    await expect(coordinator.create({
      actor: systemActor(),
      includeSecrets: false,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      correlationId: CORRELATION_ID,
    })).rejects.toEqual(new BackupCoordinatorError("rate_limited"));
    expect(projection.calls).toBe(3);
    expect(await auditCount(worker)).toBe(4);
  });

  it("bounds concurrent generation at two and removes expired authorizations", async () => {
    const worker = await fixtureWorker();
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO backup_export_authorizations (
            id, subject_user_id, operation_digest, state, credential_count,
            expires_at, version, created_at, updated_at
          ) VALUES (
            '018f1f2e-7b3c-7a10-8000-000000000090', ?, ?, 'expired', 0,
            ?, 1, ?, ?
          )
        `, [USER_ID, "a".repeat(64), NOW - 1, NOW - 10, NOW - 10]);
      }),
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const source = {
      project: async () => {
        calls += 1;
        await gate;
        return portableProjection(false);
      },
    } as unknown as PortableBackupProjectionService;
    const coordinator = coordinatorForSystem(worker, source);
    const first = coordinator.create(systemRequest());
    const second = coordinator.create(systemRequest());
    await waitFor(() => calls === 2);
    await expect(coordinator.create(systemRequest()))
      .rejects.toEqual(new BackupCoordinatorError("busy"));
    expect(calls).toBe(2);
    release();
    const results = await Promise.all([first, second]);
    for (const result of results) result.archive.fill(0);
    expect(await authorizationCount(worker)).toBe(0);
  });
});

class CapturingVault implements BackupVaultExporter {
  calls: Array<{ selection: VaultBackupSelection[]; passphrase: string }> = [];
  failure = false;

  async exportEncrypted(
    _capability: string,
    passphrase: Uint8Array,
    selection: readonly VaultBackupSelection[],
  ): Promise<Buffer> {
    this.calls.push({
      selection: selection.map((item) => ({ ...item })),
      passphrase: Buffer.from(passphrase).toString(),
    });
    if (this.failure) throw new Error("private downstream failure");
    return Buffer.from([0x53, 0x53, 0x56, 0x41]);
  }
}

function makeCoordinator(
  worker: PersistenceWorker,
  projection: PortableBackupProjectionService,
  vault?: BackupVaultExporter,
): PortableBackupCoordinator {
  const stepUps: BackupStepUpConsumer = {
    withConsumedProof: async (_handle, audit, mutation) => worker.execute({
      run: (database) => database.withAdministrativeAudit(
        audit,
        (transaction) => mutation(transaction),
      ),
    }),
  };
  return new PortableBackupCoordinator(
    worker,
    "0.1.0-test",
    vault,
    new VaultBackupCapabilityIssuer(Buffer.alloc(32, 9), () => NOW),
    stepUps,
    () => NOW,
    projection,
  );
}

function coordinatorForSystem(
  worker: PersistenceWorker,
  projection: PortableBackupProjectionService,
): PortableBackupCoordinator {
  return new PortableBackupCoordinator(
    worker,
    "0.1.0-test",
    undefined,
    undefined,
    undefined,
    () => NOW,
    projection,
  );
}

function projectionSource(includeSecrets: boolean): {
  source: PortableBackupProjectionService;
  calls: number;
} {
  const state = {
    calls: 0,
    source: undefined as unknown as PortableBackupProjectionService,
  };
  state.source = {
    project: async (input: { includeSecrets: boolean }) => {
      state.calls += 1;
      expect(input.includeSecrets).toBe(includeSecrets);
      return portableProjection(includeSecrets);
    },
  } as PortableBackupProjectionService;
  return state;
}

function portableProjection(includeSecrets: boolean): PortableBackupProjection {
  return {
    mode: includeSecrets ? "encrypted-secrets" : "credential-less",
    counts: {
      services: 1,
      destinations: 0,
      credentials: includeSecrets ? 1 : 0,
      policies: 0,
      rules: 0,
      secrets: includeSecrets ? 1 : 0,
    },
    documents: {
      services: Buffer.from("kind: services\nschema_version: 1\nservices: []\n"),
      credentials: Buffer.from("kind: credentials\nschema_version: 1\ncredentials: []\n"),
      policies: Buffer.from("kind: policies\nschema_version: 1\npolicies: []\n"),
    },
    secretSelection: includeSecrets
      ? [{
          serviceId: SERVICE_ID,
          destinationId: SERVICE_ID,
          credentialId: CREDENTIAL_ID,
          locator: LOCATOR,
          generation: 3,
        }]
      : [],
  };
}

async function fixtureWorker(): Promise<PersistenceWorker> {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "backup-coordinator-")),
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
        ) VALUES (?, 'backup@example.org', 'backup@example.org', 'Backup',
          'Admin', 'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [USER_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at
        ) VALUES (?, 'abcdefghijklmnop', ?, 'Backup automation', 'wxyz',
          'system', NULL, 'forever', NULL, 'active', ?, 1, ?, ?)
      `, [
        API_KEY_ID,
        `$argon2id$v=19$m=65536,t=3,p=1$${"a".repeat(22)}$${"b".repeat(43)}`,
        USER_ID,
        NOW,
        NOW,
      ]);
    }),
  });
  return worker;
}

function browserActor() {
  return {
    method: "browser_session" as const,
    principalId: USER_ID,
    role: "superadmin" as const,
  };
}

function systemActor() {
  return {
    method: "api_key" as const,
    principalId: API_KEY_ID,
    role: "system" as const,
    apiKey: {
      nickname: "Backup automation",
      lastFour: "wxyz",
    },
  };
}

function systemRequest() {
  return {
    actor: systemActor(),
    includeSecrets: false,
    acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    correlationId: CORRELATION_ID,
  };
}

function proof(): AlwaysStepUpHandle {
  return new AlwaysStepUpHandle(
    "018f1f2e-7b3c-7a10-8000-000000000071",
    "018f1f2e-7b3c-7a10-8000-000000000072",
    USER_ID,
  );
}

async function auditCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.administrativeAuditCount(),
  });
}

async function authorizationCount(worker: PersistenceWorker): Promise<number> {
  return worker.execute({
    run: (database) => database.read((query) =>
      query.get<{ count: number }>(`
        SELECT count(*) AS count FROM backup_export_authorizations
      `)!.count),
  });
}

async function allAuditText(worker: PersistenceWorker): Promise<string> {
  return worker.execute({
    run: (database) => database.read((query) =>
      JSON.stringify(query.all(`
        SELECT actor_label_snapshot, target_label_snapshot, changes_json,
          failure_code
        FROM administrative_audit_events ORDER BY sequence
      `))),
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for coordinator state.");
}
