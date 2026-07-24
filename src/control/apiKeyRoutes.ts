import {
  ALL_SERVICES_KEY_CONFIRMATION,
  ApiKeyCursorCodec,
  ApiKeyError,
  type ApiKeyRepository,
  type ApiKeyService,
  type ApiKeyView,
} from "../apiKeys.js";
import type { ControlAuthenticationContext } from "./authentication.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const uuid = z.string().uuid();
const apiRole = z.enum(["service", "all_services", "system"]);
const status = z.enum(["active", "expired", "revoked"]);
const keyParams = z.object({ api_key_id: uuid }).strict();
const justification = z.string().min(1).max(512)
  .refine((value) => value === value.trim() && !/[\0\r\n]/.test(value));
const keySchema = z.object({
  id: uuid,
  key_prefix: z.string().regex(/^ssk_v1_[A-Za-z0-9_-]{16}$/),
  nickname: z.string().min(1).max(512),
  last_four: z.string().regex(/^[A-Za-z0-9_-]{4}$/),
  api_role: apiRole,
  service_id: uuid.optional(),
  expiration_policy: z.enum(["forever", "timestamp"]),
  expires_at: z.number().int().nonnegative().optional(),
  status,
  creator_id: uuid,
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  last_used_at: z.number().int().nonnegative().optional(),
  revoked_at: z.number().int().nonnegative().optional(),
}).strict();
const oneTimeKeySchema = z.object({
  api_key: keySchema,
  one_time_key: z.string().regex(/^ssk_v1_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/),
  one_time_value_displayed: z.literal(true),
}).strict();
const listQuery = z.object({
  limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
  cursor: z.string().max(2_048).optional(),
  q: z.string().min(1).max(512).optional(),
  role: apiRole.optional(),
  status: status.optional(),
  service_id: uuid.optional(),
}).strict();
const activitySchema = z.object({
  id: uuid,
  api_key_id: uuid,
  nickname: z.string().min(1).max(512),
  last_four: z.string().regex(/^[A-Za-z0-9_-]{4}$/),
  api_role: apiRole,
  service_id: uuid.optional(),
  action: z.string().min(1).max(128),
  outcome: z.enum(["allow", "deny", "error"]),
  target_type: z.string().min(1).max(128),
  target_id: uuid.optional(),
  request_id: z.string().min(1).max(128),
  failure_code: z.string().min(1).max(128).optional(),
  occurred_at: z.number().int().nonnegative(),
}).strict();

export interface ApiKeyRouteDependencies {
  repository: ApiKeyRepository;
  service: ApiKeyService;
  cursors: ApiKeyCursorCodec;
}

export function registerApiKeyRoutes(
  registry: ControlRouteRegistry,
  dependencies: ApiKeyRouteDependencies,
): void {
  registry.register(defineControlRoute({
    id: "api_keys.list",
    method: "GET",
    path: "/api/v2/api-keys",
    summary: "List visible API key metadata",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: {
      query: listQuery,
      response: z.object({
        api_keys: z.array(keySchema).max(100),
        next_cursor: z.string().max(2_048).optional(),
      }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => run(async () => {
      const actor = browserActor(authentication!);
      const filter = JSON.stringify({
        q: query.q ?? null,
        role: query.role ?? null,
        status: query.status ?? null,
        service_id: query.service_id ?? null,
      });
      const binding = {
        kind: "list" as const,
        actorId: actor.principalId,
        actorRole: actor.role,
        filter,
      };
      const last = query.cursor === undefined
        ? undefined
        : dependencies.cursors.decode(query.cursor, binding);
      const page = await dependencies.repository.list({
        actor,
        limit: query.limit === undefined ? 50 : Number(query.limit),
        ...(query.q === undefined ? {} : { q: query.q }),
        ...(query.role === undefined ? {} : { role: query.role }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.service_id === undefined ? {} : { serviceId: query.service_id }),
        ...(last === undefined ? {} : { lastCreatedAt: last.time, lastId: last.id }),
      });
      return {
        data: {
          api_keys: page.apiKeys.map(wireKey),
          ...(page.last === undefined
            ? {}
            : {
                next_cursor: dependencies.cursors.encode(binding, {
                  time: page.last.createdAt,
                  id: page.last.id,
                }),
              }),
        },
      };
    }),
  }));

  registry.register(defineControlRoute({
    id: "api_keys.create",
    method: "POST",
    path: "/api/v2/api-keys",
    summary: "Create an API key and display its raw value once",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: {
      body: z.object({
        nickname: z.string().min(1).max(512),
        api_role: apiRole,
        service_id: uuid.optional(),
        expiration: z.discriminatedUnion("policy", [
          z.object({ policy: z.literal("forever") }).strict(),
          z.object({
            policy: z.literal("days"),
            days: z.number().int().min(1).max(3_650),
          }).strict(),
        ]),
        all_services_confirmation: z.string().max(
          ALL_SERVICES_KEY_CONFIRMATION.length,
        ).optional(),
      }).strict(),
      response: oneTimeKeySchema,
    },
    rateLimit: "management",
    auditAction: "api_keys.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    successStatuses: [201],
    handler: async ({ authentication, body, requestId }) => run(async () => {
      const result = await dependencies.service.create(
        browserActor(authentication!),
        {
          nickname: body.nickname,
          apiRole: body.api_role,
          ...(body.service_id === undefined ? {} : { serviceId: body.service_id }),
          expiration: body.expiration,
          ...(body.all_services_confirmation === undefined
            ? {}
            : { allServicesConfirmation: body.all_services_confirmation }),
        },
        requestId,
      );
      return {
        statusCode: 201,
        data: {
          api_key: wireKey(result.apiKey),
          one_time_key: result.oneTimeKey,
          one_time_value_displayed: true as const,
        },
        version: result.apiKey.version,
      };
    }),
  }));

  registry.register(defineControlRoute({
    id: "api_keys.detail",
    method: "GET",
    path: "/api/v2/api-keys/{api_key_id}",
    summary: "Read API key metadata",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: { params: keyParams, response: keySchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => run(async () => {
      const key = await dependencies.repository.metadata(
        params.api_key_id,
        browserActor(authentication!),
      );
      return { data: wireKey(key), version: key.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "api_keys.update",
    method: "PATCH",
    path: "/api/v2/api-keys/{api_key_id}",
    summary: "Rename an API key or shorten finite expiry",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: {
      params: keyParams,
      body: z.object({
        nickname: z.string().min(1).max(512).optional(),
        expires_at: z.number().int().nonnegative().optional(),
      }).strict().refine((body) => Object.keys(body).length > 0),
      response: keySchema,
    },
    rateLimit: "management",
    auditAction: "api_keys.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      requestId,
    }) => run(async () => {
      const key = await dependencies.repository.update({
        actor: browserActor(authentication!),
        id: params.api_key_id,
        expectedVersion: expectedVersion!,
        ...(body.nickname === undefined ? {} : { nickname: body.nickname }),
        ...(body.expires_at === undefined ? {} : { expiresAt: body.expires_at }),
        correlationId: requestId,
      });
      return { data: wireKey(key), version: key.version };
    }),
  }));

  registerKeyMutation(registry, dependencies, "revoke");
  registerKeyMutation(registry, dependencies, "rotate");

  registry.register(defineControlRoute({
    id: "api_keys.activity",
    method: "GET",
    path: "/api/v2/api-keys/{api_key_id}/activity",
    summary: "List safe API key activity metadata",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: {
      params: keyParams,
      query: z.object({
        limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
        cursor: z.string().max(2_048).optional(),
      }).strict(),
      response: z.object({
        activity: z.array(activitySchema).max(100),
        next_cursor: z.string().max(2_048).optional(),
      }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, query }) => run(async () => {
      const actor = browserActor(authentication!);
      const binding = {
        kind: "activity" as const,
        actorId: actor.principalId,
        actorRole: actor.role,
        filter: "",
        resourceId: params.api_key_id,
      };
      const last = query.cursor === undefined
        ? undefined
        : dependencies.cursors.decode(query.cursor, binding);
      const page = await dependencies.repository.activity({
        actor,
        id: params.api_key_id,
        limit: query.limit === undefined ? 50 : Number(query.limit),
        ...(last === undefined ? {} : { beforeOccurredAt: last.time, beforeId: last.id }),
      });
      return {
        data: {
          activity: page.activity.map((entry) => ({
            id: entry.id,
            api_key_id: entry.apiKeyId,
            nickname: entry.nickname,
            last_four: entry.lastFour,
            api_role: entry.apiRole,
            ...(entry.serviceId === undefined ? {} : { service_id: entry.serviceId }),
            action: entry.action,
            outcome: entry.outcome,
            target_type: entry.targetType,
            ...(entry.targetId === undefined ? {} : { target_id: entry.targetId }),
            request_id: entry.requestId,
            ...(entry.failureCode === undefined ? {} : { failure_code: entry.failureCode }),
            occurred_at: entry.occurredAt,
          })),
          ...(page.last === undefined
            ? {}
            : {
                next_cursor: dependencies.cursors.encode(binding, {
                  time: page.last.occurredAt,
                  id: page.last.id,
                }),
              }),
        },
      };
    }),
  }));
}

function registerKeyMutation(
  registry: ControlRouteRegistry,
  dependencies: ApiKeyRouteDependencies,
  operation: "revoke" | "rotate",
): void {
  registry.register(defineControlRoute({
    id: `api_keys.${operation}`,
    method: "POST",
    path: `/api/v2/api-keys/{api_key_id}/${operation}`,
    summary: operation === "revoke"
      ? "Revoke an API key"
      : "Rotate an API key and display the replacement once",
    tags: ["API keys"],
    authentication: ["browser_session"],
    permission: "manage_api_keys",
    stepUp: "five_minutes",
    schemas: {
      params: keyParams,
      body: z.object({ justification }).strict(),
      response: operation === "revoke"
        ? z.object({
            api_key: keySchema,
            changed: z.boolean(),
          }).strict()
        : oneTimeKeySchema,
    },
    rateLimit: "management",
    auditAction: `api_keys.${operation}`,
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    ...(operation === "rotate" ? { successStatuses: [201] } : {}),
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      requestId,
    }) => run(async () => {
      const actor = browserActor(authentication!);
      if (operation === "revoke") {
        const result = await dependencies.repository.revoke({
          actor,
          id: params.api_key_id,
          expectedVersion: expectedVersion!,
          justification: body.justification,
          correlationId: requestId,
        });
        return {
          data: { api_key: wireKey(result.apiKey), changed: result.changed },
          version: result.apiKey.version,
        };
      }
      const result = await dependencies.service.rotate(actor, {
        id: params.api_key_id,
        expectedVersion: expectedVersion!,
        justification: body.justification,
      }, requestId);
      return {
        statusCode: 201,
        data: {
          api_key: wireKey(result.apiKey),
          one_time_key: result.oneTimeKey,
          one_time_value_displayed: true as const,
        },
        version: result.apiKey.version,
      };
    }),
  }));
}

function browserActor(
  actor: ControlAuthenticationContext,
): ControlAuthenticationContext & { role: "admin" | "superadmin" } {
  if (
    actor.method !== "browser_session" ||
    (actor.role !== "admin" && actor.role !== "superadmin")
  ) throw new ApiKeyError("forbidden");
  return actor as ControlAuthenticationContext & { role: "admin" | "superadmin" };
}

function wireKey(key: ApiKeyView) {
  return {
    id: key.id,
    key_prefix: key.keyPrefix,
    nickname: key.nickname,
    last_four: key.lastFour,
    api_role: key.apiRole,
    ...(key.serviceId === undefined ? {} : { service_id: key.serviceId }),
    expiration_policy: key.expirationPolicy,
    ...(key.expiresAt === undefined ? {} : { expires_at: key.expiresAt }),
    status: key.status,
    creator_id: key.creatorId,
    version: key.version,
    created_at: key.createdAt,
    updated_at: key.updatedAt,
    ...(key.lastUsedAt === undefined ? {} : { last_used_at: key.lastUsedAt }),
    ...(key.revokedAt === undefined ? {} : { revoked_at: key.revokedAt }),
  };
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ApiKeyError)) {
      throw new ControlContractError(
        503,
        "maintenance",
        "API key management is temporarily unavailable.",
      );
    }
    if (error.code === "invalid_request") {
      throw new ControlContractError(400, "validation_failed", "API key input is invalid.");
    }
    if (error.code === "forbidden") {
      throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
    if (error.code === "not_found") {
      throw new ControlContractError(404, "not_found", "API key not found.");
    }
    if (error.code === "stale") {
      throw new ControlContractError(409, "stale_version", "The API key changed. Refresh and retry.");
    }
    if (error.code === "conflict") {
      throw new ControlContractError(409, "conflict", "The API key operation conflicts with its state.");
    }
    if (error.code === "rate_limited") {
      throw new ControlContractError(429, "rate_limited", "Request rate limit exceeded.");
    }
    throw new ControlContractError(
      503,
      "maintenance",
      "API key management is temporarily unavailable.",
    );
  }
}
