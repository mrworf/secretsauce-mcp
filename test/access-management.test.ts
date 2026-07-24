import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccessCursorCodec,
  AccessManagementError,
  AccessManagementRepository,
} from "../src/accessManagement.js";
import { IdentityRepository } from "../src/identity/repository.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "../src/identity/stepUp.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_200_000_000;
const SESSION_ONE = "018f1f2e-7b3c-7a10-8000-000000000301";
const SESSION_TWO = "018f1f2e-7b3c-7a10-8000-000000000302";
const CLIENT_ID = "018f1f2e-7b3c-7a10-8000-000000000303";
const GRANT_ONE = "018f1f2e-7b3c-7a10-8000-000000000304";
const GRANT_TWO = "018f1f2e-7b3c-7a10-8000-000000000305";
const FAMILY_ONE = "018f1f2e-7b3c-7a10-8000-000000000306";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000307";
const SNAPSHOT_ID = "018f1f2e-7b3c-7a10-8000-000000000308";
const ASSIGNMENT_ID = "018f1f2e-7b3c-7a10-8000-000000000309";
const REFRESH_ID = "018f1f2e-7b3c-7a10-8000-000000000311";
const ACCESS_ID = "018f1f2e-7b3c-7a10-8000-000000000312";
const workers = new Set<PersistenceWorker>();
const codecs = new Set<AccessCursorCodec>();

afterEach(async () => {
  for (const codec of codecs) codec.close();
  codecs.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("access management projections", () => {
  it("applies own/global scope before pagination and returns only safe session and grant metadata", async () => {
    const fixture = await setup();
    const ownSessions = await fixture.repository.sessionsPage({
      viewer: { userId: fixture.userOne, role: "user" },
      scope: "own",
      currentSessionId: SESSION_ONE,
      pageSize: 1,
    });
    expect(ownSessions).toEqual({
      items: [expect.objectContaining({
        id: SESSION_ONE,
        userId: fixture.userOne,
        current: true,
        status: "active",
      })],
    });
    expect(JSON.stringify(ownSessions)).not.toContain("session_hash");
    expect(JSON.stringify(ownSessions)).not.toContain("a".repeat(64));

    const ownGrants = await fixture.repository.grantsPage({
      viewer: { userId: fixture.userOne, role: "user" },
      scope: "own",
    });
    expect(ownGrants.items).toEqual([
      expect.objectContaining({
        id: GRANT_ONE,
        userId: fixture.userOne,
        clientName: "Example MCP Client",
        scopes: ["gateway.read"],
        status: "active",
        usable: true,
        services: ["Payments API"],
      }),
    ]);
    const serialized = JSON.stringify(ownGrants);
    expect(serialized).not.toContain("token_hash");
    expect(serialized).not.toContain("refresh");
    expect(serialized).not.toContain("session_hash");

    const first = await fixture.repository.grantsPage({
      viewer: { userId: fixture.superadmin, role: "superadmin" },
      scope: "global",
      pageSize: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTypeOf("string");
    const second = await fixture.repository.grantsPage({
      viewer: { userId: fixture.superadmin, role: "superadmin" },
      scope: "global",
      pageSize: 1,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map(({ userId }) => userId)))
      .toEqual(new Set([fixture.userOne, fixture.userTwo]));
  });

  it("rejects global access for non-superadmins and malformed, cross-kind, or noncanonical cursors", async () => {
    const fixture = await setup();
    await expect(fixture.repository.grantsPage({
      viewer: { userId: fixture.userOne, role: "user" },
      scope: "global",
    })).rejects.toEqual(new AccessManagementError("forbidden"));
    await expect(fixture.repository.sessionsPage({
      viewer: { userId: fixture.userOne, role: "user" },
      scope: "own",
      pageSize: 101,
    })).rejects.toEqual(new AccessManagementError("invalid_request"));

    const cursor = fixture.codec.encode("grant", NOW, GRANT_ONE);
    expect(() => fixture.codec.decode(cursor, "session"))
      .toThrow(new AccessManagementError("invalid_request"));
    const changed = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;
    expect(() => fixture.codec.decode(changed, "grant"))
      .toThrow(new AccessManagementError("invalid_request"));
    const [payload, mac] = cursor.split(".");
    expect(() => fixture.codec.decode(`${payload}=.${mac}`, "grant"))
      .toThrow(new AccessManagementError("invalid_request"));
  });

  it("computes revocation, invalidity, expiry, and service loss at read time before status filtering", async () => {
    const fixture = await setup();
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE browser_sessions SET revoked_at = ? WHERE id = ?",
          [NOW, SESSION_TWO],
        );
        transaction.run(
          "UPDATE oauth_grants SET status = 'revoked', revoked_at = ?, revocation_reason = 'manual' WHERE id = ?",
          [NOW, GRANT_TWO],
        );
      }),
    });
    const revokedSessions = await fixture.repository.sessionsPage({
      viewer: { userId: fixture.superadmin, role: "superadmin" },
      scope: "global",
      status: "revoked",
    });
    expect(revokedSessions.items.map(({ id }) => id)).toEqual([SESSION_TWO]);
    const revokedGrants = await fixture.repository.grantsPage({
      viewer: { userId: fixture.superadmin, role: "superadmin" },
      scope: "global",
      status: "revoked",
    });
    expect(revokedGrants.items.map(({ id }) => id)).toEqual([GRANT_TWO]);

    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE id = ?",
          [ASSIGNMENT_ID],
        );
      }),
    });
    const own = await fixture.repository.grantsPage({
      viewer: { userId: fixture.userOne, role: "user" },
      scope: "own",
    });
    expect(own.items[0]).toMatchObject({
      status: "active",
      usable: false,
      services: [],
    });
  });

  it("revokes only an own session or grant, tears down token records, and is idempotent", async () => {
    const fixture = await setup();
    const denied = await fixture.repository.revokeGrant({
      viewer: { userId: fixture.userOne, role: "user" },
      grantId: GRANT_TWO,
      correlationId: correlationId("1"),
    });
    expect(denied).toMatchObject({ revoked: false, grantsRevoked: 0 });

    const session = await fixture.repository.revokeSession({
      viewer: { userId: fixture.userOne, role: "user" },
      sessionId: SESSION_ONE,
      correlationId: correlationId("2"),
    });
    expect(session).toMatchObject({ revoked: true, sessionsRevoked: 1 });
    const grant = await fixture.repository.revokeGrant({
      viewer: { userId: fixture.userOne, role: "user" },
      grantId: GRANT_ONE,
      correlationId: correlationId("3"),
    });
    expect(grant).toMatchObject({ revoked: true, grantsRevoked: 1 });
    const repeated = await fixture.repository.revokeGrant({
      viewer: { userId: fixture.userOne, role: "user" },
      grantId: GRANT_ONE,
      correlationId: correlationId("4"),
    });
    expect(repeated).toMatchObject({ revoked: false, grantsRevoked: 0 });

    const state = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        session_revoked: number;
        grant_status: string;
        family_status: string;
        refresh_status: string;
        access_status: string;
      }>(`
        SELECT
          (SELECT count(*) FROM browser_sessions
            WHERE id = ? AND revoked_at IS NOT NULL) AS session_revoked,
          (SELECT status FROM oauth_grants WHERE id = ?) AS grant_status,
          (SELECT status FROM oauth_refresh_families
            WHERE id = ?) AS family_status,
          (SELECT status FROM oauth_refresh_tokens
            WHERE id = ?) AS refresh_status,
          (SELECT status FROM oauth_access_tokens
            WHERE id = ?) AS access_status
      `, [SESSION_ONE, GRANT_ONE, FAMILY_ONE, REFRESH_ID, ACCESS_ID])),
    });
    expect(state).toEqual({
      session_revoked: 1,
      grant_status: "revoked",
      family_status: "revoked",
      refresh_status: "revoked",
      access_status: "revoked",
    });
  });

  it("requires superadmin, exact confirmation, idempotency, and step-up for bulk revocation", async () => {
    const fixture = await setup(true);
    const idempotency = {
      keyHash: "7".repeat(64),
      principalId: fixture.superadmin,
      routeId: "access.oauth.bulk_revoke",
      requestDigest: "8".repeat(64),
    };
    const base = {
      viewer: { userId: fixture.superadmin, role: "superadmin" as const },
      target: { kind: "user" as const, id: fixture.userTwo },
      justification: "Remove a compromised connection.",
      correlationId: correlationId("5"),
      idempotency,
    };
    await expect(fixture.repository.revokeGrantBulk({
      ...base,
      confirmation: `REVOKE USER ${fixture.userTwo}`,
    })).rejects.toEqual(new AccessManagementError("forbidden"));
    await expect(fixture.repository.revokeGrantBulk({
      ...base,
      confirmation: "REVOKE USER wrong",
      stepUpProof: fakeProof(fixture.superadmin),
    })).rejects.toEqual(new AccessManagementError("invalid_request"));

    const result = await fixture.repository.revokeGrantBulk({
      ...base,
      confirmation: `REVOKE USER ${fixture.userTwo}`,
      stepUpProof: fakeProof(fixture.superadmin),
    });
    expect(result).toMatchObject({
      kind: "executed",
      value: { grantsRevoked: 1, revoked: true },
    });
    const replay = await fixture.repository.revokeGrantBulk({
      ...base,
      confirmation: `REVOKE USER ${fixture.userTwo}`,
      stepUpProof: fakeProof(fixture.superadmin),
    });
    expect(replay).toMatchObject({ kind: "replayed" });
  });
});

async function setup(withStepUp = false): Promise<{
  worker: PersistenceWorker;
  repository: AccessManagementRepository;
  codec: AccessCursorCodec;
  userOne: string;
  userTwo: string;
  superadmin: string;
}> {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "secretsauce-access-management-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadmin = await identities.createLocalIdentity({
    profile: {
      email: "root@example.org",
      givenName: "Root",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const first = await identities.createLocalIdentity({
    profile: {
      email: "one@example.org",
      givenName: "First",
      familyName: "User",
    },
    role: "user",
    status: "active",
  }, audit());
  const second = await identities.createLocalIdentity({
    profile: {
      email: "two@example.org",
      givenName: "Second",
      familyName: "User",
    },
    role: "user",
    status: "active",
  }, audit());
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      insertSession(transaction, SESSION_ONE, first.id, "a", NOW - 1_000);
      insertSession(transaction, SESSION_TWO, second.id, "b", NOW - 2_000);
      transaction.run(`
        INSERT INTO oauth_clients (
          id, client_identifier, display_name, metadata_json, metadata_digest,
          lifecycle, first_seen_at, last_seen_at, version
        ) VALUES (?, 'https://client.example.org/metadata.json',
          'Example MCP Client', '{}', ?, 'active', ?, ?, 1)
      `, [CLIENT_ID, "c".repeat(64), NOW, NOW]);
      insertGrant(transaction, GRANT_ONE, first.id, NOW - 1_000);
      insertGrant(transaction, GRANT_TWO, second.id, NOW - 2_000);
      transaction.run(`
        INSERT INTO oauth_refresh_families (
          id, grant_id, current_sequence, status, issued_at, last_used_at,
          absolute_expires_at, idle_expires_at, revoked_at,
          revocation_reason, version
        ) VALUES (?, ?, 0, 'active', ?, ?, ?, ?, NULL, NULL, 1)
      `, [
        FAMILY_ONE,
        GRANT_ONE,
        NOW - 1_000,
        NOW - 1_000,
        NOW + 90 * 86_400_000,
        NOW + 30 * 86_400_000,
      ]);
      transaction.run(`
        INSERT INTO oauth_refresh_tokens (
          id, token_hash, family_id, sequence, status, issued_at, used_at
        ) VALUES (?, ?, ?, 0, 'active', ?, NULL)
      `, [REFRESH_ID, "3".repeat(64), FAMILY_ONE, NOW - 1_000]);
      transaction.run(`
        INSERT INTO oauth_access_tokens (
          id, token_hash, grant_id, family_id, scopes_json,
          issued_at, expires_at, last_used_at, status
        ) VALUES (?, ?, ?, ?, '["gateway.read"]', ?, ?, ?, 'active')
      `, [
        ACCESS_ID,
        "4".repeat(64),
        GRANT_ONE,
        FAMILY_ONE,
        NOW - 1_000,
        NOW + 300_000,
        NOW - 1_000,
      ]);
      insertService(transaction, first.id);
    }),
  });
  const codec = new AccessCursorCodec(Buffer.alloc(32, 81));
  codecs.add(codec);
  const stepUps = withStepUp
    ? fakeStepUps(worker)
    : undefined;
  const repository = new AccessManagementRepository(
    worker,
    {
      adminAbsoluteMs: 12 * 3_600_000,
      adminInactivityMs: 15 * 60_000,
      userAbsoluteMs: 24 * 3_600_000,
      userInactivityMs: 60 * 60_000,
    },
    {
      accessTokenTtlMs: 5 * 60_000,
      refreshTokenIdleTtlMs: 30 * 86_400_000,
      refreshTokenMaxTtlMs: 90 * 86_400_000,
    },
    codec,
    () => NOW,
    stepUps,
  );
  return {
    worker,
    repository,
    codec,
    userOne: first.id,
    userTwo: second.id,
    superadmin: superadmin.id,
  };
}

function insertSession(
  transaction: { run(sql: string, parameters?: unknown[]): unknown },
  id: string,
  userId: string,
  hash: string,
  lastActivity: number,
): void {
  transaction.run(`
    INSERT INTO browser_sessions (
      id, user_id, session_hash, csrf_hash, role_class,
      issued_security_epoch, issued_global_epoch,
      issued_absolute_ms, issued_inactivity_ms,
      issued_at, last_activity_at, absolute_expires_at,
      step_up_at, revoked_at, version
    ) VALUES (?, ?, ?, ?, 'user', 1, 1, 86400000, 3600000,
      ?, ?, ?, NULL, NULL, 1)
  `, [
    id,
    userId,
    hash.repeat(64),
    (hash === "a" ? "d" : "e").repeat(64),
    NOW - 10_000,
    lastActivity,
    NOW + 86_390_000,
  ]);
}

function insertGrant(
  transaction: { run(sql: string, parameters?: unknown[]): unknown },
  id: string,
  userId: string,
  lastUsed: number,
): void {
  transaction.run(`
    INSERT INTO oauth_grants (
      id, user_id, client_id, resource, scopes_json,
      authentication_method, issued_security_epoch, issued_global_epoch,
      issued_access_ttl_ms, issued_refresh_idle_ms,
      issued_refresh_absolute_ms, status, issued_at, last_used_at,
      absolute_expires_at, idle_expires_at, revoked_at,
      revocation_reason, version
    ) VALUES (?, ?, ?, 'https://mcp.example.org', '["gateway.read"]',
      'local_password_totp', 1, 1, 300000, 2592000000, 7776000000,
      'active', ?, ?, ?, ?, NULL, NULL, 1)
  `, [
    id,
    userId,
    CLIENT_ID,
    NOW - 10_000,
    lastUsed,
    NOW + 90 * 86_400_000,
    NOW + 30 * 86_400_000,
  ]);
}

function insertService(
  transaction: { run(sql: string, parameters?: unknown[]): unknown },
  userId: string,
): void {
  transaction.run(`
    INSERT INTO services (
      id, slug, name, description, documentation_url, lifecycle,
      draft_digest, published_revision_id, published_digest,
      publication_generation, version, created_at, updated_at
    ) VALUES (?, 'payments', 'Payments API', NULL, NULL, 'published',
      ?, ?, ?, 1, 1, ?, ?)
  `, [
    SERVICE_ID,
    "f".repeat(64),
    "018f1f2e-7b3c-7a10-8000-000000000310",
    "1".repeat(64),
    NOW,
    NOW,
  ]);
  transaction.run(`
    INSERT INTO runtime_service_snapshots (
      id, service_id, publication_generation, document_json, digest, created_at
    ) VALUES (?, ?, 1, '{}', ?, ?)
  `, [SNAPSHOT_ID, SERVICE_ID, "2".repeat(64), NOW]);
  transaction.run(`
    UPDATE runtime_activation
    SET state = 'active', activation_generation = 1,
      global_reference_epoch = 1, version = 2,
      activated_at = ?, updated_at = ?
    WHERE singleton = 1
  `, [NOW, NOW]);
  transaction.run(`
    INSERT INTO runtime_active_services (
      service_id, snapshot_id, publication_generation, activated_at
    ) VALUES (?, ?, 1, ?)
  `, [SERVICE_ID, SNAPSHOT_ID, NOW]);
  transaction.run(`
    INSERT INTO service_principal_assignments (
      id, service_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
  `, [ASSIGNMENT_ID, SERVICE_ID, userId, userId, NOW]);
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "access-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
    source: { category: "identity" },
  };
}

function correlationId(suffix: string): string {
  return `req_12345678-1234-4234-8234-123456789ab${suffix}`;
}

function fakeProof(userId: string): AlwaysStepUpHandle {
  return {
    proofId: SESSION_ONE,
    sessionId: SESSION_ONE,
    userId,
    consumed: false,
  } as AlwaysStepUpHandle;
}

function fakeStepUps(worker: PersistenceWorker): StepUpRepository {
  return {
    withConsumedProof: async (_proof, auditInput, mutation) =>
      worker.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => ({
            value: mutation(transaction),
            auditInput,
          }),
        ),
      }),
  } as StepUpRepository;
}
