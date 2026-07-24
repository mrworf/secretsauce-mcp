import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import { GroupAssignmentRepository } from "../src/groupAssignments.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  PolicyManagementError,
  PolicyManagementRepository,
  PolicyManagementService,
} from "../src/policyManagement.js";
import {
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const services = new Set<ServiceManagementService>();

afterEach(async () => {
  for (const service of services) service.close();
  services.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("durable policy management", () => {
  it("creates scoped boundaries and rules with selectors, invalidation, and safe copy", async () => {
    const fixture = await policyFixture("lifecycle");
    const service = await fixture.service("policy-api");
    const ordinary = await fixture.identity("user@example.org", "user");
    const group = await fixture.group(service.id, "Readers", [ordinary.id]);

    const created = await fixture.policies.createPolicy(
      fixture.superadmin,
      service.id,
      {
        boundary: { kind: "service" },
        name: "Request policy",
        operating_mode: "deny",
      },
      "create-policy-0001",
      CORRELATION,
    );
    expect(created).toMatchObject({
      replayed: false,
      policy: {
        operatingMode: "deny",
        lifecycle: "active",
        boundary: { kind: "service" },
      },
    });
    expect((await fixture.policies.createPolicy(
      fixture.superadmin,
      service.id,
      {
        boundary: { kind: "service" },
        name: "Request policy",
        operating_mode: "deny",
      },
      "create-policy-0001",
      CORRELATION,
    )).replayed).toBe(true);

    const rule = await fixture.policies.createRule(
      fixture.superadmin,
      service.id,
      created.policy.id,
      ruleBody({
        name: "Allow reads",
        selector: { kind: "groups", group_ids: [group.id] },
      }),
      "create-rule-000001",
      CORRELATION,
    );
    expect(rule.rule).toMatchObject({
      effect: "allow",
      priority: 100,
      enabled: true,
      selector: { kind: "explicit", groupIds: [group.id], userIds: [] },
      matchers: {
        methods: ["GET"],
        hosts: [{ kind: "suffix", value: "example.org" }],
        paths: [{ kind: "prefix", value: "/v1" }],
      },
    });
    expect((await fixture.policies.policy(
      fixture.superadmin,
      service.id,
      created.policy.id,
    )).evaluationGeneration).toBe(1);

    const direct = await fixture.policies.replaceRuleAssignments(
      fixture.superadmin,
      service.id,
      created.policy.id,
      rule.rule.id,
      rule.rule.version,
      {
        kind: "users",
        user_ids: [ordinary.id],
        direct_assignment_confirmed: true,
      },
      CORRELATION,
    );
    expect(direct.selector).toEqual({
      kind: "explicit",
      groupIds: [],
      userIds: [ordinary.id],
    });
    const document = await fixture.policies.copy(
      fixture.superadmin,
      service.id,
      created.policy.id,
    );
    const encoded = JSON.stringify(document);
    expect(document.format_version).toBe(1);
    expect(encoded).not.toMatch(
      /credential_value|vault_locator|authorization|cookie|gateway_reference/i,
    );
    expect(await fixture.invalidationCount(created.policy.id)).toBe(2);
  });

  it("rejects unsafe, unassigned, stale, duplicate-boundary, and cross-scope input", async () => {
    const fixture = await policyFixture("negative");
    const first = await fixture.service("first-policy-api");
    const second = await fixture.service("second-policy-api");
    const foreignGroup = await fixture.group(second.id, "Foreign", []);
    const policy = (await fixture.policies.createPolicy(
      fixture.superadmin,
      first.id,
      {
        boundary: { kind: "service" },
        name: "First policy",
        operating_mode: "deny",
      },
      "create-first-policy",
      CORRELATION,
    )).policy;

    await expect(fixture.policies.createPolicy(
      fixture.superadmin,
      first.id,
      {
        boundary: { kind: "service" },
        name: "Duplicate boundary",
        operating_mode: "allow",
      },
      "duplicate-policy-01",
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("conflict"));

    await expect(fixture.policies.createRule(
      fixture.superadmin,
      first.id,
      policy.id,
      ruleBody({
        name: "Missing selector",
        selector: undefined,
      }),
      "missing-selector1",
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("invalid_request"));

    await expect(fixture.policies.createRule(
      fixture.superadmin,
      first.id,
      policy.id,
      ruleBody({
        name: "Ambiguous path",
        paths: [{ kind: "exact", value: "/v1/%2Fadmin" }],
        selector: { kind: "all" },
      }),
      "ambiguous-path-01",
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("invalid_request"));

    await expect(fixture.policies.createRule(
      fixture.superadmin,
      first.id,
      policy.id,
      ruleBody({
        name: "Foreign selector",
        selector: { kind: "groups", group_ids: [foreignGroup.id] },
      }),
      "foreign-selector1",
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("not_found"));

    const valid = await fixture.policies.createRule(
      fixture.superadmin,
      first.id,
      policy.id,
      ruleBody({ name: "Valid", selector: { kind: "all" } }),
      "valid-rule-00001",
      CORRELATION,
    );
    await expect(fixture.policies.updateRule(
      fixture.superadmin,
      first.id,
      policy.id,
      valid.rule.id,
      valid.rule.version + 1,
      ruleBody({ name: "Stale", selector: { kind: "all" } }),
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("stale"));

    const outsider = await fixture.identity("outsider@example.org", "admin");
    await expect(fixture.policies.policy(
      browser(outsider.id, "admin"),
      first.id,
      policy.id,
    )).rejects.toEqual(new PolicyManagementError("not_found"));
  });

  it("archives before permanent deletion and disables every rule", async () => {
    const fixture = await policyFixture("archive");
    const service = await fixture.service("archive-policy-api");
    const policy = (await fixture.policies.createPolicy(
      fixture.superadmin,
      service.id,
      {
        boundary: { kind: "service" },
        name: "Archived policy",
        operating_mode: "deny",
      },
      "create-archive-policy",
      CORRELATION,
    )).policy;
    await fixture.policies.createRule(
      fixture.superadmin,
      service.id,
      policy.id,
      ruleBody({ name: "Rule", selector: { kind: "all" } }),
      "create-archive-rule",
      CORRELATION,
    );
    const current = await fixture.policies.policy(
      fixture.superadmin,
      service.id,
      policy.id,
    );
    await expect(fixture.policies.deleteArchived(
      fixture.superadmin,
      service.id,
      policy.id,
      current.version,
      CORRELATION,
    )).rejects.toEqual(new PolicyManagementError("conflict"));
    const archived = await fixture.policies.archivePolicy(
      fixture.superadmin,
      service.id,
      policy.id,
      current.version,
      CORRELATION,
    );
    expect(archived.lifecycle).toBe("archived");
    expect(archived.rules.every((rule) => !rule.enabled)).toBe(true);
    await expect(fixture.policies.deleteArchived(
      fixture.superadmin,
      service.id,
      policy.id,
      archived.version,
      CORRELATION,
    )).resolves.toBeUndefined();
  });
});

async function policyFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-policy-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const root = await identities.createLocalIdentity({
    profile: {
      email: `${label}-superadmin@example.org`,
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const relationships = new ServiceRelationshipRepository(worker);
  const serviceManager = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    new ControlIdempotencyHasher(Buffer.alloc(32, 91)),
    Buffer.alloc(32, 92),
    { now: () => NOW },
  );
  services.add(serviceManager);
  const repository = new PolicyManagementRepository(worker, () => NOW);
  const policies = new PolicyManagementService(
    repository,
    new ControlIdempotencyHasher(Buffer.alloc(32, 93)),
    () => NOW,
  );
  const groups = new GroupAssignmentRepository(worker, () => NOW);
  const uuid = new UuidV7Generator({ now: () => NOW });
  const superadmin = browser(root.id, "superadmin");
  return {
    worker,
    identities,
    policies,
    superadmin,
    identity: (email: string, role: "user" | "admin") =>
      identities.createLocalIdentity({
        profile: { email, givenName: "Example", familyName: "User" },
        role,
        status: "active",
      }, audit()),
    service: async (slug: string) => (await serviceManager.create(
      superadmin,
      { slug, name: slug },
      `create-${slug}-01`,
      CORRELATION,
    )).service,
    group: async (serviceId: string, name: string, userIds: string[]) => {
      const id = uuid.next();
      await groups.createGroup({
        actor: superadmin,
        serviceId,
        groupId: id,
        name,
        correlationId: CORRELATION,
        idempotency: idempotency(
          new ControlIdempotencyHasher(Buffer.alloc(32, 94)),
          superadmin.principalId,
          "groups.create",
          `group-${serviceId}-${name}`,
        ),
      });
      const current = await groups.group(superadmin, serviceId, id);
      await groups.replaceMembers({
        actor: superadmin,
        serviceId,
        groupId: id,
        expectedVersion: current.version,
        userIds,
        correlationId: CORRELATION,
        idempotency: idempotency(
          new ControlIdempotencyHasher(Buffer.alloc(32, 94)),
          superadmin.principalId,
          "groups.members.replace",
          `members-${serviceId}-${name}`,
        ),
      });
      return groups.group(superadmin, serviceId, id);
    },
    invalidationCount: (policyId: string) => worker.execute({
      run: (database) => database.read((query) =>
        query.get<{ count: number }>(
          "SELECT count(*) AS count FROM policy_invalidation_events WHERE policy_id = ?",
          [policyId],
        )?.count ?? 0),
    }),
  };
}

function ruleBody(overrides: {
  name: string;
  selector: unknown;
  paths?: unknown;
}) {
  return {
    name: overrides.name,
    effect: "allow",
    priority: 100,
    enabled: true,
    methods: ["GET"],
    hosts: [{ kind: "suffix", value: "example.org" }],
    paths: overrides.paths ?? [{ kind: "prefix", value: "/v1" }],
    response_safeguards: {
      secretlint: { enabled: true, disabled_rule_ids: [] },
      binary_response: { scan: true, max_bytes: 102_400 },
    },
    ...(overrides.selector === undefined ? {} : { selector: overrides.selector }),
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
    actor: { type: "system", label: "fixture", authenticationMethod: "test" },
    correlationId: CORRELATION,
  };
}

function idempotency(
  hasher: ControlIdempotencyHasher,
  principalId: string,
  routeId: string,
  key: string,
) {
  return {
    keyHash: hasher.keyHash({ key, principalId, routeId }),
    principalId,
    routeId,
    requestDigest: hasher.requestDigest({ key }),
  };
}
