import type {
  FastifyReply,
  FastifyInstance,
  FastifyRequest,
} from "fastify";
import { z } from "zod";
import {
  controlAuthentication,
  type ControlApiKeyActivityRecorder,
  type ControlAuthenticationContext,
  type ControlAuthenticationMethod,
} from "./authentication.js";
import {
  ControlContractError,
  controlDataEnvelopeSchema,
  formatVersionEtag,
  parseExpectedVersion,
  parseIdempotencyKey,
} from "./contracts.js";
import {
  CONTROL_ROLES,
  permissionNeedsHumanStepUp,
  permissionNeedsScope,
  permissionOutcome,
  type ControlCapability,
  type PermissionOutcome,
} from "./permissions.js";
import type { ControlRateLimitClass } from "./rateLimiter.js";
import { sendControlError } from "./security.js";
import {
  AlwaysStepUpHandle,
  controlStepUpBodyDigest,
} from "../identity/stepUp.js";
import {
  RESTORE_MAINTENANCE_EXEMPT_ROUTE_IDS,
  RestoreMaintenanceError,
  type RestoreMaintenanceGate,
  type RestoreOrdinaryLease,
} from "../restoreMaintenance.js";

export type ControlHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ControlStepUpRule = "none" | "five_minutes" | "always";

export interface ControlRouteSchemas {
  body?: z.ZodType;
  query?: z.ZodObject<z.ZodRawShape>;
  params?: z.ZodObject<z.ZodRawShape>;
  response: z.ZodType;
}

export interface ControlHandlerContext {
  body: unknown;
  query: unknown;
  params: unknown;
  authentication?: ControlAuthenticationContext;
  expectedVersion?: number;
  idempotencyKey?: string;
  requestId: string;
  request: FastifyRequest;
  reply: FastifyReply;
  stepUpProof?: AlwaysStepUpHandle;
}

export interface ControlStepUpOperation {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  routeId: string;
  targets: string[];
  expectedVersion?: number;
  idempotencyKey?: string;
  bodyDigest: string;
}

export interface ControlHandlerResult {
  data: unknown;
  statusCode?: number;
  version?: number;
  redirectLocation?: string;
}

export interface ControlRouteDefinition {
  id: string;
  method: ControlHttpMethod;
  path: string;
  summary: string;
  tags: readonly string[];
  authentication: "public" | readonly ControlAuthenticationMethod[];
  expandApiKeyAuthentication?: boolean;
  permission: ControlCapability | "authenticated" | null;
  stepUp: ControlStepUpRule;
  schemas: ControlRouteSchemas;
  rateLimit: ControlRateLimitClass;
  auditAction?: string;
  secretFields: readonly string[];
  cache: "no-store" | "private";
  concurrency: "none" | "if-match";
  idempotency: "none" | "required";
  rawResponse?: boolean;
  binaryResponse?: {
    contentType: "application/gzip";
    filename: string;
    maxBytes: number;
  };
  binaryRequest?: {
    contentType: "application/gzip";
    maxBytes: number;
  };
  redirectResponse?: boolean;
  successStatuses?: readonly number[];
  handler(context: ControlHandlerContext): Promise<ControlHandlerResult> | ControlHandlerResult;
}

type SchemaOutput<T extends z.ZodType | undefined> =
  T extends z.ZodType ? z.output<T> : undefined;

export function defineControlRoute<
  TBody extends z.ZodType | undefined,
  TQuery extends z.ZodObject<z.ZodRawShape> | undefined,
  TParams extends z.ZodObject<z.ZodRawShape> | undefined,
  TResponse extends z.ZodType,
>(
  definition: Omit<ControlRouteDefinition, "schemas" | "handler"> & {
    schemas: {
      body?: TBody;
      query?: TQuery;
      params?: TParams;
      response: TResponse;
    };
    handler(context: Omit<ControlHandlerContext, "body" | "query" | "params"> & {
      body: SchemaOutput<TBody>;
      query: SchemaOutput<TQuery>;
      params: SchemaOutput<TParams>;
    }): Promise<Omit<ControlHandlerResult, "data"> & { data: z.input<TResponse> }> |
      (Omit<ControlHandlerResult, "data"> & { data: z.input<TResponse> });
  },
): ControlRouteDefinition {
  return definition as unknown as ControlRouteDefinition;
}

export interface ControlAuthorizationSeam {
  authorizeScope(
    context: ControlAuthenticationContext,
    capability: ControlCapability,
    outcome: PermissionOutcome,
    request: FastifyRequest,
  ): Promise<boolean>;
  verifyStepUp(
    context: ControlAuthenticationContext,
    rule: Exclude<ControlStepUpRule, "none">,
    request: FastifyRequest,
    operation: ControlStepUpOperation,
  ): Promise<boolean>;
  stepUpProof?(request: FastifyRequest): AlwaysStepUpHandle | undefined;
}

export interface ControlSensitiveFailureAudit {
  record(input: {
    route: ControlRouteDefinition;
    authentication?: ControlAuthenticationContext;
    body?: unknown;
    params?: unknown;
    requestId: string;
    error: ControlContractError;
  }): Promise<void>;
}

export const denyControlAuthorization: ControlAuthorizationSeam = {
  authorizeScope: async () => false,
  verifyStepUp: async () => false,
};

export class ControlRouteRegistry {
  readonly #definitions: ControlRouteDefinition[] = [];
  readonly #keys = new Set<string>();
  readonly #ids = new Set<string>();

  register(definition: ControlRouteDefinition): void {
    validateDefinition(definition);
    const key = `${definition.method} ${definition.path}`;
    if (this.#keys.has(key) || this.#ids.has(definition.id)) {
      throw new Error("Duplicate control route.");
    }
    this.#keys.add(key);
    this.#ids.add(definition.id);
    this.#definitions.push(withStaticApiKeyAuthentication(definition));
  }

  definitions(): readonly ControlRouteDefinition[] {
    return [...this.#definitions];
  }
}

function withStaticApiKeyAuthentication(
  definition: ControlRouteDefinition,
): ControlRouteDefinition {
  if (
    definition.expandApiKeyAuthentication === false ||
    definition.authentication === "public" ||
    !definition.authentication.includes("browser_session") ||
    definition.authentication.includes("api_key") ||
    definition.permission === null ||
    definition.permission === "authenticated"
  ) return definition;
  const permitted = controlCapabilityAllowsApiKey(
    definition.permission as ControlCapability,
  );
  return permitted
    ? { ...definition, authentication: [...definition.authentication, "api_key"] }
    : definition;
}

export function controlCapabilityAllowsApiKey(
  capability: ControlCapability,
): boolean {
  return CONTROL_ROLES
    .filter((role) => role === "service" || role === "all_services" || role === "system")
    .some((role) => {
      const outcome = permissionOutcome(role, capability);
      return outcome !== "deny" && outcome !== "no_account";
    });
}

export function installControlRoutes(
  application: FastifyInstance,
  registry: ControlRouteRegistry,
  authorization: ControlAuthorizationSeam = denyControlAuthorization,
  failureAudit?: ControlSensitiveFailureAudit,
  apiKeyActivity?: ControlApiKeyActivityRecorder,
  maintenance?: RestoreMaintenanceGate,
): void {
  for (const definition of registry.definitions()) {
    application.route({
      method: definition.method,
      url: fastifyPath(definition.path),
      ...(definition.binaryRequest === undefined
        ? {}
        : { bodyLimit: definition.binaryRequest.maxBytes }),
      config: {
        controlSecurity: {
          public: definition.authentication === "public",
          cache: definition.cache === "no-store" ? "no-store" : undefined,
          authenticationMethods: definition.authentication === "public"
            ? undefined
            : definition.authentication,
          rateLimit: definition.rateLimit,
          activityAction: definition.id,
        },
      },
      handler: async (request, reply) => {
        let maintenanceLease: RestoreOrdinaryLease | undefined;
        let parsedBody: unknown;
        let parsedParams: unknown;
        let activityAttempted = false;
        let safeTargets: string[] = [];
        try {
          const authentication = controlAuthentication(request);
          const body = parsePart(definition.schemas.body, request.body, "body");
          parsedBody = body;
          const query = parsePart(definition.schemas.query, request.query, "query");
          const params = parsePart(definition.schemas.params, request.params, "params");
          parsedParams = params;
          const expectedVersion = definition.concurrency === "if-match"
            ? parseExpectedVersion(request.headers["if-match"])
            : undefined;
          const idempotencyKey = definition.idempotency === "required"
            ? parseIdempotencyKey(request.headers["idempotency-key"])
            : undefined;
          const operation = stepUpOperation(
            definition,
            body,
            params,
            expectedVersion,
            idempotencyKey,
          );
          safeTargets = operation.targets;
          await authorizeRoute(definition, authentication, request, authorization, operation);
          if (
            authentication !== undefined
            && maintenance !== undefined
            && !RESTORE_MAINTENANCE_EXEMPT_ROUTE_IDS.has(definition.id)
          ) {
            try {
              maintenanceLease = maintenance.acquireOrdinary();
            } catch (error) {
              if (error instanceof RestoreMaintenanceError) {
                throw new ControlContractError(
                  503,
                  "maintenance_mode",
                  "The service is temporarily in restore maintenance.",
                );
              }
              throw error;
            }
          }
          if (authentication?.method === "api_key" && apiKeyActivity !== undefined) {
            activityAttempted = true;
            await apiKeyActivity.recordControlActivity({
              apiKeyId: authentication.principalId,
              action: definition.id,
              outcome: "allow",
              ...(safeTargets[0] === undefined ? {} : { targetId: safeTargets[0] }),
              requestId: request.id,
            });
          }
          const stepUpProof = authorization.stepUpProof?.(request);
          const result = await definition.handler({
            body,
            query,
            params,
            ...(authentication === undefined ? {} : { authentication }),
            ...(expectedVersion === undefined ? {} : { expectedVersion }),
            ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
            requestId: request.id,
            request,
            reply,
            ...(stepUpProof === undefined ? {} : { stepUpProof }),
          });
          if (stepUpProof !== undefined && !stepUpProof.consumed) {
            throw new Error("Transaction-bound step-up proof was not consumed.");
          }
          const statusCode = result.statusCode ?? 200;
          const successStatuses = definition.successStatuses ?? [200];
          if (
            !Number.isInteger(statusCode) ||
            !successStatuses.includes(statusCode) ||
            !isSupportedResponseStatus(statusCode) ||
            statusCode === 204
          ) {
            throw new Error("Invalid control response status.");
          }
          const parsedData = definition.schemas.response.safeParse(result.data);
          if (!parsedData.success) throw new Error("Control response contract violation.");
          if (definition.redirectResponse) {
            if (
              statusCode !== 302 ||
              result.redirectLocation !== "/control/" ||
              result.version !== undefined
            ) throw new Error("Invalid control redirect.");
            return reply.redirect(result.redirectLocation, 302);
          }
          if (result.redirectLocation !== undefined) {
            throw new Error("Unexpected control redirect.");
          }
          if (result.version !== undefined) {
            reply.header("etag", formatVersionEtag(result.version));
          }
          if (definition.binaryResponse !== undefined) {
            if (
              !Buffer.isBuffer(parsedData.data)
              || parsedData.data.byteLength < 1
              || parsedData.data.byteLength > definition.binaryResponse.maxBytes
              || result.version !== undefined
            ) throw new Error("Control binary response contract violation.");
            return reply
              .code(statusCode)
              .header(
                "content-disposition",
                `attachment; filename="${definition.binaryResponse.filename}"`,
              )
              .type(definition.binaryResponse.contentType)
              .send(parsedData.data);
          }
          const payload = definition.rawResponse
            ? parsedData.data
            : controlDataEnvelopeSchema(definition.schemas.response).parse({
                data: parsedData.data,
                meta: { request_id: request.id, api_version: "v2" },
              });
          return reply.code(statusCode).type("application/json; charset=utf-8").send(payload);
        } catch (error) {
          const authentication = controlAuthentication(request);
          if (
            authentication?.method === "api_key" &&
            apiKeyActivity !== undefined &&
            !activityAttempted
          ) {
            activityAttempted = true;
            const contractError = error instanceof ControlContractError ? error : undefined;
            const targets = safeTargets.length > 0
              ? safeTargets
              : targetIds(parsedParams, parsedBody);
            await apiKeyActivity.recordControlActivity({
              apiKeyId: authentication.principalId,
              action: definition.id,
              outcome: contractError !== undefined &&
                  [401, 403, 404].includes(contractError.statusCode)
                ? "deny"
                : "error",
              ...(targets[0] === undefined ? {} : { targetId: targets[0] }),
              requestId: request.id,
              failureCode: contractError?.code ?? "internal_error",
            });
          }
          if (error instanceof ControlContractError) {
            if (definition.auditAction !== undefined && failureAudit !== undefined) {
              await failureAudit.record({
                route: definition,
                ...(authentication === undefined ? {} : { authentication }),
                ...(parsedBody === undefined ? {} : { body: parsedBody }),
                ...(parsedParams === undefined ? {} : { params: parsedParams }),
                requestId: request.id,
                error,
              });
            }
            sendControlError(
              reply,
              request.id,
              error.statusCode,
              error.code,
              error.message,
              error.details,
            );
            return;
          }
          throw error;
        } finally {
          maintenanceLease?.release();
        }
      },
    });
  }
}

async function authorizeRoute(
  route: ControlRouteDefinition,
  authentication: ControlAuthenticationContext | undefined,
  request: FastifyRequest,
  authorization: ControlAuthorizationSeam,
  operation: ControlStepUpOperation,
): Promise<void> {
  if (route.authentication === "public") return;
  if (authentication === undefined || route.permission === null) {
    throw new ControlContractError(401, "unauthenticated", "Authentication required.");
  }
  const capability = route.permission === "authenticated" ? undefined : route.permission;
  const outcome = capability === undefined
    ? undefined
    : permissionOutcome(authentication.role, capability);
  if (outcome !== undefined) {
    if (outcome === "deny" || outcome === "no_account") {
      throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
    if (
      permissionNeedsScope(outcome) &&
      !(await authorization.authorizeScope(authentication, capability!, outcome, request))
    ) {
      if (scopeDenialHidesResource(outcome, request)) {
        throw new ControlContractError(404, "not_found", "The resource was not found.");
      }
      throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
  }
  const needsStepUp = (outcome !== undefined && permissionNeedsHumanStepUp(outcome)) ||
    (authentication.method === "browser_session" && route.stepUp !== "none");
  if (needsStepUp) {
    if (authentication.method !== "browser_session") {
      throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
    const rule = route.stepUp === "none" ? "five_minutes" : route.stepUp;
    if (!(await authorization.verifyStepUp(authentication, rule, request, operation))) {
      throw new ControlContractError(403, "step_up_required", "Additional authentication is required.");
    }
  }
}

function scopeDenialHidesResource(
  outcome: PermissionOutcome,
  request: FastifyRequest,
): boolean {
  if (
    ![
      "assigned_services",
      "assigned_services_step_up",
      "scoped_service",
      "related_users",
      "related_users_not_self",
      "related_users_step_up",
    ].includes(outcome)
  ) return false;
  const params = request.params;
  return params !== null &&
    typeof params === "object" &&
    Object.entries(params as Record<string, unknown>).some(([key, value]) =>
      key.endsWith("_id") && typeof value === "string");
}

function stepUpOperation(
  route: ControlRouteDefinition,
  body: unknown,
  params: unknown,
  expectedVersion: number | undefined,
  idempotencyKey: string | undefined,
): ControlStepUpOperation {
  if (route.method === "GET") {
    return {
      method: "POST",
      routeId: route.id,
      targets: targetIds(params, body),
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      bodyDigest: controlStepUpBodyDigest(body ?? null),
    };
  }
  return {
    method: route.method,
    routeId: route.id,
    targets: targetIds(params, body),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    bodyDigest: controlStepUpBodyDigest(body ?? null),
  };
}

function targetIds(...values: unknown[]): string[] {
  const targets = new Set<string>();
  const visit = (value: unknown, key?: string): void => {
    if (ArrayBuffer.isView(value)) return;
    if (typeof value === "string") {
      if ((key === undefined || key === "id" || key.endsWith("_id")) && isUuidLike(value)) {
        targets.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      if (key?.endsWith("_ids")) {
        for (const entry of value) if (typeof entry === "string" && isUuidLike(entry)) targets.add(entry);
      }
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      visit(entryValue, entryKey);
    }
  };
  for (const value of values) visit(value);
  return [...targets].sort();
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function parsePart(
  schema: z.ZodType | undefined,
  value: unknown,
  part: "body" | "query" | "params",
): unknown {
  if (schema === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const pointer = issue === undefined || issue.path.length === 0
    ? `/${part}`
    : `/${part}/${issue.path.map(escapePointer).join("/")}`;
  throw new ControlContractError(
    400,
    "invalid_request",
    "The request is invalid.",
    {
      field: pointer.slice(0, 256),
      rule: (issue?.code ?? "invalid").slice(0, 64),
    },
  );
}

function escapePointer(value: PropertyKey): string {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function fastifyPath(path: string): string {
  return path.replaceAll(/\{([a-z][a-z0-9_]*)\}/g, ":$1");
}

function validateDefinition(definition: ControlRouteDefinition): void {
  if (
    !/^[a-z][a-z0-9_.-]{0,127}$/.test(definition.id) ||
    !definition.path.startsWith("/api/v2/") ||
    definition.path.includes("?") ||
    definition.path.includes("#") ||
    definition.path.includes(":") ||
    definition.summary.length < 1 ||
    definition.summary.length > 256 ||
    definition.tags.length < 1 ||
    definition.tags.some((tag) => !/^[A-Za-z][A-Za-z0-9 -]{0,63}$/.test(tag))
  ) {
    throw new Error("Invalid control route metadata.");
  }
  const successStatuses = definition.successStatuses ?? [200];
  if (
    successStatuses.length < 1 ||
    new Set(successStatuses).size !== successStatuses.length ||
    successStatuses.some((status) =>
      !Number.isInteger(status) || !isSupportedResponseStatus(status) || status === 204)
  ) {
    throw new Error("Invalid control response metadata.");
  }
  const isPublic = definition.authentication === "public";
  if (
    (isPublic && (definition.permission !== null || definition.stepUp !== "none")) ||
    (!isPublic && (
      definition.authentication.length < 1 ||
      new Set(definition.authentication).size !== definition.authentication.length ||
      definition.permission === null
    ))
  ) {
    throw new Error("Invalid control route authentication metadata.");
  }
  const unsafe = definition.method !== "GET";
  if (
    (!unsafe && (definition.concurrency !== "none" || definition.idempotency !== "none")) ||
    (unsafe && !isPublic && (
      definition.auditAction === undefined ||
      !/^[a-z][a-z0-9_.-]{0,127}$/.test(definition.auditAction)
    ))
  ) {
    throw new Error("Invalid control mutation metadata.");
  }
  if (
    definition.secretFields.some((pointer) => !/^\/[a-z][a-z0-9_]*(?:\/[a-z][a-z0-9_]*)*$/.test(pointer)) ||
    (definition.secretFields.length > 0 && (
      definition.schemas.body === undefined ||
      definition.cache !== "no-store"
    )) ||
    (!isPublic && definition.cache !== "no-store")
  ) {
    throw new Error("Invalid control secret/cache metadata.");
  }
  if (definition.rawResponse && (!isPublic || definition.secretFields.length > 0)) {
    throw new Error("Invalid control raw response metadata.");
  }
  if (
    definition.binaryResponse !== undefined
    && (
      isPublic
      || definition.rawResponse === true
      || definition.redirectResponse === true
      || definition.cache !== "no-store"
      || definition.binaryResponse.contentType !== "application/gzip"
      || !/^[a-z0-9][a-z0-9_.-]{0,127}\.tar\.gz$/
        .test(definition.binaryResponse.filename)
      || !Number.isSafeInteger(definition.binaryResponse.maxBytes)
      || definition.binaryResponse.maxBytes < 1
      || definition.binaryResponse.maxBytes > 256 * 1024 * 1024
    )
  ) {
    throw new Error("Invalid control binary response metadata.");
  }
  if (
    definition.binaryRequest !== undefined
    && (
      isPublic
      || definition.method !== "POST"
      || definition.schemas.body === undefined
      || definition.cache !== "no-store"
      || definition.binaryRequest.contentType !== "application/gzip"
      || !Number.isSafeInteger(definition.binaryRequest.maxBytes)
      || definition.binaryRequest.maxBytes < 1
      || definition.binaryRequest.maxBytes > 256 * 1024 * 1024
    )
  ) {
    throw new Error("Invalid control binary request metadata.");
  }
  if (
    definition.redirectResponse &&
    (
      !isPublic ||
      definition.method !== "GET" ||
      successStatuses.length !== 1 ||
      successStatuses[0] !== 302 ||
      definition.rawResponse === true ||
      definition.binaryResponse !== undefined ||
      definition.secretFields.length > 0
    )
  ) {
    throw new Error("Invalid control redirect metadata.");
  }
}

function isSupportedResponseStatus(status: number): boolean {
  return (status >= 200 && status <= 299) || status === 302 || status === 503;
}
