import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  SecuritySettingsError,
  SecuritySettingsRepository,
  SecuritySettingsStore,
  type SecuritySettingsPatch,
  type SecuritySettingsSeed,
} from "../src/securitySettings.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const SYSTEM_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("security settings repository", () => {
  it("initializes exactly once, persists safe defaults, and exposes an immutable snapshot", async () => {
    const fixture = await setup("initialize");
    const initialized = await fixture.repository.initialize(DEFAULT_SEED);
    expect(initialized).toMatchObject({
      passwordMinimumLength: 12,
      passwordPolicyVersion: 1,
      stepUpMode: "five_minutes",
      inactivitySuspensionDays: null,
      suspendedDeactivationDays: null,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const ignoredSeed = {
      ...DEFAULT_SEED,
      passwordMinimumLength: 128,
    };
    expect(await fixture.repository.initialize(ignoredSeed)).toEqual(initialized);
    const store = new SecuritySettingsStore(initialized);
    expect(Object.isFrozen(store.current())).toBe(true);
    expect(() => store.replace(initialized)).toThrow(
      expect.objectContaining({ code: "stale" }),
    );
  });

  it("updates bounded fields optimistically and increments policy version only when stricter", async () => {
    const fixture = await setup("update");
    const initial = await fixture.repository.initialize(DEFAULT_SEED);
    const stricter = await fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: initial.version,
      patch: {
        passwordMinimumLength: 128,
        passwordBlocklistVersion: 2,
        adminSessionAbsoluteMs: 3_600_001,
        adminSessionInactivityMs: 3_600_000,
        inactivitySuspensionDays: 1,
      },
      justification: "Adopt stricter identity policy.",
      correlationId: CORRELATION,
    });
    expect(stricter).toMatchObject({
      passwordMinimumLength: 128,
      passwordBlocklistVersion: 2,
      passwordPolicyVersion: 2,
      adminSessionAbsoluteMs: 3_600_001,
      adminSessionInactivityMs: 3_600_000,
      inactivitySuspensionDays: 1,
      version: 2,
    });

    const relaxed = await fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: stricter.version,
      patch: { passwordMinimumLength: 8, inactivitySuspensionDays: null },
      justification: "Use the supported lower boundary.",
      correlationId: CORRELATION,
    });
    expect(relaxed.passwordPolicyVersion).toBe(2);
    await expectSettingsError(fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: stricter.version,
      patch: { searchAttempts: 31 },
      justification: "Stale update.",
      correlationId: CORRELATION,
    }), "stale");

    const policy = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        password_policy_version: number;
      }>(`
        SELECT password_policy_version
        FROM identity_security_state WHERE singleton = 1
      `)),
    });
    expect(policy).toEqual({ password_policy_version: 2 });
    const events = await fixture.worker.execute({
      run: (database) => database.read((query) =>
        query.all<{
          action: string;
          changes_json: string;
        }>(`
          SELECT action, changes_json
          FROM administrative_audit_events ORDER BY occurred_at, event_id
        `)),
    });
    expect(events.filter(({ action }) =>
      action === "security.settings.update")).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("encoded_hash");
    expect(JSON.stringify(events)).not.toContain("password_minimum");
  });

  it("rejects every out-of-range boundary, invalid pair, unknown field, and blocklist rollback", async () => {
    const fixture = await setup("invalid");
    const initial = await fixture.repository.initialize(DEFAULT_SEED);
    const invalidPatches: SecuritySettingsPatch[] = [
      { passwordMinimumLength: 7 },
      { passwordMinimumLength: 129 },
      { passwordBlocklistVersion: 0 },
      { adminSessionAbsoluteMs: 3_599_999 },
      { adminSessionInactivityMs: 7_200_001 },
      { userSessionAbsoluteMs: 259_200_001 },
      { userSessionInactivityMs: 86_400_001 },
      { oauthAccessTokenMs: 59_999 },
      { oauthRefreshInactivityMs: 7_776_000_001 },
      { oauthRefreshAbsoluteMs: 604_799_999 },
      { loginAttempts: 2 },
      { loginWindowMs: 3_600_001 },
      { passwordAttempts: 21 },
      { passwordWindowMs: 299_999 },
      { totpAttempts: 11 },
      { totpWindowMs: 59_999 },
      { managementApiAttempts: 9 },
      { managementApiWindowMs: 3_600_001 },
      { searchAttempts: 4 },
      { searchWindowMs: 59_999 },
      { backupAttempts: 11 },
      { backupWindowMs: 899_999 },
      { inactivitySuspensionDays: 0 },
      { suspendedDeactivationDays: 3_651 },
      { securityJobIntervalMs: 59_999 },
      { securityJobBatchSize: 49 },
      { securityJobWallTimeMs: 120_001 },
      { adminSessionAbsoluteMs: 3_600_000, adminSessionInactivityMs: 3_600_000 },
      {
        oauthRefreshInactivityMs: 604_800_001,
        oauthRefreshAbsoluteMs: 604_800_000,
      },
    ];
    for (const patch of invalidPatches) {
      await expectSettingsError(fixture.repository.update({
        actor: browserSuperadmin(),
        expectedVersion: initial.version,
        patch,
        justification: "Boundary rejection.",
        correlationId: CORRELATION,
      }), "invalid");
    }
    await expectSettingsError(fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: initial.version,
      patch: { unknownSetting: 1 } as SecuritySettingsPatch,
      justification: "Unknown field.",
      correlationId: CORRELATION,
    }), "invalid");

    const raised = await fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: initial.version,
      patch: { passwordBlocklistVersion: 2 },
      justification: "Raise marker.",
      correlationId: CORRELATION,
    });
    await expectSettingsError(fixture.repository.update({
      actor: browserSuperadmin(),
      expectedVersion: raised.version,
      patch: { passwordBlocklistVersion: 1 },
      justification: "Rollback marker.",
      correlationId: CORRELATION,
    }), "invalid");
  });

  it("allows a live system key to tune only its explicit non-interactive fields", async () => {
    const fixture = await setup("system-key");
    const initial = await fixture.repository.initialize(DEFAULT_SEED);
    const system = systemKey();
    const updated = await fixture.repository.update({
      actor: system,
      expectedVersion: initial.version,
      patch: {
        managementApiAttempts: 600,
        searchAttempts: 120,
        backupAttempts: 10,
        securityJobBatchSize: 2_000,
      },
      justification: "Tune bounded automation throughput.",
      correlationId: CORRELATION,
    });
    expect(updated).toMatchObject({
      managementApiAttempts: 600,
      searchAttempts: 120,
      backupAttempts: 10,
      securityJobBatchSize: 2_000,
    });

    await expectSettingsError(fixture.repository.update({
      actor: system,
      expectedVersion: updated.version,
      patch: { stepUpMode: "always" },
      justification: "Must remain interactive.",
      correlationId: CORRELATION,
    }), "forbidden");
    await expectSettingsError(fixture.repository.update({
      actor: { ...system, role: "all_services" },
      expectedVersion: updated.version,
      patch: { searchAttempts: 30 },
      justification: "Wrong API role.",
      correlationId: CORRELATION,
    }), "forbidden");
  });
});

const DEFAULT_SEED: SecuritySettingsSeed = {
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

async function setup(name: string): Promise<{
  worker: PersistenceWorker;
  repository: SecuritySettingsRepository;
}> {
  const file = join(
    mkdtempSync(join(tmpdir(), `secretsauce-security-settings-${name}-`)),
    "control.sqlite",
  );
  const worker = PersistenceWorker.open({
    databaseFile: file,
    productVersion: "0.1.0-test",
    now: () => NOW,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at, updated_at
        ) VALUES (?, 'root@example.org', 'root@example.org', '', '',
          'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [SUPERADMIN_ID, NOW, NOW]);
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at, last_used_at, revoked_at
        ) VALUES (?, 'AQEBAQEBAQEBAQEB', ?, 'System automation', 'CAgI',
          'system', NULL, 'forever', NULL, 'active', ?, 1, ?, ?, NULL, NULL)
      `, [
        SYSTEM_KEY_ID,
        `$argon2id$${"x".repeat(64)}`,
        SUPERADMIN_ID,
        NOW,
        NOW,
      ]);
    }),
  });
  return {
    worker,
    repository: new SecuritySettingsRepository(worker, () => NOW),
  };
}

function browserSuperadmin(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: SUPERADMIN_ID,
    role: "superadmin",
  };
}

function systemKey(): ControlAuthenticationContext {
  return {
    method: "api_key",
    principalId: SYSTEM_KEY_ID,
    role: "system",
    apiKey: { nickname: "System automation", lastFour: "CAgI" },
  };
}

async function expectSettingsError(
  operation: Promise<unknown>,
  code: SecuritySettingsError["code"],
): Promise<void> {
  await expect(operation).rejects.toEqual(expect.objectContaining({ code }));
}
