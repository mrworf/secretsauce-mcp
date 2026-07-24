import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import { createControlApplication } from "../src/control/server.js";
import {
  GroupAssignmentRepository,
  GroupAssignmentService,
} from "../src/groupAssignments.js";
import {
  UserAdministrationRepository,
  UserAdministrationService,
  UserCursorCodec,
} from "../src/identity/userAdministration.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  ServiceManagementAuthorization,
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";
import type { GatewayConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const serviceManagers = new Set<ServiceManagementService>();

afterEach(async () => {
  for (const service of serviceManagers) service.close();
  serviceManagers.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("group and assignment HTTP contracts", () => {
  it("serves strict scoped group, membership, assignment, access, and own-service APIs", async () => {
    const fixture = await routeFixture();
    const admin = await fixture.identity("admin@example.org", "admin", "active");
    const outsider = await fixture.identity("outsider@example.org", "admin", "active");
    const user = await fixture.identity("user@example.org", "user", "active");
    const service = (await fixture.services.create(
      fixture.superadmin,
      { slug: "route-groups", name: "Route groups" },
      "create-route-groups",
      CORRELATION,
    )).service;
    await fixture.services.assign(
      fixture.superadmin,
      service.id,
      admin.id,
      service.version,
      false,
      CORRELATION,
    );

    const created = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/groups`,
      headers: mutationHeaders({ "idempotency-key": "create-group-route-1" }),
      payload: { name: "Operators", description: "Operators for this service." },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    expect(created.headers["cache-control"]).toBe("no-store");
    const groupId = created.json().data.id as string;

    const unknownField = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/groups`,
      headers: mutationHeaders({ "idempotency-key": "create-group-route-2" }),
      payload: { name: "Unsafe", credential_value: "must-not-echo" },
    });
    expect(unknownField.statusCode).toBe(400);
    expect(JSON.stringify(unknownField.json())).not.toContain("must-not-echo");

    const members = await fixture.application.inject({
      method: "PUT",
      url: `/api/v2/services/${service.id}/groups/${groupId}/members`,
      headers: mutationHeaders({
        "if-match": '"1"',
        "idempotency-key": "replace-members-route-1",
      }),
      payload: { user_ids: [user.id] },
    });
    expect(members.statusCode).toBe(200);
    expect(members.headers.etag).toBe('"2"');
    const memberList = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/groups/${groupId}/members`,
      headers: { host: "control.example.org" },
    });
    expect(memberList.statusCode).toBe(200);
    expect(memberList.json().data.members).toEqual([
      expect.objectContaining({ id: user.id, email: "user@example.org", status: "active" }),
    ]);

    const unconfirmed = await fixture.application.inject({
      method: "PUT",
      url: `/api/v2/services/${service.id}/assignments`,
      headers: mutationHeaders({
        "if-match": '"1"',
        "idempotency-key": "unconfirmed-direct-1",
      }),
      payload: {
        kind: "users",
        user_ids: [user.id],
        direct_assignment_confirmed: false,
      },
    });
    expect(unconfirmed.statusCode).toBe(400);

    const assigned = await fixture.application.inject({
      method: "PUT",
      url: `/api/v2/services/${service.id}/assignments`,
      headers: mutationHeaders({
        "if-match": '"1"',
        "idempotency-key": "replace-assignment-route-1",
      }),
      payload: {
        kind: "principals",
        group_ids: [groupId],
        user_ids: [user.id],
        direct_assignment_confirmed: true,
      },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.headers.etag).toBe('"2"');
    expect(assigned.json().data).toMatchObject({
      selector: {
        kind: "explicit",
        group_ids: [groupId],
        user_ids: [user.id],
      },
      authorization_generation: 1,
    });
    const assignmentRead = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/assignments`,
      headers: { host: "control.example.org" },
    });
    expect(assignmentRead.statusCode).toBe(200);
    expect(assignmentRead.headers.etag).toBe('"2"');
    const access = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/assignments/access`,
      headers: { host: "control.example.org" },
    });
    expect(access.statusCode).toBe(200);
    expect(access.json().data.access).toEqual([
      expect.objectContaining({
        user_id: user.id,
        contributions: [
          { kind: "direct" },
          { kind: "group", group_id: groupId, group_name: "Operators" },
        ],
      }),
    ]);

    const temporary = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/groups`,
      headers: mutationHeaders({ "idempotency-key": "create-group-route-3" }),
      payload: { name: "Temporary" },
    });
    const temporaryId = temporary.json().data.id as string;
    const detail = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}`,
      headers: { host: "control.example.org" },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.headers.etag).toBe('"1"');
    const missingVersion = await fixture.application.inject({
      method: "PATCH",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}`,
      headers: mutationHeaders(),
      payload: { name: "Temporary renamed" },
    });
    expect(missingVersion.statusCode).toBe(428);
    const updated = await fixture.application.inject({
      method: "PATCH",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}`,
      headers: mutationHeaders({ "if-match": '"1"' }),
      payload: { name: "Temporary renamed" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).toBe('"2"');
    const unjustifiedArchive = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}/archive`,
      headers: mutationHeaders({
        "if-match": '"2"',
        "idempotency-key": "archive-group-route-bad",
      }),
      payload: {},
    });
    expect(unjustifiedArchive.statusCode).toBe(400);
    const archived = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}/archive`,
      headers: mutationHeaders({
        "if-match": '"2"',
        "idempotency-key": "archive-group-route-1",
      }),
      payload: { justification: "Retire the temporary group." },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.headers.etag).toBe('"3"');
    const deleted = await fixture.application.inject({
      method: "DELETE",
      url: `/api/v2/services/${service.id}/groups/${temporaryId}`,
      headers: mutationHeaders({
        "if-match": '"3"',
        "idempotency-key": "delete-group-route-1",
      }),
      payload: { justification: "Delete the archived temporary group." },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toEqual({
      group_id: temporaryId,
      deleted: true,
      replayed: false,
    });

    fixture.actor.value = browser(admin.id, "admin");
    const visible = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/groups`,
      headers: { host: "control.example.org" },
    });
    expect(visible.statusCode).toBe(200);
    await expect(fixture.users.list(browser(admin.id, "admin"), {}))
      .resolves.toMatchObject({ users: [expect.objectContaining({ id: user.id })] });
    await expect(fixture.users.detail(browser(admin.id, "admin"), user.id))
      .resolves.toMatchObject({ id: user.id });

    fixture.actor.value = browser(outsider.id, "admin");
    const hidden = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/groups`,
      headers: { host: "control.example.org" },
    });
    expect(hidden.statusCode).toBe(404);
    await expect(fixture.users.detail(browser(outsider.id, "admin"), user.id))
      .rejects.toMatchObject({ code: "not_found" });

    fixture.actor.value = browser(user.id, "user");
    const own = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/users/me/services",
      headers: { host: "control.example.org" },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().data.services).toEqual([
      { id: service.id, slug: "route-groups", name: "Route groups" },
    ]);
    expect(JSON.stringify(own.json())).not.toMatch(
      /destination|selector|admin|email|credential/i,
    );

    const openapi = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths["/api/v2/services/{service_id}/groups"])
      .toHaveProperty("post");
    expect(openapi.json().paths["/api/v2/services/{service_id}/assignments"])
      .toHaveProperty("put");
    expect(openapi.json().paths["/api/v2/users/me/services"])
      .toHaveProperty("get");
    await fixture.application.close();
  });
});

async function routeFixture() {
  const worker = PersistenceWorker.open({
    databaseFile: join(mkdtempSync(join(tmpdir(), "secretsauce-group-routes-")), "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadminUser = await identities.createLocalIdentity({
    profile: {
      email: "superadmin@example.org",
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const superadmin = browser(superadminUser.id, "superadmin");
  const relationships = new ServiceRelationshipRepository(worker);
  const idempotency = new ControlIdempotencyHasher(Buffer.alloc(32, 61));
  const services = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    idempotency,
    Buffer.alloc(32, 62),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const groups = new GroupAssignmentService(
    new GroupAssignmentRepository(worker, () => NOW),
    idempotency,
    () => NOW,
  );
  const users = new UserAdministrationService(
    new UserAdministrationRepository(worker),
    new UserCursorCodec(Buffer.alloc(32, 63), () => NOW),
    relationships,
  );
  const actor = { value: superadmin as ControlAuthenticationContext };
  const authenticator: ControlAuthenticator = {
    authenticate: async () => actor.value,
    verifyCsrf: async () => true,
  };
  const authorization = new ServiceManagementAuthorization(
    relationships,
    { authorizeScope: async () => false, verifyStepUp: async () => false },
  );
  const application = createControlApplication(controlConfig(), {
    persistence: worker,
    authenticator,
    authorization,
    groupAssignments: groups,
  });
  return {
    worker,
    identities,
    services,
    users,
    groups,
    application,
    relationships,
    actor,
    superadmin,
    identity: (
      email: string,
      role: "user" | "admin" | "superadmin",
      status: "active" | "suspended",
    ) => identities.createLocalIdentity({
      profile: { email, givenName: "Example", familyName: "User" },
      role,
      status,
    }, audit()),
  };
}

function browser(
  principalId: string,
  role: "user" | "admin" | "superadmin",
): ControlAuthenticationContext {
  return { method: "browser_session", principalId, role };
}

function mutationHeaders(extra: Record<string, string> = {}) {
  return {
    host: "control.example.org",
    origin: "https://control.example.org",
    "x-csrf-token": "x".repeat(43),
    ...extra,
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

function controlConfig(): GatewayConfig {
  return {
    server: {
      host: "127.0.0.1",
      port: 0,
      listen: "127.0.0.1:0",
      mcpPath: "/mcp",
      allowInsecureOAuthHttp: false,
    },
    control: {
      host: "127.0.0.1",
      port: 0,
      listen: "127.0.0.1:0",
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/unused",
    },
    auth: { mode: "bearer", bearer: { token: "unused", source: "env" } },
    tokens: { idleTtlMs: 60_000, maxTtlMs: 120_000 },
    limits: {} as GatewayConfig["limits"],
    logging: { level: "info" },
    audit: { memoryEvents: 100 },
    services: {},
  };
}
