import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isUuidV7, UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  createV1MigrationPlan,
  V1MigrationPlanError,
} from "../src/v1MigrationPlan.js";
import { readV1MigrationSource } from "../src/v1MigrationSource.js";

describe("deterministic v1 migration plan", () => {
  it("maps portable configuration to new draft identities with disabled unassigned policy rules", () => {
    const source = readV1MigrationSource(fixture(fullSource()));
    const plan = createV1MigrationPlan(source, { uuid: deterministicUuid() });

    expect(plan.services.map((service) => service.profile.slug)).toEqual([
      expect.stringMatching(/^migrated-[a-f0-9]{12}$/),
      "alpha",
    ]);
    const alpha = plan.services.find((service) => service.profile.slug === "alpha")!;
    expect(alpha).toMatchObject({
      lifecycle: "draft",
      profile: {
        slug: "alpha",
        name: "Alpha",
        documentationUrl: "https://docs.example.org/",
      },
      draft: {
        destinations: [{
          slug: "primary",
          baseUrl: "https://api.example.org/",
          schemes: ["https"],
          ports: [443],
          tlsVerify: false,
        }],
      },
      credentials: [{
        name: "API Key",
        normalizedName: "api key",
        status: "unconfigured",
        placement: {
          kind: "header",
          name: "X-API-Key",
          prefix: "Bearer ",
          enforceHeaderOwnership: true,
        },
      }],
      policy: {
        name: "Migrated service policy",
        operatingMode: "deny",
        lifecycle: "active",
        rules: [{
          name: "read",
          enabled: false,
          matchers: {
            methods: ["GET"],
            hosts: [{ kind: "regex", value: "^api\\.example\\.org$" }],
            paths: [{ kind: "regex", value: "^/v1/items/[A-Za-z0-9-]+$" }],
          },
          responseSafeguards: {
            secretlint: {
              enabled: true,
              disabledRuleIds: ["@secretlint/secretlint-rule-github"],
            },
            binaryResponse: { scan: true, maxBytes: 1024 },
          },
        }],
      },
    });
    expect(alpha.policy.rules[0]).not.toHaveProperty("selector");

    const ids = plan.services.flatMap((service) => [
      service.id,
      ...service.draft.destinations.map(({ id }) => id),
      ...service.credentials.map(({ id }) => id),
      service.policy.id,
      ...service.policy.rules.map(({ id }) => id),
    ]);
    expect(ids.every(isUuidV7)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.report.counts).toMatchObject({
      services: 2,
      destinations: 2,
      credentials: 1,
      policies: 2,
      rules: 1,
      configuredCredentials: 0,
      unconfiguredCredentials: 1,
      discardedAclEntries: 2,
      retainedServiceSlugs: 1,
      generatedServiceSlugs: 1,
    });
  });

  it("reuses one exact ID map and keeps reports free of source, ACL, destination, and credential details", () => {
    const source = readV1MigrationSource(fixture(fullSource()));
    const first = createV1MigrationPlan(source, { uuid: deterministicUuid() });
    const second = createV1MigrationPlan(source, { idMap: first.idMap });

    expect(second.digest).toBe(first.digest);
    expect(second.services).toEqual(first.services);
    const report = JSON.stringify(second.report);
    for (const forbidden of [
      "private@example.org",
      "PRIVATE_TOKEN",
      "api.example.org",
      "X-API-Key",
      "API Key",
      "/run/private",
      "Bad Service Key",
    ]) {
      expect(report).not.toContain(forbidden);
    }
  });

  it("rejects noncanonical destinations and unsupported credential placement", () => {
    expectPlanFailure(
      fullSource().replace("https://api.example.org/", "https://api.example.org"),
      "unsafe_destination",
    );
    expectPlanFailure(
      fullSource().replace("name: X-API-Key", "name: Host"),
      "unsupported_placement",
    );
    expectPlanFailure(
      fullSource().replace("kind: header", "kind: cookie"),
      "unsupported_placement",
    );
  });

  it("rejects unsafe policy regexes, unsupported safeguards, and normalized-name collisions", () => {
    expectPlanFailure(
      fullSource().replace("^/v1/items/[A-Za-z0-9-]+$", "/v1/items.*"),
      "unsafe_policy",
    );
    expectPlanFailure(
      fullSource().replace(
        "@secretlint/secretlint-rule-github",
        "@secretlint/private-rule-name",
      ),
      "unsafe_policy",
    );
    expectPlanFailure(
      fullSource().replace(
        "    access:\n      users: [private@example.org, hidden@example.org]",
        `      - id: " API Key "
        usage: {kind: query, name: token}
        source: {kind: file, path: /run/private}
    access:
      users: [private@example.org, hidden@example.org]`,
      ),
      "duplicate_name",
    );
  });

  it("rejects incomplete, duplicate, or non-v7 reusable identity maps", () => {
    const source = readV1MigrationSource(fixture(fullSource()));
    const plan = createV1MigrationPlan(source, { uuid: deterministicUuid() });
    const incomplete = structuredClone(plan.idMap);
    incomplete.alpha!.ruleIds = [];
    expect(() => createV1MigrationPlan(source, { idMap: incomplete })).toThrowError(
      expect.objectContaining({ code: "id_map_invalid" }),
    );

    const duplicate = structuredClone(plan.idMap);
    duplicate.alpha!.policyId = duplicate.alpha!.serviceId;
    expect(() => createV1MigrationPlan(source, { idMap: duplicate })).toThrowError(
      expect.objectContaining({ code: "id_map_invalid" }),
    );
  });
});

function deterministicUuid(): () => string {
  const generator = new UuidV7Generator({
    now: () => 1_700_000_000_000,
    random: () => Buffer.alloc(10, 0x24),
  });
  return () => generator.next();
}

function fixture(source: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "v1-migration-plan-")), "source.yaml");
  writeFileSync(file, source);
  return file;
}

function expectPlanFailure(source: string, code: string): void {
  let thrown: unknown;
  try {
    createV1MigrationPlan(readV1MigrationSource(fixture(source)), {
      uuid: deterministicUuid(),
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(V1MigrationPlanError);
  expect(thrown).toMatchObject({ code });
}

function fullSource(): string {
  return `services:
  alpha:
    name: Alpha
    api_docs_url: https://docs.example.org/
    destinations:
      - id: primary
        base_url: https://api.example.org/
        hosts:
          - regex: '^api\\.example\\.org$'
        tls: {verify: false}
    credentials:
      - id: API Key
        usage:
          kind: header
          name: X-API-Key
          prefix: "Bearer "
          enforce: true
        source:
          kind: env
          name: PRIVATE_TOKEN
    access:
      users: [private@example.org, hidden@example.org]
    policy:
      mode: deny
      rules:
        - id: read
          effect: allow
          priority: 100
          methods: [get]
          hosts: ['^api\\.example\\.org$']
          paths: ['^/v1/items/[A-Za-z0-9-]+$']
          secretlint:
            disabled_rules: ['@secretlint/secretlint-rule-github']
          binary_response:
            scan: true
            max_size: 1kb
  Bad Service Key:
    name: Beta
    destinations:
      - name: "Bad Destination"
        base_url: http://beta.example.org:8080/
    no_auth: true
`;
}
