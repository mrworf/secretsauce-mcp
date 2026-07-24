import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import type { ControlAuthorizationSeam } from "../src/control/routeRegistry.js";
import { createControlApplication } from "../src/control/server.js";
import type { RestoreStageCoordinator } from "../src/restoreStaging.js";
import type { GatewayConfig } from "../src/types.js";

const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const STAGE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const ARCHIVE = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);

describe("restore staging HTTP contracts", () => {
  it("accepts only bounded gzip bytes and returns actor-safe stage state", async () => {
    const stage = vi.fn(async () => stageResult());
    const application = app(browserActor(), { stage });
    const response = await application.inject({
      method: "POST",
      url: "/api/v2/restores/stages",
      headers: {
        ...browserHeaders(),
        "content-type": "application/gzip",
      },
      payload: ARCHIVE,
    });
    expect(response.statusCode).toBe(201);
    expect(response.headers).toMatchObject({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    expect(response.json().data).toEqual({
      id: STAGE_ID,
      archive_id: ARCHIVE_ID,
      archive_bytes: ARCHIVE.byteLength,
      state: "validated",
      expires_at: 1_800_003_600_000,
      version: 1,
      created_at: 1_800_000_000_000,
      updated_at: 1_800_000_000_000,
    });
    expect(response.body).not.toContain("storage");
    expect(response.body).not.toContain("sha256");
    expect(stage).toHaveBeenCalledWith({
      actor: browserActor(),
      archive: ARCHIVE,
    });
    await application.close();
  });

  it("serves actor-bound status and maps hidden, conflict, and unavailable failures", async () => {
    const status = vi.fn(async () => stageResult());
    const application = app(browserActor(), { status });
    const response = await application.inject({
      method: "GET",
      url: `/api/v2/restores/${STAGE_ID}`,
      headers: { host: "control.example.org" },
    });
    expect(response.statusCode).toBe(200);
    expect(status).toHaveBeenCalledWith(browserActor(), STAGE_ID);
    await application.close();

    for (const [code, expected] of [
      ["not_found", 404],
      ["expired", 404],
      ["conflict", 409],
      ["unavailable", 503],
    ] as const) {
      const failed = app(browserActor(), {
        status: vi.fn(async () => {
          const { RestoreStagingError } = await import(
            "../src/restoreStaging.js"
          );
          throw new RestoreStagingError(code);
        }),
      });
      const result = await failed.inject({
        method: "GET",
        url: `/api/v2/restores/${STAGE_ID}`,
        headers: { host: "control.example.org" },
      });
      expect(result.statusCode).toBe(expected);
      await failed.close();
    }
  });

  it("requires browser CSRF, superadmin step-up, and the exact media type", async () => {
    const stage = vi.fn(async () => stageResult());
    const noStepUp = app(browserActor(), { stage }, false);
    const denied = await noStepUp.inject({
      method: "POST",
      url: "/api/v2/restores/stages",
      headers: {
        ...browserHeaders(),
        "content-type": "application/gzip",
      },
      payload: ARCHIVE,
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("step_up_required");
    expect(stage).not.toHaveBeenCalled();
    await noStepUp.close();

    const admin = app({ ...browserActor(), role: "admin" }, { stage });
    const forbidden = await admin.inject({
      method: "POST",
      url: "/api/v2/restores/stages",
      headers: {
        ...browserHeaders(),
        "content-type": "application/gzip",
      },
      payload: ARCHIVE,
    });
    expect(forbidden.statusCode).toBe(403);
    await admin.close();

    const wrongType = app(browserActor(), { stage });
    const invalid = await wrongType.inject({
      method: "POST",
      url: "/api/v2/restores/stages",
      headers: browserHeaders(),
      payload: { archive: "not accepted" },
    });
    expect([400, 415]).toContain(invalid.statusCode);
    await wrongType.close();
  });

  it("publishes the binary request bound and browser-only security contract", async () => {
    const application = app(browserActor(), {});
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    const route = response.json().paths["/api/v2/restores/stages"].post;
    expect(route).toMatchObject({
      security: [{ browserSession: [] }],
      "x-permission": "restore",
      "x-step-up": "five_minutes",
      "x-binary-request-max-bytes": 256 * 1024 * 1024,
      requestBody: {
        content: {
          "application/gzip": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
    });
    await application.close();
  });
});

function app(
  actor: ControlAuthenticationContext,
  coordinator: {
    stage?: ReturnType<typeof vi.fn>;
    status?: ReturnType<typeof vi.fn>;
  },
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
      && rule === "five_minutes"
      && operation.routeId.startsWith("restores."),
  };
  return createControlApplication(config(), {
    authenticator,
    authorization,
    restoreStages: coordinator as unknown as RestoreStageCoordinator,
  });
}

function stageResult() {
  return {
    id: STAGE_ID,
    subjectUserId: USER_ID,
    archiveId: ARCHIVE_ID,
    storageKey: "018f1f2e-7b3c-7a10-8000-000000000011",
    archiveSha256: "a".repeat(64),
    archiveBytes: ARCHIVE.byteLength,
    state: "validated" as const,
    expiresAt: 1_800_003_600_000,
    version: 1,
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
  };
}

function browserActor(): ControlAuthenticationContext {
  return {
    method: "browser_session",
    principalId: USER_ID,
    role: "superadmin",
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
