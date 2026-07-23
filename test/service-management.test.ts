import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
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
  ServiceManagementAuthorization,
  ServiceManagementError,
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";
import {
  ServiceConfigurationError,
  canonicalServiceDraft,
  normalizeServiceDestination,
} from "../src/serviceConfiguration.js";
import type { GatewayConfig } from "../src/types.js";

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

describe("durable service ownership", () => {
  it("normalizes canonical safe destinations and rejects unsafe external inputs", () => {
    const normalized = normalizeServiceDestination({
      slug: "primary",
      baseUrl: "https://api.example.org/v1/",
      schemes: ["https"],
      hosts: [
        { type: "exact", value: "api.example.org" },
        { type: "suffix", value: ".example.org" },
      ],
      ports: [443],
      tlsVerify: false,
    });
    expect(normalized).toMatchObject({
      baseUrl: "https://api.example.org/v1/",
      schemes: ["https"],
      ports: [443],
      tlsVerify: false,
    });
    expect(canonicalServiceDraft({
      formatVersion: 1,
      service: { slug: "lab-api", name: "Lab API" },
      destinations: [{
        id: "018f1f2e-7b3c-7a10-8000-000000000010",
        ...normalized,
      }],
    }).digest).toMatch(/^[a-f0-9]{64}$/);

    for (const destination of [
      { ...inputDestination(), baseUrl: "ftp://api.example.org/" },
      { ...inputDestination(), baseUrl: "https://user@api.example.org/" },
      { ...inputDestination(), baseUrl: "https://api.example.org/%2fadmin/" },
      { ...inputDestination(), baseUrl: "https://api.example.org/%41dmin/" },
      { ...inputDestination(), schemes: ["http"] },
      { ...inputDestination(), hosts: [{ type: "regex" as const, value: ".*" }] },
      { ...inputDestination(), hosts: [{ type: "suffix" as const, value: "127.0.0.1" }] },
      { ...inputDestination(), ports: [8443] },
    ]) {
      expect(() => normalizeServiceDestination(destination))
        .toThrow(ServiceConfigurationError);
    }
  });

  it("creates idempotent drafts and enforces unique slugs without routing them", async () => {
    const fixture = await serviceFixture("create");
    const first = await fixture.service.create(
      fixture.superadmin,
      { slug: "lab-api", name: "Lab API" },
      "create-service-001",
      CORRELATION,
    );
    expect(first).toMatchObject({
      replayed: false,
      service: {
        slug: "lab-api",
        lifecycle: "draft",
        destinationCount: 0,
        adminCount: 0,
        publicationGeneration: 0,
      },
    });
    const replay = await fixture.service.create(
      fixture.superadmin,
      { slug: "lab-api", name: "Lab API" },
      "create-service-001",
      CORRELATION,
    );
    expect(replay).toMatchObject({ replayed: true, service: { id: first.service.id } });
    await expect(fixture.service.create(
      fixture.superadmin,
      { slug: "lab-api", name: "Duplicate" },
      "create-service-002",
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("conflict"));
    await fixture.identity("replacement@example.org", "superadmin", "active");
    await fixture.identities.changeRole(
      fixture.superadmin.principalId,
      1,
      "admin",
      audit(),
    );
    await expect(fixture.service.create(
      fixture.superadmin,
      { slug: "lab-api", name: "Lab API" },
      "create-service-001",
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("not_found"));
    expect(controlConfig().services).toEqual({});
  });

  it("assigns only active admins and grants exact assigned-service visibility", async () => {
    const fixture = await serviceFixture("assign");
    const created = await fixture.create("managed", "Managed");
    const admin = await fixture.identity("admin@example.org", "admin", "active");
    const ordinary = await fixture.identity("user@example.org", "user", "active");
    const suspended = await fixture.identity("suspended@example.org", "admin", "suspended");

    const assigned = await fixture.service.assign(
      fixture.superadmin,
      created.id,
      admin.id,
      created.version,
      false,
      CORRELATION,
    );
    expect(assigned).toMatchObject({ version: 2, adminCount: 1 });
    await expect(fixture.service.detail(browser(admin.id, "admin"), created.id))
      .resolves.toMatchObject({ id: created.id });
    await expect(fixture.relationships.relatedServiceIds(admin.id))
      .resolves.toEqual([created.id]);
    await expect(fixture.relationships.relatedServiceIds(admin.id, ordinary.id))
      .resolves.toEqual([]);

    for (const target of [ordinary, suspended]) {
      await expect(fixture.service.assign(
        fixture.superadmin,
        created.id,
        target.id,
        assigned.version,
        false,
        CORRELATION,
      )).rejects.toEqual(new ServiceManagementError("not_found"));
    }
    await expect(fixture.service.assign(
      fixture.superadmin,
      created.id,
      admin.id,
      assigned.version,
      true,
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("conflict"));
    await fixture.identities.changeStatus(admin.id, admin.version, "suspended", audit());
    await expect(fixture.service.detail(browser(admin.id, "admin"), created.id))
      .rejects.toEqual(new ServiceManagementError("not_found"));
    await expect(fixture.service.list(browser(admin.id, "admin"), {}))
      .resolves.toMatchObject({ services: [] });
  });

  it("scopes lists and binds cursors to actor, scope, and filters", async () => {
    const fixture = await serviceFixture("list");
    const alpha = await fixture.create("alpha", "Alpha");
    await fixture.create("bravo", "Bravo");
    const charlie = await fixture.create("charlie", "Charlie");
    const admin = await fixture.identity("admin@example.org", "admin", "active");
    await fixture.service.assign(
      fixture.superadmin, alpha.id, admin.id, alpha.version, false, CORRELATION,
    );

    const first = await fixture.service.list(fixture.superadmin, { limit: 2 });
    expect(first.services.map(({ slug }) => slug)).toEqual(["alpha", "bravo"]);
    const second = await fixture.service.list(fixture.superadmin, {
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.services.map(({ slug }) => slug)).toEqual(["charlie"]);
    const adminList = await fixture.service.list(browser(admin.id, "admin"), {});
    expect(adminList.services.map(({ id }) => id)).toEqual([alpha.id]);
    await expect(fixture.service.list(browser(admin.id, "admin"), {
      cursor: first.nextCursor,
    })).rejects.toBeInstanceOf(Error);
    await expect(fixture.service.detail(browser(admin.id, "admin"), charlie.id))
      .rejects.toEqual(new ServiceManagementError("not_found"));
  });

  it("adapts assigned-service authorization while denying target relationships", async () => {
    const fixture = await serviceFixture("authorization");
    const created = await fixture.create("owned", "Owned");
    const admin = await fixture.identity("admin@example.org", "admin", "active");
    await fixture.service.assign(
      fixture.superadmin, created.id, admin.id, created.version, false, CORRELATION,
    );
    const authorization = new ServiceManagementAuthorization(
      fixture.relationships,
      { authorizeScope: async () => false, verifyStepUp: async () => false },
    );
    const request = { params: { service_id: created.id } } as FastifyRequest;
    await expect(authorization.authorizeScope(
      browser(admin.id, "admin"),
      "configure_service",
      "assigned_services",
      request,
    )).resolves.toBe(true);
    await expect(authorization.authorizeScope(
      browser(admin.id, "admin"),
      "view_service_configuration",
      "assigned_services",
      { params: {}, routeOptions: { url: "/api/v2/services" } } as FastifyRequest,
    )).resolves.toBe(true);
    await expect(authorization.authorizeScope(
      browser(admin.id, "admin"),
      "configure_service",
      "assigned_services",
      { params: { service_id: "018f1f2e-7b3c-7a10-8000-000000000099" } } as FastifyRequest,
    )).resolves.toBe(false);
  });

  it("serves strict create/detail/admin contracts and generated OpenAPI", async () => {
    const fixture = await serviceFixture("routes");
    const authenticator: ControlAuthenticator = {
      authenticate: async () => fixture.superadmin,
      verifyCsrf: async () => true,
    };
    const authorization = new ServiceManagementAuthorization(
      fixture.relationships,
      { authorizeScope: async () => false, verifyStepUp: async () => false },
    );
    const application = createControlApplication(controlConfig(), {
      persistence: fixture.worker,
      authenticator,
      authorization,
      serviceManagement: fixture.service,
    });
    const created = await application.inject({
      method: "POST",
      url: "/api/v2/services",
      headers: mutationHeaders({ "idempotency-key": "route-create-0001" }),
      payload: { slug: "route-api", name: "Route API" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    expect(created.headers["cache-control"]).toBe("no-store");
    const serviceId = created.json().data.id as string;

    const unknown = await application.inject({
      method: "POST",
      url: "/api/v2/services",
      headers: mutationHeaders({ "idempotency-key": "route-create-0002" }),
      payload: { slug: "bad", name: "Bad", credential_value: "prohibited" },
    });
    expect(unknown.statusCode).toBe(400);
    expect(JSON.stringify(unknown.json())).not.toContain("prohibited");

    const conflict = await application.inject({
      method: "POST",
      url: "/api/v2/services",
      headers: mutationHeaders({ "idempotency-key": "route-create-0003" }),
      payload: { slug: "route-api", name: "Duplicate Route API" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toMatchObject({ code: "service_conflict" });

    const detail = await application.inject({
      method: "GET",
      url: `/api/v2/services/${serviceId}`,
      headers: { host: "control.example.org" },
    });
    expect(detail.statusCode).toBe(200);
    expect(JSON.stringify(detail.json())).not.toMatch(/document_json|assigned_by|subject|secret/i);

    const openapi = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().paths["/api/v2/services/{service_id}/admins/{user_id}"])
      .toHaveProperty("put");
    await application.close();
  });
});

async function serviceFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(mkdtempSync(join(tmpdir(), `secretsauce-services-${label}-`)), "control.sqlite"),
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
  const service = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    new ControlIdempotencyHasher(Buffer.alloc(32, 41)),
    Buffer.alloc(32, 42),
    { now: () => NOW },
  );
  services.add(service);
  const superadmin = browser(superadminUser.id, "superadmin");
  return {
    worker,
    identities,
    relationships,
    service,
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
    create: async (slug: string, name: string) => (await service.create(
      superadmin,
      { slug, name },
      `create-${slug}-0001`,
      CORRELATION,
    )).service,
  };
}

function inputDestination() {
  return {
    slug: "primary",
    baseUrl: "https://api.example.org/",
    schemes: ["https"],
    hosts: [{ type: "exact" as const, value: "api.example.org" }],
    ports: [443],
    tlsVerify: true,
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
