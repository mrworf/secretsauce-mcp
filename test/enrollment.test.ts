import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnrollmentError,
  LocalEnrollmentRepository,
  LocalEnrollmentService,
  RestrictedSessionAuthenticator,
} from "../src/identity/enrollment.js";
import {
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../src/identity/localAuthentication.js";
import {
  BrowserSessionAuthenticator,
  BrowserSessionRepository,
} from "../src/identity/browserSessions.js";
import {
  LocalCredentialLifecycleRepository,
  LocalCredentialLifecycleService,
} from "../src/identity/credentialLifecycle.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import {
  IdentityKeyRing,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { CONTROL_ENROLLMENT_COOKIE } from "../src/control/security.js";
import { createControlApplication } from "../src/control/server.js";
import { LocalControlAuthenticator } from "../src/identity/enrollment.js";
import { createLogger } from "../src/logger.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig, IdentityConfig } from "../src/types.js";
import { registryConfig } from "./helpers.js";

const START = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const services = new Set<{ close(): void }>();

afterEach(async () => {
  for (const service of services) service.close();
  services.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("restricted initial local enrollment", () => {
  it("advances an invited identity before issuing its restricted enrollment session", async () => {
    const fixture = await enrollmentFixture("invited-handoff");
    const identities = new IdentityRepository(
      fixture.worker,
      { now: () => fixture.clock.value },
    );
    const invited = await identities.createLocalIdentity({
      profile: {
        email: "invited-handoff-user@example.org",
        givenName: "Invited",
        familyName: "User",
      },
      role: "user",
      status: "invited",
    }, audit());
    const issued = await fixture.service.issueInitialTemporary(invited.id, audit());
    await expect(fixture.service.temporaryLogin(loginInput(
      invited.email,
      issued.temporaryPassword,
      "invited-handoff",
    ))).resolves.toMatchObject({
      userId: invited.id,
      purpose: "initial_enrollment",
    });
    await expect(identities.identity(invited.id)).resolves.toMatchObject({
      status: "enrollment_required",
      version: invited.version + 1,
    });
  });

  it("activates a bootstrapped identity only after permanent password and confirmed TOTP", async () => {
    const fixture = await enrollmentFixture("success");
    const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
    expect(issued.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(issued.expiresAt).toBe(START + 72 * 3_600_000);

    const login = await fixture.service.temporaryLogin(loginInput(
      fixture.email,
      issued.temporaryPassword,
    ));
    expect(login).toMatchObject({
      userId: fixture.userId,
      role: "superadmin",
      purpose: "initial_enrollment",
      expiresAt: START + 15 * 60_000,
    });
    expect(login.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(login.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await expect(fixture.service.temporaryLogin(loginInput(
      fixture.email,
      issued.temporaryPassword,
    ))).rejects.toEqual(new EnrollmentError("authentication_failed"));

    const restricted = await bindRestricted(fixture, login.sessionToken);
    const permanentPassword = "Permanent-Enrollment-Password-2026";
    const begun = await fixture.service.beginInitial(restricted, permanentPassword);
    expect(begun.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(begun.uri).toContain("otpauth://totp/");
    const seed = parseTotpEnrollmentUri(begun.uri).seed;

    await expect(fixture.service.confirmInitial(restricted, {
      newPassword: permanentPassword,
      totp: "000000",
      correlationId: CORRELATION,
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    await fixture.service.confirmInitial(restricted, {
      newPassword: permanentPassword,
      totp: totpCode(seed, START),
      correlationId: CORRELATION,
    });

    const stored = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        status: string;
        security_epoch: number;
        password_state: string;
        totp_state: string;
        temporary_hash: string;
        temporary_revoked: number;
        restricted_revoked: number;
        pending_count: number;
        accepted_count: number;
        invalidation_reason: string;
        audit_actions: string;
      }>(`
        SELECT
          u.status, u.security_epoch, a.password_state, a.totp_state,
          tp.encoded_hash AS temporary_hash,
          (tp.revoked_at IS NOT NULL) AS temporary_revoked,
          (SELECT count(*) FROM identity_restricted_sessions
            WHERE user_id = u.id AND revoked_at IS NOT NULL) AS restricted_revoked,
          (SELECT count(*) FROM identity_pending_totp
            WHERE user_id = u.id) AS pending_count,
          (SELECT count(*) FROM accepted_totp_steps
            WHERE user_id = u.id) AS accepted_count,
          (SELECT reason FROM identity_invalidation_events
            WHERE user_id = u.id) AS invalidation_reason,
          (SELECT group_concat(action) FROM administrative_audit_events
            WHERE target_id_snapshot = u.id) AS audit_actions
        FROM users u
        JOIN local_authenticator_states a ON a.user_id = u.id
        JOIN identity_temporary_passwords tp ON tp.user_id = u.id
        WHERE u.id = ?
      `, [fixture.userId])),
    });
    expect(stored).toMatchObject({
      status: "active",
      security_epoch: 2,
      password_state: "configured",
      totp_state: "configured",
      temporary_revoked: 1,
      restricted_revoked: 1,
      pending_count: 0,
      accepted_count: 1,
      invalidation_reason: "enrollment",
    });
    expect(stored?.audit_actions).toContain("identity.enrollment_issue");
    expect(stored?.audit_actions).toContain("identity.enrollment_complete");
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(issued.temporaryPassword);
    expect(serialized).not.toContain(permanentPassword);
    expect(serialized).not.toContain(begun.secret);

    fixture.clock.value += 30_000;
    const authRepository = new LocalAuthenticationRepository(
      fixture.worker,
      { now: () => fixture.clock.value },
    );
    const authentication = await LocalAuthenticationService.create({
      repository: authRepository,
      config: fixture.config,
      keyRing: fixture.keyRing,
      sessionHmacKey: fixture.sessionKey,
      now: () => fixture.clock.value,
    });
    services.add(authentication);
    await expect(authentication.login({
      email: fixture.email,
      password: permanentPassword,
      totp: totpCode(seed, fixture.clock.value),
      source: "127.0.0.1",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ userId: fixture.userId });
    seed.fill(0);
  });

  it("uses uniform failures for missing, wrong, expired, and malformed temporary credentials", async () => {
    const fixture = await enrollmentFixture("uniform");
    const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
    const cases = [
      loginInput("missing@example.org", issued.temporaryPassword, "source-1"),
      loginInput(fixture.email, "Wrong-Temporary-Password-2026", "source-2"),
      { ...loginInput(fixture.email, issued.temporaryPassword, "source-3"), extra: true },
    ];
    for (const input of cases) {
      await expect(fixture.service.temporaryLogin(input)).rejects.toEqual(
        new EnrollmentError("authentication_failed"),
      );
    }
    fixture.clock.value = issued.expiresAt;
    await expect(fixture.service.temporaryLogin(loginInput(
      fixture.email,
      issued.temporaryPassword,
      "source-edge",
    ))).rejects.toEqual(new EnrollmentError("authentication_failed"));
  });

  it("rejects weak passwords and a policy-version change without consuming the ceremony", async () => {
    const fixture = await enrollmentFixture("policy");
    const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
    const login = await fixture.service.temporaryLogin(loginInput(
      fixture.email,
      issued.temporaryPassword,
    ));
    const restricted = await bindRestricted(fixture, login.sessionToken);
    await expect(fixture.service.beginInitial(restricted, "short"))
      .rejects.toMatchObject({ code: "password_too_short" });
    const password = "Permanent-Policy-Password-2026";
    const begun = await fixture.service.beginInitial(restricted, password);
    const seed = parseTotpEnrollmentUri(begun.uri).seed;
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE identity_security_state
          SET password_policy_version = password_policy_version + 1,
              version = version + 1, updated_at = ?
          WHERE singleton = 1
        `, [START]);
      }),
    });
    await expect(fixture.service.confirmInitial(restricted, {
      newPassword: password,
      totp: totpCode(seed, START),
      correlationId: CORRELATION,
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    const state = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        status: string;
        pending: number;
      }>(`
        SELECT
          status,
          (SELECT count(*) FROM identity_pending_totp WHERE user_id = users.id) AS pending
        FROM users WHERE id = ?
      `, [fixture.userId])),
    });
    expect(state).toEqual({ status: "enrollment_required", pending: 1 });
    seed.fill(0);
  });

  it("allows exactly one concurrent confirmation and retains no retrievable pending seed", async () => {
    const fixture = await enrollmentFixture("concurrent");
    const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
    const login = await fixture.service.temporaryLogin(loginInput(
      fixture.email,
      issued.temporaryPassword,
    ));
    const restricted = await bindRestricted(fixture, login.sessionToken);
    const password = "Permanent-Concurrent-Password-2026";
    const begun = await fixture.service.beginInitial(restricted, password);
    const seed = parseTotpEnrollmentUri(begun.uri).seed;
    const input = {
      newPassword: password,
      totp: totpCode(seed, START),
      correlationId: CORRELATION,
    };
    const outcomes = await Promise.allSettled([
      fixture.service.confirmInitial(restricted, input),
      fixture.service.confirmInitial(restricted, input),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await fixture.repository.pending(restricted.sessionId, restricted.userId))
      .toBeUndefined();
    seed.fill(0);
  });

  it("completes a reset-required password change while preserving the current TOTP", async () => {
    const fixture = await enrollmentFixture("password-change");
    const active = await activateInitial(fixture, "Original-Password-2026");
    fixture.clock.value += 30_000;
    const lifecycle = new LocalCredentialLifecycleService({
      repository: new LocalCredentialLifecycleRepository(
        fixture.worker,
        () => fixture.clock.value,
      ),
      config: fixture.config,
      now: () => fixture.clock.value,
    });
    const reset = await lifecycle.resetPassword({
      targetUserId: fixture.userId,
      justification: "Recover the local account.",
      authorization: resetAuthorization(fixture.userId),
    });
    const login = await fixture.service.temporaryLogin(loginInput(
      fixture.email,
      reset.temporaryPassword,
      "password-change",
    ));
    expect(login.purpose).toBe("password_change");
    const restricted = await bindRestricted(fixture, login.sessionToken);
    const replacement = "Replacement-Password-2026";
    await expect(fixture.service.confirmPasswordChange(restricted, {
      newPassword: replacement,
      totp: "000000",
      correlationId: CORRELATION,
      source: "wrong-code",
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    await fixture.service.confirmPasswordChange(restricted, {
      newPassword: replacement,
      totp: totpCode(active.seed, fixture.clock.value),
      correlationId: CORRELATION,
      source: "correct-code",
    });

    fixture.clock.value += 30_000;
    const authentication = await authenticationService(fixture);
    await expect(authentication.login({
      email: fixture.email,
      password: replacement,
      totp: totpCode(active.seed, fixture.clock.value),
      source: "new-password",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ userId: fixture.userId });
    const state = await credentialState(fixture);
    expect(state).toMatchObject({
      status: "active",
      password_state: "configured",
      totp_state: "configured",
      invalidation_reason: "password_change",
    });
    active.seed.fill(0);
  });

  it("re-enrolls TOTP only through password-authenticated restricted recovery", async () => {
    const fixture = await enrollmentFixture("totp-recovery");
    const password = "Recovery-Password-2026";
    const active = await activateInitial(fixture, password);
    fixture.clock.value += 30_000;
    const lifecycle = new LocalCredentialLifecycleService({
      repository: new LocalCredentialLifecycleRepository(
        fixture.worker,
        () => fixture.clock.value,
      ),
      config: fixture.config,
      now: () => fixture.clock.value,
    });
    await lifecycle.resetTotp({
      targetUserId: fixture.userId,
      justification: "Replace the lost authenticator.",
      authorization: resetAuthorization(fixture.userId),
    });
    await expect(fixture.service.totpRecoveryLogin({
      email: fixture.email,
      password: "wrong-password",
      source: "wrong-password",
      correlationId: CORRELATION,
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    const login = await fixture.service.totpRecoveryLogin({
      email: fixture.email,
      password,
      source: "correct-password",
      correlationId: CORRELATION,
    });
    expect(login.purpose).toBe("totp_enrollment");
    const restricted = await bindRestricted(fixture, login.sessionToken);
    const begun = await fixture.service.beginTotpEnrollment(restricted);
    const replacementSeed = parseTotpEnrollmentUri(begun.uri).seed;
    await fixture.service.confirmTotpEnrollment(restricted, {
      totp: totpCode(replacementSeed, fixture.clock.value),
      correlationId: CORRELATION,
      source: "replacement",
    });

    fixture.clock.value += 30_000;
    const authentication = await authenticationService(fixture);
    await expect(authentication.login({
      email: fixture.email,
      password,
      totp: totpCode(replacementSeed, fixture.clock.value),
      source: "new-totp",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ userId: fixture.userId });
    const state = await credentialState(fixture);
    expect(state).toMatchObject({
      status: "active",
      password_state: "configured",
      totp_state: "configured",
      invalidation_reason: "totp_change",
    });
    active.seed.fill(0);
    replacementSeed.fill(0);
  });

  it("changes the current password only after fresh password and TOTP verification", async () => {
    const fixture = await enrollmentFixture("self-password");
    const currentPassword = "Current-Self-Password-2026";
    const active = await activateInitial(fixture, currentPassword);
    fixture.clock.value += 30_000;
    const browser = await loginBrowser(fixture, currentPassword, active.seed);
    fixture.clock.value += 30_000;
    await expect(fixture.service.selfPasswordChange(browser.session, {
      currentPassword: "wrong-password",
      currentTotp: totpCode(active.seed, fixture.clock.value),
      newPassword: "Replacement-Self-Password-2026",
      correlationId: CORRELATION,
      source: "wrong-current",
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    await fixture.service.selfPasswordChange(browser.session, {
      currentPassword,
      currentTotp: totpCode(active.seed, fixture.clock.value),
      newPassword: "Replacement-Self-Password-2026",
      correlationId: CORRELATION,
      source: "correct-current",
    });
    expect(await browser.authenticator.authenticate(browser.request)).toBeUndefined();

    fixture.clock.value += 30_000;
    const authentication = await authenticationService(fixture);
    await expect(authentication.login({
      email: fixture.email,
      password: "Replacement-Self-Password-2026",
      totp: totpCode(active.seed, fixture.clock.value),
      source: "replacement-password",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ userId: fixture.userId });
    const state = await credentialState(fixture);
    expect(state).toMatchObject({ invalidation_reason: "password_change" });
    active.seed.fill(0);
  });

  it("replaces TOTP through an isolated ceremony and invalidates the initiating session", async () => {
    const fixture = await enrollmentFixture("self-totp");
    const password = "Current-TOTP-Password-2026";
    const active = await activateInitial(fixture, password);
    fixture.clock.value += 30_000;
    const browser = await loginBrowser(fixture, password, active.seed);
    fixture.clock.value += 30_000;
    await expect(fixture.service.beginTotpReplacement(browser.session, {
      currentPassword: password,
      currentTotp: "000000",
      correlationId: CORRELATION,
      source: "wrong-current-totp",
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    const begun = await fixture.service.beginTotpReplacement(browser.session, {
      currentPassword: password,
      currentTotp: totpCode(active.seed, fixture.clock.value),
      correlationId: CORRELATION,
      source: "correct-current-totp",
    });
    const replacementSeed = parseTotpEnrollmentUri(begun.uri).seed;
    const restricted = await bindRestricted(fixture, begun.sessionToken);
    expect(restricted.purpose).toBe("totp_replacement");
    fixture.clock.value += 30_000;
    await fixture.service.confirmTotpReplacement(restricted, {
      totp: totpCode(replacementSeed, fixture.clock.value),
      correlationId: CORRELATION,
      source: "replacement-totp",
    });
    expect(await browser.authenticator.authenticate(browser.request)).toBeUndefined();

    fixture.clock.value += 30_000;
    const authentication = await authenticationService(fixture);
    await expect(authentication.login({
      email: fixture.email,
      password,
      totp: totpCode(active.seed, fixture.clock.value),
      source: "old-totp",
      correlationId: CORRELATION,
    })).rejects.toEqual(expect.objectContaining({ code: "authentication_failed" }));
    await expect(authentication.login({
      email: fixture.email,
      password,
      totp: totpCode(replacementSeed, fixture.clock.value),
      source: "new-totp",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ userId: fixture.userId });
    active.seed.fill(0);
    replacementSeed.fill(0);
  });

  it("serves strict no-store restricted-cookie HTTP flow without granting an ordinary session", async () => {
    const fixture = await enrollmentFixture("http");
    const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
    const browser = new BrowserSessionAuthenticator(
      new BrowserSessionRepository(fixture.worker, () => fixture.clock.value),
      fixture.config.sessions,
      fixture.sessionKey,
    );
    const restricted = new RestrictedSessionAuthenticator(
      fixture.repository,
      fixture.sessionKey,
      (size) => Buffer.alloc(size, 91),
    );
    services.add(browser);
    services.add(restricted);
    const lines: string[] = [];
    const application = createControlApplication(
      controlConfig(fixture.worker, fixture.config),
      {
        persistence: fixture.worker,
        logger: createLogger({ level: "debug" }, (line) => lines.push(line)),
        localIdentity: {
          authentication: await authenticationService(fixture),
          browserSessions: browser,
          enrollment: fixture.service,
          restrictedSessions: restricted,
          authenticator: new LocalControlAuthenticator(browser, restricted),
        },
      },
    );
    services.add(application);

    const login = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/login",
      headers: { host: "control.example.org", "content-type": "application/json" },
      payload: {
        email: fixture.email,
        temporary_password: issued.temporaryPassword,
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["cache-control"]).toBe("no-store");
    const setCookie = String(login.headers["set-cookie"]);
    expect(setCookie).toContain(`${CONTROL_ENROLLMENT_COOKIE}=`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    const cookie = setCookie.split(";")[0] ?? "";
    const csrf = login.json().data.csrf_token as string;

    const ordinary = await application.inject({
      method: "GET",
      url: "/api/v2/auth/session",
      headers: { host: "control.example.org", cookie },
    });
    expect(ordinary.statusCode).toBe(401);

    const missingCsrf = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/begin",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
      },
      payload: { new_password: "Permanent-HTTP-Password-2026" },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const begin = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/begin",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
        "x-csrf-token": csrf,
      },
      payload: { new_password: "Permanent-HTTP-Password-2026" },
    });
    expect(begin.statusCode).toBe(200);
    expect(begin.headers["cache-control"]).toBe("no-store");
    const rotatedCsrf = begin.json().data.csrf_token as string;
    const seed = parseTotpEnrollmentUri(begin.json().data.otpauth_uri).seed;

    const staleCsrf = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/confirm",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
        "x-csrf-token": csrf,
      },
      payload: {
        new_password: "Permanent-HTTP-Password-2026",
        totp: totpCode(seed, START),
      },
    });
    expect(staleCsrf.statusCode).toBe(403);

    const confirm = await application.inject({
      method: "POST",
      url: "/api/v2/auth/enrollment/confirm",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        cookie,
        "x-csrf-token": rotatedCsrf,
      },
      payload: {
        new_password: "Permanent-HTTP-Password-2026",
        totp: totpCode(seed, START),
      },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.headers["cache-control"]).toBe("no-store");
    expect(String(confirm.headers["set-cookie"])).toContain(`${CONTROL_ENROLLMENT_COOKIE}=;`);
    const serializedLogs = lines.join("\n");
    expect(serializedLogs).not.toContain(issued.temporaryPassword);
    expect(serializedLogs).not.toContain("Permanent-HTTP-Password-2026");
    expect(serializedLogs).not.toContain(begin.json().data.secret);
    expect(serializedLogs).not.toContain(cookie);
    seed.fill(0);
  });
});

async function enrollmentFixture(label: string) {
  const clock = { value: START };
  const databaseFile = join(
    mkdtempSync(join(tmpdir(), `secretsauce-enrollment-${label}-`)),
    "control.sqlite",
  );
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => clock.value,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => clock.value });
  const identity = await identities.bootstrapInitialSuperadmin({
    email: `${label}@example.org`,
    givenName: "Ada",
    familyName: "Lovelace",
  }, audit());
  const repository = new LocalEnrollmentRepository(worker, () => clock.value);
  const rootKey = Buffer.alloc(32, 51);
  const sessionKey = Buffer.alloc(32, 52);
  const keyRing = new IdentityKeyRing("root", { root: rootKey });
  let randomByte = 60;
  const service = await LocalEnrollmentService.create({
    repository,
    config: identityConfig(),
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => clock.value,
    random: (size) => Buffer.alloc(size, randomByte++),
  });
  services.add(service);
  return {
    clock,
    worker,
    repository,
    service,
    keyRing,
    sessionKey,
    config: identityConfig(),
    userId: identity.id,
    email: `${label}@example.org`,
  };
}

async function activateInitial(
  fixture: Awaited<ReturnType<typeof enrollmentFixture>>,
  password: string,
): Promise<{ seed: Buffer }> {
  const issued = await fixture.service.issueInitialTemporary(fixture.userId, audit());
  const login = await fixture.service.temporaryLogin(loginInput(
    fixture.email,
    issued.temporaryPassword,
    `activate-${fixture.userId}`,
  ));
  const restricted = await bindRestricted(fixture, login.sessionToken);
  const begun = await fixture.service.beginInitial(restricted, password);
  const seed = parseTotpEnrollmentUri(begun.uri).seed;
  await fixture.service.confirmInitial(restricted, {
    newPassword: password,
    totp: totpCode(seed, fixture.clock.value),
    correlationId: CORRELATION,
    source: `confirm-${fixture.userId}`,
  });
  return { seed };
}

function resetAuthorization(userId: string) {
  return {
    allowed: true,
    targetUserId: userId,
    capability: "affect_superadmin" as const,
    humanStepUpSatisfied: true,
    actor: {
      type: "browser_session" as const,
      id: userId,
      label: `user:${userId}`,
      role: "superadmin" as const,
      authenticationMethod: "browser_session",
    },
    correlationId: CORRELATION,
    source: { category: "identity" as const, client: "enrollment-test" },
  };
}

async function credentialState(
  fixture: Awaited<ReturnType<typeof enrollmentFixture>>,
) {
  return fixture.worker.execute({
    run: (database) => database.read((query) => query.get<Record<string, unknown>>(`
      SELECT
        u.status, a.password_state, a.totp_state,
        (SELECT reason FROM identity_invalidation_events
          WHERE user_id = u.id ORDER BY rowid DESC LIMIT 1) AS invalidation_reason
      FROM users u
      JOIN local_authenticator_states a ON a.user_id = u.id
      WHERE u.id = ?
    `, [fixture.userId])),
  });
}

async function bindRestricted(
  fixture: Awaited<ReturnType<typeof enrollmentFixture>>,
  sessionToken: string,
) {
  const authenticator = new RestrictedSessionAuthenticator(
    fixture.repository,
    fixture.sessionKey,
  );
  services.add(authenticator);
  const request = {
    cookies: { [CONTROL_ENROLLMENT_COOKIE]: sessionToken },
  } as unknown as FastifyRequest;
  const context = await authenticator.authenticate(request);
  expect(context).toMatchObject({
    method: "restricted_session",
    principalId: fixture.userId,
  });
  const session = authenticator.session(request);
  if (session === undefined) throw new Error("missing restricted fixture session");
  return session;
}

async function loginBrowser(
  fixture: Awaited<ReturnType<typeof enrollmentFixture>>,
  password: string,
  seed: Buffer,
) {
  const authentication = await authenticationService(fixture);
  const login = await authentication.login({
    email: fixture.email,
    password,
    totp: totpCode(seed, fixture.clock.value),
    source: `browser-${fixture.userId}`,
    correlationId: CORRELATION,
  });
  const authenticator = new BrowserSessionAuthenticator(
    new BrowserSessionRepository(fixture.worker, () => fixture.clock.value),
    fixture.config.sessions,
    fixture.sessionKey,
  );
  services.add(authenticator);
  const request = {
    cookies: { "__Host-secretsauce_session": login.sessionToken },
  } as unknown as FastifyRequest;
  await authenticator.authenticate(request);
  const session = authenticator.session(request);
  if (session === undefined) throw new Error("missing browser fixture session");
  return { authenticator, request, session };
}

async function authenticationService(
  fixture: Awaited<ReturnType<typeof enrollmentFixture>>,
): Promise<LocalAuthenticationService> {
  const service = await LocalAuthenticationService.create({
    repository: new LocalAuthenticationRepository(
      fixture.worker,
      { now: () => fixture.clock.value },
    ),
    config: fixture.config,
    keyRing: fixture.keyRing,
    sessionHmacKey: fixture.sessionKey,
    now: () => fixture.clock.value,
  });
  services.add(service);
  return service;
}

function controlConfig(
  _worker: PersistenceWorker,
  identity: IdentityConfig,
): GatewayConfig {
  return {
    ...registryConfig(),
    control: {
      listen: "127.0.0.1:8081",
      host: "127.0.0.1",
      port: 8081,
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/unused",
    },
    persistence: { databaseFile: "/unused/control.sqlite" },
    identity,
  };
}

function loginInput(
  email: string,
  temporaryPassword: string,
  source = "127.0.0.1",
) {
  return { email, temporaryPassword, source, correlationId: CORRELATION };
}

function identityConfig(): IdentityConfig {
  return {
    activeRootKeyId: "root",
    rootKeyFiles: { root: "/unused" },
    sessionHmacKeyFile: "/unused",
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

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "host-local operator",
      authenticationMethod: "host_terminal",
    },
    correlationId: CORRELATION,
    source: { category: "break_glass", client: "test-enrollment" },
    justification: "Issue restricted enrollment access.",
  };
}
