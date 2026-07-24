import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import {
  UserAdministrationError,
  UserAdministrationRepository,
  UserAdministrationService,
  UserCursorCodec,
  UserManagementAuthorization,
} from "../src/identity/userAdministration.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const services = new Set<UserAdministrationService>();

afterEach(async () => {
  for (const service of services) service.close();
  services.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("authorized user profiles", () => {
  it("adapts matrix outcomes with fail-closed user and invitation scopes", async () => {
    const serviceId = "018f1f2e-7b3c-7a10-8000-000000000010";
    const targetId = "018f1f2e-7b3c-7a10-8000-000000000011";
    const authorization = new UserManagementAuthorization({
      authorizeScope: async () => false,
      verifyStepUp: async () => true,
    }, {
      relatedServiceIds: async () => [],
      userRelatedToService: async (userId, scopedServiceId) =>
        userId === targetId && scopedServiceId === serviceId,
    });
    const request = { params: {} } as FastifyRequest;
    await expect(authorization.authorizeScope(
      browser("018f1f2e-7b3c-7a10-8000-000000000001", "superadmin"),
      "invite_ordinary_user",
      "all_services",
      request,
    )).resolves.toBe(true);
    await expect(authorization.authorizeScope(
      browser("018f1f2e-7b3c-7a10-8000-000000000002", "admin"),
      "invite_ordinary_user",
      "assigned_services",
      request,
    )).resolves.toBe(false);
    await expect(authorization.authorizeScope(
      browser("018f1f2e-7b3c-7a10-8000-000000000001", "superadmin"),
      "view_ordinary_users",
      "all_ordinary_users",
      request,
    )).resolves.toBe(true);
    const serviceKey = apiActor(
      "018f1f2e-7b3c-7a10-8000-000000000012",
      "service",
      serviceId,
    );
    await expect(authorization.authorizeScope(
      serviceKey,
      "invite_ordinary_user",
      "scoped_service",
      request,
    )).resolves.toBe(true);
    await expect(authorization.authorizeScope(
      serviceKey,
      "view_ordinary_users",
      "related_users",
      { params: { user_id: targetId } } as unknown as FastifyRequest,
    )).resolves.toBe(true);
    await expect(authorization.authorizeScope(
      serviceKey,
      "view_ordinary_users",
      "related_users",
      {
        params: { user_id: "018f1f2e-7b3c-7a10-8000-000000000013" },
      } as unknown as FastifyRequest,
    )).resolves.toBe(false);
    await expect(authorization.authorizeScope(
      apiActor("018f1f2e-7b3c-7a10-8000-000000000014", "system"),
      "invite_ordinary_user",
      "ordinary_users_without_assignment",
      request,
    )).resolves.toBe(true);
  });

  it("lists and searches bounded superadmin projections with viewer-bound cursors", async () => {
    const fixture = await userFixture("list");
    await fixture.create("charlie@example.org", "user");
    await fixture.create("bravo@example.org", "admin");
    await fixture.create("alpha@example.org", "user");

    const first = await fixture.service.list(fixture.superadmin, { limit: 2 });
    expect(first.users).toHaveLength(2);
    expect(first.users.map(({ email }) => email)).toEqual([
      "alpha@example.org",
      "bravo@example.org",
    ]);
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
    const second = await fixture.service.list(fixture.superadmin, {
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.users.map(({ email }) => email)).toEqual([
      "charlie@example.org",
      "list-superadmin@example.org",
    ]);
    expect(second.nextCursor).toBeUndefined();

    const searched = await fixture.service.list(fixture.superadmin, {
      q: "CHARLIE",
      role: "user",
      status: "active",
    });
    expect(searched.users.map(({ email }) => email)).toEqual(["charlie@example.org"]);
    expect(JSON.stringify(searched)).not.toMatch(
      /normalizedEmail|securityEpoch|encoded_hash|envelope_json|session_hash/i,
    );

    const other = await fixture.create("other-superadmin@example.org", "superadmin");
    await expect(fixture.service.list(browser(other.id, "superadmin"), {
      limit: 2,
      cursor: first.nextCursor,
    })).rejects.toEqual(new UserAdministrationError("invalid_request"));
    await expect(fixture.service.list(fixture.superadmin, {
      limit: 2,
      q: "different",
      cursor: first.nextCursor,
    })).rejects.toEqual(new UserAdministrationError("invalid_request"));
  });

  it("expires cursors and rejects malformed, unknown, and over-bound list inputs", async () => {
    const fixture = await userFixture("cursor");
    await fixture.create("one@example.org", "user");
    const first = await fixture.service.list(fixture.superadmin, { limit: 1 });
    fixture.clock.value += 15 * 60_000;
    await expect(fixture.service.list(fixture.superadmin, {
      limit: 1,
      cursor: first.nextCursor,
    })).rejects.toEqual(new UserAdministrationError("invalid_request"));
    for (const input of [
      { limit: 0 },
      { limit: 201 },
      { q: "x".repeat(513) },
      { cursor: "altered" },
      { unexpected: true },
    ]) {
      await expect(fixture.service.list(fixture.superadmin, input))
        .rejects.toEqual(new UserAdministrationError("invalid_request"));
    }
  });

  it("allows self and superadmin detail while fail-closing admin relationships", async () => {
    const fixture = await userFixture("visibility");
    const ordinary = await fixture.create("ordinary@example.org", "user");
    const admin = await fixture.create("admin@example.org", "admin");
    await expect(fixture.service.detail(browser(ordinary.id, "user"), ordinary.id))
      .resolves.toMatchObject({ id: ordinary.id });
    await expect(fixture.service.detail(browser(ordinary.id, "user"), admin.id))
      .rejects.toEqual(new UserAdministrationError("not_found"));
    await expect(fixture.service.detail(browser(admin.id, "admin"), ordinary.id))
      .rejects.toEqual(new UserAdministrationError("not_found"));
    await expect(fixture.service.list(browser(admin.id, "admin"), {}))
      .rejects.toEqual(new UserAdministrationError("forbidden"));
    await expect(fixture.service.detail(fixture.superadmin, admin.id))
      .resolves.toMatchObject({ id: admin.id, role: "admin" });
  });

  it("updates names without invalidation and invalidates every session only when email changes", async () => {
    const fixture = await userFixture("profile");
    const target = await fixture.create("target@example.org", "user");
    await addSessions(fixture.worker, target.id);
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE users
          SET email_source = 'oidc:workforce',
              given_name_source = 'oidc:workforce',
              family_name_source = 'oidc:workforce'
          WHERE id = ?
        `, [target.id]);
      }),
    });

    const renamed = await fixture.service.updateOther(
      fixture.superadmin,
      target.id,
      target.version,
      {
        email: target.email,
        givenName: "Grace",
        familyName: "Hopper",
      },
      CORRELATION,
    );
    expect(renamed).toMatchObject({
      email: "target@example.org",
      givenName: "Grace",
      familyName: "Hopper",
      version: target.version + 1,
    });
    await expect(fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        email_source: string;
        given_name_source: string;
        family_name_source: string;
      }>(`
        SELECT email_source, given_name_source, family_name_source
        FROM users WHERE id = ?
      `, [target.id])),
    })).resolves.toEqual({
      email_source: "local",
      given_name_source: "local",
      family_name_source: "local",
    });
    expect(await securitySnapshot(fixture.worker, target.id)).toMatchObject({
      security_epoch: 1,
      browser_revoked: 0,
      restricted_revoked: 0,
      invalidations: 0,
    });

    const changed = await fixture.service.updateOther(
      fixture.superadmin,
      target.id,
      renamed.version,
      {
        email: "new-target@example.org",
        givenName: "Grace",
        familyName: "Hopper",
      },
      CORRELATION,
    );
    expect(changed.email).toBe("new-target@example.org");
    expect(await securitySnapshot(fixture.worker, target.id)).toMatchObject({
      security_epoch: 2,
      browser_revoked: 1,
      restricted_revoked: 1,
      invalidations: 1,
      reason: "profile_email_change",
    });
  });

  it("supports every role's self profile and rolls duplicate/stale changes back", async () => {
    const fixture = await userFixture("self");
    for (const role of ["user", "admin", "superadmin"] as const) {
      const identity = role === "superadmin"
        ? await fixture.service.self(fixture.superadmin)
        : await fixture.create(`${role}@example.org`, role);
      const actor = browser(identity.id, role);
      await expect(fixture.service.self(actor)).resolves.toMatchObject({
        id: identity.id,
        role,
      });
      await expect(fixture.service.updateSelf(
        actor,
        identity.version,
        {
          email: identity.email,
          givenName: "Self",
          familyName: role,
        },
        CORRELATION,
      )).resolves.toMatchObject({ givenName: "Self" });
    }

    const first = await fixture.create("first@example.org", "user");
    await fixture.create("duplicate@example.org", "user");
    await expect(fixture.service.updateOther(
      fixture.superadmin,
      first.id,
      first.version,
      {
        email: " DUPLICATE@example.org ",
        givenName: "First",
        familyName: "User",
      },
      CORRELATION,
    )).rejects.toEqual(new UserAdministrationError("conflict"));
    await expect(fixture.service.updateOther(
      fixture.superadmin,
      first.id,
      first.version + 1,
      {
        email: first.email,
        givenName: "Stale",
        familyName: "User",
      },
      CORRELATION,
    )).rejects.toEqual(new UserAdministrationError("stale"));
    await expect(fixture.service.detail(fixture.superadmin, first.id))
      .resolves.toMatchObject({ email: first.email, givenName: "Ada" });
  });

  it("scopes API-key visibility and reserves profile edits for system keys", async () => {
    const fixture = await userFixture("api-visibility");
    const ordinary = await fixture.create("api-ordinary@example.org", "user");
    const admin = await fixture.create("api-admin@example.org", "admin");
    const protectedAdmin = await fixture.create("api-superadmin@example.org", "superadmin");
    const serviceId = "018f1f2e-7b3c-7a10-8000-000000000141";
    const serviceKey = await insertApiKey(
      fixture.worker,
      "018f1f2e-7b3c-7a10-8000-000000000142",
      "service",
      fixture.superadmin.principalId,
      51,
      serviceId,
      ordinary.id,
    );
    const allServicesKey = await insertApiKey(
      fixture.worker,
      "018f1f2e-7b3c-7a10-8000-000000000143",
      "all_services",
      fixture.superadmin.principalId,
      52,
    );
    const systemKey = await insertApiKey(
      fixture.worker,
      "018f1f2e-7b3c-7a10-8000-000000000144",
      "system",
      fixture.superadmin.principalId,
      53,
    );
    const relationships = {
      relatedServiceIds: async () => [],
      userRelatedToService: async (targetUserId: string, requestedServiceId: string) =>
        targetUserId === ordinary.id && requestedServiceId === serviceId,
    };
    const apiService = new UserAdministrationService(
      new UserAdministrationRepository(fixture.worker, () => fixture.clock.value),
      new UserCursorCodec(Buffer.alloc(32, 92), () => fixture.clock.value),
      relationships,
      () => fixture.clock.value,
    );
    services.add(apiService);

    await expect(apiService.detail(serviceKey, ordinary.id))
      .resolves.toMatchObject({ id: ordinary.id, role: "user" });
    await expect(apiService.detail(serviceKey, admin.id))
      .rejects.toEqual(new UserAdministrationError("not_found"));
    expect((await apiService.list(serviceKey, {})).users.map(({ id }) => id))
      .toEqual([ordinary.id]);
    expect((await apiService.list(allServicesKey, {})).users.map(({ role }) => role))
      .toEqual(["user"]);
    expect(new Set(
      (await apiService.list(systemKey, {})).users.map(({ role }) => role),
    )).toEqual(new Set(["user", "admin"]));
    await expect(apiService.detail(systemKey, protectedAdmin.id))
      .rejects.toEqual(new UserAdministrationError("not_found"));

    const updated = await apiService.updateOther(
      systemKey,
      admin.id,
      admin.version,
      {
        email: admin.email,
        givenName: "System",
        familyName: "Managed",
      },
      CORRELATION,
    );
    expect(updated).toMatchObject({ id: admin.id, givenName: "System" });
    for (const actor of [serviceKey, allServicesKey]) {
      await expect(apiService.updateOther(
        actor,
        ordinary.id,
        ordinary.version,
        {
          email: ordinary.email,
          givenName: "Forbidden",
          familyName: "Edit",
        },
        CORRELATION,
      )).rejects.toEqual(new UserAdministrationError("not_found"));
    }
  });
});

async function userFixture(label: string) {
  const clock = { value: NOW };
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-users-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => clock.value,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => clock.value });
  const superadmin = await identities.createLocalIdentity({
    profile: {
      email: `${label}-superadmin@example.org`,
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const repository = new UserAdministrationRepository(worker, () => clock.value);
  const service = new UserAdministrationService(
    repository,
    new UserCursorCodec(Buffer.alloc(32, 91), () => clock.value),
    undefined,
    () => clock.value,
  );
  services.add(service);
  return {
    clock,
    worker,
    service,
    superadmin: browser(superadmin.id, "superadmin"),
    create: async (
      email: string,
      role: "user" | "admin" | "superadmin",
    ) => identities.createLocalIdentity({
      profile: { email, givenName: "Ada", familyName: "Lovelace" },
      role,
      status: "active",
    }, audit()),
  };
}

function browser(
  principalId: string,
  role: "user" | "admin" | "superadmin",
): ControlAuthenticationContext {
  return { method: "browser_session", principalId, role };
}

function apiActor(
  principalId: string,
  role: "service" | "all_services" | "system",
  serviceId?: string,
): ControlAuthenticationContext {
  return {
    method: "api_key",
    principalId,
    role,
    apiKey: {
      nickname: `${role} automation`,
      lastFour: "safe",
      ...(serviceId === undefined ? {} : { serviceId }),
    },
  };
}

async function insertApiKey(
  worker: PersistenceWorker,
  id: string,
  role: "service" | "all_services" | "system",
  creatorId: string,
  byte: number,
  serviceId?: string,
  relatedUserId?: string,
): Promise<ControlAuthenticationContext> {
  const identifier = Buffer.alloc(12, byte).toString("base64url");
  const nickname = `${role} automation`;
  const lastFour = Buffer.alloc(3, byte).toString("base64url");
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      if (serviceId !== undefined) {
        transaction.run(`
          INSERT INTO services (
            id, slug, name, description, documentation_url, lifecycle,
            draft_digest, published_revision_id, published_digest,
            publication_generation, version, created_at, updated_at
          ) VALUES (?, 'api-scope', 'API scope', NULL, NULL, 'draft', ?, NULL, NULL, 0, 1, ?, ?)
        `, [serviceId, "0".repeat(64), NOW, NOW]);
        if (relatedUserId !== undefined) {
          transaction.run(`
            INSERT INTO service_principal_assignments (
              id, service_id, selector_kind, group_id, user_id,
              assigned_by_user_id, created_at
            ) VALUES (
              '018f1f2e-7b3c-7a10-8000-000000000145',
              ?, 'user', NULL, ?, ?, ?
            )
          `, [serviceId, relatedUserId, creatorId, NOW]);
        }
      }
      transaction.run(`
        INSERT INTO api_keys (
          id, identifier, verifier_hash, nickname, last_four, api_role,
          service_id, expiration_policy, expires_at, status, creator_id,
          version, created_at, updated_at, last_used_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'forever', NULL, 'active', ?, 1, ?, ?, NULL, NULL)
      `, [
        id,
        identifier,
        `$argon2id$${"x".repeat(64)}`,
        nickname,
        lastFour,
        role,
        serviceId ?? null,
        creatorId,
        NOW,
        NOW,
      ]);
    }),
  });
  return {
    method: "api_key",
    principalId: id,
    role,
    apiKey: {
      nickname,
      lastFour,
      ...(serviceId === undefined ? {} : { serviceId }),
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
    correlationId: CORRELATION,
    source: { category: "identity" },
  };
}

async function addSessions(worker: PersistenceWorker, userId: string): Promise<void> {
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
          '018f1f2e-7b3c-7a10-8000-000000000030', ?, ?, ?, 'user',
          1, 1, 3600000, 900000, ?, ?, ?, NULL, NULL, 1
        )
      `, [userId, "5".repeat(64), "6".repeat(64), NOW, NOW, NOW + 3_600_000]);
      transaction.run(`
        INSERT INTO identity_restricted_sessions (
          id, user_id, purpose, session_hash, csrf_hash,
          issued_security_epoch, issued_global_epoch,
          issued_at, expires_at, revoked_at, version
        ) VALUES (
          '018f1f2e-7b3c-7a10-8000-000000000031', ?, 'totp_replacement',
          ?, ?, 1, 1, ?, ?, NULL, 1
        )
      `, [userId, "7".repeat(64), "8".repeat(64), NOW, NOW + 900_000]);
    }),
  });
}

async function securitySnapshot(worker: PersistenceWorker, userId: string) {
  return worker.execute({
    run: (database) => database.read((query) => query.get<Record<string, unknown>>(`
      SELECT
        security_epoch,
        (SELECT count(*) FROM browser_sessions
          WHERE user_id = users.id AND revoked_at IS NOT NULL) AS browser_revoked,
        (SELECT count(*) FROM identity_restricted_sessions
          WHERE user_id = users.id AND revoked_at IS NOT NULL) AS restricted_revoked,
        (SELECT count(*) FROM identity_invalidation_events
          WHERE user_id = users.id) AS invalidations,
        (SELECT reason FROM identity_invalidation_events
          WHERE user_id = users.id ORDER BY rowid DESC LIMIT 1) AS reason
      FROM users WHERE id = ?
    `, [userId])),
  });
}
