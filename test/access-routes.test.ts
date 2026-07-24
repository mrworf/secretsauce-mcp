import { afterEach, describe, expect, it } from "vitest";
import {
  AccessManagementError,
  type AccessManagementRepository,
} from "../src/accessManagement.js";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import { ControlIdempotencyHasher } from "../src/control/idempotency.js";
import { createControlApplication } from "../src/control/server.js";
import type { BrowserSessionAuthenticator } from "../src/identity/browserSessions.js";
import type { GatewayConfig } from "../src/types.js";

const USER = "018f1f2e-7b3c-7a10-8000-000000000401";
const SESSION = "018f1f2e-7b3c-7a10-8000-000000000402";
const GRANT = "018f1f2e-7b3c-7a10-8000-000000000403";
const CLIENT = "018f1f2e-7b3c-7a10-8000-000000000404";
const SERVICE = "018f1f2e-7b3c-7a10-8000-000000000405";
const applications: ReturnType<typeof createControlApplication>[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((application) => application.close()));
});

describe("access management HTTP contracts", () => {
  it("serves strict no-store own lists and clears the current revoked session cookie", async () => {
    const fixture = setup();
    const sessions = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/access/sessions?limit=1",
      headers: requestHeaders(),
    });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.headers["cache-control"]).toBe("no-store");
    expect(sessions.json().data.items).toEqual([
      expect.objectContaining({ id: SESSION, current: true, status: "active" }),
    ]);

    const grants = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/access/grants",
      headers: requestHeaders(),
    });
    expect(grants.statusCode).toBe(200);
    expect(grants.json().data.items[0]).toMatchObject({
      id: GRANT,
      oauth_grant_status: "active",
      services: ["Payments API"],
    });
    expect(JSON.stringify(grants.json())).not.toMatch(
      /token_hash|refresh_token|session_hash|credential_value/i,
    );

    const revoked = await fixture.application.inject({
      method: "DELETE",
      url: `/api/v2/access/sessions/${SESSION}`,
      headers: mutationHeaders(),
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().data).toMatchObject({
      target_id: SESSION,
      revoked: true,
      sessions_revoked: 1,
    });
    expect(revoked.headers["set-cookie"]).toContain(
      "__Host-secretsauce_session=",
    );
    expect(revoked.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("rejects broad or malformed access and documents every access boundary", async () => {
    const fixture = setup();
    const global = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/security/oauth-grants",
      headers: requestHeaders(),
    });
    expect(global.statusCode).toBe(403);
    const malformed = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/access/grants?unexpected=true",
      headers: requestHeaders(),
    });
    expect(malformed.statusCode).toBe(400);
    const bulkWithoutStepUp = await fixture.application.inject({
      method: "POST",
      url: "/api/v2/security/oauth-grants/revoke",
      headers: mutationHeaders({ "idempotency-key": "bulk-revoke-key-0001" }),
      payload: {
        target: { kind: "all" },
        confirmation: "REVOKE ALL OAUTH GRANTS",
        justification: "Exercise the guarded contract.",
      },
    });
    expect(bulkWithoutStepUp.statusCode).toBe(403);
    expect(bulkWithoutStepUp.json().error.code).toBe("step_up_required");

    const openapi = await fixture.application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: requestHeaders(),
    });
    const document = openapi.json();
    for (const path of [
      "/api/v2/access/sessions",
      "/api/v2/access/sessions/{session_id}",
      "/api/v2/access/grants",
      "/api/v2/access/grants/{grant_id}",
      "/api/v2/security/sessions",
      "/api/v2/security/oauth-grants",
      "/api/v2/security/oauth-grants/revoke",
      "/api/v2/services/{service_id}/access",
      "/api/v2/services/{service_id}/capabilities/invalidate",
    ]) expect(document.paths).toHaveProperty(path);
  });
});

function setup() {
  const actor = {
    value: {
      method: "browser_session",
      principalId: USER,
      role: "user",
    } satisfies ControlAuthenticationContext,
  };
  const authenticator: ControlAuthenticator = {
    authenticate: async () => actor.value,
    verifyCsrf: async () => true,
  };
  const repository = {
    sessionsPage: async (input: {
      scope: "own" | "global";
      currentSessionId?: string;
    }) => {
      if (input.scope === "global") throw new AccessManagementError("forbidden");
      return {
        items: [{
          id: SESSION,
          userId: USER,
          userLabel: "Example User (user@example.org)",
          role: "user" as const,
          current: input.currentSessionId === SESSION,
          issuedAt: 1,
          lastUsedAt: 2,
          expiresAt: 3,
          status: "active" as const,
        }],
      };
    },
    grantsPage: async (input: { scope: "own" | "global" }) => {
      if (input.scope === "global") throw new AccessManagementError("forbidden");
      return {
        items: [{
          id: GRANT,
          userId: USER,
          userLabel: "Example User (user@example.org)",
          clientId: CLIENT,
          clientIdentifier: "https://client.example.org/metadata.json",
          clientName: "Example MCP Client",
          resource: "https://mcp.example.org",
          scopes: ["gateway.read"],
          authenticationMethod: "local_password_totp" as const,
          issuedAt: 1,
          lastUsedAt: 2,
          expiresAt: 3,
          status: "active" as const,
          usable: true,
          services: ["Payments API"],
        }],
      };
    },
    revokeSession: async () => ({
      targetId: SESSION,
      revoked: true,
      sessionsRevoked: 1,
      grantsRevoked: 0,
    }),
  } as unknown as AccessManagementRepository;
  const browserSessions = {
    session: () => ({
      sessionId: SESSION,
      userId: USER,
      role: "user",
      csrfHash: "a".repeat(64),
      issuedAt: 1,
      absoluteExpiresAt: 3,
      context: actor.value,
    }),
  } as unknown as BrowserSessionAuthenticator;
  const application = createControlApplication(controlConfig(), {
    authenticator,
    authorization: {
      authorizeScope: async () => true,
      verifyStepUp: async () => false,
    },
    accessManagement: {
      repository,
      browserSessions,
      idempotency: new ControlIdempotencyHasher(Buffer.alloc(32, 41)),
      now: () => 1_785_000_000_000,
    },
  });
  applications.push(application);
  return { application, actor };
}

function requestHeaders() {
  return { host: "control.example.org" };
}

function mutationHeaders(extra: Record<string, string> = {}) {
  return {
    host: "control.example.org",
    origin: "https://control.example.org",
    "x-csrf-token": "x".repeat(43),
    ...extra,
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
