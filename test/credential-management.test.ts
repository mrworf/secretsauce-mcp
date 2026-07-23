import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import {
  CredentialManagementError,
  CredentialManagementRepository,
  CredentialManagementService,
} from "../src/credentialManagement.js";
import { GroupAssignmentRepository } from "../src/groupAssignments.js";
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

describe("service credential metadata and selectors", () => {
  it("creates, reads, and edits only safe credential metadata", async () => {
    const fixture = await credentialFixture("metadata");
    const service = await fixture.service("managed-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: " API token ",
        description: "Primary automation token.",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        selector: { kind: "all" },
      },
      "create-credential-0001",
      CORRELATION,
    );
    expect(created).toMatchObject({
      replayed: false,
      credential: {
        name: "API token",
        status: "unconfigured",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforceHeaderOwnership: true,
        },
        selector: { kind: "all", groupIds: [], userIds: [] },
        version: 1,
      },
    });
    expect(created.credential).not.toHaveProperty("vaultLocator");
    expect(created.credential).not.toHaveProperty("vaultGeneration");

    const replay = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: " API token ",
        description: "Primary automation token.",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        selector: { kind: "all" },
      },
      "create-credential-0001",
      CORRELATION,
    );
    expect(replay).toMatchObject({
      replayed: true,
      credential: { id: created.credential.id },
    });

    const updated = await fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version,
      {
        name: "API token v2",
        placement: { kind: "query", name: "api_key" },
      },
      CORRELATION,
    );
    expect(updated).toMatchObject({
      name: "API token v2",
      placement: {
        kind: "query",
        name: "api_key",
        enforceHeaderOwnership: false,
      },
      status: "unconfigured",
      version: 2,
    });
    expect(await fixture.credentials.credentials(fixture.superadmin, service.id))
      .toEqual([updated]);
  });

  it("rejects unsafe/open metadata, stale writes, duplicate names, and unassigned scope", async () => {
    const fixture = await credentialFixture("negative");
    const service = await fixture.service("safe-api");
    const outsider = await fixture.identity("outsider@example.org", "admin", "active");
    const create = (body: unknown, key: string) => fixture.credentials.create(
      fixture.superadmin,
      service.id,
      body,
      key,
      CORRELATION,
    );
    for (const [body, key] of [
      [{
        name: "Authority",
        placement: { kind: "header", name: "Host" },
        selector: { kind: "all" },
      }, "invalid-host-header"],
      [{
        name: "Unconfirmed",
        placement: { kind: "body", name: "password" },
        selector: {
          kind: "users",
          user_ids: [fixture.superadmin.principalId],
          direct_assignment_confirmed: false,
        },
      }, "invalid-unconfirmed"],
      [{
        name: "Open",
        placement: { kind: "query", name: "key" },
        selector: { kind: "all" },
        secret: "must-not-be-accepted",
      }, "invalid-open"],
    ] as const) {
      await expect(create(body, key))
        .rejects.toEqual(new CredentialManagementError("invalid_request"));
    }

    const created = await create({
      name: "Unique",
      placement: { kind: "header", name: "Authorization" },
      selector: { kind: "all" },
    }, "valid-unique-0001");
    await expect(create({
      name: "unique",
      placement: { kind: "header", name: "X-Key" },
      selector: { kind: "all" },
    }, "duplicate-unique-0001")).rejects.toEqual(
      new CredentialManagementError("conflict"),
    );
    await expect(fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version + 1,
      {
        name: "Stale",
        placement: { kind: "header", name: "X-Key" },
      },
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("stale"));
    await expect(fixture.credentials.credentials(
      browser(outsider.id, "admin"),
      service.id,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
  });

  it("intersects service and every credential selector and rejects cross-service groups", async () => {
    const fixture = await credentialFixture("selectors");
    const service = await fixture.service("selector-api");
    const otherService = await fixture.service("other-api");
    const user = await fixture.identity("assigned@example.org", "user", "active");
    const other = await fixture.identity("other@example.org", "user", "active");
    const group = await fixture.group(service.id, "Operators", [user.id]);
    const crossGroup = await fixture.group(otherService.id, "Other", [user.id]);
    await fixture.assignService(service.id, {
      kind: "explicit",
      groupIds: [group.id],
      userIds: [other.id],
    });

    const first = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Group credential",
        placement: { kind: "header", name: "X-Group-Key" },
        selector: { kind: "groups", group_ids: [group.id] },
      },
      "create-group-credential",
      CORRELATION,
    );
    const second = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Direct credential",
        placement: { kind: "body", name: "password" },
        selector: {
          kind: "users",
          user_ids: [other.id],
          direct_assignment_confirmed: true,
        },
      },
      "create-direct-credential",
      CORRELATION,
    );
    await fixture.markConfigured(first.credential.id);
    await fixture.markConfigured(second.credential.id);

    expect(await fixture.credentials.authorizes(
      user.id,
      service.id,
      [first.credential.id],
    )).toBe(true);
    expect(await fixture.credentials.authorizes(
      user.id,
      service.id,
      [second.credential.id],
    )).toBe(false);
    expect(await fixture.credentials.authorizes(
      other.id,
      service.id,
      [second.credential.id],
    )).toBe(true);
    expect(await fixture.credentials.authorizes(
      other.id,
      service.id,
      [first.credential.id, second.credential.id],
    )).toBe(false);

    const configuredFirst = await fixture.credentials.credential(
      fixture.superadmin,
      service.id,
      first.credential.id,
    );
    await expect(fixture.credentials.replaceAssignments(
      fixture.superadmin,
      service.id,
      first.credential.id,
      configuredFirst.version,
      { kind: "groups", group_ids: [crossGroup.id] },
      "cross-service-selector",
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
  });

  it("clones and copies without private material, then archives before deletion", async () => {
    const fixture = await credentialFixture("lifecycle");
    const service = await fixture.service("lifecycle-api");
    const created = await fixture.credentials.create(
      fixture.superadmin,
      service.id,
      {
        name: "Source",
        description: "Safe metadata.",
        placement: {
          kind: "header",
          name: "Authorization",
          prefix: "Bearer ",
        },
        selector: { kind: "all" },
      },
      "create-source-credential",
      CORRELATION,
    );
    const cloned = await fixture.credentials.clone(
      fixture.superadmin,
      service.id,
      created.credential.id,
      { name: "Clone" },
      "clone-credential-0001",
      CORRELATION,
    );
    expect(cloned.credential).toMatchObject({
      name: "Clone",
      status: "unconfigured",
      selector: { kind: "all" },
    });
    expect(cloned.credential).not.toHaveProperty("lastFour");
    expect(cloned.credential).not.toHaveProperty("valueUpdatedAt");

    const document = await fixture.credentials.copy(
      fixture.superadmin,
      service.id,
      created.credential.id,
    );
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(
      /"(?:secret|locator|generation|last_four|ciphertext|source|value)"\s*:/i,
    );
    const imported = await fixture.credentials.import(
      fixture.superadmin,
      service.id,
      {
        ...document,
        credential: { ...document.credential, name: "Imported" },
      },
      "import-credential-001",
      CORRELATION,
    );
    expect(imported.credential).toMatchObject({
      name: "Imported",
      status: "unconfigured",
    });
    await expect(fixture.credentials.import(
      fixture.superadmin,
      service.id,
      {
        ...document,
        credential: {
          ...document.credential,
          name: "Unsafe import",
          value: "never-accepted",
        },
      },
      "import-credential-unsafe",
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("invalid_request"));

    const archived = await fixture.credentials.archiveUnconfigured(
      fixture.superadmin,
      service.id,
      created.credential.id,
      created.credential.version,
      { justification: "No longer needed." },
      "archive-credential-001",
      CORRELATION,
    );
    expect(archived.credential).toMatchObject({ status: "archived", version: 2 });
    expect(archived.credential.selector).toBeUndefined();
    await expect(fixture.credentials.update(
      fixture.superadmin,
      service.id,
      created.credential.id,
      archived.credential.version,
      {
        name: "Cannot edit",
        placement: { kind: "header", name: "X-Key" },
      },
      CORRELATION,
    )).rejects.toEqual(new CredentialManagementError("conflict"));
    await expect(fixture.credentials.deleteArchived(
      fixture.superadmin,
      service.id,
      created.credential.id,
      archived.credential.version,
      { justification: "Remove archived metadata." },
      "delete-credential-001",
      CORRELATION,
    )).resolves.toMatchObject({
      credentialId: created.credential.id,
      deleted: true,
      replayed: false,
    });
    await expect(fixture.credentials.credential(
      fixture.superadmin,
      service.id,
      created.credential.id,
    )).rejects.toEqual(new CredentialManagementError("not_found"));
    expect(await fixture.deletionInvalidations(created.credential.id)).toBe(1);
  });
});

async function credentialFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-credentials-${label}-`)),
      "control.sqlite",
    ),
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
    new ControlIdempotencyHasher(Buffer.alloc(32, 71)),
    Buffer.alloc(32, 72),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const hasher = new ControlIdempotencyHasher(Buffer.alloc(32, 73));
  const repository = new CredentialManagementRepository(worker, () => NOW);
  const credentials = new CredentialManagementService(repository, hasher, () => NOW);
  const groups = new GroupAssignmentRepository(worker, () => NOW);
  const superadmin = browser(superadminUser.id, "superadmin");
  const uuid = new UuidV7Generator({ now: () => NOW });
  return {
    worker,
    identities,
    services,
    credentials,
    repository,
    groups,
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
    service: async (slug: string) => (await services.create(
      superadmin,
      { slug, name: slug },
      `create-${slug}-0001`,
      CORRELATION,
    )).service,
    group: async (serviceId: string, name: string, userIds: string[]) => {
      const groupId = uuid.next();
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
          `create-${serviceId}-${name}`,
          { serviceId, name },
        ),
      });
      const group = await groups.group(superadmin, serviceId, groupId);
      await groups.replaceMembers({
        actor: superadmin,
        serviceId,
        groupId,
        expectedVersion: group.version,
        userIds,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "groups.members.replace",
          `members-${groupId}`,
          { userIds },
        ),
      });
      return groups.group(superadmin, serviceId, groupId);
    },
    assignService: async (
      serviceId: string,
      selector: {
        kind: "explicit";
        groupIds: string[];
        userIds: string[];
      },
    ) => {
      const state = await groups.assignments(superadmin, serviceId);
      return groups.replaceAssignments({
        actor: superadmin,
        serviceId,
        expectedVersion: state.version,
        selector,
        correlationId: CORRELATION,
        idempotency: idempotency(
          hasher,
          superadmin.principalId,
          "services.assignments.replace",
          `assign-${serviceId}`,
          selector,
        ),
      });
    },
    markConfigured: (credentialId: string) => worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          UPDATE service_credentials
          SET status = 'configured', vault_locator = ?,
            vault_generation = 1, value_updated_at = ?, version = version + 1,
            updated_at = ?
          WHERE id = ?
        `, [
          "12345678-1234-4234-8234-123456789abc",
          NOW,
          NOW,
          credentialId,
        ]);
        return undefined;
      }),
    }),
    deletionInvalidations: (credentialId: string) => worker.execute({
      run: (database) => database.read((query) => query.get<{ count: number }>(`
        SELECT count(*) AS count FROM credential_invalidation_events
        WHERE credential_id = ? AND reason = 'delete'
      `, [credentialId])!.count),
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
