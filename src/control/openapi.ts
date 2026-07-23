import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  controlDataEnvelopeSchema,
  controlErrorEnvelopeSchema,
  controlExpectedVersionHeaderSchema,
  controlIdempotencyKeySchema,
  controlPageMetaSchema,
  controlPaginationQuerySchema,
} from "./contracts.js";
import type { ControlAuthenticationMethod } from "./authentication.js";
import {
  CONTROL_SESSION_COOKIE,
} from "./security.js";
import {
  type ControlRouteDefinition,
  type ControlRouteRegistry,
} from "./routeRegistry.js";

export function generateControlOpenApi(
  routeRegistry: ControlRouteRegistry,
  serverOrigin = "https://control.example.org",
): Record<string, unknown> {
  const registry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", "browserSession", {
    type: "apiKey",
    in: "cookie",
    name: CONTROL_SESSION_COOKIE,
    description: "Opaque Secure HttpOnly browser session cookie. Cookie mutations also require synchronizer CSRF proof.",
  });
  registry.registerComponent("securitySchemes", "managementApiKey", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "SecretSauce management API key",
    description: "System-owned API key with immutable static role and resource scope. It never satisfies human step-up.",
  });
  registry.registerComponent("securitySchemes", "localHostAuthority", {
    type: "mutualTLS",
    description: "Local host or Unix-socket authority. Remote bearer credentials are not accepted.",
  });
  const registeredErrorSchema = registry.register("ControlError", controlErrorEnvelopeSchema);
  registry.register("ControlPaginationQuery", controlPaginationQuerySchema);
  registry.register("ControlPageMeta", controlPageMetaSchema);
  registry.register("ControlExpectedVersion", controlExpectedVersionHeaderSchema);
  registry.register("ControlIdempotencyKey", controlIdempotencyKeySchema);

  for (const route of routeRegistry.definitions()) {
    registerRoute(registry, route, registeredErrorSchema);
  }
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "SecretSauce Control API",
      version: "v2",
      description: "Versioned management API. Secret inputs are body-only, bounded, write-only, and excluded from logs, errors, audit, and later reads.",
    },
    servers: [{ url: serverOrigin }],
    tags: [
      { name: "System", description: "Sanitized control-plane readiness and contracts." },
    ],
  }) as unknown as Record<string, unknown>;
}

export function serializeControlOpenApi(document: Record<string, unknown>): string {
  return `${JSON.stringify(sortValue(document), null, 2)}\n`;
}

function registerRoute(
  registry: OpenAPIRegistry,
  route: ControlRouteDefinition,
  errorSchema: z.ZodType,
): void {
  const responseSchema = route.rawResponse
    ? route.schemas.response
    : controlDataEnvelopeSchema(route.schemas.response);
  const responses: RouteConfig["responses"] = {};
  for (const status of route.successStatuses ?? [200]) {
    responses[status] = {
      description: status === 503 ? "Control plane is not ready." : "Successful response.",
      content: {
        "application/json": { schema: responseSchema },
      },
    };
  }
  for (const [status, description] of commonErrors) {
    responses[status] = {
      description,
      content: {
        "application/json": { schema: errorSchema },
      },
    };
  }
  const headerShape: Record<string, z.ZodType> = {};
  if (route.concurrency === "if-match") {
    headerShape["if-match"] = controlExpectedVersionHeaderSchema;
  }
  if (route.idempotency === "required") {
    headerShape["idempotency-key"] = controlIdempotencyKeySchema;
  }
  registry.registerPath({
    method: route.method.toLowerCase() as Lowercase<ControlRouteDefinition["method"]>,
    path: route.path,
    operationId: route.id,
    summary: route.summary,
    tags: [...route.tags],
    security: route.authentication === "public" ? [] : securityRequirements(route.authentication),
    request: {
      ...(route.schemas.params === undefined ? {} : { params: route.schemas.params }),
      ...(route.schemas.query === undefined ? {} : { query: route.schemas.query }),
      ...(Object.keys(headerShape).length === 0 ? {} : { headers: z.object(headerShape).strict() }),
      ...(route.schemas.body === undefined ? {} : {
        body: {
          required: true,
          content: {
            "application/json": { schema: route.schemas.body },
          },
        },
      }),
    },
    responses,
    "x-authentication-methods": route.authentication === "public" ? ["public"] : [...route.authentication],
    "x-permission": route.permission ?? "public",
    "x-step-up": route.stepUp,
    "x-rate-limit-class": route.rateLimit,
    "x-secret-fields": [...route.secretFields],
    "x-cache-class": route.cache,
    "x-audit-action": route.auditAction ?? "none",
  } as unknown as RouteConfig);
}

function securityRequirements(
  methods: readonly ControlAuthenticationMethod[],
): Array<Record<string, string[]>> {
  const requirements: Array<Record<string, string[]>> = [];
  for (const method of methods) {
    if (method === "browser_session") requirements.push({ browserSession: [] });
    if (method === "api_key") requirements.push({ managementApiKey: [] });
    if (method === "local_cli") requirements.push({ localHostAuthority: [] });
  }
  return requirements;
}

const commonErrors = [
  [400, "Invalid request. Validation details contain only a JSON Pointer and rule."],
  [401, "Authentication is required."],
  [403, "The operation is forbidden or requires human step-up."],
  [404, "The route or an authorized resource was not found."],
  [409, "The resource version or idempotency digest conflicts."],
  [413, "The request body exceeds its bounded limit."],
  [428, "A required expected resource version is missing."],
  [429, "A bounded request rate was exceeded."],
  [500, "The request failed without exposing internal details."],
] as const;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}
