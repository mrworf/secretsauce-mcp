import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CredentialLifecycleError,
  LocalCredentialLifecycleRepository,
  LocalCredentialLifecycleService,
  generateTemporaryPassword,
  type CredentialResetAuthorization,
  type IdentityInvalidationNotice,
} from "../src/identity/credentialLifecycle.js";
import {
  LocalAuthenticationRepository,
  LocalAuthenticationService,
} from "../src/identity/localAuthentication.js";
import { hashPassword } from "../src/identity/password.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import {
  IdentityKeyRing,
  beginTotpEnrollment,
  parseTotpEnrollmentUri,
  totpCode,
} from "../src/identity/totp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { IdentityConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const authenticationServices = new Set<LocalAuthenticationService>();

afterEach(async () => {
  for (const service of authenticationServices) service.close();
  authenticationServices.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("guarded local credential lifecycle", () => {
  it("generates bounded base64url temporary passwords and clears random input buffers", () => {
    for (const minimum of [8, 128]) {
      let generated: Buffer | undefined;
      const value = generateTemporaryPassword(minimum, (size) => {
        generated = Buffer.alloc(size, 7);
        return generated;
      });
      expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(value).toHaveLength(Math.max(24, minimum));
      expect(generated?.every((byte) => byte === 0)).toBe(true);
    }
    expect(() => generateTemporaryPassword(7)).toThrow(
      new CredentialLifecycleError("invalid_request"),
    );
  });

  it("resets a password with one hash-only temporary value and atomic invalidation", async () => {
    const fixture = await configuredIdentity("password-reset");
    await login(fixture);
    await addRestrictedSession(fixture, "018f1f2e-7b3c-7a10-8000-000000000111");
    const notices: IdentityInvalidationNotice[] = [];
    const service = lifecycle(fixture, {
      invalidate: async (notice) => {
        notices.push(notice);
      },
    });
    const result = await service.resetPassword({
      targetUserId: fixture.userId,
      justification: "  Account owner verified by support.  ",
      authorization: authorization(fixture.userId, "reset_ordinary_user_password"),
    });

    expect(result).toMatchObject({
      expiresAt: NOW + 72 * 3_600_000,
      invalidationPending: false,
      browserSessionsRevoked: 1,
      restrictedSessionsRevoked: 1,
    });
    expect(result.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      userId: fixture.userId,
      reason: "password_reset",
      browserSessionsRevoked: 1,
      restrictedSessionsRevoked: 1,
    });

    const stored = await snapshot(fixture);
    expect(stored).toMatchObject({
      password_state: "temporary",
      totp_state: "configured",
      security_epoch: 2,
      totp_count: 1,
      browser_revoked: 1,
      restricted_revoked: 1,
      invalidation_reason: "password_reset",
      dispatched: 1,
      justification: "Account owner verified by support.",
    });
    expect(stored.temporary_hash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(stored)).not.toContain(result.temporaryPassword);
  });

  it("erases only TOTP, increments the epoch, and leaves failed dispatch retryable", async () => {
    const fixture = await configuredIdentity("totp-reset");
    await login(fixture);
    const service = lifecycle(fixture, {
      invalidate: async () => {
        throw new Error("downstream-reference-secret");
      },
    });
    const result = await service.resetTotp({
      targetUserId: fixture.userId,
      justification: "Authenticator was lost.",
      authorization: authorization(fixture.userId, "reset_ordinary_user_totp"),
    });

    expect(result).toEqual({
      invalidationPending: true,
      browserSessionsRevoked: 1,
      restrictedSessionsRevoked: 0,
    });
    expect(result).not.toHaveProperty("seed");
    const stored = await snapshot(fixture);
    expect(stored).toMatchObject({
      password_state: "configured",
      totp_state: "not_configured",
      security_epoch: 2,
      totp_count: 0,
      browser_revoked: 1,
      invalidation_reason: "totp_reset",
      dispatched: 0,
    });
    expect(JSON.stringify(stored)).not.toContain("downstream-reference-secret");
  });

  it("rejects missing authority, step-up, target binding, and justification before mutation", async () => {
    const fixture = await configuredIdentity("denials");
    const cases = [
      {
        targetUserId: fixture.userId,
        justification: "",
        authorization: authorization(fixture.userId, "reset_ordinary_user_password"),
        code: "invalid_request",
      },
      {
        targetUserId: fixture.userId,
        justification: "Required reset.",
        authorization: {
          ...authorization(fixture.userId, "reset_ordinary_user_password"),
          allowed: false,
        },
        code: "forbidden",
      },
      {
        targetUserId: fixture.userId,
        justification: "Required reset.",
        authorization: {
          ...authorization(fixture.userId, "reset_ordinary_user_password"),
          humanStepUpSatisfied: false,
        },
        code: "forbidden",
      },
      {
        targetUserId: fixture.userId,
        justification: "Required reset.",
        authorization: authorization(
          "018f1f2e-7b3c-7a10-8000-000000000222",
          "reset_ordinary_user_password",
        ),
        code: "forbidden",
      },
    ] as const;
    const service = lifecycle(fixture);
    for (const input of cases) {
      await expect(service.resetPassword(input)).rejects.toMatchObject({ code: input.code });
    }
    const stored = await snapshot(fixture);
    expect(stored).toMatchObject({
      password_state: "configured",
      totp_state: "configured",
      security_epoch: 1,
      invalidation_count: 0,
    });
  });

  it("rolls reset state back when the transactional audit is invalid", async () => {
    const fixture = await configuredIdentity("rollback");
    await login(fixture);
    const invalidAudit = authorization(fixture.userId, "reset_ordinary_user_password");
    invalidAudit.actor = {
      type: "browser_session",
      id: fixture.userId,
      label: "",
      role: "superadmin",
      authenticationMethod: "browser_session",
    };
    await expect(lifecycle(fixture).resetPassword({
      targetUserId: fixture.userId,
      justification: "Rollback test.",
      authorization: invalidAudit,
    })).rejects.toEqual(new CredentialLifecycleError("credential_lifecycle_unavailable"));

    const stored = await snapshot(fixture);
    expect(stored).toMatchObject({
      password_state: "configured",
      totp_state: "configured",
      security_epoch: 1,
      browser_revoked: 0,
      invalidation_count: 0,
    });
  });

  it("requires explicit interactive superadmin authority for a superadmin target", async () => {
    const fixture = await configuredIdentity("superadmin-target", "superadmin");
    const service = lifecycle(fixture);
    await expect(service.resetTotp({
      targetUserId: fixture.userId,
      justification: "Recover the superadmin authenticator.",
      authorization: authorization(fixture.userId, "reset_ordinary_user_totp"),
    })).rejects.toEqual(new CredentialLifecycleError("forbidden"));

    await expect(service.resetTotp({
      targetUserId: fixture.userId,
      justification: "Recover the superadmin authenticator.",
      authorization: authorization(fixture.userId, "affect_superadmin"),
    })).resolves.toMatchObject({ invalidationPending: true });
  });
});

async function configuredIdentity(
  label: string,
  role: "superadmin" | "admin" | "user" = "admin",
) {
  const databaseFile = join(
    mkdtempSync(join(tmpdir(), `secretsauce-credential-${label}-`)),
    "control.sqlite",
  );
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const identity = await identities.createLocalIdentity({
    profile: {
      email: `${label}@example.org`,
      givenName: "Ada",
      familyName: "Lovelace",
    },
    role,
    status: "active",
  }, audit());
  const password = `Correct-${label}-Password-2026`;
  const encodedHash = await hashPassword(Buffer.from(password, "utf8"));
  const rootKey = Buffer.alloc(32, 31);
  const keyRing = new IdentityKeyRing("root", { root: rootKey });
  const enrollment = beginTotpEnrollment({
    authenticatorId: "018f1f2e-7b3c-7a10-8000-000000000010",
    userId: identity.id,
    label: `${label}@example.org`,
    issuer: "SecretSauce",
    keyRing,
  });
  const seed = parseTotpEnrollmentUri(enrollment.uri).seed;
  const authenticationRepository = new LocalAuthenticationRepository(worker, { now: () => NOW });
  await authenticationRepository.provisionConfiguredAuthenticator({
    userId: identity.id,
    encodedHash,
    envelope: enrollment.envelope,
  }, audit());
  const config = identityConfig();
  const sessionKey = Buffer.alloc(32, 33);
  const authentication = await LocalAuthenticationService.create({
    repository: authenticationRepository,
    config,
    keyRing,
    sessionHmacKey: sessionKey,
    now: () => NOW,
  });
  authenticationServices.add(authentication);
  return {
    worker,
    userId: identity.id,
    email: `${label}@example.org`,
    password,
    seed,
    sessionKey,
    keyRing,
    authentication,
    config,
  };
}

async function login(fixture: Awaited<ReturnType<typeof configuredIdentity>>): Promise<void> {
  await fixture.authentication.login({
    email: fixture.email,
    password: fixture.password,
    totp: totpCode(fixture.seed, NOW),
    source: "127.0.0.1",
    correlationId: CORRELATION,
  });
}

async function addRestrictedSession(
  fixture: Awaited<ReturnType<typeof configuredIdentity>>,
  id: string,
): Promise<void> {
  await fixture.worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO identity_restricted_sessions (
          id, user_id, purpose, session_hash, csrf_hash,
          issued_security_epoch, issued_global_epoch,
          issued_at, expires_at, revoked_at, version
        ) VALUES (?, ?, 'password_change', ?, ?, 1, 1, ?, ?, NULL, 1)
      `, [id, fixture.userId, "1".repeat(64), "2".repeat(64), NOW, NOW + 900_000]);
    }),
  });
}

function lifecycle(
  fixture: Awaited<ReturnType<typeof configuredIdentity>>,
  invalidationSink?: { invalidate(notice: IdentityInvalidationNotice): Promise<void> },
): LocalCredentialLifecycleService {
  return new LocalCredentialLifecycleService({
    repository: new LocalCredentialLifecycleRepository(fixture.worker, () => NOW),
    config: fixture.config,
    ...(invalidationSink === undefined ? {} : { invalidationSink }),
    random: (size) => Buffer.alloc(size, 41),
    now: () => NOW,
  });
}

function authorization(
  targetUserId: string,
  capability: CredentialResetAuthorization["capability"],
): CredentialResetAuthorization {
  return {
    allowed: true,
    targetUserId,
    capability,
    humanStepUpSatisfied: true,
    actor: {
      type: "browser_session",
      id: targetUserId,
      label: `user:${targetUserId}`,
      role: "superadmin",
      authenticationMethod: "browser_session",
    },
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}

async function snapshot(fixture: Awaited<ReturnType<typeof configuredIdentity>>) {
  return fixture.worker.execute({
    run: (database) => database.read((query) => query.get<{
      password_state: string;
      totp_state: string;
      security_epoch: number;
      temporary_hash: string | null;
      totp_count: number;
      browser_revoked: number;
      restricted_revoked: number;
      invalidation_count: number;
      invalidation_reason: string | null;
      dispatched: number;
      justification: string | null;
    }>(`
      SELECT
        a.password_state,
        a.totp_state,
        u.security_epoch,
        (SELECT encoded_hash FROM identity_temporary_passwords WHERE user_id = u.id)
          AS temporary_hash,
        (SELECT count(*) FROM local_totp_authenticators WHERE user_id = u.id)
          AS totp_count,
        (SELECT count(*) FROM browser_sessions
          WHERE user_id = u.id AND revoked_at IS NOT NULL) AS browser_revoked,
        (SELECT count(*) FROM identity_restricted_sessions
          WHERE user_id = u.id AND revoked_at IS NOT NULL) AS restricted_revoked,
        (SELECT count(*) FROM identity_invalidation_events
          WHERE user_id = u.id) AS invalidation_count,
        (SELECT reason FROM identity_invalidation_events
          WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1)
          AS invalidation_reason,
        coalesce((SELECT count(*) FROM identity_invalidation_events
          WHERE user_id = u.id AND dispatched_at IS NOT NULL), 0) AS dispatched,
        (SELECT justification FROM administrative_audit_events
          WHERE target_id_snapshot = u.id
          ORDER BY occurred_at DESC, event_id DESC LIMIT 1) AS justification
      FROM users u
      JOIN local_authenticator_states a ON a.user_id = u.id
      WHERE u.id = ?
    `, [fixture.userId])),
  });
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
      label: "test-operator",
      authenticationMethod: "host_terminal",
    },
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}
