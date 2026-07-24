import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InactivityJob } from "../src/inactivityJob.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import {
  SecuritySettingsRepository,
  SecuritySettingsStore,
  type SecuritySettingsSeed,
} from "../src/securitySettings.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const START = 1_785_000_000_000;
const DAY = 86_400_000;
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("leased inactivity automation", () => {
  it("uses exact cutoffs, processes ordinary users first, and protects the final superadmin", async () => {
    const now = { value: START };
    const worker = open(now);
    const identities = new IdentityRepository(worker, { now: () => now.value });
    const ordinary = await create(identities, "ordinary", "user");
    await create(identities, "root-one", "superadmin");
    await create(identities, "root-two", "superadmin");
    const settingsRepository = new SecuritySettingsRepository(
      worker,
      () => now.value,
    );
    const initial = await settingsRepository.initialize({
      ...seed(),
      inactivitySuspensionDays: 1,
      suspendedDeactivationDays: 1,
    });
    const store = new SecuritySettingsStore(initial);
    const job = new InactivityJob(worker, () => store.current(), () => now.value);

    now.value += DAY;
    const first = await job.run(true);
    expect(first).toMatchObject({
      lastOutcome: "completed",
      suspendedCount: 2,
      deactivatedCount: 0,
      protectedCount: 1,
      lastCode: "last_superadmin_protected",
    });
    expect(await statuses(worker)).toEqual({
      active_superadmins: 1,
      suspended: 2,
      deactivated: 0,
    });

    now.value += DAY;
    const second = await job.run(true);
    expect(second).toMatchObject({
      deactivatedCount: 2,
      protectedCount: 1,
    });
    expect(await statuses(worker)).toEqual({
      active_superadmins: 1,
      suspended: 0,
      deactivated: 2,
    });
    expect(await worker.execute({
      run: (database) => database.read((query) => query.get<{
        password_state: string;
        totp_state: string;
      }>(`
        SELECT password_state, totp_state
        FROM local_authenticator_states WHERE user_id = ?
      `, [ordinary.id])),
    })).toEqual({ password_state: "disabled", totp_state: "disabled" });
  });

  it("does not cross a newer activity value and respects an unexpired lease", async () => {
    const now = { value: START };
    const worker = open(now);
    const identities = new IdentityRepository(worker, { now: () => now.value });
    const user = await create(identities, "race", "user");
    const repository = new SecuritySettingsRepository(worker, () => now.value);
    const store = new SecuritySettingsStore(await repository.initialize({
      ...seed(),
      inactivitySuspensionDays: 1,
    }));
    now.value += DAY;
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE users SET last_qualifying_activity_at = ?
          WHERE id = ?
        `, [now.value - DAY + 1, user.id]);
      }),
    });
    const job = new InactivityJob(worker, () => store.current(), () => now.value);
    expect((await job.run(true)).suspendedCount).toBe(0);
    await worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE security_job_state
          SET lease_owner = ?, lease_expires_at = ?, version = version + 1
          WHERE job_name = 'inactivity'
        `, [
          "018f1f2e-7b3c-7a10-8000-000000000099",
          now.value + 60_000,
        ]);
      }),
    });
    const before = await job.state();
    expect(await job.run(true)).toEqual(before);
  });

  it("acquires a forced manual run inside an always-proof transaction", async () => {
    const now = { value: START };
    const worker = open(now);
    const identities = new IdentityRepository(worker, { now: () => now.value });
    const root = await create(identities, "proof-root", "superadmin");
    const repository = new SecuritySettingsRepository(worker, () => now.value);
    const store = new SecuritySettingsStore(await repository.initialize(seed()));
    const job = new InactivityJob(worker, () => store.current(), () => now.value);
    let proofTransactionUsed = false;
    const state = await job.run(true, {
      proof: new AlwaysStepUpHandle(
        "018f1f2e-7b3c-7a10-8000-000000000031",
        "018f1f2e-7b3c-7a10-8000-000000000032",
        root.id,
      ),
      stepUps: {
        withConsumedProof: async (_proof, event, mutation) => {
          proofTransactionUsed = true;
          return worker.execute({
            run: (database) => database.withGeneratedAdministrativeAudit(
              (transaction) => ({ value: mutation(transaction), auditInput: event }),
            ),
          });
        },
      },
      audit: {
        actor: {
          type: "browser_session",
          id: root.id,
          label: `user:${root.id}`,
          role: "superadmin",
          authenticationMethod: "browser_session",
        },
        action: "security.inactivity_job.run",
        result: "allow",
        target: { type: "security_job", label: "inactivity" },
        justification: "Run now.",
        correlationId: "req_12345678-1234-4234-8234-123456789abd",
        source: { category: "security" },
      },
    });
    expect(proofTransactionUsed).toBe(true);
    expect(state.lastOutcome).toBe("skipped");
  });
});

async function create(
  repository: IdentityRepository,
  name: string,
  role: "superadmin" | "user",
) {
  return repository.createLocalIdentity({
    profile: {
      email: `${name}@example.org`,
      givenName: name,
      familyName: "User",
    },
    role,
    status: "active",
  }, audit());
}

function seed(): SecuritySettingsSeed {
  return {
    passwordMinimumLength: 12,
    passwordBlocklistVersion: 1,
    adminSessionAbsoluteMs: 43_200_000,
    adminSessionInactivityMs: 900_000,
    userSessionAbsoluteMs: 86_400_000,
    userSessionInactivityMs: 3_600_000,
    oauthAccessTokenMs: 300_000,
    oauthRefreshInactivityMs: 2_592_000_000,
    oauthRefreshAbsoluteMs: 7_776_000_000,
    stepUpMode: "five_minutes",
    loginAttempts: 10,
    loginWindowMs: 900_000,
    passwordAttempts: 10,
    passwordWindowMs: 900_000,
    totpAttempts: 5,
    totpWindowMs: 300_000,
    managementApiAttempts: 120,
    managementApiWindowMs: 60_000,
    searchAttempts: 30,
    searchWindowMs: 60_000,
    backupAttempts: 2,
    backupWindowMs: 3_600_000,
    inactivitySuspensionDays: null,
    suspendedDeactivationDays: null,
    securityJobIntervalMs: 300_000,
    securityJobBatchSize: 500,
    securityJobWallTimeMs: 30_000,
  };
}

function statuses(worker: PersistenceWorker) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      active_superadmins: number;
      suspended: number;
      deactivated: number;
    }>(`
      SELECT
        count(*) FILTER (
          WHERE role = 'superadmin' AND status = 'active'
        ) AS active_superadmins,
        count(*) FILTER (WHERE status = 'suspended') AS suspended,
        count(*) FILTER (WHERE status = 'deactivated') AS deactivated
      FROM users
    `)),
  });
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "inactivity-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
    source: { category: "identity" },
  };
}

function open(now: { value: number }): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "secretsauce-inactivity-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => now.value,
  });
  workers.add(worker);
  return worker;
}
