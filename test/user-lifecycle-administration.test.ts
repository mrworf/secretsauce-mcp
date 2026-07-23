import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import {
  UserLifecycleAdministrationError,
  UserLifecycleAdministrationRepository,
  UserLifecycleAdministrationService,
} from "../src/identity/userLifecycleAdministration.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("guarded user lifecycle administration", () => {
  it("invites an ordinary identity atomically and never repeats its one-time value", async () => {
    const fixture = await lifecycleFixture("invite");
    const body = {
      email: " Invited@Example.org ",
      given_name: "Invited",
      family_name: "User",
      role: "user",
    };
    const first = await fixture.service.invite(
      fixture.actor,
      body,
      "invite-idempotency-key",
      CORRELATION,
    );
    expect(first).toMatchObject({
      oneTimeValueDisplayed: true,
      user: {
        email: "Invited@Example.org",
        role: "user",
        status: "invited",
        passwordState: "temporary",
        totpState: "not_configured",
      },
    });
    expect(first.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const replay = await fixture.service.invite(
      fixture.actor,
      body,
      "invite-idempotency-key",
      CORRELATION,
    );
    expect(replay).toEqual({
      user: first.user,
      oneTimeValueDisplayed: false,
    });
    const stored = await snapshot(fixture.worker, first.user.id);
    expect(stored.temporary_hash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(stored)).not.toContain(first.temporaryPassword);
    expect(stored.audit_count).toBe(2);
    expect(stored.idempotency_count).toBe(1);

    await expect(fixture.service.invite(
      fixture.actor,
      { ...body, given_name: "Changed" },
      "invite-idempotency-key",
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("idempotency_conflict"));
  });

  it("resets password and TOTP with stale, replay, and material-preservation guards", async () => {
    const fixture = await lifecycleFixture("reset");
    const target = await fixture.create("reset-target@example.org", "user", "active");
    const password = await fixture.service.resetPassword(
      fixture.actor,
      target.id,
      target.version,
      { justification: "Account owner verified." },
      "password-reset-key",
      CORRELATION,
    );
    expect(password).toMatchObject({
      oneTimeValueDisplayed: true,
      user: {
        id: target.id,
        passwordState: "temporary",
        totpState: "not_configured",
        version: target.version + 1,
      },
    });
    const replay = await fixture.service.resetPassword(
      fixture.actor,
      target.id,
      target.version,
      { justification: "Account owner verified." },
      "password-reset-key",
      CORRELATION,
    );
    expect(replay.oneTimeValueDisplayed).toBe(false);
    expect(replay).not.toHaveProperty("temporaryPassword");
    const other = await fixture.create("reset-other@example.org", "user", "active");
    await expect(fixture.service.resetPassword(
      fixture.actor,
      other.id,
      other.version,
      { justification: "Account owner verified." },
      "password-reset-key",
      CORRELATION,
    )).rejects.toEqual(
      new UserLifecycleAdministrationError("idempotency_conflict"),
    );

    const totp = await fixture.service.resetTotp(
      fixture.actor,
      target.id,
      password.user.version,
      { justification: "Authenticator was lost." },
      "totp-reset-key-123",
      CORRELATION,
    );
    expect(totp).toMatchObject({
      id: target.id,
      passwordState: "temporary",
      totpState: "not_configured",
      version: target.version + 2,
    });
    await expect(fixture.service.resetTotp(
      fixture.actor,
      target.id,
      target.version,
      { justification: "Stale request." },
      "different-reset-key",
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("stale"));
  });

  it("enforces legal status transitions, erases deactivated material, and restores enrollment", async () => {
    const fixture = await lifecycleFixture("states");
    const target = await fixture.create("state-target@example.org", "admin", "active");
    const suspended = await fixture.service.transition(
      "suspend",
      fixture.actor,
      target.id,
      target.version,
      { justification: "Investigating account misuse." },
      CORRELATION,
    );
    expect(suspended.status).toBe("suspended");
    const active = await fixture.service.transition(
      "reactivate",
      fixture.actor,
      target.id,
      suspended.version,
      { justification: "Investigation completed." },
      CORRELATION,
    );
    expect(active.status).toBe("active");
    const deactivated = await fixture.service.transition(
      "deactivate",
      fixture.actor,
      target.id,
      active.version,
      { justification: "Employment ended." },
      CORRELATION,
    );
    expect(deactivated).toMatchObject({
      status: "deactivated",
      passwordState: "disabled",
      totpState: "disabled",
    });
    const disabled = await snapshot(fixture.worker, target.id);
    expect(disabled).toMatchObject({
      password_count: 0,
      totp_count: 0,
      temporary_count: 0,
      pending_count: 0,
    });

    const restored = await fixture.service.restoreEnrollment(
      fixture.actor,
      target.id,
      deactivated.version,
      { justification: "Approved identity restoration." },
      "restore-enrollment-key",
      CORRELATION,
    );
    expect(restored).toMatchObject({
      oneTimeValueDisplayed: true,
      user: {
        id: target.id,
        role: "admin",
        status: "enrollment_required",
        passwordState: "temporary",
        totpState: "not_configured",
      },
    });
    expect(restored.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
    await expect(fixture.service.transition(
      "reactivate",
      fixture.actor,
      target.id,
      restored.user.version,
      { justification: "Illegal shortcut." },
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("forbidden"));
  });

  it("changes roles with final-active-superadmin protection and fail-closed admin scope", async () => {
    const fixture = await lifecycleFixture("roles");
    const target = await fixture.create("role-target@example.org", "user", "active");
    const promoted = await fixture.service.changeRole(
      fixture.actor,
      target.id,
      target.version,
      { role: "admin", justification: "Approved administrator assignment." },
      CORRELATION,
    );
    expect(promoted).toMatchObject({ role: "admin", version: target.version + 1 });

    const lone = await lifecycleFixture("lone");
    await expect(lone.service.changeRole(
      lone.actor,
      lone.actor.principalId,
      1,
      { role: "admin", justification: "Unsafe self demotion." },
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("last_superadmin"));

    const admin = await fixture.create("scoped-admin@example.org", "admin", "active");
    await expect(fixture.service.transition(
      "suspend",
      browser(admin.id, "admin"),
      target.id,
      promoted.version,
      { justification: "No relationship evidence." },
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("not_found"));
  });

  it("permanently deletes only deactivated ordinary identities and retains audit evidence", async () => {
    const fixture = await lifecycleFixture("delete");
    const target = await fixture.create("delete-target@example.org", "user", "active");
    const identities = new IdentityRepository(fixture.worker, { now: () => NOW });
    await identities.linkProvider(target.id, {
      providerId: "fixture",
      issuer: "https://issuer.example.org",
      subject: "delete-target",
    }, audit());
    await addDeletionRelations(fixture.worker, target.id);

    await expect(fixture.service.deleteUser(
      fixture.actor,
      target.id,
      target.version,
      { justification: "Still active." },
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("not_found"));

    const deactivated = await fixture.service.transition(
      "deactivate",
      fixture.actor,
      target.id,
      target.version,
      { justification: "Prepare approved deletion." },
      CORRELATION,
    );
    await expect(fixture.service.deleteUser(
      fixture.actor,
      target.id,
      deactivated.version,
      { justification: "Retention period completed." },
      CORRELATION,
    )).resolves.toEqual({ userId: target.id, deleted: true });

    const remaining = await deletionSnapshot(fixture.worker, target.id);
    expect(remaining.relation_count).toBe(0);
    expect(remaining.delete_audits).toBe(1);
    expect(remaining.audit_target).toBe(target.id);

    const protectedSuperadmin = await fixture.create(
      "protected-superadmin@example.org",
      "superadmin",
      "deactivated",
    );
    await expect(fixture.service.deleteUser(
      fixture.actor,
      protectedSuperadmin.id,
      protectedSuperadmin.version,
      { justification: "Superadmins are never deleted." },
      CORRELATION,
    )).rejects.toEqual(new UserLifecycleAdministrationError("not_found"));
  });
});

async function lifecycleFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-user-lifecycle-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadmin = await identities.createLocalIdentity({
    profile: {
      email: `${label}-superadmin@example.org`,
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const repository = new UserLifecycleAdministrationRepository(worker, undefined, () => NOW);
  return {
    worker,
    actor: browser(superadmin.id, "superadmin"),
    service: new UserLifecycleAdministrationService(
      repository,
      new ControlIdempotencyHasher(Buffer.alloc(32, 77)),
      {
        password: { minimumLength: 12 },
        temporaryPasswordTtlMs: 72 * 60 * 60_000,
      },
      undefined,
      () => NOW,
    ),
    create: (
      email: string,
      role: "superadmin" | "admin" | "user",
      status: "invited" | "enrollment_required" | "active" | "suspended" | "deactivated",
    ) => identities.createLocalIdentity({
      profile: { email, givenName: "Target", familyName: "User" },
      role,
      status,
    }, audit()),
  };
}

function browser(
  principalId: string,
  role: "superadmin" | "admin" | "user",
): ControlAuthenticationContext {
  return { method: "browser_session", principalId, role };
}

function audit(): IdentityAuditContext {
  return {
    actor: {
      type: "local_cli",
      label: "fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}

async function snapshot(worker: PersistenceWorker, userId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      temporary_hash: string | null;
      audit_count: number;
      idempotency_count: number;
      password_count: number;
      totp_count: number;
      temporary_count: number;
      pending_count: number;
    }>(`
      SELECT
        (SELECT encoded_hash FROM identity_temporary_passwords WHERE user_id = u.id)
          AS temporary_hash,
        (SELECT count(*) FROM administrative_audit_events) AS audit_count,
        (SELECT count(*) FROM control_idempotency_records) AS idempotency_count,
        (SELECT count(*) FROM local_password_credentials WHERE user_id = u.id)
          AS password_count,
        (SELECT count(*) FROM local_totp_authenticators WHERE user_id = u.id)
          AS totp_count,
        (SELECT count(*) FROM identity_temporary_passwords WHERE user_id = u.id)
          AS temporary_count,
        (SELECT count(*) FROM identity_pending_totp WHERE user_id = u.id)
          AS pending_count
      FROM users u WHERE u.id = ?
    `, [userId])),
  });
}

async function addDeletionRelations(worker: PersistenceWorker, userId: string): Promise<void> {
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      const sessionId = "018f1f2e-7b3c-7a10-8000-000000000101";
      transaction.run(`
        INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
        VALUES (?, 1, 'login', ?)
      `, [userId, NOW]);
      transaction.run(`
        INSERT INTO browser_sessions (
          id, user_id, session_hash, csrf_hash, role_class,
          issued_security_epoch, issued_global_epoch,
          issued_absolute_ms, issued_inactivity_ms,
          issued_at, last_activity_at, absolute_expires_at,
          step_up_at, revoked_at, version
        ) VALUES (?, ?, ?, ?, 'user', 1, 1, 60000, 30000, ?, ?, ?, NULL, NULL, 1)
      `, [
        sessionId,
        userId,
        "1".repeat(64),
        "2".repeat(64),
        NOW,
        NOW,
        NOW + 60_000,
      ]);
      transaction.run(`
        INSERT INTO identity_step_up_proofs (
          id, proof_hash, session_id, user_id, method, route_id,
          targets_json, expected_version, idempotency_key_hash, body_digest,
          issued_security_epoch, issued_global_epoch, issued_at, expires_at, consumed_at
        ) VALUES (?, ?, ?, ?, 'DELETE', 'users.delete', '[]', 1, NULL, ?, 1, 1, ?, ?, NULL)
      `, [
        "018f1f2e-7b3c-7a10-8000-000000000102",
        "3".repeat(64),
        sessionId,
        userId,
        "4".repeat(64),
        NOW,
        NOW + 60_000,
      ]);
      transaction.run(`
        INSERT INTO identity_restricted_sessions (
          id, user_id, purpose, session_hash, csrf_hash,
          issued_security_epoch, issued_global_epoch,
          issued_at, expires_at, revoked_at, version
        ) VALUES (?, ?, 'password_change', ?, ?, 1, 1, ?, ?, NULL, 1)
      `, [
        "018f1f2e-7b3c-7a10-8000-000000000103",
        userId,
        "5".repeat(64),
        "6".repeat(64),
        NOW,
        NOW + 60_000,
      ]);
    }),
  });
}

async function deletionSnapshot(worker: PersistenceWorker, userId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<{
      relation_count: number;
      delete_audits: number;
      audit_target: string | null;
    }>(`
      SELECT
        (
          (SELECT count(*) FROM users WHERE id = ?) +
          (SELECT count(*) FROM local_authenticator_states WHERE user_id = ?) +
          (SELECT count(*) FROM external_identities WHERE user_id = ?) +
          (SELECT count(*) FROM local_password_credentials WHERE user_id = ?) +
          (SELECT count(*) FROM local_totp_authenticators WHERE user_id = ?) +
          (SELECT count(*) FROM accepted_totp_steps WHERE user_id = ?) +
          (SELECT count(*) FROM browser_sessions WHERE user_id = ?) +
          (SELECT count(*) FROM identity_step_up_proofs WHERE user_id = ?) +
          (SELECT count(*) FROM identity_temporary_passwords WHERE user_id = ?) +
          (SELECT count(*) FROM identity_restricted_sessions WHERE user_id = ?) +
          (SELECT count(*) FROM identity_pending_totp WHERE user_id = ?) +
          (SELECT count(*) FROM identity_invalidation_events WHERE user_id = ?) +
          (SELECT count(*) FROM identity_bootstrap WHERE user_id = ?)
        ) AS relation_count,
        (
          SELECT count(*) FROM administrative_audit_events
          WHERE action = 'identity.delete' AND target_id_snapshot = ?
        ) AS delete_audits,
        (
          SELECT target_id_snapshot FROM administrative_audit_events
          WHERE action = 'identity.delete' AND target_id_snapshot = ?
          LIMIT 1
        ) AS audit_target
    `, Array(15).fill(userId))),
  });
}
