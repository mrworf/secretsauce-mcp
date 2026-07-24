import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticationContext } from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import type { StepUpRepository } from "../src/identity/stepUp.js";
import { PersistenceError } from "../src/persistence/errors.js";
import type { PersistenceTransaction } from "../src/persistence/transaction.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";
import { RuntimeActivationRepository } from "../src/runtimeSnapshots.js";
import {
  runRuntimeActivationCli,
  type RuntimeActivationIo,
} from "../src/runtime/activateCli.js";
import type { GatewayConfig } from "../src/types.js";
import { PersistedRuntimeAuthority } from "../src/runtimeAuthority.js";
import { TokenBroker } from "../src/tokens.js";
import { RuntimeInvalidationConsumer } from "../src/runtimeInvalidation.js";

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

describe("persisted runtime snapshot activation", () => {
  it("activates every published service atomically and only once", async () => {
    const fixture = await runtimeFixture("activate");
    const published = await fixture.publish("runtime-api");
    const before = await runtimeRows(fixture.worker, published.id);
    expect(before).toMatchObject({
      snapshotCount: 1,
      activeSnapshotId: null,
    });

    const activation = new RuntimeActivationRepository(
      fixture.worker,
      () => NOW,
    );
    await expect(activation.activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    })).resolves.toEqual({
      activationGeneration: 1,
      globalReferenceEpoch: 1,
      serviceCount: 1,
    });
    await expect(activation.state()).resolves.toMatchObject({
      state: "active",
      activationGeneration: 1,
      globalReferenceEpoch: 1,
      version: 2,
      activatedAt: NOW,
    });

    const active = await runtimeRows(fixture.worker, published.id);
    expect(active.snapshotCount).toBe(2);
    expect(active.activeSnapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(active.document).toMatchObject({
      formatVersion: 1,
      service: {
        id: published.id,
        slug: "runtime-api",
        publicationGeneration: 1,
      },
      destinations: [{
        baseUrl: "https://api.example.org/",
        tlsVerify: true,
      }],
      credentials: [],
      policies: [],
    });

    await expect(activation.activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    })).rejects.toEqual(new PersistenceError("identity_conflict"));
    expect((await runtimeRows(fixture.worker, published.id)).snapshotCount).toBe(2);
  });

  it("rolls activation back when no published service exists", async () => {
    const fixture = await runtimeFixture("empty");
    await fixture.service.create(
      fixture.superadmin,
      { slug: "draft-only", name: "Draft only" },
      "create-draft-only-0001",
      CORRELATION,
    );
    const activation = new RuntimeActivationRepository(fixture.worker, () => NOW);

    await expect(activation.activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    })).rejects.toEqual(new PersistenceError("identity_conflict"));
    await expect(activation.state()).resolves.toEqual({
      state: "inactive",
      activationGeneration: 0,
      globalReferenceEpoch: 0,
      version: 1,
    });
    expect(await runtimeTableCounts(fixture.worker)).toEqual({
      snapshots: 0,
      activeServices: 0,
      activationAudits: 0,
    });
  });

  it("moves the active pointer to a new immutable snapshot after publication", async () => {
    const fixture = await runtimeFixture("republish");
    let published = await fixture.publish("changing-api");
    const activation = new RuntimeActivationRepository(fixture.worker, () => NOW);
    await activation.activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    const original = await runtimeRows(fixture.worker, published.id);

    published = await fixture.service.updateProfile(
      fixture.superadmin,
      published.id,
      published.version,
      { name: "Changed API", description: "new revision" },
      CORRELATION,
    );
    published = await fixture.service.publish(
      fixture.superadmin,
      published.id,
      published.version,
      CORRELATION,
    );
    const updated = await runtimeRows(fixture.worker, published.id);

    expect(updated.snapshotCount).toBe(3);
    expect(updated.activeSnapshotId).not.toBe(original.activeSnapshotId);
    expect(updated.document).toMatchObject({
      service: {
        name: "Changed API",
        description: "new revision",
        publicationGeneration: 2,
      },
    });
    expect(await snapshotDocument(
      fixture.worker,
      original.activeSnapshotId!,
    )).toMatchObject({
      service: {
        name: "changing-api",
        publicationGeneration: 1,
      },
    });
  });
});

describe("runtime activation CLI boundary", () => {
  it("requires an exact interactive confirmation and emits only stable output", async () => {
    const fixture = await runtimeFixture("cli");
    await fixture.publish("cli-api");
    const output: string[] = [];
    const errors: string[] = [];
    const io: RuntimeActivationIo = {
      inputTerminal: true,
      outputTerminal: true,
      question: async () => "ACTIVATE V2",
      stdout: (value) => output.push(value),
      stderr: (value) => errors.push(value),
    };

    await expect(runRuntimeActivationCli(
      [],
      { CONFIG_PATH: "/unused/config.yaml" },
      io,
      {
        loadConfiguration: () => databaseRuntimeConfig(),
        openPersistence: () => fixture.worker,
        now: () => NOW,
        uuid: () => "018f1f2e-7b3c-7a10-8000-000000000090",
        correlationUuid: () => "12345678-1234-4234-8234-123456789abc",
        osActor: () => "test-operator",
      },
    )).resolves.toBe(0);
    expect(errors).toEqual([]);
    expect(output).toEqual([
      `${JSON.stringify({
        status: "active",
        authority: "database",
        activation_generation: 1,
        service_count: 1,
      })}\n`,
    ]);
  });

  it("rejects non-terminals, wrong authority, and near-match confirmations", async () => {
    const outcomes: Array<{
      io: RuntimeActivationIo;
      config: GatewayConfig;
      expected: string;
    }> = [
      {
        io: memoryIo("ACTIVATE V2", false),
        config: databaseRuntimeConfig(),
        expected: "terminal_required",
      },
      {
        io: memoryIo("ACTIVATE V2"),
        config: { ...databaseRuntimeConfig(), runtime: { authority: "yaml" } },
        expected: "database_runtime_required",
      },
      {
        io: memoryIo("activate v2"),
        config: databaseRuntimeConfig(),
        expected: "activation_cancelled",
      },
    ];
    for (const outcome of outcomes) {
      let opened = false;
      await expect(runRuntimeActivationCli(
        [],
        { CONFIG_PATH: "/unused/config.yaml" },
        outcome.io,
        {
          loadConfiguration: () => outcome.config,
          openPersistence: () => {
            opened = true;
            throw new Error("must not open");
          },
        },
      )).resolves.not.toBe(0);
      expect(opened).toBe(false);
      expect((outcome.io as MemoryIo).errors).toEqual([
        `${JSON.stringify({ error: { code: outcome.expected } })}\n`,
      ]);
      expect((outcome.io as MemoryIo).output).toEqual([]);
    }
  });
});

describe("persisted runtime discovery", () => {
  it("discovers and describes only services assigned to an active ordinary user", async () => {
    const fixture = await runtimeFixture("discovery");
    await fixture.publish("visible-api", fixture.user.id);
    await fixture.publish("hidden-api");
    await new RuntimeActivationRepository(fixture.worker, () => NOW).activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    const authority = new PersistedRuntimeAuthority(fixture.worker);
    const userAuth = {
      subject: fixture.user.id,
      scopes: ["gateway.read"],
      mode: "oauth" as const,
    };

    await expect(authority.listServices(userAuth)).resolves.toEqual([
      expect.objectContaining({
        id: "visible-api",
        name: "visible-api",
        destinations: [{
          id: "primary",
          base_url_hint: "https://api.example.org/",
          tls_verify: true,
        }],
        access_methods: [{
          id: "gateway_access",
          usage_hint: "Pass reference as service_reference",
        }],
        policy_summary: "mode=deny",
      }),
    ]);
    await expect(authority.describeServicePolicy(
      userAuth,
      "visible-api",
    )).resolves.toMatchObject({
      id: "visible-api",
      policy: { mode: "deny", rules: [] },
    });
    await expect(authority.serviceView(userAuth, "hidden-api"))
      .rejects.toMatchObject({ code: "unauthorized_service" });
  });

  it("fails closed for non-UUID, inactive, and privileged subjects", async () => {
    const fixture = await runtimeFixture("subjects");
    await fixture.publish("subject-api", fixture.user.id);
    await new RuntimeActivationRepository(fixture.worker, () => NOW).activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    const authority = new PersistedRuntimeAuthority(fixture.worker);
    const invalidSubjects = [
      "legacy@example.org",
      fixture.superadmin.principalId,
      fixture.suspendedUser.id,
    ];
    for (const subject of invalidSubjects) {
      await expect(authority.listServices({
        subject,
        scopes: ["gateway.read"],
        mode: "oauth",
      })).rejects.toMatchObject({ code: "unauthenticated" });
    }
  });

  it("issues subject, destination, snapshot, and generation-bound references", async () => {
    const fixture = await runtimeFixture("references");
    const published = await fixture.publish("reference-api", fixture.user.id);
    await new RuntimeActivationRepository(fixture.worker, () => NOW).activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    const authority = new PersistedRuntimeAuthority(fixture.worker);
    const auth = {
      subject: fixture.user.id,
      scopes: ["gateway.references"],
      mode: "oauth" as const,
    };
    const input = {
      service: "reference-api",
      access_ids: ["gateway_access"],
      reason: "Read the assigned runtime service.",
    };
    const grant = await authority.authorizeReferences(auth, input);
    const broker = new TokenBroker(referenceConfig(), () => NOW);
    const issued = broker.issueRuntimeTokens(auth, input, grant);
    expect(issued.tokens).toHaveLength(1);
    const record = broker.validateServiceReferenceUse(
      auth,
      { service: "reference-api", destination: "primary" },
      issued.tokens[0]!.token,
    );
    expect(record).toMatchObject({
      subject: fixture.user.id,
      service: "reference-api",
      serviceId: published.id,
      destination: "primary",
      snapshotId: grant.snapshotId,
      publicationGeneration: 1,
      serviceAuthorizationGeneration: 0,
      subjectSecurityEpoch: 1,
      globalReferenceEpoch: 1,
      kind: "service",
    });
    expect(() => broker.validateServiceReferenceUse(
      {
        ...auth,
        subject: fixture.suspendedUser.id,
      },
      { service: "reference-api", destination: "primary" },
      issued.tokens[0]!.token,
    )).toThrowError(expect.objectContaining({ code: "reference_invalid" }));
  });

  it("rejects a preflighted reference after the active publication changes", async () => {
    const fixture = await runtimeFixture("stale");
    let published = await fixture.publish("stale-api", fixture.user.id);
    await new RuntimeActivationRepository(fixture.worker, () => NOW).activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    const authority = new PersistedRuntimeAuthority(fixture.worker);
    const auth = {
      subject: fixture.user.id,
      scopes: ["gateway.request"],
      mode: "oauth" as const,
    };
    const input = {
      service: "stale-api",
      destination: "primary",
      access_ids: ["gateway_access"],
      reason: "Exercise a generation-bound reference.",
    };
    const broker = new TokenBroker(referenceConfig(), () => NOW);
    const issued = broker.issueRuntimeTokens(
      auth,
      input,
      await authority.authorizeReferences(auth, input),
    );
    const record = broker.preflightTokenUse(
      auth,
      { service: "stale-api", destination: "primary" },
      issued.tokens[0]!.token,
    );

    published = await fixture.service.updateProfile(
      fixture.superadmin,
      published.id,
      published.version,
      { name: "New snapshot" },
      CORRELATION,
    );
    await fixture.service.publish(
      fixture.superadmin,
      published.id,
      published.version,
      CORRELATION,
    );

    await expect(authority.validateReferences(
      auth,
      "stale-api",
      "primary",
      [record],
    )).rejects.toMatchObject({ code: "reference_invalid" });
  });

  it("consumes targeted invalidations after evicting only affected references", async () => {
    const fixture = await runtimeFixture("invalidations");
    const first = await fixture.publish("first-api", fixture.user.id);
    await fixture.publish("second-api", fixture.user.id);
    await new RuntimeActivationRepository(fixture.worker, () => NOW).activate({
      correlationId: CORRELATION,
      osActor: "test-operator",
    });
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "UPDATE service_invalidation_events SET dispatched_at = ? WHERE dispatched_at IS NULL",
          [NOW],
        );
      }),
    });
    const authority = new PersistedRuntimeAuthority(fixture.worker);
    const auth = {
      subject: fixture.user.id,
      scopes: ["gateway.references"],
      mode: "oauth" as const,
    };
    const broker = new TokenBroker(referenceConfig(), () => NOW);
    for (const service of ["first-api", "second-api"]) {
      const input = {
        service,
        access_ids: ["gateway_access"],
        reason: "Prepare targeted invalidation coverage.",
      };
      broker.issueRuntimeTokens(
        auth,
        input,
        await authority.authorizeReferences(auth, input),
      );
    }
    expect(broker.stats().configured).toBe(2);
    const invalidationId = "018f1f2e-7b3c-7a10-8000-000000000099";
    await fixture.worker.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(`
          INSERT INTO service_invalidation_events (
            id, service_id, publication_generation, reason,
            created_at, dispatched_at, attempts
          ) VALUES (?, ?, 2, 'publication', ?, NULL, 0)
        `, [invalidationId, first.id, NOW]);
      }),
    });

    await expect(new RuntimeInvalidationConsumer(
      fixture.worker,
      broker,
    ).poll()).resolves.toBe(1);
    expect(broker.stats().configured).toBe(1);
    await expect(fixture.worker.execute({
      run: (database) => database.read((query) => ({
        event: query.get<{ dispatched_at: number; attempts: number }>(`
          SELECT dispatched_at, attempts
          FROM service_invalidation_events WHERE id = ?
        `, [invalidationId]),
        checkpoint: query.get<{ last_event_id: string }>(`
          SELECT last_event_id FROM runtime_invalidation_checkpoints
          WHERE stream_name = 'service'
        `),
      })),
    })).resolves.toMatchObject({
      event: { dispatched_at: expect.any(Number), attempts: 1 },
      checkpoint: { last_event_id: invalidationId },
    });
  });
});

async function runtimeFixture(label: string) {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-runtime-${label}-`)),
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
  const admin = await identities.createLocalIdentity({
    profile: {
      email: `${label}-admin@example.org`,
      givenName: "Service",
      familyName: "Admin",
    },
    role: "admin",
    status: "active",
  }, audit());
  const user = await identities.createLocalIdentity({
    profile: {
      email: `${label}-user@example.org`,
      givenName: "Runtime",
      familyName: "User",
    },
    role: "user",
    status: "active",
  }, audit());
  const suspendedUser = await identities.createLocalIdentity({
    profile: {
      email: `${label}-suspended@example.org`,
      givenName: "Suspended",
      familyName: "User",
    },
    role: "user",
    status: "suspended",
  }, audit());
  const stepUps = {
    withConsumedProof: async (
      _handle: unknown,
      auditInput: unknown,
      mutation: (transaction: PersistenceTransaction) => unknown,
    ) => worker.execute({
      run: (database) => database.withGeneratedAdministrativeAudit(
        (transaction) => ({ value: mutation(transaction), auditInput }),
      ),
    }),
  } as unknown as StepUpRepository;
  const service = new ServiceManagementService(
    new ServiceManagementRepository(worker, stepUps),
    new ServiceRelationshipRepository(worker),
    new ControlIdempotencyHasher(Buffer.alloc(32, 51)),
    Buffer.alloc(32, 52),
    { now: () => NOW },
  );
  services.add(service);
  const superadmin = browser(superadminUser.id, "superadmin");
  return {
    worker,
    service,
    superadmin,
    user,
    suspendedUser,
    publish: async (slug: string, assignedUserId?: string) => {
      let view = (await service.create(
        superadmin,
        { slug, name: slug },
        `create-${slug}-0001`,
        CORRELATION,
      )).service;
      if (assignedUserId !== undefined) {
        await worker.execute({
          run: (database) => database.withOperationalTransaction((transaction) => {
            transaction.run(`
              INSERT INTO service_principal_assignments (
                id, service_id, selector_kind, group_id, user_id,
                assigned_by_user_id, created_at
              ) VALUES (?, ?, 'user', NULL, ?, ?, ?)
            `, [
              nextFixtureUuid(slug),
              view.id,
              assignedUserId,
              superadmin.principalId,
              NOW,
            ]);
          }),
        });
      }
      view = await service.assign(
        superadmin,
        view.id,
        admin.id,
        view.version,
        false,
        CORRELATION,
      );
      view = await service.createDestination(
        superadmin,
        view.id,
        view.version,
        {
          slug: "primary",
          baseUrl: "https://api.example.org/",
          schemes: ["https"],
          hosts: [{ type: "exact", value: "api.example.org" }],
          ports: [443],
          tlsVerify: true,
        },
        CORRELATION,
      );
      return service.publish(
        superadmin,
        view.id,
        view.version,
        CORRELATION,
      );
    },
  };
}

function nextFixtureUuid(value: string): string {
  let suffix = 0;
  for (const character of value) {
    suffix = (suffix * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `018f1f2e-7b3c-7a10-8000-${suffix.toString(16).padStart(12, "0")}`;
}

function runtimeRows(worker: PersistenceWorker, serviceId: string): Promise<{
  snapshotCount: number;
  activeSnapshotId: string | null;
  document: unknown;
}> {
  return worker.execute({
    run: (database) => database.read((query) => {
      const active = query.get<{ snapshot_id: string }>(
        "SELECT snapshot_id FROM runtime_active_services WHERE service_id = ?",
        [serviceId],
      );
      const snapshotCount = query.get<{ count: number }>(
        "SELECT count(*) AS count FROM runtime_service_snapshots WHERE service_id = ?",
        [serviceId],
      )!.count;
      const document = active === undefined
        ? null
        : JSON.parse(query.get<{ document_json: string }>(
          "SELECT document_json FROM runtime_service_snapshots WHERE id = ?",
          [active.snapshot_id],
        )!.document_json) as unknown;
      return {
        snapshotCount,
        activeSnapshotId: active?.snapshot_id ?? null,
        document,
      };
    }),
  });
}

function snapshotDocument(
  worker: PersistenceWorker,
  snapshotId: string,
): Promise<Record<string, unknown>> {
  return worker.execute({
    run: (database) => database.read((query) => JSON.parse(
      query.get<{ document_json: string }>(
        "SELECT document_json FROM runtime_service_snapshots WHERE id = ?",
        [snapshotId],
      )!.document_json,
    ) as Record<string, unknown>),
  });
}

function runtimeTableCounts(worker: PersistenceWorker): Promise<{
  snapshots: number;
  activeServices: number;
  activationAudits: number;
}> {
  return worker.execute({
    run: (database) => database.read((query) => ({
      snapshots: query.get<{ count: number }>(
        "SELECT count(*) AS count FROM runtime_service_snapshots",
      )!.count,
      activeServices: query.get<{ count: number }>(
        "SELECT count(*) AS count FROM runtime_active_services",
      )!.count,
      activationAudits: query.get<{ count: number }>(`
        SELECT count(*) AS count FROM administrative_audit_events
        WHERE action = 'runtime.activate_v2'
      `)!.count,
    })),
  });
}

function browser(
  principalId: string,
  role: "admin" | "superadmin",
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

interface MemoryIo extends RuntimeActivationIo {
  output: string[];
  errors: string[];
}

function memoryIo(answer: string, terminal = true): MemoryIo {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    inputTerminal: terminal,
    outputTerminal: terminal,
    question: async () => answer,
    stdout: (value) => output.push(value),
    stderr: (value) => errors.push(value),
    output,
    errors,
  };
}

function databaseRuntimeConfig(): GatewayConfig {
  return {
    server: {
      host: "127.0.0.1",
      port: 0,
      listen: "127.0.0.1:0",
      mcpPath: "/mcp",
      allowInsecureOAuthHttp: false,
    },
    auth: { mode: "bearer", bearer: { token: "unused", source: "env" } },
    tokens: { idleTtlMs: 60_000, maxTtlMs: 120_000 },
    limits: {} as GatewayConfig["limits"],
    logging: { level: "info" },
    audit: { memoryEvents: 100 },
    persistence: { databaseFile: "/unused/control.sqlite" },
    runtime: { authority: "database" },
    services: {},
    warnings: [],
    debugDiagnostics: [],
  };
}

function referenceConfig(): GatewayConfig {
  return {
    ...databaseRuntimeConfig(),
    limits: {
      maxTokenRecords: 100,
      maxTokenRecordsPerSubject: 20,
    } as GatewayConfig["limits"],
  };
}
