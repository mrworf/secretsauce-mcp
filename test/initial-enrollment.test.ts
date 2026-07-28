import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { IdentityConfig } from "../src/types.js";
import { InitialEnrollmentAuthority } from "../src/identity/initialEnrollment.js";
import {
  EnrollmentError,
  LocalEnrollmentRepository,
  LocalEnrollmentService,
  RestrictedSessionAuthenticator,
} from "../src/identity/enrollment.js";
import {
  IdentityKeyRing,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { CONTROL_ENROLLMENT_COOKIE } from "../src/control/security.js";
import {
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../src/identity/localAuthentication.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const closeables = new Set<{ close(): void | Promise<void> }>();

afterEach(async () => {
  await Promise.all([...closeables].map((value) => value.close()));
  closeables.clear();
});

describe("process-lifetime initial enrollment authority", () => {
  it("announces one 192-bit secret and issues only in-memory restricted authority", async () => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 3),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 7),
    });
    const lines: string[] = [];
    authority.announce((line) => lines.push(line));
    expect(lines).toEqual([
      "SECRETSAUCE INITIAL ENROLLMENT SECRET: BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH "
        + "(invalid after successful enrollment or process restart)\n",
    ]);
    expect(() => authority.announce(() => undefined)).toThrow(
      "Initial enrollment secret was already displayed.",
    );
    expect(await authority.verify("BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH")).toBe(true);
    expect(await authority.verify("not-the-secret")).toBe(false);

    const login = authority.issue("Admin@Example.org");
    expect(login).toMatchObject({
      role: "superadmin",
      purpose: "initial_enrollment",
      expiresAt: NOW + 15 * 60_000,
    });
    const session = authority.restrictedSession(
      authority.sessionHash(login.sessionToken),
    );
    expect(session).toMatchObject({
      userId: login.userId,
      provisional: true,
      purpose: "initial_enrollment",
    });
    expect(authority.csrfMatches(session!, login.csrfToken)).toBe(true);
    expect(authority.csrfMatches(session!, `${login.csrfToken.slice(0, -1)}A`)).toBe(false);
  });

  it("abandons the old secret and every provisional session on close", async () => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 4),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 8),
    });
    const code = Buffer.alloc(24, 8).toString("base64url");
    authority.announce(() => undefined);
    const login = authority.issue("admin@example.org");
    authority.close();

    expect(await authority.verify(code)).toBe(false);
    expect(authority.restrictedSession(authority.sessionHash(login.sessionToken)))
      .toBeUndefined();
    expect(() => authority.issue("other@example.org")).toThrow(
      "Initial enrollment is unavailable.",
    );
  });

  it.each([
    "",
    "not-an-email",
    "a@@example.org",
    "admin @example.org",
  ])("rejects invalid provisional email %j", async (email) => {
    const authority = await InitialEnrollmentAuthority.create({
      config: identityConfig(),
      sessionHmacKey: Buffer.alloc(32, 5),
      now: () => NOW,
      random: (size) => Buffer.alloc(size, 9),
    });
    authority.announce(() => undefined);
    expect(() => authority.issue(email)).toThrow();
    authority.close();
  });

  it("atomically creates a complete superadmin and requires an ordinary login", async () => {
    const fixture = await freshEnrollmentFixture("complete");
    const session = await provisionalSession(
      fixture,
      "admin@example.org",
      fixture.code,
    );
    const password = "Permanent-Browser-Enrollment-Password-2026";
    const begun = await fixture.service.beginInitial(session, password, {
      givenName: "Ada",
      familyName: "Lovelace",
    });
    const seed = parseTotpEnrollmentUri(begun.uri).seed;
    await fixture.service.confirmInitial(session, {
      newPassword: password,
      totp: totpCode(seed, NOW),
      correlationId: CORRELATION,
      source: "initial-complete",
    });

    const state = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        users: number;
        active: number;
        superadmins: number;
        passwords: number;
        totps: number;
        markers: number;
        audits: number;
      }>(`
        SELECT
          (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM users WHERE status = 'active') AS active,
          (SELECT count(*) FROM users WHERE role = 'superadmin') AS superadmins,
          (SELECT count(*) FROM local_password_credentials) AS passwords,
          (SELECT count(*) FROM local_totp_authenticators) AS totps,
          (SELECT count(*) FROM identity_bootstrap) AS markers,
          (SELECT count(*) FROM administrative_audit_events
            WHERE action = 'identity.bootstrap_enrollment_complete') AS audits
      `)),
    });
    expect(state).toEqual({
      users: 1,
      active: 1,
      superadmins: 1,
      passwords: 1,
      totps: 1,
      markers: 1,
      audits: 1,
    });
    expect(await fixture.authority.verify(fixture.code)).toBe(false);
    expect(fixture.completions.value).toBe(1);
    const authentication = await LocalAuthenticationService.create({
      repository: new LocalAuthenticationRepository(
        fixture.worker,
        { now: () => fixture.clock.value },
      ),
      config: fixture.config,
      keyRing: fixture.keyRing,
      sessionHmacKey: fixture.sessionKey,
      now: () => fixture.clock.value,
    });
    closeables.add(authentication);
    fixture.clock.value += 30_000;
    await expect(authentication.login({
      email: "admin@example.org",
      password,
      totp: totpCode(seed, fixture.clock.value),
      source: "ordinary-login",
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ role: "superadmin" });
    seed.fill(0);
  });

  it("allows exactly one racing initial completion and leaves no partial loser", async () => {
    const fixture = await freshEnrollmentFixture("race");
    const first = await provisionalSession(
      fixture,
      "first@example.org",
      fixture.code,
    );
    const second = await provisionalSession(
      fixture,
      "second@example.org",
      fixture.code,
    );
    const password = "Permanent-Racing-Enrollment-Password-2026";
    const firstBegin = await fixture.service.beginInitial(first, password, {
      givenName: "First",
      familyName: "Operator",
    });
    const secondBegin = await fixture.service.beginInitial(second, password, {
      givenName: "Second",
      familyName: "Operator",
    });
    const firstSeed = parseTotpEnrollmentUri(firstBegin.uri).seed;
    const secondSeed = parseTotpEnrollmentUri(secondBegin.uri).seed;
    const results = await Promise.allSettled([
      fixture.service.confirmInitial(first, {
        newPassword: password,
        totp: totpCode(firstSeed, NOW),
        correlationId: CORRELATION,
        source: "race-first",
      }),
      fixture.service.confirmInitial(second, {
        newPassword: password,
        totp: totpCode(secondSeed, NOW),
        correlationId: CORRELATION,
        source: "race-second",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const counts = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<Record<string, number>>(`
        SELECT
          (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM local_authenticator_states) AS states,
          (SELECT count(*) FROM local_password_credentials) AS passwords,
          (SELECT count(*) FROM local_totp_authenticators) AS totps,
          (SELECT count(*) FROM identity_bootstrap) AS markers
      `)),
    });
    expect(counts).toEqual({
      users: 1,
      states: 1,
      passwords: 1,
      totps: 1,
      markers: 1,
    });
    expect(fixture.completions.value).toBe(1);
    firstSeed.fill(0);
    secondSeed.fill(0);
  });

  it("creates no user for invalid profile, weak password, invalid TOTP, or expiry", async () => {
    const fixture = await freshEnrollmentFixture("failures");
    const session = await provisionalSession(
      fixture,
      "admin@example.org",
      fixture.code,
    );
    await expect(fixture.service.beginInitial(session, "short", {
      givenName: "Ada",
      familyName: "Lovelace",
    })).rejects.toMatchObject({ code: "password_too_short" });
    await expect(fixture.service.beginInitial(
      session,
      "Permanent-Enrollment-Password-2026",
      { givenName: "\u0000", familyName: "Lovelace" },
    )).rejects.toEqual(new EnrollmentError("invalid_request"));
    const begun = await fixture.service.beginInitial(
      session,
      "Permanent-Enrollment-Password-2026",
      { givenName: "Ada", familyName: "Lovelace" },
    );
    await expect(fixture.service.confirmInitial(session, {
      newPassword: "Permanent-Enrollment-Password-2026",
      totp: "000000",
      correlationId: CORRELATION,
    })).rejects.toEqual(new EnrollmentError("authentication_failed"));
    fixture.clock.value += fixture.config.restrictedSessionTtlMs;
    await expect(fixture.service.confirmInitial(session, {
      newPassword: "Permanent-Enrollment-Password-2026",
      totp: totpCode(parseTotpEnrollmentUri(begun.uri).seed, NOW),
      correlationId: CORRELATION,
    })).rejects.toBeInstanceOf(EnrollmentError);
    const count = await fixture.worker.execute({
      run: (database) => database.read((query) =>
        query.get<{ count: number }>("SELECT count(*) AS count FROM users")?.count),
    });
    expect(count).toBe(0);
  });

  it("rolls back every identity row when administrative audit creation fails", async () => {
    const fixture = await freshEnrollmentFixture("audit-rollback", true);
    const session = await provisionalSession(
      fixture,
      "admin@example.org",
      fixture.code,
    );
    const password = "Permanent-Audit-Rollback-Password-2026";
    const begun = await fixture.service.beginInitial(session, password, {
      givenName: "Audit",
      familyName: "Failure",
    });
    const seed = parseTotpEnrollmentUri(begun.uri).seed;
    await expect(fixture.service.confirmInitial(session, {
      newPassword: password,
      totp: totpCode(seed, NOW),
      correlationId: CORRELATION,
    })).rejects.toEqual(new EnrollmentError("enrollment_unavailable"));
    const counts = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<Record<string, number>>(`
        SELECT
          (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM local_password_credentials) AS passwords,
          (SELECT count(*) FROM local_totp_authenticators) AS totps,
          (SELECT count(*) FROM identity_bootstrap) AS markers
      `)),
    });
    expect(counts).toEqual({ users: 0, passwords: 0, totps: 0, markers: 0 });
    seed.fill(0);
  });
});

async function freshEnrollmentFixture(label: string, failAudit = false) {
  const clock = { value: NOW };
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-initial-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => clock.value,
    ...(failAudit
      ? {
          sanitizeAuditText: () => {
            throw new Error("injected audit failure");
          },
        }
      : {}),
  });
  closeables.add(worker);
  const config = identityConfig();
  const sessionKey = Buffer.alloc(32, 21);
  let randomByte = 31;
  const random = (size: number) => Buffer.alloc(size, randomByte++);
  const authority = await InitialEnrollmentAuthority.create({
    config,
    sessionHmacKey: sessionKey,
    now: () => clock.value,
    random,
  });
  const lines: string[] = [];
  authority.announce((line) => lines.push(line));
  const code = lines[0]!.split(": ", 2)[1]!.split(" ", 1)[0]!;
  const repository = new LocalEnrollmentRepository(worker, () => clock.value);
  const keyRing = new IdentityKeyRing("root", { root: Buffer.alloc(32, 22) });
  const completions = { value: 0 };
  const service = await LocalEnrollmentService.create({
    repository,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    initialAuthority: authority,
    onInitialEnrollmentComplete: () => {
      completions.value += 1;
    },
    now: () => clock.value,
    random,
  });
  closeables.add(service);
  return {
    clock,
    worker,
    config,
    sessionKey,
    authority,
    repository,
    keyRing,
    service,
    code,
    completions,
  };
}

async function provisionalSession(
  fixture: Awaited<ReturnType<typeof freshEnrollmentFixture>>,
  email: string,
  code: string,
) {
  const login = await fixture.service.enrollmentLogin({
    email,
    enrollmentCode: code,
    source: `source-${email}`,
    correlationId: CORRELATION,
  });
  const authenticator = new RestrictedSessionAuthenticator(
    fixture.repository,
    fixture.sessionKey,
    undefined,
    fixture.authority,
  );
  closeables.add(authenticator);
  const request = {
    cookies: { [CONTROL_ENROLLMENT_COOKIE]: login.sessionToken },
    routeOptions: {
      config: {
        controlSecurity: { authenticationMethods: ["restricted_session"] },
      },
    },
  } as unknown as FastifyRequest;
  expect(await authenticator.authenticate(request)).toMatchObject({
    method: "restricted_session",
    principalId: login.userId,
  });
  const session = authenticator.session(request);
  if (session === undefined) throw new Error("Missing provisional session.");
  return session;
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
