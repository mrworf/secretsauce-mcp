import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ControlAuthenticator } from "../src/control/authentication.js";
import { registerUserAdministrationRoutes } from "../src/control/userRoutes.js";
import { createControlApplication } from "../src/control/server.js";
import { IdentityRepository, type IdentityAuditContext } from "../src/identity/repository.js";
import {
  UserAdministrationRepository,
  UserAdministrationService,
  UserCursorCodec,
} from "../src/identity/userAdministration.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import type { GatewayConfig } from "../src/types.js";

const NOW = 1_785_000_000_000;
const CORRELATION = "req_12345678-1234-4234-8234-123456789abc";
const workers = new Set<PersistenceWorker>();
const services = new Set<UserAdministrationService>();

afterEach(async () => {
  for (const service of services) service.close();
  services.clear();
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("user administration HTTP contracts", () => {
  it("serves no-store scoped list/detail and strong profile concurrency", async () => {
    const worker = open("http");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const superadmin = await identities.createLocalIdentity({
      profile: {
        email: "superadmin@example.org",
        givenName: "Super",
        familyName: "Admin",
      },
      role: "superadmin",
      status: "active",
    }, audit());
    const target = await identities.createLocalIdentity({
      profile: {
        email: "target@example.org",
        givenName: "Target",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    const service = new UserAdministrationService(
      new UserAdministrationRepository(worker, () => NOW),
      new UserCursorCodec(Buffer.alloc(32, 101), () => NOW),
    );
    services.add(service);
    const authenticator: ControlAuthenticator = {
      authenticate: async () => ({
        method: "browser_session",
        principalId: superadmin.id,
        role: "superadmin",
      }),
      verifyCsrf: async () => true,
    };
    const application = createControlApplication(controlConfig(), {
      persistence: worker,
      authenticator,
      authorization: {
        authorizeScope: async () => true,
        verifyStepUp: async () => false,
      },
      registerControlRoutes: (registry) =>
        registerUserAdministrationRoutes(registry, service),
    });

    const list = await application.inject({
      method: "GET",
      url: "/api/v2/users?limit=1",
      headers: { host: "control.example.org" },
    });
    expect(list.statusCode).toBe(200);
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(list.json().data.users).toHaveLength(1);
    expect(list.json().data.next_cursor).toBeTypeOf("string");
    expect(JSON.stringify(list.json())).not.toMatch(
      /normalized_email|security_epoch|encoded_hash|envelope_json/i,
    );

    const detail = await application.inject({
      method: "GET",
      url: `/api/v2/users/${target.id}`,
      headers: { host: "control.example.org" },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.headers.etag).toBe(`"${target.version}"`);

    const missingVersion = await application.inject({
      method: "PATCH",
      url: `/api/v2/users/${target.id}/profile`,
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        "x-csrf-token": "x".repeat(43),
      },
      payload: {
        email: target.email,
        given_name: "Updated",
        family_name: "User",
      },
    });
    expect(missingVersion.statusCode).toBe(428);

    const updated = await application.inject({
      method: "PATCH",
      url: `/api/v2/users/${target.id}/profile`,
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        "x-csrf-token": "x".repeat(43),
        "if-match": `"${target.version}"`,
      },
      payload: {
        email: target.email,
        given_name: "Updated",
        family_name: "User",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).toBe(`"${target.version + 1}"`);
    expect(updated.json().data).toMatchObject({
      id: target.id,
      given_name: "Updated",
    });
    await application.close();
  });

  it("returns not-found for cross-user ordinary access even after coarse authorization", async () => {
    const worker = open("scope");
    const identities = new IdentityRepository(worker, { now: () => NOW });
    const actor = await identities.createLocalIdentity({
      profile: { email: "actor@example.org", givenName: "", familyName: "" },
      role: "user",
      status: "active",
    }, audit());
    const target = await identities.createLocalIdentity({
      profile: { email: "hidden@example.org", givenName: "", familyName: "" },
      role: "user",
      status: "active",
    }, audit());
    const service = new UserAdministrationService(
      new UserAdministrationRepository(worker, () => NOW),
      new UserCursorCodec(Buffer.alloc(32, 102), () => NOW),
    );
    services.add(service);
    const application = createControlApplication(controlConfig(), {
      authenticator: {
        authenticate: async () => ({
          method: "browser_session",
          principalId: actor.id,
          role: "user",
        }),
        verifyCsrf: async () => true,
      },
      authorization: {
        authorizeScope: async () => true,
        verifyStepUp: async () => false,
      },
      registerControlRoutes: (registry) =>
        registerUserAdministrationRoutes(registry, service),
    });
    const response = await application.inject({
      method: "GET",
      url: `/api/v2/users/${target.id}`,
      headers: { host: "control.example.org" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
    await application.close();
  });
});

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

function open(label: string): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), `secretsauce-user-routes-${label}-`)),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  return worker;
}
