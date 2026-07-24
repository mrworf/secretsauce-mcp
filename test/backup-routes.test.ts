import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
  type PortableBackupCoordinator,
} from "../src/backupCoordinator.js";
import {
  type ControlAuthenticationContext,
  type ControlAuthenticator,
} from "../src/control/authentication.js";
import { type ControlAuthorizationSeam } from "../src/control/routeRegistry.js";
import { createControlApplication } from "../src/control/server.js";
import type { GatewayConfig } from "../src/types.js";

const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const API_KEY_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const ARCHIVE = Buffer.from("portable-gzip-fixture");

describe("portable backup HTTP contracts", () => {
  it("delivers a stepped-up browser backup as a no-store gzip attachment", async () => {
    const create = vi.fn(async () => result());
    const application = app(browserActor(), create);
    const response = await application.inject({
      method: "POST",
      url: "/api/v2/backups/interactive",
      headers: browserHeaders(),
      payload: {
        include_secrets: true,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
        passphrase: "correct horse battery staple",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(ARCHIVE);
    expect(response.headers).toMatchObject({
      "content-type": "application/gzip",
      "content-disposition":
        'attachment; filename="secretsauce-portable-backup.tar.gz"',
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      actor: browserActor(),
      includeSecrets: true,
      acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      passphrase: expect.any(Buffer),
      stepUpProof: expect.objectContaining({ consumed: true }),
    }));
    const supplied = create.mock.calls[0]![0].passphrase as Buffer;
    expect(supplied).toEqual(Buffer.alloc(supplied.byteLength));
    await application.close();
  });

  it("requires browser CSRF, exact step-up, superadmin role, and valid passphrase shape", async () => {
    const create = vi.fn(async () => result());
    const noStepUp = app(browserActor(), create, false);
    const stepUp = await noStepUp.inject({
      method: "POST",
      url: "/api/v2/backups/interactive",
      headers: browserHeaders(),
      payload: {
        include_secrets: false,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
    });
    expect(stepUp.statusCode).toBe(403);
    expect(stepUp.json().error.code).toBe("step_up_required");
    await noStepUp.close();

    const csrfApp = app(browserActor(), create);
    const csrf = await csrfApp.inject({
      method: "POST",
      url: "/api/v2/backups/interactive",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
      },
      payload: {
        include_secrets: false,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
    });
    expect(csrf.statusCode).toBe(403);
    await csrfApp.close();

    const adminApp = app({ ...browserActor(), role: "admin" }, create);
    const admin = await adminApp.inject({
      method: "POST",
      url: "/api/v2/backups/interactive",
      headers: browserHeaders(),
      payload: {
        include_secrets: false,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
    });
    expect(admin.statusCode).toBe(403);
    await adminApp.close();

    const validationApp = app(browserActor(), create);
    for (const payload of [
      {
        include_secrets: true,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
      {
        include_secrets: false,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
        passphrase: "not permitted here",
      },
      {
        include_secrets: true,
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
        passphrase: "é".repeat(513),
      },
      {
        include_secrets: false,
        acknowledgement: "wrong acknowledgement",
      },
    ]) {
      const response = await validationApp.inject({
        method: "POST",
        url: "/api/v2/backups/interactive",
        headers: browserHeaders(),
        payload,
      });
      expect(response.statusCode).toBe(400);
      if (payload.passphrase !== undefined) {
        expect(response.body).not.toContain(payload.passphrase);
      }
    }
    expect(create).not.toHaveBeenCalled();
    await validationApp.close();
  });

  it("permits only a system key on the credential-less programmatic route", async () => {
    const create = vi.fn(async () => result());
    const system = app(systemActor(), create);
    const response = await system.inject({
      method: "POST",
      url: "/api/v2/backups/programmatic",
      headers: { host: "control.example.org" },
      payload: {
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      actor: systemActor(),
      includeSecrets: false,
    }));
    await system.close();

    const service = app({ ...systemActor(), role: "service" }, create);
    const denied = await service.inject({
      method: "POST",
      url: "/api/v2/backups/programmatic",
      headers: { host: "control.example.org" },
      payload: {
        acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
    });
    expect(denied.statusCode).toBe(403);
    await service.close();

    const strict = app(systemActor(), create);
    for (const extra of [
      { include_secrets: false },
      { include_secrets: true },
      { passphrase: "must-not-be-accepted" },
    ]) {
      const invalid = await strict.inject({
        method: "POST",
        url: "/api/v2/backups/programmatic",
        headers: { host: "control.example.org" },
        payload: {
          acknowledgement: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
          ...extra,
        },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.body).not.toContain("must-not-be-accepted");
    }
    await strict.close();
  });

  it("publishes authenticated binary responses in runtime OpenAPI", async () => {
    const application = app(systemActor(), vi.fn(async () => result()));
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    const operation = response.json().paths[
      "/api/v2/backups/programmatic"
    ].post;
    expect(operation).toMatchObject({
      operationId: "backups.create_programmatic",
      security: [{ managementApiKey: [] }],
      "x-permission": "create_portable_backup",
      "x-step-up": "none",
      "x-binary-response-max-bytes": 256 * 1024 * 1024,
    });
    expect(operation.responses["200"].content).toEqual({
      "application/gzip": {
        schema: { type: "string", format: "binary" },
      },
    });
    const interactive = response.json().paths[
      "/api/v2/backups/interactive"
    ].post;
    expect(interactive).toMatchObject({
      security: [{ browserSession: [] }],
      "x-step-up": "always",
      "x-secret-fields": ["/passphrase"],
    });
    await application.close();
  });
});

function app(
  actor: ControlAuthenticationContext,
  create: ReturnType<typeof vi.fn>,
  allowStepUp = true,
) {
  const authenticator: ControlAuthenticator = {
    authenticate: async () => actor,
    verifyCsrf: async () => true,
  };
  const authorization: ControlAuthorizationSeam = {
    authorizeScope: async () => true,
    verifyStepUp: async (
      _context,
      rule,
      _request: FastifyRequest,
      operation,
    ) => allowStepUp
      && rule === "always"
      && operation.routeId === "backups.create_interactive",
    stepUpProof: () => ({ consumed: true }) as never,
  };
  return createControlApplication(config(), {
    authenticator,
    authorization,
    backupCoordinator: { create } as unknown as PortableBackupCoordinator,
  });
}

function result() {
  return {
    archiveId: "018f1f2e-7b3c-7a10-8000-000000000099",
    archive: Buffer.from(ARCHIVE),
    sha256: "a".repeat(64),
    bytes: ARCHIVE.byteLength,
    mode: "credential-less" as const,
    counts: {
      services: 0,
      destinations: 0,
      credentials: 0,
      policies: 0,
      rules: 0,
      secrets: 0,
    },
  };
}

function browserActor(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: USER_ID,
    role: "superadmin",
  };
}

function systemActor(): ControlAuthenticationContext {
  return {
    method: "api_key",
    principalId: API_KEY_ID,
    role: "system",
    apiKey: {
      nickname: "Backup automation",
      lastFour: "wxyz",
    },
  };
}

function browserHeaders() {
  return {
    host: "control.example.org",
    origin: "https://control.example.org",
    "x-csrf-token": "valid-csrf-token-value",
  };
}

function config(): GatewayConfig {
  return {
    version: 1,
    server: { host: "127.0.0.1", port: 8080, mcpPath: "/mcp" },
    control: {
      listen: "127.0.0.1:8081",
      host: "127.0.0.1",
      port: 8081,
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/run/secrets/control-idempotency.key",
    },
    auth: { mode: "static_bearer", staticBearer: { token: "test" } },
    limits: {
      requestBodyBytes: 1024,
      responseBodyBytes: 1024,
      timeoutMs: 1000,
      maxConcurrentRequests: 4,
      maxAuthorizationCodes: 100,
      maxRefreshTokenRecords: 100,
      maxRegisteredClients: 100,
    },
    logging: { level: "silent" },
    services: [],
  };
}
