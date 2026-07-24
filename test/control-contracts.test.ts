import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateConfig } from "../src/config.js";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../src/control/authentication.js";
import {
  ControlContractError,
  ControlCursorCodec,
  controlPaginationQuerySchema,
  formatVersionEtag,
  parseExpectedVersion,
  parseIdempotencyKey,
} from "../src/control/contracts.js";
import { createDefaultControlRouteRegistry } from "../src/control/defaultRoutes.js";
import {
  generateControlOpenApi,
  serializeControlOpenApi,
} from "../src/control/openapi.js";
import { ControlRateLimiter } from "../src/control/rateLimiter.js";
import {
  ControlRouteRegistry,
  type ControlAuthorizationSeam,
  type ControlRouteDefinition,
} from "../src/control/routeRegistry.js";
import { createControlApplication } from "../src/control/server.js";
import type { GatewayConfig } from "../src/types.js";
import { z } from "../src/control/zod.js";

const PRINCIPAL_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const RESOURCE_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

describe("control wire primitives", () => {
  it("parses bounded pagination and rejects malformed or unknown query inputs", () => {
    expect(controlPaginationQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(controlPaginationQuerySchema.parse({ limit: "1" })).toEqual({ limit: 1 });
    expect(controlPaginationQuerySchema.parse({ limit: "200" })).toEqual({ limit: 200 });
    for (const query of [
      { limit: "0" },
      { limit: "201" },
      { limit: "1.5" },
      { limit: "many" },
      { cursor: "not-opaque" },
      { unexpected: "value" },
    ]) {
      expect(() => controlPaginationQuerySchema.parse(query)).toThrow();
    }
  });

  it("formats strong ETags and returns safe missing, malformed, and stale errors", () => {
    expect(formatVersionEtag(7)).toBe("\"7\"");
    expect(parseExpectedVersion("\"7\"", 7)).toBe(7);
    expect(() => formatVersionEtag(0)).toThrow("Version must be positive");
    expectContractError(() => parseExpectedVersion(undefined), 428, "precondition_required");
    expectContractError(() => parseExpectedVersion("W/\"7\""), 400, "invalid_request");
    try {
      parseExpectedVersion("\"7\"", 8);
      throw new Error("Expected stale version");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        code: "stale_version",
        details: { current_version: 8 },
      });
      expect(String(error)).not.toContain("\"7\"");
    }
  });

  it("accepts exact idempotency-key boundaries and rejects unsafe values", () => {
    expect(parseIdempotencyKey("a".repeat(16))).toHaveLength(16);
    expect(parseIdempotencyKey("z".repeat(128))).toHaveLength(128);
    expect(parseIdempotencyKey("sixteen chars ok!")).toBe("sixteen chars ok!");
    for (const value of [
      undefined,
      "a".repeat(15),
      "a".repeat(129),
      " leading-whitespace",
      "trailing-whitespace ",
      "line\nbreak".padEnd(16, "x"),
      ["a".repeat(16)],
    ]) {
      expectContractError(() => parseIdempotencyKey(value), 400, "invalid_request");
    }
  });

  it("round-trips signed bound cursors and rejects tampering, expiry, or scope reuse", () => {
    let now = 1_785_000_000_000;
    const codec = new ControlCursorCodec(Buffer.alloc(32, 4), () => now);
    const binding = {
      routeId: "services.list",
      principalId: PRINCIPAL_ID,
      scopeDigest: DIGEST_A,
      sort: "created_at",
      filterDigest: DIGEST_B,
    };
    const cursor = codec.encode({ ...binding, lastKey: `${now}:${RESOURCE_ID}` });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(codec.decode(cursor, binding)).toEqual({ lastKey: `${now}:${RESOURCE_ID}` });

    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("a") ? "b" : "a"}`;
    expectContractError(() => codec.decode(tampered, binding), 400, "invalid_request");
    expectContractError(
      () => codec.decode(cursor, { ...binding, principalId: RESOURCE_ID }),
      400,
      "invalid_request",
    );
    now += 15 * 60 * 1000;
    expectContractError(() => codec.decode(cursor, binding), 400, "invalid_request");
    expect(() => new ControlCursorCodec(Buffer.alloc(31))).toThrow("32 bytes");
  });

  it("enforces bounded direct-source and principal request windows", () => {
    let now = 1000;
    const limiter = new ControlRateLimiter(() => now);
    for (let count = 0; count < 120; count += 1) {
      expect(limiter.check("management", "127.0.0.1", PRINCIPAL_ID)).toEqual({ allowed: true });
    }
    expect(limiter.check("management", "127.0.0.1", PRINCIPAL_ID)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.check("management", "127.0.0.2", RESOURCE_ID)).toEqual({ allowed: true });
    now += 60_000;
    expect(limiter.check("management", "127.0.0.1", PRINCIPAL_ID)).toEqual({ allowed: true });
    expect(new ControlRateLimiter(() => now, 1).check(
      "management",
      "127.0.0.1",
      PRINCIPAL_ID,
    )).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("uses live rate limits without rewriting an existing window deadline", () => {
    let now = 1_000;
    const settings = {
      management: { attempts: 3, windowMs: 60_000 },
      search: { attempts: 2, windowMs: 30_000 },
    };
    const limiter = new ControlRateLimiter(
      () => now,
      100,
      () => settings,
    );
    expect(limiter.check("management", "127.0.0.1")).toEqual({ allowed: true });
    expect(limiter.check("management", "127.0.0.1")).toEqual({ allowed: true });
    settings.management = { attempts: 2, windowMs: 5 * 60_000 };
    expect(limiter.check("management", "127.0.0.1")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    now += 60_000;
    expect(limiter.check("management", "127.0.0.1")).toEqual({ allowed: true });
    expect(limiter.check("management", "127.0.0.1")).toEqual({ allowed: true });
    expect(limiter.check("management", "127.0.0.1")).toEqual({
      allowed: false,
      retryAfterSeconds: 300,
    });
  });
});

describe("control route registry", () => {
  it("rejects duplicate, incomplete, unsafe, or out-of-prefix route definitions", () => {
    const registry = new ControlRouteRegistry();
    registry.register(publicGet());
    expect(() => registry.register({ ...publicGet(), id: "other" })).toThrow("Duplicate");
    const invalid: ControlRouteDefinition[] = [
      { ...publicGet(), id: "Uppercase" },
      { ...publicGet(), id: "outside", path: "/mcp" },
      { ...publicGet(), id: "public.permission", permission: "manage_global_settings" },
      {
        ...publicGet(),
        id: "protected.missing",
        authentication: ["browser_session"],
      },
      {
        ...publicGet(),
        id: "mutation.audit",
        method: "POST",
        authentication: ["browser_session"],
        permission: "manage_global_settings",
      },
      {
        ...publicGet(),
        id: "secret.body",
        secretFields: ["/password"],
      },
      {
        ...publicGet(),
        id: "read.idempotency",
        idempotency: "required",
      },
    ];
    for (const definition of invalid) {
      expect(() => new ControlRouteRegistry().register(definition)).toThrow(/Invalid control/);
    }
  });

  it("derives API-key authentication only for statically permitted matrix capabilities", () => {
    const registry = new ControlRouteRegistry();
    registry.register({
      ...mutationRoute(vi.fn()),
      id: "test.service_configuration",
      authentication: ["browser_session"],
      permission: "configure_service",
    });
    registry.register({
      ...mutationRoute(vi.fn()),
      id: "test.key_lifecycle",
      path: "/api/v2/test/key-lifecycle/{resource_id}",
      authentication: ["browser_session"],
      permission: "manage_api_keys",
    });
    registry.register({
      ...mutationRoute(vi.fn()),
      id: "test.own_security",
      path: "/api/v2/test/own-security/{resource_id}",
      authentication: ["browser_session"],
      permission: "authenticated",
    });
    expect(registry.definitions().map(({ id, authentication }) => ({
      id,
      authentication,
    }))).toEqual([
      {
        id: "test.service_configuration",
        authentication: ["browser_session", "api_key"],
      },
      {
        id: "test.key_lifecycle",
        authentication: ["browser_session"],
      },
      {
        id: "test.own_security",
        authentication: ["browser_session"],
      },
    ]);
  });

  it("validates closed body/query/params, headers, permissions, and response envelopes", async () => {
    const mutation = vi.fn(async (context) => ({
      data: {
        id: context.params.resource_id,
        name: context.body.name,
        version: context.expectedVersion + 1,
      },
      version: context.expectedVersion + 1,
    }));
    const application = createControlApplication(controlConfig(), {
      authenticator: authenticator("browser_session", "superadmin"),
      authorization: allowAuthorization(),
      registerControlRoutes: (registry) => {
        registry.register(mutationRoute(mutation));
      },
    });
    const headers = {
      host: "control.example.org",
      origin: "https://control.example.org",
      "x-csrf-token": "valid-csrf-proof",
      "if-match": "\"7\"",
      "idempotency-key": "retry-key-0000001",
      "content-type": "application/json",
    };
    const response = await application.inject({
      method: "PATCH",
      url: `/api/v2/test/resources/${RESOURCE_ID}`,
      headers,
      payload: {
        name: "Renamed",
        credential_value: "private-credential-value",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe("\"8\"");
    expect(response.json()).toMatchObject({
      data: { id: RESOURCE_ID, name: "Renamed", version: 8 },
      meta: { api_version: "v2", request_id: expect.stringMatching(/^req_/) },
    });
    expect(response.body).not.toContain("private-credential-value");
    expect(mutation).toHaveBeenCalledTimes(1);

    const rejectedCases = [
      {
        headers,
        payload: {
          name: "Renamed",
          credential_value: "private-credential-value",
          unknown_secret: "must-not-echo",
        },
        status: 400,
      },
      {
        headers: Object.fromEntries(
          Object.entries(headers).filter(([name]) => name !== "if-match"),
        ),
        payload: { name: "Renamed", credential_value: "private-credential-value" },
        status: 428,
      },
      {
        headers: { ...headers, "idempotency-key": "short" },
        payload: { name: "Renamed", credential_value: "private-credential-value" },
        status: 400,
      },
    ];
    for (const testCase of rejectedCases) {
      const rejected = await application.inject({
        method: "PATCH",
        url: `/api/v2/test/resources/${RESOURCE_ID}`,
        headers: testCase.headers,
        payload: testCase.payload,
      });
      expect(rejected.statusCode).toBe(testCase.status);
      expect(rejected.body).not.toContain("private-credential-value");
      expect(rejected.body).not.toContain("must-not-echo");
    }
    expect(mutation).toHaveBeenCalledTimes(1);
    await application.close();
  });

  it("rejects disallowed authentication methods, role denials, and missing step-up", async () => {
    const handler = vi.fn(async () => ({ data: { deleted: false } }));
    for (const [method, role, stepUp, expectedCode] of [
      ["api_key", "superadmin", true, "forbidden"],
      ["browser_session", "user", true, "forbidden"],
      ["browser_session", "superadmin", false, "step_up_required"],
    ] as const) {
      const application = createControlApplication(controlConfig(), {
        authenticator: authenticator(method, role),
        authorization: allowAuthorization(stepUp),
        registerControlRoutes: (registry) => registry.register(stepUpRoute(handler)),
      });
      const response = await application.inject({
        method: "DELETE",
        url: `/api/v2/test/resources/${RESOURCE_ID}`,
        headers: {
          host: "control.example.org",
          origin: "https://control.example.org",
          "x-csrf-token": "valid-csrf-proof",
          "if-match": "\"1\"",
          "idempotency-key": "delete-key-000001",
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe(expectedCode);
      await application.close();
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("permits an explicitly declared API-key role without treating it as human step-up", async () => {
    const handler = vi.fn(async () => ({ data: { accepted: true } }));
    const verifyStepUp = vi.fn(async () => false);
    const application = createControlApplication(controlConfig(), {
      authenticator: authenticator("api_key", "system"),
      authorization: {
        authorizeScope: async () => true,
        verifyStepUp,
      },
      registerControlRoutes: (registry) => registry.register({
        ...stepUpRoute(handler),
        id: "test.user.reset",
        method: "PATCH",
        summary: "Exercise API-key non-step-up contract",
        authentication: ["browser_session", "api_key"],
        permission: "reset_ordinary_user_password",
        schemas: {
          params: mutationRoute(handler).schemas.params,
          response: z.object({ accepted: z.boolean() }).strict(),
        },
        auditAction: "test.user.reset",
      }),
    });
    const response = await application.inject({
      method: "PATCH",
      url: `/api/v2/test/resources/${RESOURCE_ID}`,
      headers: {
        host: "control.example.org",
        "if-match": "\"1\"",
        "idempotency-key": "reset-key-0000001",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ accepted: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(verifyStepUp).not.toHaveBeenCalled();
    await application.close();
  });

  it("returns bounded validation pointers/rules and never echoes rejected values", async () => {
    const application = createControlApplication(controlConfig(), {
      authenticator: authenticator("api_key", "all_services"),
      authorization: allowAuthorization(),
      registerControlRoutes: (registry) => registry.register(listRoute()),
    });
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/test/resources?limit=201&private_query_value=do-not-echo",
      headers: { host: "control.example.org" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "invalid_request",
      details: {
        field: expect.stringMatching(/^\/query/),
        rule: expect.any(String),
      },
    });
    expect(response.body).not.toContain("do-not-echo");
    await application.close();
  });
});

describe("generated control OpenAPI", () => {
  it("is served from the runtime registry and matches the checked release artifact", async () => {
    const registry = createDefaultControlRouteRegistry(undefined, "https://control.example.org");
    const generated = serializeControlOpenApi(
      generateControlOpenApi(registry, "https://control.example.org"),
    );
    expect(generated).toBe(readFileSync("docs/openapi/control-v2.json", "utf8"));
    expect(generated).toContain("\"openapi\": \"3.1.0\"");
    expect(generated).toContain("\"ControlPaginationQuery\"");
    expect(generated).toContain("\"ControlExpectedVersion\"");
    expect(generated).toContain("\"ControlIdempotencyKey\"");
    expect(generated).toContain("\"x-secret-fields\"");
    expect(generated).not.toContain(".internal");
    expect(generated).not.toContain("private-credential-value");

    const application = createControlApplication(controlConfig());
    const response = await application.inject({
      method: "GET",
      url: "/api/v2/openapi.json",
      headers: { host: "control.example.org" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      servers: [{ url: "https://control.example.org" }],
    });
    await application.close();
  });
});

function publicGet(): ControlRouteDefinition {
  return {
    id: "test.public",
    method: "GET",
    path: "/api/v2/test/public",
    summary: "Read a public test contract",
    tags: ["System"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: { response: z.object({ ok: z.boolean() }).strict() },
    rateLimit: "none",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: () => ({ data: { ok: true } }),
  };
}

function mutationRoute(handler: ControlRouteDefinition["handler"]): ControlRouteDefinition {
  return {
    id: "test.resource.update",
    method: "PATCH",
    path: "/api/v2/test/resources/{resource_id}",
    summary: "Exercise mutation contracts",
    tags: ["System"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: z.object({
        resource_id: z.string().regex(/^[0-9a-f-]{36}$/),
      }).strict(),
      body: z.object({
        name: z.string().min(1).max(64),
        credential_value: z.string().min(1).max(256),
      }).strict(),
      response: z.object({
        id: z.string(),
        name: z.string(),
        version: z.number().int().positive(),
      }).strict(),
    },
    rateLimit: "management",
    auditAction: "test.resource.update",
    secretFields: ["/credential_value"],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler,
  };
}

function stepUpRoute(handler: ControlRouteDefinition["handler"]): ControlRouteDefinition {
  return {
    ...mutationRoute(handler),
    id: "test.resource.delete",
    method: "DELETE",
    summary: "Exercise step-up contracts",
    permission: "permanently_delete_service",
    stepUp: "always",
    schemas: {
      params: mutationRoute(handler).schemas.params,
      response: z.object({ deleted: z.boolean() }).strict(),
    },
    auditAction: "test.resource.delete",
    secretFields: [],
  };
}

function listRoute(): ControlRouteDefinition {
  return {
    ...publicGet(),
    id: "test.resource.list",
    path: "/api/v2/test/resources",
    summary: "Exercise pagination contracts",
    authentication: ["api_key"],
    permission: "view_service_configuration",
    schemas: {
      query: controlPaginationQuerySchema,
      response: z.object({
        items: z.array(z.object({ id: z.string() }).strict()),
        next_cursor: z.string().optional(),
      }).strict(),
    },
    rateLimit: "management",
    cache: "no-store",
    handler: () => ({ data: { items: [] } }),
  };
}

function authenticator(
  method: ControlAuthenticationContext["method"],
  role: ControlAuthenticationContext["role"],
): ControlAuthenticator {
  return {
    authenticate: async () => ({ method, role, principalId: PRINCIPAL_ID }),
    verifyCsrf: async (_context, proof) => proof === "valid-csrf-proof",
  };
}

function allowAuthorization(stepUp = true): ControlAuthorizationSeam {
  return {
    authorizeScope: async () => true,
    verifyStepUp: async () => stepUp,
  };
}

function expectContractError(
  operation: () => unknown,
  statusCode: number,
  code: string,
): void {
  try {
    operation();
    throw new Error("Expected contract error");
  } catch (error) {
    expect(error).toBeInstanceOf(ControlContractError);
    expect(error).toMatchObject({ statusCode, code });
  }
}

function controlConfig(): GatewayConfig {
  const directory = mkdtempSync(join(tmpdir(), "secretsauce-control-contract-"));
  const keyFile = join(directory, "idempotency.key");
  writeFileSync(keyFile, `${Buffer.alloc(32, 9).toString("base64url")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  return validateConfig({
    server: {
      listen: "127.0.0.1:8080",
      mcp_path: "/mcp",
      resource: "https://mcp.example.org",
    },
    control: {
      listen: "127.0.0.1:8081",
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
