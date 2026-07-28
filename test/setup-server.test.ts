import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { startSetupOnlyApplication } from "../src/setup/server.js";
import type { GatewayConfig } from "../src/types.js";

describe("setup-only application boundary", () => {
  it("has no ordinary runtime, persistence, authentication, OAuth, or MCP dependency", () => {
    const source = readFileSync("src/setup/server.ts", "utf8");
    expect(source).not.toMatch(
      /GatewayRuntime|PersistenceWorker|authenticateRequest|BuiltinOAuth|handleMcp|vault\/readiness/,
    );
  });

  it("serves only bounded setup surfaces and rejects ordinary work first", async () => {
    const application = await startSetupOnlyApplication(config(), () => ({
      state: "preparing",
      message: "SecretSauce is preparing this installation.",
      retryPending: true,
    }));
    try {
      const controlPort =
        (application.controlServer.address() as AddressInfo).port;
      const gatewayPort =
        (application.gatewayServer.address() as AddressInfo).port;
      await expect(call(controlPort, "GET", "/api/v2/health/live"))
        .resolves.toMatchObject({
          status: 200,
          body: { state: "live" },
        });
      await expect(call(controlPort, "GET", "/api/v2/health/ready"))
        .resolves.toMatchObject({
          status: 503,
          body: { state: "not_ready" },
        });
      await expect(call(controlPort, "GET", "/api/v2/setup/status"))
        .resolves.toMatchObject({
          status: 200,
          body: { state: "preparing", retry_pending: true },
        });

      for (const target of [
        [controlPort, "POST", "/api/v2/auth/login"],
        [controlPort, "GET", "/api/v2/users"],
        [gatewayPort, "GET", "/.well-known/oauth-authorization-server"],
        [gatewayPort, "POST", "/mcp"],
      ] as const) {
        const result = await call(...target, "body-not-read");
        expect(result).toMatchObject({
          status: 503,
          body: {
            error: {
              code: "temporarily_unavailable",
              message: "SecretSauce is temporarily unavailable.",
            },
          },
        });
        expect(result.headers["retry-after"]).toBe("3");
        expect(JSON.stringify(result)).not.toContain("body-not-read");
      }
      await expect(call(
        controlPort,
        "GET",
        "/api/v2/setup/status",
        undefined,
        "attacker.example.org",
      )).resolves.toMatchObject({
        status: 400,
        body: { error: { code: "invalid_request" } },
      });
    } finally {
      await application.close();
    }
  });

  it("rejects method, query, and body variants of exact setup routes", async () => {
    const application = await startSetupOnlyApplication(config(), () => ({
      state: "not_ready",
      message:
        "SecretSauce needs operator attention before setup can continue.",
      retryPending: false,
    }));
    try {
      const port = (application.controlServer.address() as AddressInfo).port;
      for (const input of [
        ["POST", "/api/v2/setup/status", undefined],
        ["GET", "/api/v2/setup/status?detail=true", undefined],
        ["GET", "/api/v2/setup/status", "x"],
      ] as const) {
        await expect(call(port, ...input)).resolves.toMatchObject({
          status: 400,
          body: { error: { code: "invalid_request" } },
        });
      }
    } finally {
      await application.close();
    }
  });
});

function config(): GatewayConfig {
  return {
    server: {
      listen: "127.0.0.1:0",
      host: "127.0.0.1",
      port: 0,
      mcpPath: "/mcp",
      allowInsecureOAuthHttp: false,
    },
    control: {
      listen: "127.0.0.1:0",
      host: "127.0.0.1",
      port: 0,
      publicOrigin: "https://control.example.org",
      publicAuthority: "control.example.org",
      idempotencyHmacKeyFile: "/unused/control.key",
    },
    auth: { mode: "bearer", bearer: { token: "unused", source: "env" } },
    tokens: { idleTtlMs: 1, maxTtlMs: 1 },
    limits: {} as GatewayConfig["limits"],
    logging: { level: "info" },
    audit: { memoryEvents: 1 },
    services: {},
    warnings: [],
    debugDiagnostics: [],
  };
}

function call(
  port: number,
  method: string,
  path: string,
  body?: string,
  host = "control.example.org",
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}> {
  return new Promise((resolve, reject) => {
    const requestValue = request({
      host: "127.0.0.1",
      port,
      method,
      path,
      setHost: false,
      headers: body === undefined
        ? { host }
        : { host, "content-length": Buffer.byteLength(body) },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.once("end", () => {
        const source = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: JSON.parse(source),
        });
      });
    });
    requestValue.once("error", reject);
    if (body !== undefined) requestValue.write(body);
    requestValue.end();
  });
}
