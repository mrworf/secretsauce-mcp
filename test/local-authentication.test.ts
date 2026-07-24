import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalAuthenticationError,
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../src/identity/localAuthentication.js";
import { hashPassword } from "../src/identity/password.js";
import {
  IdentityKeyRing,
  beginTotpEnrollment,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import type { IdentityConfig } from "../src/types.js";
import type { SecuritySettings } from "../src/securitySettings.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const services = new Set<LocalAuthenticationService>();

afterEach(async () => {
  for (const service of services) service.close();
  services.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("atomic local authentication", () => {
  it("verifies an MCP proof without creating a browser session or consuming the TOTP step", async () => {
    const fixture = await configuredIdentity("mcp-proof");
    const code = totpCode(fixture.seed, NOW);
    await expect(fixture.service.verifyMcpProof(
      loginInput(fixture.email, fixture.password, code),
    )).resolves.toMatchObject({
      userId: fixture.userId,
      role: "admin",
      securityEpoch: 1,
      globalSecurityEpoch: 1,
      acceptedTotpStep: Math.floor(NOW / 30_000),
      verifiedAt: NOW,
      correlationId: CORRELATION,
    });
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        sessions: number;
        steps: number;
      }>(`
        SELECT
          (SELECT count(*) FROM browser_sessions) AS sessions,
          (SELECT count(*) FROM accepted_totp_steps) AS steps
      `)),
    })).toEqual({ sessions: 0, steps: 0 });

    await expect(fixture.service.login(
      loginInput(fixture.email, fixture.password, code),
    )).resolves.toMatchObject({ userId: fixture.userId });
    fixture.seed.fill(0);
  });

  it("authenticates an active configured identity, consumes TOTP, and persists only hashed session values", async () => {
    const fixture = await configuredIdentity("success");
    const code = totpCode(fixture.seed, NOW);
    const result = await fixture.service.login(loginInput(fixture.email, fixture.password, code));

    expect(result).toMatchObject({
      userId: fixture.userId,
      role: "admin",
      issuedAt: NOW,
      absoluteExpiresAt: NOW + 12 * 3_600_000,
    });
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        sessions: number;
        steps: number;
        session_hash: string;
        csrf_hash: string;
        last_login_at: number;
        audit: string;
      }>(`
        SELECT
          (SELECT count(*) FROM browser_sessions) AS sessions,
          (SELECT count(*) FROM accepted_totp_steps) AS steps,
          (SELECT session_hash FROM browser_sessions) AS session_hash,
          (SELECT csrf_hash FROM browser_sessions) AS csrf_hash,
          (SELECT last_login_at FROM users WHERE id = ?) AS last_login_at,
          (SELECT group_concat(action || ':' || target_label_snapshot)
             FROM administrative_audit_events) AS audit
      `, [fixture.userId])),
    });
    expect(stored).toMatchObject({
      sessions: 1,
      steps: 1,
      session_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      csrf_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      last_login_at: NOW,
    });
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(result.sessionToken);
    expect(serialized).not.toContain(result.csrfToken);
    expect(serialized).not.toContain(fixture.password);
    expect(serialized).not.toContain(code);
    expect(stored?.audit).toContain(`identity.login:user:${fixture.userId}`);

    await expect(fixture.service.login(loginInput(fixture.email, fixture.password, code)))
      .rejects.toEqual(new LocalAuthenticationError("authentication_failed"));
    fixture.seed.fill(0);
  });

  it("survives persistence restart with stable keys and permits only a fresh TOTP step", async () => {
    const fixture = await configuredIdentity("restart");
    await fixture.worker.close();
    workers.delete(fixture.worker);
    fixture.service.close();
    services.delete(fixture.service);

    const worker = open(fixture.databaseFile);
    const repository = new LocalAuthenticationRepository(worker, { now: () => NOW + 30_000 });
    const keyRing = new IdentityKeyRing("root", { root: fixture.rootKey });
    const service = await LocalAuthenticationService.create({
      repository,
      config: identityConfig(),
      keyRing,
      sessionHmacKey: fixture.sessionKey,
      now: () => NOW + 30_000,
    });
    services.add(service);
    const result = await service.login(loginInput(
      fixture.email,
      fixture.password,
      totpCode(fixture.seed, NOW + 30_000),
    ));
    expect(result.userId).toBe(fixture.userId);
    fixture.seed.fill(0);
    keyRing.destroy();
  });

  it("returns one public failure for nonexistent, inactive, wrong-password, wrong-TOTP, and corrupt-authenticator paths", async () => {
    const fixture = await configuredIdentity("uniform");
    const code = totpCode(fixture.seed, NOW);
    const cases = [
      loginInput("missing@example.org", fixture.password, code, "source-1"),
      loginInput(fixture.email, "Wrong-Password-2026", code, "source-2"),
      loginInput(fixture.email, fixture.password, "000000", "source-3"),
    ];
    for (const input of cases) {
      await expect(fixture.service.login(input)).rejects.toEqual(
        new LocalAuthenticationError("authentication_failed"),
      );
    }

    const tampered = structuredClone(fixture.envelope);
    tampered.encryptedSeed.tag = `${tampered.encryptedSeed.tag[0] === "A" ? "B" : "A"}${tampered.encryptedSeed.tag.slice(1)}`;
    await fixture.repository.provisionConfiguredAuthenticator({
      userId: fixture.userId,
      encodedHash: fixture.encodedHash,
      envelope: tampered,
    }, audit());
    await expect(fixture.service.login(loginInput(
      fixture.email,
      fixture.password,
      code,
      "source-corrupt",
    ))).rejects.toEqual(new LocalAuthenticationError("authentication_failed"));

    const identities = new IdentityRepository(fixture.worker, { now: () => NOW });
    const user = await identities.identity(fixture.userId);
    if (user === undefined) throw new Error("missing fixture user");
    await identities.changeStatus(fixture.userId, user.version, "suspended", audit());
    await expect(fixture.service.login(loginInput(
      fixture.email,
      fixture.password,
      code,
      "source-4",
    ))).rejects.toEqual(new LocalAuthenticationError("authentication_failed"));

    const audits = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{ labels: string }>(`
        SELECT group_concat(target_label_snapshot) AS labels
        FROM administrative_audit_events
        WHERE result = 'deny'
      `)?.labels ?? ""),
    });
    expect(audits).not.toContain(fixture.email);
    expect(audits).not.toContain("missing");
    fixture.seed.fill(0);
  });

  it("enforces independent attempt and password-work concurrency budgets before expensive work", async () => {
    const fixture = await configuredIdentity("limits", {
      ...identityConfig(),
      limits: {
        ...identityConfig().limits,
        loginAttempts: 20,
        passwordAttempts: 3,
        maxPasswordVerifications: 1,
        maxPasswordVerificationsPerSource: 1,
      },
    });
    const code = totpCode(fixture.seed, NOW);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(fixture.service.login(loginInput(
        fixture.email,
        "Wrong-Password-2026",
        code,
        "attempt-source",
      ))).rejects.toEqual(new LocalAuthenticationError("authentication_failed"));
    }
    await expect(fixture.service.login(loginInput(
      fixture.email,
      fixture.password,
      code,
      "attempt-source",
    ))).rejects.toEqual(new LocalAuthenticationError("rate_limited"));

    const concurrent = await configuredIdentity("concurrency", {
      ...identityConfig(),
      limits: {
        ...identityConfig().limits,
        loginAttempts: 20,
        passwordAttempts: 20,
        maxPasswordVerifications: 1,
        maxPasswordVerificationsPerSource: 1,
      },
    });
    const outcomes = await Promise.allSettled([
      concurrent.service.login(loginInput(
        concurrent.email,
        "Wrong-Password-2026",
        totpCode(concurrent.seed, NOW),
        "concurrent-source",
      )),
      concurrent.service.login(loginInput(
        concurrent.email,
        "Wrong-Password-2026",
        totpCode(concurrent.seed, NOW),
        "concurrent-source",
      )),
    ]);
    expect(outcomes.filter((outcome) =>
      outcome.status === "rejected" &&
      outcome.reason instanceof LocalAuthenticationError &&
      outcome.reason.code === "rate_limited")).toHaveLength(1);
    fixture.seed.fill(0);
    concurrent.seed.fill(0);

    const totpLimited = await configuredIdentity("totp-limits", {
      ...identityConfig(),
      limits: {
        ...identityConfig().limits,
        loginAttempts: 20,
        passwordAttempts: 20,
        totpAttempts: 3,
      },
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(totpLimited.service.login(loginInput(
        totpLimited.email,
        totpLimited.password,
        "000000",
        "totp-source",
      ))).rejects.toEqual(new LocalAuthenticationError("authentication_failed"));
    }
    await expect(totpLimited.service.login(loginInput(
      totpLimited.email,
      totpLimited.password,
      totpCode(totpLimited.seed, NOW),
      "totp-source",
    ))).rejects.toEqual(new LocalAuthenticationError("rate_limited"));
    totpLimited.seed.fill(0);
  });

  it("rolls back session and TOTP consumption when the success audit is invalid", async () => {
    const fixture = await configuredIdentity("audit-rollback");
    const candidate = await fixture.repository.candidate(fixture.email);
    if (
      candidate === undefined ||
      candidate.encodedHash === null ||
      candidate.totpEnvelopeJson === null
    ) throw new Error("invalid fixture candidate");
    await expect(fixture.repository.commitLogin({
      candidate,
      encodedHash: candidate.encodedHash,
      envelopeJson: candidate.totpEnvelopeJson,
      acceptedStep: Math.floor(NOW / 30_000),
      session: {
        id: "018f1f2e-7b3c-7a10-8000-000000000099",
        sessionHash: "a".repeat(64),
        csrfHash: "b".repeat(64),
        roleClass: "admin",
        securityEpoch: candidate.securityEpoch,
        globalSecurityEpoch: candidate.globalSecurityEpoch,
        absoluteMs: 3_600_000,
        inactivityMs: 300_000,
        issuedAt: NOW,
      },
      correlationId: "invalid-correlation",
    })).rejects.toEqual(new LocalAuthenticationError("authentication_unavailable"));
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{ sessions: number; steps: number }>(`
        SELECT
          (SELECT count(*) FROM browser_sessions) AS sessions,
          (SELECT count(*) FROM accepted_totp_steps) AS steps
      `)),
    })).toEqual({ sessions: 0, steps: 0 });
    fixture.seed.fill(0);
  });

  it("rejects malformed and oversized inputs before authentication work", async () => {
    const fixture = await configuredIdentity("input");
    for (const input of [
      { ...loginInput(fixture.email, fixture.password, "000000"), unexpected: true },
      loginInput("not-an-email", fixture.password, "000000"),
      loginInput(fixture.email, "x".repeat(1_025), "000000"),
      loginInput(fixture.email, fixture.password, "12345x"),
    ]) {
      await expect(fixture.service.login(input)).rejects.toEqual(
        new LocalAuthenticationError("authentication_failed"),
      );
    }
    fixture.seed.fill(0);
  });

  it("advances a compliant old policy only after successful password and TOTP verification", async () => {
    const config = identityConfig();
    const settings = securitySettings(config, {
      passwordMinimumLength: 20,
      passwordPolicyVersion: 2,
    });
    const fixture = await configuredIdentity(
      "policy-advance",
      config,
      () => settings,
    );
    await setGlobalPasswordState(fixture.worker, 2, 1);
    const result = await fixture.service.login(loginInput(
      fixture.email,
      fixture.password,
      totpCode(fixture.seed, NOW),
    ));
    expect(result.purpose).toBeUndefined();
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        credential: number;
        user: number;
      }>(`
        SELECT
          (SELECT policy_version FROM local_password_credentials
            WHERE user_id = ?) AS credential,
          (SELECT password_policy_version FROM users
            WHERE id = ?) AS user
      `, [fixture.userId, fixture.userId])),
    })).toEqual({ credential: 2, user: 2 });
    fixture.seed.fill(0);
  });

  it("routes noncompliant and global-epoch credentials to password change and denies MCP proof", async () => {
    const config = identityConfig();
    const settings = securitySettings(config, {
      passwordMinimumLength: 40,
      passwordPolicyVersion: 2,
    });
    const fixture = await configuredIdentity(
      "policy-change",
      config,
      () => settings,
    );
    await setGlobalPasswordState(fixture.worker, 2, 1);
    const result = await fixture.service.login(loginInput(
      fixture.email,
      fixture.password,
      totpCode(fixture.seed, NOW),
    ));
    expect(result).toMatchObject({ purpose: "password_change" });
    expect(await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        browser: number;
        restricted: number;
        policy: number;
      }>(`
        SELECT
          (SELECT count(*) FROM browser_sessions) AS browser,
          (SELECT count(*) FROM identity_restricted_sessions
            WHERE purpose = 'password_change' AND revoked_at IS NULL) AS restricted,
          (SELECT policy_version FROM local_password_credentials
            WHERE user_id = ?) AS policy
      `, [fixture.userId])),
    })).toEqual({ browser: 0, restricted: 1, policy: 1 });
    fixture.seed.fill(0);

    const epochFixture = await configuredIdentity(
      "epoch-change",
      config,
      () => settings,
    );
    await setGlobalPasswordState(epochFixture.worker, 1, 2);
    await expect(epochFixture.service.verifyMcpProof(loginInput(
      epochFixture.email,
      epochFixture.password,
      totpCode(epochFixture.seed, NOW),
    ))).rejects.toEqual(new LocalAuthenticationError("authentication_failed"));
    expect(await epochFixture.worker.execute({
      run: (database) => database.read((query) => query.get<{ steps: number }>(
        "SELECT count(*) AS steps FROM accepted_totp_steps",
      )?.steps ?? -1),
    })).toBe(0);
    epochFixture.seed.fill(0);
  });
});

async function configuredIdentity(
  name: string,
  config: IdentityConfig = identityConfig(),
  securitySettingsProvider?: () => SecuritySettings,
): Promise<{
  databaseFile: string;
  worker: PersistenceWorker;
  repository: LocalAuthenticationRepository;
  service: LocalAuthenticationService;
  userId: string;
  email: string;
  password: string;
  seed: Buffer;
  encodedHash: string;
  envelope: ReturnType<typeof beginTotpEnrollment>["envelope"];
  rootKey: Buffer;
  sessionKey: Buffer;
}> {
  const databaseFile = databasePath(name);
  const worker = open(databaseFile);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const email = `${name}@example.org`;
  const user = await identities.createLocalIdentity({
    profile: { email, givenName: "Test", familyName: "User" },
    role: "admin",
    status: "active",
  }, audit());
  const password = `Correct-${name}-2026`;
  const encodedHash = await hashPassword(Buffer.from(password, "utf8"));
  const rootKey = Buffer.alloc(32, 41);
  const sessionKey = Buffer.alloc(32, 42);
  const keyRing = new IdentityKeyRing("root", { root: rootKey });
  const enrollment = beginTotpEnrollment({
    authenticatorId: "018f1f2e-7b3c-7a10-8000-000000000010",
    userId: user.id,
    issuer: "SecretSauce",
    label: email,
    keyRing,
  });
  const seed = parseTotpEnrollmentUri(enrollment.uri).seed;
  const repository = new LocalAuthenticationRepository(worker, { now: () => NOW });
  await repository.provisionConfiguredAuthenticator({
    userId: user.id,
    encodedHash,
    envelope: enrollment.envelope,
  }, audit());
  const service = await LocalAuthenticationService.create({
    repository,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => NOW,
    ...(securitySettingsProvider === undefined
      ? {}
      : { securitySettings: securitySettingsProvider }),
  });
  services.add(service);
  return {
    databaseFile,
    worker,
    repository,
    service,
    userId: user.id,
    email,
    password,
    seed,
    encodedHash,
    envelope: enrollment.envelope,
    rootKey,
    sessionKey,
  };
}

function identityConfig(): IdentityConfig {
  return {
    activeRootKeyId: "root",
    rootKeyFiles: { root: "/not-read-by-this-test" },
    sessionHmacKeyFile: "/not-read-by-this-test",
    temporaryPasswordTtlMs: 72 * 3_600_000,
    restrictedSessionTtlMs: 15 * 60_000,
    password: { minimumLength: 12 },
    sessions: {
      adminAbsoluteMs: 12 * 3_600_000,
      adminInactivityMs: 15 * 60_000,
      userAbsoluteMs: 24 * 3_600_000,
      userInactivityMs: 60 * 60_000,
    },
    stepUpMode: "five_minutes",
    limits: {
      loginAttempts: 10,
      loginWindowMs: 15 * 60_000,
      passwordAttempts: 10,
      passwordWindowMs: 15 * 60_000,
      totpAttempts: 5,
      totpWindowMs: 5 * 60_000,
      maxPasswordVerifications: 2,
      maxPasswordVerificationsPerSource: 1,
      maxTotpVerifications: 8,
      maxTotpVerificationsPerSource: 2,
    },
  };
}

function securitySettings(
  config: IdentityConfig,
  overrides: Partial<SecuritySettings> = {},
): SecuritySettings {
  return {
    passwordMinimumLength: config.password.minimumLength,
    passwordBlocklistVersion: 1,
    passwordPolicyVersion: 1,
    adminSessionAbsoluteMs: config.sessions.adminAbsoluteMs,
    adminSessionInactivityMs: config.sessions.adminInactivityMs,
    userSessionAbsoluteMs: config.sessions.userAbsoluteMs,
    userSessionInactivityMs: config.sessions.userInactivityMs,
    oauthAccessTokenMs: 300_000,
    oauthRefreshInactivityMs: 30 * 86_400_000,
    oauthRefreshAbsoluteMs: 90 * 86_400_000,
    stepUpMode: config.stepUpMode,
    loginAttempts: config.limits.loginAttempts,
    loginWindowMs: config.limits.loginWindowMs,
    passwordAttempts: config.limits.passwordAttempts,
    passwordWindowMs: config.limits.passwordWindowMs,
    totpAttempts: config.limits.totpAttempts,
    totpWindowMs: config.limits.totpWindowMs,
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
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function setGlobalPasswordState(
  worker: PersistenceWorker,
  policyVersion: number,
  passwordChangeEpoch: number,
): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        UPDATE identity_security_state
        SET password_policy_version = ?, password_change_epoch = ?,
            version = version + 1, updated_at = ?
        WHERE singleton = 1
      `, [policyVersion, passwordChangeEpoch, NOW]);
    }),
  });
}

function loginInput(
  email: string,
  password: string,
  totp: string,
  source = "127.0.0.1",
): Record<string, string> {
  return { email, password, totp, source, correlationId: CORRELATION };
}

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "test-operator",
      authenticationMethod: "host_terminal",
    },
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}

function open(databaseFile: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "0.1.0-test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function databasePath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-local-auth-${name}-`)), "control.sqlite");
}
