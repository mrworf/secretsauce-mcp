import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import {
  GroupAssignmentError,
  GroupAssignmentRepository,
} from "../src/groupAssignments.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";

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

describe("service-scoped groups and assignments", () => {
  it("creates scoped groups and rejects duplicate, malformed, and unassigned access", async () => {
    const fixture = await groupFixture("groups");
    const admin = await fixture.identity("admin@example.org", "admin", "active");
    const outsider = await fixture.identity("outsider@example.org", "admin", "active");
    const service = await fixture.service("lab-api");
    const assigned = await fixture.services.assign(
      fixture.superadmin,
      service.id,
      admin.id,
      service.version,
      false,
      CORRELATION,
    );
    expect(assigned.adminCount).toBe(1);
    const created = await fixture.groups.createGroup({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: fixture.uuid(),
      name: " Operators ",
      description: "Can operate the lab.",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.create", "create-group-0001", {
        serviceId: service.id,
        name: "Operators",
      }),
    });
    expect(created.kind).toBe("executed");
    await expect(fixture.groups.groups(browser(admin.id, "admin"), service.id))
      .resolves.toEqual([
        expect.objectContaining({
          id: created.value,
          name: "Operators",
          lifecycle: "active",
          memberCount: 0,
          version: 1,
        }),
      ]);
    await expect(fixture.groups.groups(browser(outsider.id, "admin"), service.id))
      .rejects.toEqual(new GroupAssignmentError("not_found"));
    await expect(fixture.groups.createGroup({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: fixture.uuid(),
      name: "operators",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.create", "create-group-0002", {
        serviceId: service.id,
        name: "operators",
      }),
    })).rejects.toEqual(new GroupAssignmentError("conflict"));
    await expect(fixture.groups.createGroup({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: fixture.uuid(),
      name: "\0unsafe",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.create", "create-group-0003", {}),
    })).rejects.toEqual(new GroupAssignmentError("invalid_request"));
  });

  it("replaces membership atomically and invalidates only selected effective changes", async () => {
    const fixture = await groupFixture("members");
    const service = await fixture.service("member-api");
    const group = await fixture.createGroup(service.id, "Members");
    const ordinary = await fixture.identity("member@example.org", "user", "active");
    const suspended = await fixture.identity("suspended@example.org", "user", "suspended");
    const admin = await fixture.identity("wrong-role@example.org", "admin", "active");

    await expect(fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: group.version,
      userIds: [ordinary.id, ordinary.id],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "members-duplicate-01", {}),
    })).rejects.toEqual(new GroupAssignmentError("invalid_request"));
    for (const target of [suspended, admin]) {
      await expect(fixture.groups.replaceMembers({
        actor: fixture.superadmin,
        serviceId: service.id,
        groupId: group.id,
        expectedVersion: group.version,
        userIds: [target.id],
        correlationId: CORRELATION,
        idempotency: fixture.idempotency(
          "groups.members.replace",
          `members-denied-${target.id}`,
          { target: target.id },
        ),
      })).rejects.toEqual(new GroupAssignmentError("not_found"));
    }
    await fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: group.version,
      userIds: [ordinary.id],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "members-set-0001", {
        userIds: [ordinary.id],
      }),
    });
    expect(await fixture.invalidationCount(service.id)).toBe(0);

    const assignments = await fixture.groups.assignments(fixture.superadmin, service.id);
    await fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: service.id,
      expectedVersion: assignments.version,
      selector: { kind: "explicit", groupIds: [group.id], userIds: [] },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "assign-group-0001", {
        groupId: group.id,
      }),
    });
    await expect(fixture.groups.effectiveAccess(
      fixture.superadmin,
      service.id,
      ordinary.id,
    )).resolves.toEqual({
      serviceId: service.id,
      userId: ordinary.id,
      contributions: [{ kind: "group", groupId: group.id, groupName: "Members" }],
    });
    const currentGroup = await fixture.groups.group(fixture.superadmin, service.id, group.id);
    await fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: currentGroup.version,
      userIds: [],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "members-clear-001", {}),
    });
    expect(await fixture.groups.effectiveAccess(
      fixture.superadmin,
      service.id,
      ordinary.id,
    )).toMatchObject({ contributions: [] });
    expect((await fixture.identityState(ordinary.id)).status).toBe("active");
    expect(await fixture.invalidationCount(service.id)).toBe(4);
  });

  it("explains direct, group, and all access while rejecting cross-service selectors", async () => {
    const fixture = await groupFixture("selectors");
    const first = await fixture.service("first-api");
    const second = await fixture.service("second-api");
    const firstGroup = await fixture.createGroup(first.id, "First");
    const secondGroup = await fixture.createGroup(second.id, "Second");
    const user = await fixture.identity("active@example.org", "user", "active");
    const other = await fixture.identity("other@example.org", "user", "active");
    const suspended = await fixture.identity("inactive@example.org", "user", "suspended");
    await fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: first.id,
      groupId: firstGroup.id,
      expectedVersion: firstGroup.version,
      userIds: [user.id],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "selector-members-1", {}),
    });

    const initial = await fixture.groups.assignments(fixture.superadmin, first.id);
    await expect(fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: first.id,
      expectedVersion: initial.version,
      selector: { kind: "explicit", groupIds: [secondGroup.id], userIds: [] },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "cross-group-0001", {}),
    })).rejects.toEqual(new GroupAssignmentError("not_found"));
    await expect(fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: first.id,
      expectedVersion: initial.version,
      selector: { kind: "explicit", groupIds: [], userIds: [] },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "empty-selector-01", {}),
    })).rejects.toEqual(new GroupAssignmentError("invalid_request"));

    await fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: first.id,
      expectedVersion: initial.version,
      selector: {
        kind: "explicit",
        groupIds: [firstGroup.id],
        userIds: [user.id, other.id],
      },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "mixed-selector-1", {}),
    });
    expect((await fixture.groups.effectiveAccess(
      fixture.superadmin,
      first.id,
      user.id,
    )).contributions).toEqual([
      { kind: "direct" },
      { kind: "group", groupId: firstGroup.id, groupName: "First" },
    ]);
    expect((await fixture.groups.effectiveAccess(
      fixture.superadmin,
      first.id,
      other.id,
    )).contributions).toEqual([{ kind: "direct" }]);

    const mixed = await fixture.groups.assignments(fixture.superadmin, first.id);
    await fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: first.id,
      expectedVersion: mixed.version,
      selector: { kind: "all", groupIds: [], userIds: [] },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "all-selector-001", {}),
    });
    expect((await fixture.groups.effectiveAccess(
      fixture.superadmin,
      first.id,
      user.id,
    )).contributions).toEqual([{ kind: "all" }]);
    expect((await fixture.groups.effectiveAccess(
      fixture.superadmin,
      first.id,
      suspended.id,
    )).contributions).toEqual([]);
  });

  it("archives before deleting groups and cascades owned authorization state", async () => {
    const fixture = await groupFixture("lifecycle");
    const service = await fixture.service("lifecycle-api");
    const group = await fixture.createGroup(service.id, "Temporary");
    const user = await fixture.identity("temporary@example.org", "user", "active");
    await fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: group.version,
      userIds: [user.id],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "lifecycle-members", {}),
    });
    const state = await fixture.groups.assignments(fixture.superadmin, service.id);
    await fixture.groups.replaceAssignments({
      actor: fixture.superadmin,
      serviceId: service.id,
      expectedVersion: state.version,
      selector: { kind: "explicit", groupIds: [group.id], userIds: [] },
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("services.assignments.replace", "lifecycle-selector", {}),
    });
    const current = await fixture.groups.group(fixture.superadmin, service.id, group.id);
    await expect(fixture.groups.deleteGroup({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: current.version,
      justification: "Delete the active group.",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.delete", "delete-active-group", {}),
    })).rejects.toEqual(new GroupAssignmentError("conflict"));
    await fixture.groups.archiveGroup({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: current.version,
      justification: "Retire this temporary access group.",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.archive", "archive-group-001", {}),
    });
    expect((await fixture.groups.effectiveAccess(
      fixture.superadmin,
      service.id,
      user.id,
    )).contributions).toEqual([]);
    const archived = await fixture.groups.group(fixture.superadmin, service.id, group.id);
    await expect(fixture.groups.replaceMembers({
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: archived.version,
      userIds: [],
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.members.replace", "archived-members", {}),
    })).rejects.toEqual(new GroupAssignmentError("conflict"));
    const deletion = {
      actor: fixture.superadmin,
      serviceId: service.id,
      groupId: group.id,
      expectedVersion: archived.version,
      justification: "Remove the archived group.",
      correlationId: CORRELATION,
      idempotency: fixture.idempotency("groups.delete", "delete-group-0001", {}),
    };
    await expect(fixture.groups.deleteGroup(deletion))
      .resolves.toMatchObject({ kind: "executed", value: group.id });
    await expect(fixture.groups.deleteGroup(deletion))
      .resolves.toMatchObject({ kind: "replayed", resultReference: group.id });
    await expect(fixture.groups.group(fixture.superadmin, service.id, group.id))
      .rejects.toEqual(new GroupAssignmentError("not_found"));
    expect(await fixture.groupMemberCount(group.id)).toBe(0);
  });
});

async function groupFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(mkdtempSync(join(tmpdir(), `secretsauce-groups-${label}-`)), "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadminUser = await identities.createLocalIdentity({
    profile: {
      email: `${label}-superadmin@example.org`,
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const relationships = new ServiceRelationshipRepository(worker);
  const services = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    new ControlIdempotencyHasher(Buffer.alloc(32, 51)),
    Buffer.alloc(32, 52),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const uuidGenerator = new UuidV7Generator({ now: () => NOW });
  const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 53));
  const superadmin = browser(superadminUser.id, "superadmin");
  const groups = new GroupAssignmentRepository(worker, () => NOW);
  return {
    worker,
    identities,
    services,
    groups,
    superadmin,
    uuid: () => uuidGenerator.next(),
    identity: (
      email: string,
      role: "user" | "admin" | "superadmin",
      status: "active" | "suspended",
    ) => identities.createLocalIdentity({
      profile: { email, givenName: "Example", familyName: "User" },
      role,
      status,
    }, audit()),
    service: async (slug: string) => (await services.create(
      superadmin,
      { slug, name: slug },
      `create-${slug}-0001`,
      CORRELATION,
    )).service,
    createGroup: async (serviceId: string, name: string) => {
      const groupId = uuidGenerator.next();
      await groups.createGroup({
        actor: superadmin,
        serviceId,
        groupId,
        name,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "groups.create",
          `create-${name.toLowerCase()}-001`,
          { serviceId, name },
        ),
      });
      return groups.group(superadmin, serviceId, groupId);
    },
    idempotency: (routeId: string, key: string, body: unknown) =>
      idempotency(hasher, superadmin.principalId, routeId, key, body),
    invalidationCount: (serviceId: string) => worker.execute({
      run: (database) => database.read((query) => query.get<{ count: number }>(
        "SELECT count(*) AS count FROM assignment_invalidation_events WHERE service_id = ?",
        [serviceId],
      )!.count),
    }),
    identityState: (userId: string) => worker.execute({
      run: (database) => database.read((query) => query.get<{ status: string }>(
        "SELECT status FROM users WHERE id = ?",
        [userId],
      )!),
    }),
    groupMemberCount: (groupId: string) => worker.execute({
      run: (database) => database.read((query) => query.get<{ count: number }>(
        "SELECT count(*) AS count FROM service_group_members WHERE group_id = ?",
        [groupId],
      )!.count),
    }),
  };
}

function idempotency(
  hasher: ControlIdempotencyHasher,
  principalId: string,
  routeId: string,
  key: string,
  body: unknown,
) {
  return {
    keyHash: hasher.keyHash({ key, principalId, routeId }),
    principalId,
    routeId,
    requestDigest: hasher.requestDigest(body),
  };
}

function browser(
  principalId: string,
  role: "user" | "admin" | "superadmin",
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
