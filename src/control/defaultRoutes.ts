import { z } from "./zod.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import {
  generateControlOpenApi,
} from "./openapi.js";
import {
  ControlRouteRegistry,
} from "./routeRegistry.js";
import type { PortableBackupCoordinator } from "../backupCoordinator.js";
import { registerBackupRoutes } from "./backupRoutes.js";
import type { RestoreStageCoordinator } from "../restoreStaging.js";
import type { RestorePreviewCoordinator } from "../restorePreview.js";
import type { RestoreCommitCoordinator } from "../restoreCommit.js";
import { registerRestoreRoutes } from "./restoreRoutes.js";

const readinessValueSchema = z.enum(["ready", "unavailable", "unsupported"]);
const healthDataSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.object({
    database: readinessValueSchema.optional(),
    schema: readinessValueSchema.optional(),
    administrative_audit: readinessValueSchema.optional(),
    vault: readinessValueSchema.optional(),
    identity: readinessValueSchema.optional(),
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
  vaultReadiness?: () => Promise<"ready" | "unavailable" | "unsupported">,
  identityReadiness?: () => Promise<"ready" | "unavailable" | "unsupported">,
  backupCoordinator?: PortableBackupCoordinator,
  restoreStages?: RestoreStageCoordinator,
  restorePreviews?: RestorePreviewCoordinator,
  restoreCommits?: RestoreCommitCoordinator,
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
    handler: async () => {
      const readiness = persistence?.readiness;
      let vault: "ready" | "unavailable" | "unsupported" | undefined;
      let identity: "ready" | "unavailable" | "unsupported" | undefined;
      if (vaultReadiness !== undefined) {
        try {
          vault = await vaultReadiness();
        } catch {
          vault = "unavailable";
        }
      }
      if (identityReadiness !== undefined) {
        try {
          identity = await identityReadiness();
        } catch {
          identity = "unavailable";
        }
      }
      const ready = (readiness === undefined || (
        readiness.database === "ready" &&
        readiness.schema === "ready" &&
        readiness.administrativeAudit === "ready"
      )) &&
        (vault === undefined || vault === "ready") &&
        (identity === undefined || identity === "ready");
      return {
        statusCode: ready ? 200 : 503,
        data: {
          status: ready ? "ready" : "not_ready",
          checks: {
            ...(readiness === undefined ? {} : {
                database: readiness.database,
                schema: readiness.schema,
                administrative_audit: readiness.administrativeAudit,
            }),
            ...(vault === undefined ? {} : { vault }),
            ...(identity === undefined ? {} : { identity }),
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
  registerBackupRoutes(registry, backupCoordinator);
  registerRestoreRoutes(registry, restoreStages, restorePreviews, restoreCommits);
  return registry;
}
