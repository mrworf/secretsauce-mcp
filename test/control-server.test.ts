import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateConfig } from "../src/config.js";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import {
  createControlApplication,
  startControlServer,
} from "../src/control/server.js";
import {
  CONTROL_BODY_LIMIT_BYTES,
  publicControlRoute,
  setControlSessionCookie,
} from "../src/control/security.js";
import { createLogger } from "../src/logger.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { publicRequestIdPattern } from "../src/requestId.js";
import { startServer } from "../src/server.js";
import type { GatewayConfig } from "../src/types.js";

const openApplications: Array<{ close(): Promise<unknown> }> = [];

afterEach(async () => {
  await Promise.allSettled(openApplications.splice(0).map((application) => application.close()));
});

describe("control listener security boundary", () => {
  it("serves sanitized health and browser prefixes with strict default headers", async () => {
    const application = createControlApplication(controlConfig());
    openApplications.push(application);

    const health = await application.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      data: { status: "ready", checks: {} },
      meta: { api_version: "v2", request_id: expect.stringMatching(publicRequestIdPattern) },
    });
    expect(health.headers).toMatchObject({
      "cache-control": "no-store",
      "content-security-policy": expect.stringContaining("frame-ancestors 'none'"),
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "x-request-id": expect.stringMatching(publicRequestIdPattern),
    });
    expect(health.headers["access-control-allow-origin"]).toBeUndefined();

    const browser = await application.inject({
      method: "GET",
      url: "/control/",
      headers: { host: "control.example.org" },
    });
    expect(browser.statusCode).toBe(200);
    expect(browser.headers["content-type"]).toContain("text/html");
    expect(browser.body).toContain('<div id="root"></div>');
    expect(browser.body).toContain("/control/assets/");
  });

  it("rejects untrusted Host and Origin before invoking protected handlers", async () => {
    const handler = vi.fn(async () => ({ ok: true }));
    const authenticator = browserAuthenticator();
    const application = createControlApplication(controlConfig(), {
      authenticator,
      registerRoutes: (scope) => {
        scope.post("/api/v2/test-mutation", handler);
      },
    });
    openApplications.push(application);

    const invalidRequests = [
      { host: "mcp.example.org", origin: "https://control.example.org" },
      { host: "control.example.org", origin: "https://evil.example.org" },
      { host: "control.example.org", origin: "null" },
    ];
    for (const headers of invalidRequests) {
      const response = await application.inject({
        method: "POST",
        url: "/api/v2/test-mutation",
        headers: {
          ...headers,
          "x-csrf-token": "valid-csrf-proof",
          "content-type": "application/json",
        },
        payload: "{}",
      });
      expect([400, 403]).toContain(response.statusCode);
      expect(response.json().error).toMatchObject({
        code: expect.stringMatching(/^(invalid_request|forbidden)$/),
        request_id: expect.stringMatching(publicRequestIdPattern),
      });
    }
    expect(handler).not.toHaveBeenCalled();
    expect(authenticator.authenticate).toHaveBeenCalledTimes(0);
  });

  it("denies non-public routes by default and requires same-origin CSRF for browser mutations", async () => {
    const handler = vi.fn(async () => ({ data: { changed: false } }));
    const authenticator = browserAuthenticator();
    const unauthenticated = createControlApplication(controlConfig(), {
      registerRoutes: (scope) => {
        scope.get("/api/v2/test-protected", handler);
      },
    });
    openApplications.push(unauthenticated);
    const denied = await unauthenticated.inject({
      method: "GET",
      url: "/api/v2/test-protected",
      headers: { host: "control.example.org" },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json().error.code).toBe("unauthenticated");
    expect(handler).not.toHaveBeenCalled();

    const authenticated = createControlApplication(controlConfig(), {
      authenticator,
      registerRoutes: (scope) => {
        scope.post("/api/v2/test-mutation", handler);
      },
    });
    openApplications.push(authenticated);
    for (const headers of [
      { host: "control.example.org" },
      { host: "control.example.org", origin: "https://control.example.org" },
      {
        host: "control.example.org",
        origin: "https://control.example.org",
        "x-csrf-token": "invalid-csrf-proof",
      },
    ]) {
      const response = await authenticated.inject({
        method: "POST",
        url: "/api/v2/test-mutation",
        headers,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({
        code: "forbidden",
        message: "CSRF validation failed.",
      });
    }
    const accepted = await authenticated.inject({
      method: "POST",
      url: "/api/v2/test-mutation",
      headers: {
        host: "control.example.org",
        origin: "https://control.example.org",
        "x-csrf-token": "valid-csrf-proof",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(authenticator.verifyCsrf).toHaveBeenCalledTimes(2);
  });

  it("enforces the hard body boundary and maps malformed JSON without echoing it", async () => {
    const handler = vi.fn(async () => ({ data: { accepted: true } }));
    const application = createControlApplication(controlConfig(), {
      authenticator: apiKeyAuthenticator(),
      registerRoutes: (scope) => {
        scope.post("/api/v2/test-body", handler);
      },
    });
    openApplications.push(application);
    const prefix = "{\"value\":\"";
    const suffix = "\"}";
    const exact = `${prefix}${"a".repeat(CONTROL_BODY_LIMIT_BYTES - prefix.length - suffix.length)}${suffix}`;
    expect(Buffer.byteLength(exact)).toBe(CONTROL_BODY_LIMIT_BYTES);

    const accepted = await application.inject({
      method: "POST",
      url: "/api/v2/test-body",
      headers: {
        host: "control.example.org",
        "content-type": "application/json",
      },
      payload: exact,
    });
    expect(accepted.statusCode).toBe(200);

    const oversized = await application.inject({
      method: "POST",
      url: "/api/v2/test-body",
      headers: {
        host: "control.example.org",
        "content-type": "application/json",
      },
      payload: `${exact} `,
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json().error.code).toBe("invalid_request");

    const malformedValue = "do-not-echo";
    const malformed = await application.inject({
      method: "POST",
      url: "/api/v2/test-body",
      headers: {
        host: "control.example.org",
        "content-type": "application/json",
      },
      payload: `{"value":"${malformedValue}"`,
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).not.toContain(malformedValue);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("provides only a Secure HttpOnly host cookie and never logs headers, queries, or bodies", async () => {
    const lines: string[] = [];
    const config = controlConfig();
    const application = createControlApplication(config, {
      logger: createLogger({ level: "info" }, (line) => lines.push(line)),
      authenticator: apiKeyAuthenticator(),
      registerRoutes: (scope) => {
        scope.get("/api/v2/test-cookie", {
          config: publicControlRoute(),
        }, async (_request, reply) => {
          setControlSessionCookie(reply, "opaque-cookie-value", 900);
          return { data: { issued: true } };
        });
        scope.post("/api/v2/test-log", async () => ({ data: { accepted: true } }));
      },
    });
    openApplications.push(application);

    const cookie = await application.inject({
      method: "GET",
      url: "/api/v2/test-cookie",
      headers: { host: "control.example.org" },
    });
    expect(cookie.headers["set-cookie"]).toContain(
      "__Host-secretsauce_session=opaque-cookie-value; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Strict",
    );
    await application.inject({
      method: "POST",
      url: "/api/v2/test-log?secret=private-query-value",
      headers: {
        host: "control.example.org",
        authorization: "Bearer private-authorization-value",
        cookie: "private-cookie-value",
        "content-type": "application/json",
      },
      payload: { password: "private-body-value" },
    });

    const serialized = lines.join("\n");
    expect(serialized).toContain("/api/v2/test-log");
    for (const prohibited of [
      "private-query-value",
      "private-authorization-value",
      "private-cookie-value",
      "private-body-value",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });

  it("reports persistence degradation with stable health fields only", async () => {
    const application = createControlApplication(controlConfig(), {
      persistence: {
        readiness: {
          database: "unavailable",
          schema: "unsupported",
          administrativeAudit: "unavailable",
        },
        execute: async () => {
          throw new Error("not used");
        },
        close: async () => undefined,
      },
    });
    openApplications.push(application);
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().data).toEqual({
      status: "not_ready",
      checks: {
        database: "unavailable",
        schema: "unsupported",
        administrative_audit: "unavailable",
      },
    });
    expect(response.body).not.toContain(configDatabaseFile);
  });

  it("reports only the sanitized vault readiness seam and fails closed on seam errors", async () => {
    const ready = createControlApplication(controlConfig(), {
      vaultReadiness: async () => "ready",
    });
    openApplications.push(ready);
    const readyResponse = await ready.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json().data).toEqual({
      status: "ready",
      checks: { vault: "ready" },
    });

    const unavailable = createControlApplication(controlConfig(), {
      vaultReadiness: async () => {
        throw new Error("private socket path and key details");
      },
    });
    openApplications.push(unavailable);
    const unavailableResponse = await unavailable.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json().data).toEqual({
      status: "not_ready",
      checks: { vault: "unavailable" },
    });
    expect(unavailableResponse.body).not.toContain("private socket path");
  });

  it("reports configured identity readiness and sanitizes seam failures", async () => {
    const config = controlConfig();
    const ready = createControlApplication(config, {
      identityReadiness: async () => "ready",
    });
    const readyResponse = await ready.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toMatchObject({
      data: { status: "ready", checks: { identity: "ready" } },
    });
    await ready.close();

    const unavailable = createControlApplication(config, {
      identityReadiness: async () => {
        throw new Error("identity-key-value-and-path");
      },
    });
    const unavailableResponse = await unavailable.inject({
      method: "GET",
      url: "/api/v2/health",
      headers: { host: "control.example.org" },
    });
    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toMatchObject({
      data: { status: "not_ready", checks: { identity: "unavailable" } },
    });
    expect(unavailableResponse.body).not.toContain("identity-key-value-and-path");
    await unavailable.close();
  });
});

describe("control and data listener integration", () => {
  it("runs both real listeners without route confusion", async () => {
    const dataPort = await unusedPort();
    const controlPort = await unusedPort();
    const dataConfig = gatewayConfig(dataPort);
    const control = controlConfig(controlPort, dataPort);
    const dataApplication = await startServer(dataConfig);
    const controlApplication = await startControlServer(control);
    openApplications.push(dataApplication, controlApplication);

    const dataControlRoute = await request(dataPort, "/api/v2/health", "127.0.0.1");
    expect(dataControlRoute.statusCode).toBe(404);
    const controlMcpRoute = await request(controlPort, "/mcp", "control.example.org");
    expect(controlMcpRoute.statusCode).toBe(401);
    expect(JSON.parse(controlMcpRoute.body).error.code).toBe("unauthenticated");
    const health = await request(controlPort, "/api/v2/health", "control.example.org");
    expect(health.statusCode).toBe(200);
  });

  it("releases persistence ownership after partial listener startup failure", async () => {
    const port = await unusedPort();
    const blocker = createNetServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(port, "127.0.0.1", resolve);
    });
    const config = controlConfig(port);
    await expect(startControlServer(config)).rejects.toBeDefined();
    await new Promise<void>((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()));

    const replacement = PersistenceWorker.open({
      databaseFile: config.persistence!.databaseFile,
      productVersion: "test",
    });
    await replacement.close();
  });

  it("restarts cleanly with the persisted production schema and built shell", async () => {
    const port = await unusedPort();
    const config = controlConfig(port);
    const first = await startControlServer(config);
    expect(await first.persistence.execute({
      run: (database) => database.schemaVersion,
    })).toBe(15);
    await first.close();

    const restarted = await startControlServer(config);
    openApplications.push(restarted);
    expect(await restarted.persistence.execute({
      run: (database) => database.schemaVersion,
    })).toBe(15);
    const health = await request(port, "/api/v2/health", "control.example.org");
    expect(health.statusCode).toBe(200);
    const shell = await request(port, "/control/services", "control.example.org");
    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain('<div id="root"></div>');
  });
});

const configDatabaseFile = "/not/a/real/control.sqlite";

function controlConfig(
  controlPort = 8081,
  dataPort = 8080,
): GatewayConfig {
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-control-test-"));
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  return validateConfig({
    server: {
      listen: `127.0.0.1:${dataPort}`,
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: `127.0.0.1:${controlPort}`,
      public_origin: "https://control.example.org",
      idempotency_hmac_key_file: keyFile,
    },
    persistence: {
      database_file: join(directory, "control.sqlite"),
    },
    auth: {
      mode: "bearer",
      bearer: { token_env: "TEST_GATEWAY_TOKEN" },
    },
    services: {
      demo: {
        type: "http",
        name: "Demo",
        no_auth: true,
        destinations: [{ name: "primary", base_url: "https://api.example.org" }],
      },
    },
  }, { TEST_GATEWAY_TOKEN: "data-plane-test-token" });
}

function gatewayConfig(port: number): GatewayConfig {
  const config = controlConfig(port + 1, port);
  return {
    ...config,
    control: undefined,
    persistence: undefined,
  };
}

function browserAuthenticator(): ControlAuthenticator & {
  authenticate: ReturnType<typeof vi.fn>;
  verifyCsrf: ReturnType<typeof vi.fn>;
} {
  const context: ControlAuthenticationContext = {
    method: "browser_session",
    principalId: "018f1f2e-7b3c-7a10-8000-000000000001",
    role: "superadmin",
  };
  return {
    authenticate: vi.fn(async () => context),
    verifyCsrf: vi.fn(async (_context, proof) => proof === "valid-csrf-proof"),
  };
}

function apiKeyAuthenticator(): ControlAuthenticator {
  return {
    authenticate: async () => ({
      method: "api_key",
      principalId: "018f1f2e-7b3c-7a10-8000-000000000002",
      role: "system",
    }),
    verifyCsrf: async () => false,
  };
}

async function unusedPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function request(
  port: number,
  path: string,
  host: string,
): Promise<{ statusCode: number; body: string }> {
  const { request: httpRequest } = await import("node:http");
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: { host },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.once("error", reject);
    request.end();
  });
}
