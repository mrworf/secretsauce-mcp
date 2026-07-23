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
  CredentialManagementRepository,
  CredentialManagementService,
} from "../src/credentialManagement.js";
import {
  CredentialVaultCoordinator,
  type CredentialControlVault,
} from "../src/credentialVaultCoordinator.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import {
  ServiceManagementAuthorization,
  ServiceManagementRepository,
  ServiceManagementService,
  ServiceRelationshipRepository,
} from "../src/serviceManagement.js";
import type { GatewayConfig } from "../src/types.js";
import { vaultError } from "../src/vault/errors.js";
import type {
  VaultCredentialBinding,
  VaultRecordMetadata,
} from "../src/vault/recordStore.js";

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

describe("credential HTTP contracts", () => {
  it("serves strict scoped redacted metadata and write-only value routes", async () => {
    const fixture = await routeFixture();
    const service = (await fixture.services.create(
      fixture.superadmin,
      { slug: "credential-routes", name: "Credential routes" },
      "create-credential-service",
      CORRELATION,
    )).service;
    const created = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/credentials`,
      headers: mutationHeaders({ "idempotency-key": "create-route-credential" }),
      payload: {
        name: "API token",
        placement: {
          kind: "header",
          name: "Authorization",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        selector: { kind: "all" },
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(created.json().data).not.toHaveProperty("vault_locator");
    const credentialId = created.json().data.id as string;

    const unknown = await fixture.application.inject({
      method: "POST",
      url: `/api/v2/services/${service.id}/credentials`,
      headers: mutationHeaders({ "idempotency-key": "invalid-route-credential" }),
      payload: {
        name: "Unsafe",
        placement: { kind: "query", name: "key" },
        selector: { kind: "all" },
        secret: "must-not-echo",
      },
    });
    expect(unknown.statusCode).toBe(400);
    expect(JSON.stringify(unknown.json())).not.toContain("must-not-echo");

    const raw = "route-secret-9876";
    const configured = await fixture.application.inject({
      method: "PUT",
      url: `/api/v2/services/${service.id}/credentials/${credentialId}/value`,
      headers: mutationHeaders({
        "if-match": '"1"',
        "idempotency-key": "set-route-credential",
      }),
      payload: { value: raw, capture_last_four: true },
    });
    expect(configured.statusCode).toBe(200);
    expect(configured.json().data).toMatchObject({
      id: credentialId,
      status: "configured",
      last_four: "9876",
    });
    expect(JSON.stringify(configured.json())).not.toContain(raw);
    expect(configured.headers["cache-control"]).toBe("no-store");

    const stale = await fixture.application.inject({
      method: "PATCH",
      url: `/api/v2/services/${service.id}/credentials/${credentialId}`,
      headers: mutationHeaders({ "if-match": '"1"' }),
      payload: {
        name: "Stale",
        placement: { kind: "query", name: "token" },
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("stale_version");

    const list = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/credentials`,
      headers: { host: "control.example.org" },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.credentials).toEqual([
      expect.objectContaining({ id: credentialId, status: "configured" }),
    ]);
    expect(JSON.stringify(list.json())).not.toContain(raw);

    fixture.actor.value = await fixture.identity(
      "unassigned@example.org",
      "admin",
      "active",
    ).then(({ id }) => browser(id, "admin"));
    const hidden = await fixture.application.inject({
      method: "GET",
      url: `/api/v2/services/${service.id}/credentials/${credentialId}`,
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
      "/api/v2/services/{service_id}/credentials/{credential_id}/value",
    );
  });
});

async function routeFixture() {
  const directory = mkdtempSync(join(tmpdir(), "credential-route-test-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  const identities = new IdentityRepository(worker, { now: () => NOW });
  const superadminUser = await identities.createLocalIdentity({
    profile: {
      email: "credential-superadmin@example.org",
      givenName: "Super",
      familyName: "Admin",
    },
    role: "superadmin",
    status: "active",
  }, audit());
  const superadmin = browser(superadminUser.id, "superadmin");
  const relationships = new ServiceRelationshipRepository(worker);
  const idempotency = new ControlIdempotencyHasher(Buffer.alloc(32, 91));
  const services = new ServiceManagementService(
    new ServiceManagementRepository(worker),
    relationships,
    idempotency,
    Buffer.alloc(32, 92),
    { now: () => NOW },
  );
  serviceManagers.add(services);
  const repository = new CredentialManagementRepository(worker, () => NOW);
  const credentials = new CredentialManagementService(repository, idempotency, () => NOW);
  const vault = new RouteVault();
  const coordinator = new CredentialVaultCoordinator(
    worker,
    repository,
    vault,
    () => NOW,
    () => "abcdef12-3456-4789-8abc-def012345678",
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
    credentialManagement: credentials,
    credentialVault: coordinator,
  });
  return {
    worker,
    identities,
    services,
    application,
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

class RouteVault implements CredentialControlVault {
  readonly records = new Map<string, VaultRecordMetadata>();

  async create(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    captureLastFour?: boolean;
  }) {
    const text = Buffer.from(input.secret).toString("utf8");
    const metadata: VaultRecordMetadata = {
      status: "configured",
      generation: 1,
      sizeClass: "up_to_32_bytes",
      ...(input.captureLastFour === true ? { lastFour: text.slice(-4) } : {}),
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.records.set(input.locator, metadata);
    return { locator: input.locator, metadata };
  }

  async replace() {
    throw vaultError("vault_record_not_found");
  }

  async delete() {
    return { deleted: true as const };
  }

  async metadata(locator: string) {
    const metadata = this.records.get(locator);
    if (metadata === undefined) throw vaultError("vault_record_not_found");
    return metadata;
  }
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
