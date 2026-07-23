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
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
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
      {
        ...inputDestination(),
        hosts: [{ type: "regex" as const, value: "^(a+)+\\.example\\.org$" }],
      },
      {
        ...inputDestination(),
        hosts: [{ type: "regex" as const, value: "api\\.example\\.org" }],
      },
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
    await expect(fixture.service.validate(
      fixture.superadmin,
      created.id,
      CORRELATION,
    )).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining([{ code: "service_admin_required", pointer: "/admins" }]),
    });
  });

  it("edits canonical destination drafts and previews closed validation outcomes", async () => {
    const fixture = await serviceFixture("drafts");
    const created = await fixture.create("draft-api", "Draft API");
    const initial = await fixture.service.validate(
      fixture.superadmin,
      created.id,
      CORRELATION,
    );
    expect(initial).toMatchObject({
      valid: false,
      issues: [
        { code: "service_admin_required", pointer: "/admins" },
        { code: "destination_required", pointer: "/destinations" },
      ],
    });
    const admin = await fixture.identity("draft-admin@example.org", "admin", "active");
    const assigned = await fixture.service.assign(
      fixture.superadmin,
      created.id,
      admin.id,
      created.version,
      false,
      CORRELATION,
    );
    const withDestination = await fixture.service.createDestination(
      browser(admin.id, "admin"),
      created.id,
      assigned.version,
      { ...inputDestination(), tlsVerify: false },
      CORRELATION,
    );
    expect(withDestination).toMatchObject({
      version: 3,
      destinationCount: 1,
      destinations: [{
        slug: "primary",
        tlsVerify: false,
        baseUrl: "https://api.example.org/",
      }],
    });
    await expect(fixture.service.validate(
      browser(admin.id, "admin"),
      created.id,
      CORRELATION,
    )).resolves.toMatchObject({
      valid: true,
      issues: [],
      warnings: [{
        code: "tls_verification_disabled",
        pointer: "/destinations/0/tls_verify",
      }],
    });

    const profiled = await fixture.service.updateProfile(
      browser(admin.id, "admin"),
      created.id,
      withDestination.version,
      {
        name: "Edited API",
        description: "Canonical draft",
        documentationUrl: "https://docs.example.org/",
      },
      CORRELATION,
    );
    expect(profiled).toMatchObject({
      name: "Edited API",
      description: "Canonical draft",
      documentationUrl: "https://docs.example.org/",
      version: 4,
    });
    const partial = await fixture.service.updateProfile(
      browser(admin.id, "admin"),
      created.id,
      profiled.version,
      { name: "Edited API v2" },
      CORRELATION,
    );
    expect(partial).toMatchObject({
      name: "Edited API v2",
      description: "Canonical draft",
      documentationUrl: "https://docs.example.org/",
      version: 5,
    });
    const destinationId = profiled.destinations[0]!.id;
    const updated = await fixture.service.updateDestination(
      browser(admin.id, "admin"),
      created.id,
      destinationId,
      partial.version,
      {
        baseUrl: "https://api.example.org/v2/",
        schemes: ["https"],
        hosts: [{ type: "regex", value: "^api\\.example\\.org$" }],
        ports: [443],
        tlsVerify: true,
      },
      CORRELATION,
    );
    expect(updated).toMatchObject({
      version: 6,
      destinations: [{
        id: destinationId,
        slug: "primary",
        baseUrl: "https://api.example.org/v2/",
        tlsVerify: true,
        version: 2,
      }],
    });
    await expect(fixture.service.updateProfile(
      browser(admin.id, "admin"),
      created.id,
      profiled.version,
      { name: "Stale" },
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("stale"));
    await expect(fixture.service.updateDestination(
      browser(admin.id, "admin"),
      created.id,
      destinationId,
      updated.version,
      {
        ...inputDestination(),
        baseUrl: "https://api.example.org/%2fescape/",
      },
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("invalid_request"));

    const empty = await fixture.service.deleteDestination(
      browser(admin.id, "admin"),
      created.id,
      destinationId,
      updated.version,
      CORRELATION,
    );
    expect(empty).toMatchObject({ version: 7, destinationCount: 0, destinations: [] });
    await expect(fixture.service.validate(
      browser(admin.id, "admin"),
      created.id,
      CORRELATION,
    )).resolves.toMatchObject({
      valid: false,
      issues: [{ code: "destination_required" }],
    });
  });

  it("publishes immutable snapshots with atomic invalidation and audit rollback", async () => {
    const fixture = await serviceFixture("publish");
    const created = await fixture.create("published-api", "Published API");
    const admin = await fixture.identity("publisher@example.org", "admin", "active");
    const assigned = await fixture.service.assign(
      fixture.superadmin,
      created.id,
      admin.id,
      created.version,
      false,
      CORRELATION,
    );
    const drafted = await fixture.service.createDestination(
      browser(admin.id, "admin"),
      created.id,
      assigned.version,
      inputDestination(),
      CORRELATION,
    );
    const unassigned = await fixture.identity("unassigned@example.org", "admin", "active");
    await expect(fixture.service.publish(
      browser(unassigned.id, "admin"),
      created.id,
      drafted.version,
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("not_found"));

    await expect(fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      drafted.version,
      "invalid-correlation",
    )).rejects.toBeInstanceOf(ServiceManagementError);
    expect(await servicePersistenceState(fixture.worker, created.id)).toMatchObject({
      revisions: [],
      invalidations: [],
      lifecycle: "draft",
      publication_generation: 0,
    });

    const first = await fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      drafted.version,
      CORRELATION,
    );
    expect(first).toMatchObject({
      lifecycle: "published",
      publicationGeneration: 1,
      draftMatchesPublished: true,
      version: 4,
      publishedRevision: {
        sequence: 1,
        publishedAt: NOW,
      },
    });
    const firstState = await servicePersistenceState(fixture.worker, created.id);
    expect(firstState.revisions).toHaveLength(1);
    expect(firstState.invalidations).toEqual([{
      publication_generation: 1,
      reason: "publication",
    }]);
    expect(firstState.revisions[0]).toMatchObject({
      sequence: 1,
      publication_generation: 1,
      actor_role: "admin",
    });
    expect(firstState.revisions[0]!.document_json).not.toMatch(
      /admin|credential|secret|token|policy|runtime/i,
    );

    const edited = await fixture.service.updateProfile(
      browser(admin.id, "admin"),
      created.id,
      first.version,
      { name: "Published API v2" },
      CORRELATION,
    );
    expect(edited.draftMatchesPublished).toBe(false);
    const second = await fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      edited.version,
      CORRELATION,
    );
    expect(second).toMatchObject({
      publicationGeneration: 2,
      draftMatchesPublished: true,
      version: 6,
    });
    const secondState = await servicePersistenceState(fixture.worker, created.id);
    expect(secondState.revisions).toHaveLength(2);
    expect(secondState.revisions[0]!.document_json)
      .toBe(firstState.revisions[0]!.document_json);
    expect(secondState.revisions[1]!.document_json).toContain("Published API v2");
    await expect(fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      second.version,
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("conflict"));
  });

  it("enforces revision capacity and prunes only expired non-current history", async () => {
    const fixture = await serviceFixture("retention");
    const created = await fixture.create("retention-api", "Retention API");
    const admin = await fixture.identity("retention-admin@example.org", "admin", "active");
    const assigned = await fixture.service.assign(
      fixture.superadmin,
      created.id,
      admin.id,
      created.version,
      false,
      CORRELATION,
    );
    const drafted = await fixture.service.createDestination(
      browser(admin.id, "admin"),
      created.id,
      assigned.version,
      inputDestination(),
      CORRELATION,
    );
    await seedRevisionCapacity(fixture.worker, created.id, admin.id, NOW);
    await expect(fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      drafted.version,
      CORRELATION,
    )).rejects.toEqual(new ServiceManagementError("conflict"));
    expect((await servicePersistenceState(fixture.worker, created.id)).revisions)
      .toHaveLength(100);

    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE service_config_versions SET published_at = 1 WHERE service_id = ?",
          [created.id],
        );
      }),
    });
    const published = await fixture.service.publish(
      browser(admin.id, "admin"),
      created.id,
      drafted.version,
      CORRELATION,
    );
    expect(published).toMatchObject({ lifecycle: "published", publicationGeneration: 1 });
    const revisions = (await servicePersistenceState(fixture.worker, created.id)).revisions;
    expect(revisions).toHaveLength(100);
    expect(revisions.at(-1)).toMatchObject({
      sequence: 101,
      publication_generation: 1,
    });
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

    const admin = await fixture.identity("route-admin@example.org", "admin", "active");
    const assigned = await application.inject({
      method: "PUT",
      url: `/api/v2/services/${serviceId}/admins/${admin.id}`,
      headers: mutationHeaders({ "if-match": '"1"' }),
      payload: {},
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.headers.etag).toBe('"2"');

    const unsafeDestination = await application.inject({
      method: "POST",
      url: `/api/v2/services/${serviceId}/destinations`,
      headers: mutationHeaders({ "if-match": '"2"' }),
      payload: {
        ...wireDestinationInput(),
        base_url: "https://api.example.org/%2fescape/",
      },
    });
    expect(unsafeDestination.statusCode).toBe(400);
    expect(JSON.stringify(unsafeDestination.json())).not.toContain("%2fescape");

    const destination = await application.inject({
      method: "POST",
      url: `/api/v2/services/${serviceId}/destinations`,
      headers: mutationHeaders({ "if-match": '"2"' }),
      payload: wireDestinationInput(),
    });
    expect(destination.statusCode).toBe(200);
    expect(destination.headers.etag).toBe('"3"');
    expect(destination.json().data.destinations).toHaveLength(1);

    const validation = await application.inject({
      method: "POST",
      url: `/api/v2/services/${serviceId}/validate`,
      headers: mutationHeaders(),
      payload: {},
    });
    expect(validation.statusCode).toBe(200);
    expect(validation.json().data).toMatchObject({ valid: true, issues: [] });

    const published = await application.inject({
      method: "POST",
      url: `/api/v2/services/${serviceId}/publish`,
      headers: mutationHeaders({ "if-match": '"3"' }),
      payload: {},
    });
    expect(published.statusCode).toBe(200);
    expect(published.headers.etag).toBe('"4"');
    expect(published.json().data).toMatchObject({
      lifecycle: "published",
      publication_generation: 1,
      draft_matches_published: true,
    });

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
    expect(openapi.json().paths["/api/v2/services/{service_id}/destinations"])
      .toHaveProperty("post");
    expect(openapi.json().paths["/api/v2/services/{service_id}/publish"])
      .toHaveProperty("post");
    await application.close();
  });
});

async function servicePersistenceState(worker: PersistenceWorker, serviceId: string) {
  return worker.execute({
    run: (database) => database.read((query) => ({
      ...query.get<{
        lifecycle: string;
        publication_generation: number;
      }>(
        "SELECT lifecycle, publication_generation FROM services WHERE id = ?",
        [serviceId],
      ),
      revisions: query.all<{
        sequence: number;
        document_json: string;
        publication_generation: number;
        actor_role: string;
      }>(`
        SELECT sequence, document_json, publication_generation, actor_role
        FROM service_config_versions
        WHERE service_id = ?
        ORDER BY sequence
      `, [serviceId]),
      invalidations: query.all<{
        publication_generation: number;
        reason: string;
      }>(`
        SELECT publication_generation, reason
        FROM service_invalidation_events
        WHERE service_id = ?
        ORDER BY publication_generation
      `, [serviceId]),
    })),
  });
}

async function seedRevisionCapacity(
  worker: PersistenceWorker,
  serviceId: string,
  actorUserId: string,
  publishedAt: number,
) {
  const ids = new UuidV7Generator({ now: () => NOW });
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      for (let sequence = 1; sequence <= 100; sequence += 1) {
        transaction.run(`
          INSERT INTO service_config_versions (
            id, service_id, sequence, document_json, digest, source_revision_id,
            publication_generation, actor_user_id, actor_role, published_at
          ) VALUES (?, ?, ?, '{}', ?, NULL, ?, ?, 'admin', ?)
        `, [
          ids.next(),
          serviceId,
          sequence,
          "0".repeat(64),
          sequence,
          actorUserId,
          publishedAt,
        ]);
      }
    }),
  });
}

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

function wireDestinationInput() {
  return {
    slug: "primary",
    base_url: "https://api.example.org/",
    schemes: ["https"],
    hosts: [{ type: "exact", value: "api.example.org" }],
    ports: [443],
    tls_verify: true,
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
