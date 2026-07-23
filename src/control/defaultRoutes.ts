import { z } from "./zod.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import {
  generateControlOpenApi,
} from "./openapi.js";
import {
  ControlRouteRegistry,
} from "./routeRegistry.js";

const readinessValueSchema = z.enum(["ready", "unavailable", "unsupported"]);
const healthDataSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.object({
    database: readinessValueSchema.optional(),
    schema: readinessValueSchema.optional(),
    administrative_audit: readinessValueSchema.optional(),
  }).strict(),
}).strict().meta({
  id: "ControlHealth",
  description: "Sanitized readiness with stable check names and states.",
});

const openApiDocumentSchema = z.record(z.string(), z.unknown()).meta({
  id: "ControlOpenApiDocument",
  description: "Generated OpenAPI 3.1 document.",
});

export function createDefaultControlRouteRegistry(
  persistence: PersistenceOwner | undefined,
  publicOrigin: string,
): ControlRouteRegistry {
  const registry = new ControlRouteRegistry();
  registry.register({
    id: "control.health",
    method: "GET",
    path: "/api/v2/health",
    summary: "Read sanitized control-plane readiness",
    tags: ["System"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: { response: healthDataSchema },
    rateLimit: "none",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    successStatuses: [200, 503],
    handler: () => {
      const readiness = persistence?.readiness;
      const ready = readiness === undefined || (
        readiness.database === "ready" &&
        readiness.schema === "ready" &&
        readiness.administrativeAudit === "ready"
      );
      return {
        statusCode: ready ? 200 : 503,
        data: {
          status: ready ? "ready" : "not_ready",
          checks: readiness === undefined
            ? {}
            : {
                database: readiness.database,
                schema: readiness.schema,
                administrative_audit: readiness.administrativeAudit,
              },
        },
      };
    },
  });
  registry.register({
    id: "control.openapi",
    method: "GET",
    path: "/api/v2/openapi.json",
    summary: "Read the generated OpenAPI 3.1 contract",
    tags: ["System"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: { response: openApiDocumentSchema },
    rateLimit: "none",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    rawResponse: true,
    handler: () => ({
      data: generateControlOpenApi(registry, publicOrigin),
    }),
  });
  return registry;
}
