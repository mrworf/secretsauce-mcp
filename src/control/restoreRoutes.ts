import { Buffer } from "node:buffer";
import {
  RestoreStagingError,
  type RestoreStageCoordinator,
} from "../restoreStaging.js";
import type { RestoreStage } from "../restoreState.js";
import { ControlContractError } from "./contracts.js";
import {
  defineControlRoute,
  type ControlRouteRegistry,
} from "./routeRegistry.js";
import { z } from "./zod.js";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const uuid = z.string().uuid();
const archiveBody = z.custom<Buffer>(
  (value) => Buffer.isBuffer(value)
    && value.byteLength >= 1
    && value.byteLength <= MAX_ARCHIVE_BYTES,
).meta({
  id: "PortableRestoreArchive",
  description: "Bounded gzip-compressed portable restore archive.",
});
const stageParams = z.object({ stage_id: uuid }).strict();
const stageSchema = z.object({
  id: uuid,
  archive_id: uuid,
  archive_bytes: z.number().int().min(1).max(MAX_ARCHIVE_BYTES),
  state: z.enum([
    "validated",
    "previewed",
    "committing",
    "completed",
    "failed",
    "expired",
  ]),
  expires_at: z.number().int().nonnegative(),
  completed_at: z.number().int().nonnegative().optional(),
  failure_code: z.string().min(1).max(64).optional(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict().meta({
  id: "RestoreStage",
  description: "Actor-bound restore upload state without a local path or secret material.",
});

export function registerRestoreRoutes(
  registry: ControlRouteRegistry,
  coordinator?: RestoreStageCoordinator,
): void {
  registry.register(defineControlRoute({
    id: "restores.create_stage",
    method: "POST",
    path: "/api/v2/restores/stages",
    summary: "Validate and stage a portable restore archive",
    tags: ["Restores"],
    authentication: ["browser_session"],
    expandApiKeyAuthentication: false,
    permission: "restore",
    stepUp: "five_minutes",
    schemas: {
      body: archiveBody,
      response: stageSchema,
    },
    rateLimit: "management",
    auditAction: "restore.stage",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    binaryRequest: {
      contentType: "application/gzip",
      maxBytes: MAX_ARCHIVE_BYTES,
    },
    successStatuses: [201],
    handler: async ({ authentication, body, request }) => {
      if (coordinator === undefined || authentication === undefined) {
        throw unavailable();
      }
      if (
        request.headers["content-type"] !== "application/gzip"
        || request.headers["content-encoding"] !== undefined
      ) {
        throw new ControlContractError(
          400,
          "invalid_request",
          "The restore archive media type is invalid.",
        );
      }
      try {
        const stage = await coordinator.stage({
          actor: authentication,
          archive: body,
        });
        return { data: wireStage(stage), statusCode: 201 };
      } catch (error) {
        throw mapError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "restores.read_stage",
    method: "GET",
    path: "/api/v2/restores/{stage_id}",
    summary: "Read an actor-bound restore stage",
    tags: ["Restores"],
    authentication: ["browser_session"],
    expandApiKeyAuthentication: false,
    permission: "restore",
    stepUp: "five_minutes",
    schemas: {
      params: stageParams,
      response: stageSchema,
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      if (coordinator === undefined || authentication === undefined) {
        throw unavailable();
      }
      try {
        return {
          data: wireStage(
            await coordinator.status(authentication, params.stage_id),
          ),
        };
      } catch (error) {
        throw mapError(error);
      }
    },
  }));
}

function wireStage(stage: RestoreStage): z.input<typeof stageSchema> {
  return {
    id: stage.id,
    archive_id: stage.archiveId,
    archive_bytes: stage.archiveBytes,
    state: stage.state,
    expires_at: stage.expiresAt,
    ...(stage.completedAt === undefined
      ? {}
      : { completed_at: stage.completedAt }),
    ...(stage.failureCode === undefined
      ? {}
      : { failure_code: stage.failureCode }),
    version: stage.version,
    created_at: stage.createdAt,
    updated_at: stage.updatedAt,
  };
}

function mapError(error: unknown): ControlContractError {
  if (!(error instanceof RestoreStagingError)) return unavailable();
  if (error.code === "invalid") {
    return new ControlContractError(
      400,
      "invalid_request",
      "The restore archive is invalid.",
    );
  }
  if (error.code === "forbidden") {
    return new ControlContractError(
      403,
      "forbidden",
      "The operation is not permitted.",
    );
  }
  if (error.code === "not_found" || error.code === "expired") {
    return new ControlContractError(
      404,
      "not_found",
      "The restore stage was not found.",
    );
  }
  if (error.code === "conflict") {
    return new ControlContractError(
      409,
      "restore_conflict",
      "Another restore archive is already staged.",
    );
  }
  return unavailable();
}

function unavailable(): ControlContractError {
  return new ControlContractError(
    503,
    "vault_unavailable",
    "Restore staging is unavailable.",
  );
}
