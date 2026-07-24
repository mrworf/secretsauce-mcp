import { Buffer } from "node:buffer";
import {
  RestoreStagingError,
  type RestoreStageCoordinator,
} from "../restoreStaging.js";
import type { RestoreStage } from "../restoreState.js";
import {
  RestorePreviewError,
  type RestorePreviewCoordinator,
} from "../restorePreview.js";
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
const previewBody = z.object({
  passphrase: z.string().superRefine((value, context) => {
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes < 12 || bytes > 1_024) {
      context.addIssue({
        code: "custom",
        message: "Passphrase must be between 12 and 1024 UTF-8 bytes.",
      });
    }
  }).optional(),
}).strict();
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
const restoreCountsSchema = z.object({
  services: z.number().int().nonnegative().max(100_000),
  destinations: z.number().int().nonnegative().max(100_000),
  credentials: z.number().int().nonnegative().max(100_000),
  policies: z.number().int().nonnegative().max(100_000),
  rules: z.number().int().nonnegative().max(100_000),
  available_secrets: z.number().int().nonnegative().max(100_000),
  unavailable_secrets: z.number().int().nonnegative().max(100_000),
  replacements: z.number().int().nonnegative().max(100_000),
  removals: z.number().int().nonnegative().max(100_000),
  revoked_api_keys: z.number().int().nonnegative().max(100_000),
  revoked_sessions: z.number().int().nonnegative().max(100_000),
  revoked_oauth_grants: z.number().int().nonnegative().max(100_000),
  remediations: z.number().int().nonnegative().max(100_000),
}).strict();
const previewSchema = z.object({
  id: uuid,
  stage_id: uuid,
  archive_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  plan_digest: z.string().regex(/^[0-9a-f]{64}$/),
  secret_disposition: z.enum(["configuration_only", "encrypted_secrets"]),
  counts: restoreCountsSchema,
  confirmation_phrase: z.string().min(1).max(128),
  state: z.literal("ready"),
  expires_at: z.number().int().nonnegative(),
  version: z.number().int().positive(),
}).strict().meta({
  id: "RestorePreview",
  description: "Server-derived, actor-bound restore replacement preview.",
});

export function registerRestoreRoutes(
  registry: ControlRouteRegistry,
  coordinator?: RestoreStageCoordinator,
  previews?: RestorePreviewCoordinator,
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

  registry.register(defineControlRoute({
    id: "restores.preview",
    method: "POST",
    path: "/api/v2/restores/{stage_id}/preview",
    summary: "Validate and preview an actor-bound restore",
    tags: ["Restores"],
    authentication: ["browser_session"],
    expandApiKeyAuthentication: false,
    permission: "restore",
    stepUp: "five_minutes",
    schemas: {
      params: stageParams,
      body: previewBody,
      response: previewSchema,
    },
    rateLimit: "management",
    auditAction: "restore.preview",
    secretFields: ["/passphrase"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, body }) => {
      if (previews === undefined || authentication === undefined) {
        throw unavailable();
      }
      const passphraseBytes = body.passphrase === undefined
        ? undefined
        : Buffer.from(body.passphrase, "utf8");
      try {
        const preview = await previews.preview({
          actor: authentication,
          stageId: params.stage_id,
          ...(passphraseBytes === undefined
            ? {}
            : { passphrase: passphraseBytes }),
        });
        return {
          data: {
            id: preview.id,
            stage_id: preview.stageId,
            archive_sha256: preview.archiveSha256,
            plan_digest: preview.planDigest,
            secret_disposition: preview.secretDisposition,
            counts: {
              services: preview.counts.services,
              destinations: preview.counts.destinations,
              credentials: preview.counts.credentials,
              policies: preview.counts.policies,
              rules: preview.counts.rules,
              available_secrets: preview.counts.availableSecrets,
              unavailable_secrets: preview.counts.unavailableSecrets,
              replacements: preview.counts.replacements,
              removals: preview.counts.removals,
              revoked_api_keys: preview.counts.revokedApiKeys,
              revoked_sessions: preview.counts.revokedSessions,
              revoked_oauth_grants: preview.counts.revokedOauthGrants,
              remediations: preview.counts.remediations,
            },
            confirmation_phrase: preview.confirmationPhrase,
            state: "ready" as const,
            expires_at: preview.expiresAt,
            version: preview.version,
          },
        };
      } catch (error) {
        throw mapError(error);
      } finally {
        passphraseBytes?.fill(0);
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
  if (
    !(error instanceof RestoreStagingError)
    && !(error instanceof RestorePreviewError)
  ) return unavailable();
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
