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
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  PolicyManagementRepository,
  PolicyManagementService,
} from "../src/policyManagement.js";
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
  for (const manager of serviceManagers) manager.close();
  serviceManagers.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("policy HTTP contracts", () => {
  it("serves strict scoped policy, rule, copy, and simulation contracts", async () => {
    const fixture = await routeFixture();
    const service = (await fixture.services.create(
      fixture.superadmin,
      { slug: "policy-routes", name: "Policy routes" },
      "create-policy-service",
      CORRELATION,
    )).service;
    const created = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies`,
      headers: mutationHeaders({ "idempotency-key": "create-route-policy" }),
      payload: {
        boundary: { kind: "service" },
        name: "Request policy",
        operating_mode: "deny",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    expect(created.headers["cache-control"]).toBe("no-store");
    const policyId = created.json().data.id as string;

    const rule = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies/${policyId}/rules`,
      headers: mutationHeaders({ "idempotency-key": "create-route-rule" }),
      payload: {
        name: "Allow reads",
        effect: "allow",
        priority: 100,
        enabled: true,
        methods: ["GET"],
        hosts: [{ kind: "suffix", value: "example.org" }],
        paths: [{ kind: "prefix", value: "/v1" }],
        response_safeguards: {
          secretlint: { enabled: true, disabled_rule_ids: [] },
          binary_response: { scan: true, max_bytes: 102400 },
        },
        selector: { kind: "all" },
      },
    });
    expect(rule.statusCode).toBe(201);
    expect(rule.json().data).toMatchObject({
      effect: "allow",
      selector: { kind: "all", group_ids: [], user_ids: [] },
    });

    const detail = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/policies/${policyId}`,
      headers: { host: "control.example.org" },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.rules).toHaveLength(1);
    expect(detail.headers["cache-control"]).toBe("no-store");

    const copy = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/policies/${policyId}/copy`,
      headers: { host: "control.example.org" },
    });
    expect(copy.statusCode).toBe(200);
    expect(JSON.stringify(copy.json())).not.toMatch(
      /credential_value|vault_locator|authorization|cookie|gateway_reference/i,
    );

    const bulkTarget = (await fixture.services.create(
      fixture.superadmin,
      { slug: "policy-bulk-target", name: "Policy bulk target" },
      "create-policy-bulk-target",
      CORRELATION,
    )).service;
    const bulkPayload = {
      copies: [{
        source_policy_id: policyId,
        target_service_id: bulkTarget.id,
        boundary: { kind: "service" },
      }],
    };
    const bulk = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies/bulk-copy`,
      headers: mutationHeaders({ "idempotency-key": "route-bulk-copy-01" }),
      payload: bulkPayload,
    });
    expect(bulk.statusCode).toBe(201);
    expect(bulk.json().data.policies[0]).toMatchObject({
      service_id: bulkTarget.id,
      rules: [{ enabled: false }],
    });
    const bulkReplay = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies/bulk-copy`,
      headers: mutationHeaders({ "idempotency-key": "route-bulk-copy-01" }),
      payload: bulkPayload,
    });
    expect(bulkReplay.statusCode).toBe(200);
    expect(bulkReplay.json().data.policies[0].id)
      .toBe(bulk.json().data.policies[0].id);

    const hostileBulk = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies/bulk-copy`,
      headers: mutationHeaders({ "idempotency-key": "hostile-route-bulk" }),
      payload: {
        copies: [{
          ...bulkPayload.copies[0],
          credential_value: "must-not-echo",
        }],
      },
    });
    expect(hostileBulk.statusCode).toBe(400);
    expect(JSON.stringify(hostileBulk.json())).not.toContain("must-not-echo");

    const hostile = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policies/import`,
      headers: mutationHeaders({ "idempotency-key": "hostile-route-import" }),
      payload: {
        boundary: { kind: "service" },
        document: {
          ...copy.json().data,
          secret: "must-not-echo",
        },
      },
    });
    expect(hostile.statusCode).toBe(400);
    expect(JSON.stringify(hostile.json())).not.toContain("must-not-echo");

    const malformedSimulation = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/policy-simulations`,
      headers: mutationHeaders(),
      payload: {
        user_id: fixture.superadmin.principalId,
        destination_id: service.id,
        method: "GET",
        credential_ids: [],
      },
    });
    expect(malformedSimulation.statusCode).toBe(400);

    fixture.actor.value = await fixture.identity("outsider@example.org", "admin")
      .then(({ id }) => browser(id, "admin"));
    const hidden = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/policies/${policyId}`,
      headers: { host: "control.example.org" },
    });
    expect([403, 404]).toContain(hidden.statusCode);

    fixture.actor.value = fixture.superadmin;
    const documented = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(documented.json().paths).toHaveProperty(
      "/api/v2/services/{service_id}/policy-simulations",
    );
    expect(documented.json().paths).toHaveProperty(
      "/api/v2/services/{service_id}/policies/{policy_id}/rules/{rule_id}/assignments",
    );
    expect(documented.json().paths).toHaveProperty(
      "/api/v2/services/{service_id}/policies/bulk-copy",
    );
  });
});

async function routeFixture() {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "policy-route-test-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const root = await identities.createLocalIdentity({
    profile: {
      email: "policy-superadmin@example.org",
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const superadmin = browser(root.id, "superadmin");
  const relationships = new ServiceRelationshipRepository(worker);
  const idempotency = new ControlIdempotencyHasher(Buffer.alloc(32, 101));
  const services = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    idempotency,
    Buffer.alloc(32, 102),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const policies = new PolicyManagementService(
    new PolicyManagementRepository(worker, () => NOW),
    idempotency,
    () => NOW,
  );
  const actor = { value: superadmin as ControlAuthenticationContext };
  const authenticator: ControlAuthenticator = {
    authenticate: async () => actor.value,
    verifyCsrf: async () => true,
  };
  const application = createControlApplication(controlConfig(), {
    persistence: worker,
    authenticator,
    authorization: new ServiceManagementAuthorization(
      relationships,
      { authorizeScope: async () => false, verifyStepUp: async () => false },
    ),
    policyManagement: policies,
  });
  return {
    worker,
    identities,
    services,
    application,
    actor,
    superadmin,
    identity: (email: string, role: "user" | "admin" | "superadmin") =>
      identities.createLocalIdentity({
        profile: { email, givenName: "Example", familyName: "User" },
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
    actor: { type: "system", label: "fixture", authenticationMethod: "test" },
    correlationId: CORRELATION,
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
