import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { GatewayError } from "../src/errors.js";
import { executeServiceRequest } from "../src/gateway.js";
import { TokenBroker, defaultTokenBrokers } from "../src/tokens.js";
import type { AuthContext, GatewayConfig } from "../src/types.js";

describe("HTTP gateway", () => {
  it("substitutes tokens in headers, query, and body after policy allows the request", async () => {
    const downstream = await startDownstream();
    try {
      const config = gatewayConfig(downstream.baseUrl);
      const broker = installBroker(config);
      const auth = actor();
      const issued = broker.issueTokens(auth, {
        service: "demo-service",
        destination: "primary",
        credential_ids: ["api_key"],
        reason: "Call downstream test service.",
      });
      const token = issued.tokens[0]?.token ?? "";

      const response = await executeServiceRequest(config, auth, {
        service: "demo-service",
        destination: "primary",
        method: "POST",
        path: "/api/echo",
        headers: { "X-API-Key": token },
        query: { api_key: token },
        body: { credential: token },
        reason: "Exercise substitution.",
      });

      expect(response.status_code).toBe(200);
      expect(response.tls.verify).toBe(false);
      expect(response.body).not.toContain("demo-secret");
      expect(response.redacted).toBe(true);
      expect(downstream.requests).toHaveLength(1);
      expect(downstream.requests[0]?.headers["x-api-key"]).toBe("demo-secret");
      expect(downstream.requests[0]?.url).toContain("api_key=demo-secret");
      expect(downstream.requests[0]?.body).toContain("demo-secret");
    } finally {
      await downstream.close();
    }
  });

  it("does not send policy-denied requests downstream", async () => {
    const downstream = await startDownstream();
    try {
      const config = gatewayConfig(downstream.baseUrl);
      const broker = installBroker(config);
      const issued = broker.issueTokens(actor(), {
        service: "demo-service",
        destination: "primary",
        credential_ids: ["api_key"],
        reason: "Call downstream test service.",
      });

      await expectGatewayError(() => executeServiceRequest(config, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "GET",
        path: "/api/blocked",
        headers: { "X-API-Key": issued.tokens[0]?.token ?? "" },
        reason: "This should be denied.",
      }), "policy_denied");
      expect(downstream.requests).toHaveLength(0);
    } finally {
      await downstream.close();
    }
  });

  it("rejects unknown and wrong-destination tokens before downstream calls", async () => {
    const downstream = await startDownstream();
    try {
      const config = gatewayConfig(downstream.baseUrl, { includeSecondary: true });
      const broker = installBroker(config);
      const issued = broker.issueTokens(actor(), {
        service: "demo-service",
        destination: "primary",
        credential_ids: ["api_key"],
        reason: "Call downstream test service.",
      });

      await expectGatewayError(() => executeServiceRequest(config, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "GET",
        path: "/api/echo",
        headers: { "X-API-Key": "tok_unknown" },
        reason: "Unknown token.",
      }), "token_invalid");
      await expectGatewayError(() => executeServiceRequest(config, actor(), {
        service: "demo-service",
        destination: "secondary",
        method: "GET",
        path: "/api/echo",
        headers: { "X-API-Key": issued.tokens[0]?.token ?? "" },
        reason: "Wrong destination.",
      }), "token_invalid");
      expect(downstream.requests).toHaveLength(0);
    } finally {
      await downstream.close();
    }
  });

  it("does not follow redirects", async () => {
    const downstream = await startDownstream();
    try {
      const config = gatewayConfig(downstream.baseUrl);
      installBroker(config);

      const response = await executeServiceRequest(config, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "GET",
        path: "/api/redirect",
        reason: "Check redirect handling.",
      });

      expect(response.status_code).toBe(302);
      expect(downstream.requests.map((request) => request.path)).toEqual(["/api/redirect"]);
    } finally {
      await downstream.close();
    }
  });

  it("reports downstream timeouts", async () => {
    const downstream = await startDownstream();
    try {
      const config = gatewayConfig(downstream.baseUrl, { timeout: "10ms" });
      installBroker(config);

      await expectGatewayError(() => executeServiceRequest(config, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "GET",
        path: "/api/slow",
        reason: "Check timeout.",
      }), "downstream_timeout");
    } finally {
      await downstream.close();
    }
  });

  it("rejects oversized requests and truncates oversized responses", async () => {
    const downstream = await startDownstream();
    try {
      const smallRequestConfig = gatewayConfig(downstream.baseUrl, { maxRequestBody: "5b" });
      installBroker(smallRequestConfig);
      await expectGatewayError(() => executeServiceRequest(smallRequestConfig, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "POST",
        path: "/api/echo",
        body: "too large",
        reason: "Check request size.",
      }), "response_too_large");

      const smallResponseConfig = gatewayConfig(downstream.baseUrl, { maxResponseBody: "10b" });
      installBroker(smallResponseConfig);
      const response = await executeServiceRequest(smallResponseConfig, actor(), {
        service: "demo-service",
        destination: "primary",
        method: "GET",
        path: "/api/large",
        reason: "Check response truncation.",
      });

      expect(response.truncated).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    } finally {
      await downstream.close();
    }
  });
});

function gatewayConfig(baseUrl: string, options: {
  includeSecondary?: boolean;
  timeout?: string;
  maxRequestBody?: string;
  maxResponseBody?: string;
} = {}): GatewayConfig {
  const destinations = [
    { name: "primary", base_url: baseUrl, schemes: ["http"], hosts: [{ exact: "127.0.0.1" }] },
  ];
  if (options.includeSecondary) {
    destinations.push({ name: "secondary", base_url: baseUrl, schemes: ["http"], hosts: [{ exact: "127.0.0.1" }] });
  }
  return validateConfig({
    server: { listen: "127.0.0.1:8080", mcp_path: "/mcp" },
    auth: { mode: "bearer", bearer: { token_env: "TEST_GATEWAY_TOKEN" } },
    limits: {
      max_request_body: options.maxRequestBody ?? "1mb",
      max_response_body: options.maxResponseBody ?? "1mb",
      timeout: options.timeout ?? "1s",
    },
    services: {
      "demo-service": {
        type: "http",
        name: "Demo Service",
        destinations,
        tls: { verify: false },
        credentials: [{
          id: "api_key",
          usage: { kind: "header", name: "X-API-Key" },
          source: { kind: "env", name: "DEMO_API_KEY" },
        }],
        access: { users: ["henric@example.com"] },
        policy: {
          mode: "deny",
          rules: [
            { id: "allow-echo", effect: "allow", priority: 100, methods: ["GET", "POST"], paths: ["/api/echo"] },
            { id: "allow-large", effect: "allow", priority: 100, methods: ["GET"], paths: ["/api/large"] },
            { id: "allow-redirect", effect: "allow", priority: 100, methods: ["GET"], paths: ["/api/redirect"] },
            { id: "allow-slow", effect: "allow", priority: 100, methods: ["GET"], paths: ["/api/slow"] },
            { id: "deny-blocked", effect: "deny", priority: 200, methods: ["GET"], paths: ["/api/blocked"] },
          ],
        },
      },
    },
  }, {
    TEST_GATEWAY_TOKEN: "dev-token",
    DEMO_API_KEY: "demo-secret",
  });
}

function installBroker(config: GatewayConfig): TokenBroker {
  const broker = new TokenBroker(config);
  defaultTokenBrokers.set(config, broker);
  return broker;
}

function actor(): AuthContext {
  return { subject: "henric@example.com", scopes: ["gateway.request"], mode: "bearer" };
}

async function expectGatewayError(fn: () => Promise<unknown>, code: GatewayError["code"]) {
  try {
    await fn();
    throw new Error("Expected gateway error");
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).code).toBe(code);
  }
}

async function startDownstream() {
  const requests: Array<{ path: string; url: string; headers: Record<string, string | string[] | undefined>; body: string }> = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({
      path: new URL(request.url ?? "/", "http://127.0.0.1").pathname,
      url: request.url ?? "/",
      headers: request.headers,
      body,
    });
    if (request.url?.startsWith("/api/redirect")) {
      response.writeHead(302, { location: "/api/echo" });
      response.end();
      return;
    }
    if (request.url?.startsWith("/api/slow")) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      response.end("slow");
      return;
    }
    if (request.url?.startsWith("/api/large")) {
      response.end("x".repeat(100));
      return;
    }
    response.writeHead(200, {
      "content-type": "text/plain",
      "x-leaked-secret": "demo-secret",
    });
    response.end(`ok demo-secret ${body}`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
