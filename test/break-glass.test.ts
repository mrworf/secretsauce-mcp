import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runBreakGlassCli,
  type BreakGlassIo,
} from "../src/identity/breakGlassCli.js";
import {
  LocalAuthenticationRepository,
} from "../src/identity/localAuthentication.js";
import { hashPassword } from "../src/identity/password.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { IdentityKeyRing, beginTotpEnrollment } from "../src/identity/totp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig, IdentityConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;
const CORRELATION_UUID = "12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("host-local break-glass recovery", () => {
  it("recovers an active superadmin by UUID without changing identity or role", async () => {
    const fixture = await configuredIdentity("superadmin", "active");
    await fixture.worker.close();
    workers.delete(fixture.worker);
    const marker = "configured-break-glass-marker";
    const io = fakeIo([fixture.userId, "RESET"]);
    expect(await runBreakGlassCli([], { CONFIG_PATH: "/config/example.yaml" }, io, {
      loadConfiguration: () => fakeConfig(fixture.databaseFile, marker),
      correlationUuid: () => CORRELATION_UUID,
      now: () => NOW,
      osActor: () => `operator ${marker}`,
      random: (size) => Buffer.alloc(size, 71),
    })).toBe(0);
    expect(io.errors).toEqual([]);
    expect(io.output).toHaveLength(1);
    const output = JSON.parse(io.output[0]!) as Record<string, unknown>;
    expect(output).toMatchObject({
      status: "enrollment_required",
      user_id: fixture.userId,
      role: "superadmin",
      expires_at: NOW + 72 * 3_600_000,
      invalidation_pending: true,
    });
    expect(output.temporary_password).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const worker = open(fixture.databaseFile);
    const state = await worker.execute({
      run: (database) => database.read((query) => query.get<Record<string, unknown>>(`
        SELECT
          u.id, u.role, u.status, u.security_epoch,
          a.password_state, a.totp_state,
          (SELECT count(*) FROM local_password_credentials WHERE user_id = u.id)
            AS password_count,
          (SELECT count(*) FROM local_totp_authenticators WHERE user_id = u.id)
            AS totp_count,
          (SELECT encoded_hash FROM identity_temporary_passwords WHERE user_id = u.id)
            AS temporary_hash,
          (SELECT count(*) FROM browser_sessions
            WHERE user_id = u.id AND revoked_at IS NOT NULL) AS browser_revoked,
          (SELECT count(*) FROM identity_restricted_sessions
            WHERE user_id = u.id AND revoked_at IS NOT NULL) AS restricted_revoked,
          (SELECT reason FROM identity_invalidation_events
            WHERE user_id = u.id ORDER BY rowid DESC LIMIT 1) AS reason,
          (SELECT json_extract(source_json, '$.osActor') FROM administrative_audit_events
            WHERE action = 'identity.break_glass_reset') AS os_actor,
          (SELECT justification FROM administrative_audit_events
            WHERE action = 'identity.break_glass_reset') AS justification
        FROM users u
        JOIN local_authenticator_states a ON a.user_id = u.id
        WHERE u.id = ?
      `, [fixture.userId])),
    });
    expect(state).toMatchObject({
      id: fixture.userId,
      role: "superadmin",
      status: "enrollment_required",
      security_epoch: 2,
      password_state: "temporary",
      totp_state: "not_configured",
      password_count: 0,
      totp_count: 0,
      browser_revoked: 1,
      restricted_revoked: 1,
      reason: "break_glass",
      justification: "Host-local break-glass credential recovery.",
    });
    expect(state?.temporary_hash).toMatch(/^\$argon2id\$/);
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(String(output.temporary_password));
    expect(serialized).not.toContain(marker);
    expect(serialized).toContain("[REDACTED]");
  });

  it("finds a non-active ordinary user by normalized email", async () => {
    const fixture = await configuredIdentity("ordinary", "suspended", "admin");
    await fixture.worker.close();
    workers.delete(fixture.worker);
    const submitted = " ORDINARY@EXAMPLE.ORG ";
    const io = fakeIo([submitted, "RESET"]);
    expect(await runBreakGlassCli([], { CONFIG_PATH: "/config/example.yaml" }, io, {
      loadConfiguration: () => fakeConfig(fixture.databaseFile),
      correlationUuid: () => CORRELATION_UUID,
      now: () => NOW,
      osActor: () => "operator",
    })).toBe(0);
    expect(JSON.parse(io.output[0]!)).toMatchObject({
      user_id: fixture.userId,
      role: "admin",
      status: "enrollment_required",
    });
    expect(io.output.join("")).not.toContain(submitted);
  });

  it("fails uniformly for arguments, non-terminals, cancellation, and unknown targets", async () => {
    const argument = "Raw-Secret-Argument";
    const withArguments = fakeIo([]);
    expect(await runBreakGlassCli(["--password", argument], {}, withArguments)).toBe(2);
    expect(withArguments.errors).toEqual(['{"error":{"code":"invalid_arguments"}}\n']);
    expect(withArguments.errors.join("")).not.toContain(argument);

    const nonTerminal = fakeIo([], false);
    expect(await runBreakGlassCli([], { CONFIG_PATH: "/config/example.yaml" }, nonTerminal))
      .toBe(2);
    expect(nonTerminal.errors).toEqual(['{"error":{"code":"terminal_required"}}\n']);

    const cancelled = fakeIo(["someone@example.org", "no"]);
    expect(await runBreakGlassCli([], { CONFIG_PATH: "/config/example.yaml" }, cancelled, {
      loadConfiguration: () => fakeConfig(databasePath("cancelled")),
    })).toBe(1);
    expect(cancelled.errors).toEqual(['{"error":{"code":"break_glass_cancelled"}}\n']);

    const missingFile = databasePath("missing");
    const worker = open(missingFile);
    await worker.close();
    workers.delete(worker);
    const submitted = "missing-private@example.org";
    const missing = fakeIo([submitted, "RESET"]);
    expect(await runBreakGlassCli([], { CONFIG_PATH: "/config/example.yaml" }, missing, {
      loadConfiguration: () => fakeConfig(missingFile),
      correlationUuid: () => CORRELATION_UUID,
      now: () => NOW,
    })).toBe(1);
    expect(missing.errors).toEqual(['{"error":{"code":"break_glass_failed"}}\n']);
    expect(missing.errors.join("")).not.toContain(submitted);
  });
});

async function configuredIdentity(
  label: string,
  status: "active" | "suspended",
  role: "superadmin" | "admin" | "user" = "superadmin",
) {
  const databaseFile = databasePath(label);
  const worker = open(databaseFile);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const identity = await identities.createLocalIdentity({
    profile: {
      email: `${label}@example.org`,
      givenName: "Ada",
      familyName: "Lovelace",
    },
    role,
    status,
  }, audit());
  const encodedHash = await hashPassword(Buffer.from(`Current-${label}-Password-2026`, "utf8"));
  const keyRing = new IdentityKeyRing("root", { root: Buffer.alloc(32, 81) });
  const enrollment = beginTotpEnrollment({
    authenticatorId: "018f1f2e-7b3c-7a10-8000-000000000010",
    userId: identity.id,
    label: `${label}@example.org`,
    issuer: "SecretSauce",
    keyRing,
  });
  await new LocalAuthenticationRepository(worker, { now: () => NOW })
    .provisionConfiguredAuthenticator({
      userId: identity.id,
      encodedHash,
      envelope: enrollment.envelope,
    }, audit());
  keyRing.destroy();
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO browser_sessions (
          id, user_id, session_hash, csrf_hash, role_class,
          issued_security_epoch, issued_global_epoch,
          issued_absolute_ms, issued_inactivity_ms,
          issued_at, last_activity_at, absolute_expires_at,
          step_up_at, revoked_at, version
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000020', ?, ?, ?, 'admin',
          1, 1, 3600000, 900000, ?, ?, ?, NULL, NULL, 1
        )
      `, [identity.id, "1".repeat(64), "2".repeat(64), NOW, NOW, NOW + 3_600_000]);
      transaction.run(`
        INSERT INTO identity_restricted_sessions (
          id, user_id, purpose, session_hash, csrf_hash,
          issued_security_epoch, issued_global_epoch,
          issued_at, expires_at, revoked_at, version
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000021', ?, 'totp_replacement',
          ?, ?, 1, 1, ?, ?, NULL, 1
        )
      `, [identity.id, "3".repeat(64), "4".repeat(64), NOW, NOW + 900_000]);
    }),
  });
  return { databaseFile, worker, userId: identity.id };
}

interface FakeIo extends BreakGlassIo {
  output: string[];
  errors: string[];
}

function fakeIo(answers: string[], terminal = true): FakeIo {
  const remaining = [...answers];
  const output: string[] = [];
  const errors: string[] = [];
  return {
    inputTerminal: terminal,
    outputTerminal: terminal,
    output,
    errors,
    question: async () => remaining.shift() ?? "",
    stdout: (value) => output.push(value),
    stderr: (value) => errors.push(value),
  };
}

function fakeConfig(databaseFile: string, secret = ""): GatewayConfig {
  return {
    persistence: { databaseFile },
    identity: identityConfig(),
    services: {
      fixture: {
        credentials: secret === "" ? [] : [{ secret }],
      },
    },
  } as unknown as GatewayConfig;
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
      label: "fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: `req_${CORRELATION_UUID}`,
    source: { category: "identity" },
  };
}

function open(databaseFile: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}

function databasePath(label: string): string {
  return join(mkdtempSync(join(tmpdir(), `secretsauce-break-glass-${label}-`)), "control.sqlite");
}
