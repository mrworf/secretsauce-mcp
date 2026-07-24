import {
  AccessManagementError,
  type AccessManagementRepository,
  type AccessRecordStatus,
  type AccessViewer,
  type CapabilityInvalidationTarget,
  type GrantAccessItem,
  type GrantBulkTarget,
  type ServiceAccessItem,
  type SessionAccessItem,
} from "../accessManagement.js";
import type { BrowserSessionAuthenticator } from "../identity/browserSessions.js";
import { UuidV7Generator } from "../persistence/uuidV7.js";
import type { ControlIdempotencyHasher } from "./idempotency.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { clearControlSessionCookie } from "./security.js";
import { z } from "./zod.js";

const uuid = z.string().uuid();
const status = z.enum(["active", "expired", "revoked", "invalid"]);
const listQuery = z.object({
  limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
  cursor: z.string().min(80).max(512).optional(),
  status: status.optional(),
  user_id: uuid.optional(),
  client_id: uuid.optional(),
  q: z.string().min(1).max(128).optional(),
}).strict();
const sessionParams = z.object({ session_id: uuid }).strict();
const grantParams = z.object({ grant_id: uuid }).strict();
const serviceParams = z.object({ service_id: uuid }).strict();
const sessionSchema = z.object({
  id: uuid,
  user_id: uuid,
  user_label: z.string().min(1).max(512),
  role: z.enum(["superadmin", "admin", "user"]),
  current: z.boolean(),
  issued_at: z.number().int().nonnegative(),
  last_used_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative(),
  status,
}).strict();
const grantSchema = z.object({
  id: uuid,
  user_id: uuid,
  user_label: z.string().min(1).max(512),
  client_id: uuid,
  client_identifier: z.string().min(1).max(2048),
  client_name: z.string().min(1).max(256),
  resource: z.string().min(1).max(2048),
  scopes: z.array(z.string().min(1).max(128)).max(32),
  authentication_method: z.enum(["local_password_totp", "oidc"]),
  issued_at: z.number().int().nonnegative(),
  last_used_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative(),
  oauth_grant_status: status,
  usable: z.boolean(),
  services: z.array(z.string().min(1).max(256)).max(256),
}).strict();
const referenceState = z.object({
  active: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
}).strict();
const serviceAccessSchema = z.object({
  grant_id: uuid,
  user_id: uuid,
  user_label: z.string().min(1).max(512),
  client_id: uuid,
  client_identifier: z.string().min(1).max(2048),
  client_name: z.string().min(1).max(256),
  service_id: uuid,
  service_name: z.string().min(1).max(256),
  issued_at: z.number().int().nonnegative(),
  last_used_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative(),
  oauth_grant_status: status,
  capability_status: z.enum(["active", "invalid"]),
  credential_count: z.number().int().nonnegative(),
  policy_count: z.number().int().nonnegative(),
  references: z.object({
    gref: referenceState,
    sec: referenceState,
  }).strict(),
}).strict();
const sessionPage = z.object({
  items: z.array(sessionSchema).max(100),
  next_cursor: z.string().max(512).optional(),
}).strict();
const grantPage = z.object({
  items: z.array(grantSchema).max(100),
  next_cursor: z.string().max(512).optional(),
}).strict();
const serviceAccessPage = z.object({
  items: z.array(serviceAccessSchema).max(100),
  next_cursor: z.string().max(512).optional(),
}).strict();
const revokeSchema = z.object({
  target_id: uuid,
  revoked: z.boolean(),
  sessions_revoked: z.number().int().nonnegative(),
  grants_revoked: z.number().int().nonnegative(),
  replayed: z.boolean(),
}).strict();

export interface AccessRouteDependencies {
  repository: AccessManagementRepository;
  browserSessions: BrowserSessionAuthenticator;
  idempotency: ControlIdempotencyHasher;
  now?: () => number;
}

export function registerAccessManagementRoutes(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
): void {
  const ids = new UuidV7Generator(
    dependencies.now === undefined ? {} : { now: dependencies.now },
  );
  registerSessionList(registry, dependencies, false);
  registerSessionList(registry, dependencies, true);
  registerSessionRevoke(registry, dependencies, false);
  registerSessionRevoke(registry, dependencies, true);
  registerGrantList(registry, dependencies, false);
  registerGrantList(registry, dependencies, true);
  registerGrantRevoke(registry, dependencies);
  registerBulkGrantRevoke(registry, dependencies);

  registry.register(defineControlRoute({
    id: "access.service.list",
    method: "GET",
    path: "/api/v2/services/{service_id}/access",
    summary: "List computed access for one administered service",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      query: listQuery.omit({ user_id: true, client_id: true, q: true }),
      response: serviceAccessPage,
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, query }) => run(async () => {
      const page = await dependencies.repository.serviceAccessPage({
        viewer: viewer(authentication!),
        serviceId: params.service_id,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { pageSize: Number(query.limit) }),
      });
      return {
        data: {
          items: page.items.map(wireServiceAccess),
          ...(page.nextCursor === undefined
            ? {}
            : { next_cursor: page.nextCursor }),
        },
      };
    }),
  }));

  registry.register(defineControlRoute({
    id: "access.capabilities.invalidate",
    method: "POST",
    path: "/api/v2/services/{service_id}/capabilities/invalidate",
    summary: "Invalidate dynamic capabilities without revoking OAuth",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: z.object({
        target: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("service") }).strict(),
          z.object({ kind: z.literal("credential"), id: uuid }).strict(),
          z.object({ kind: z.literal("policy"), id: uuid }).strict(),
          z.object({ kind: z.literal("assignment"), user_id: uuid }).strict(),
        ]),
        justification: z.string().min(1).max(1024),
      }).strict(),
      response: z.object({
        capability_status: z.literal("invalidated"),
        invalidated_references: z.number().int().nonnegative(),
        oauth_grants_revoked: z.literal(0),
      }).strict(),
    },
    rateLimit: "management",
    auditAction: "access.capability_invalidate",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, body, requestId }) => run(async () => {
      const result = await dependencies.repository.invalidateCapabilities({
        viewer: viewer(authentication!),
        serviceId: params.service_id,
        target: capabilityTarget(body.target),
        eventId: ids.next(),
        justification: body.justification,
        correlationId: requestId,
      });
      return {
        data: {
          capability_status: result.capabilityStatus,
          invalidated_references: result.invalidatedReferences,
          oauth_grants_revoked: 0 as const,
        },
      };
    }),
  }));
}

function registerSessionList(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
  global: boolean,
): void {
  registry.register(defineControlRoute({
    id: global ? "access.security_sessions.list" : "access.sessions.list",
    method: "GET",
    path: global ? "/api/v2/security/sessions" : "/api/v2/access/sessions",
    summary: global ? "List all browser sessions" : "List own browser sessions",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      query: global
        ? listQuery.omit({ client_id: true })
        : listQuery.omit({ user_id: true, client_id: true, q: true }),
      response: sessionPage,
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query, request }) => run(async () => {
      const filters = query as {
        user_id?: string;
        q?: string;
      };
      const current = dependencies.browserSessions.session(request);
      const page = await dependencies.repository.sessionsPage({
        viewer: viewer(authentication!),
        scope: global ? "global" : "own",
        ...(current === undefined ? {} : { currentSessionId: current.sessionId }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(filters.user_id === undefined
          ? {}
          : { userId: filters.user_id }),
        ...(filters.q === undefined ? {} : { query: filters.q }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { pageSize: Number(query.limit) }),
      });
      return {
        data: {
          items: page.items.map(wireSession),
          ...(page.nextCursor === undefined ? {} : { next_cursor: page.nextCursor }),
        },
      };
    }),
  }));
}

function registerSessionRevoke(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
  global: boolean,
): void {
  registry.register(defineControlRoute({
    id: global ? "access.security_sessions.revoke" : "access.sessions.revoke",
    method: "DELETE",
    path: global
      ? "/api/v2/security/sessions/{session_id}"
      : "/api/v2/access/sessions/{session_id}",
    summary: global ? "Revoke any browser session" : "Revoke an own browser session",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: { params: sessionParams, response: revokeSchema },
    rateLimit: "management",
    auditAction: "access.session_revoke",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, request, reply, requestId }) =>
      run(async () => {
        const result = await dependencies.repository.revokeSession({
          viewer: viewer(authentication!),
          sessionId: params.session_id,
          correlationId: requestId,
        });
        const current = dependencies.browserSessions.session(request);
        if (result.revoked && current?.sessionId === params.session_id) {
          clearControlSessionCookie(reply);
        }
        return {
          data: {
            target_id: result.targetId,
            revoked: result.revoked,
            sessions_revoked: result.sessionsRevoked,
            grants_revoked: 0,
            replayed: false,
          },
        };
      }),
  }));
}

function registerGrantList(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
  global: boolean,
): void {
  registry.register(defineControlRoute({
    id: global ? "access.security_grants.list" : "access.grants.list",
    method: "GET",
    path: global
      ? "/api/v2/security/oauth-grants"
      : "/api/v2/access/grants",
    summary: global ? "List all OAuth grants" : "List own OAuth grants",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      query: global
        ? listQuery
        : listQuery.omit({ user_id: true, client_id: true, q: true }),
      response: grantPage,
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => run(async () => {
      const filters = query as {
        user_id?: string;
        client_id?: string;
        q?: string;
      };
      const page = await dependencies.repository.grantsPage({
        viewer: viewer(authentication!),
        scope: global ? "global" : "own",
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(filters.user_id === undefined ? {} : { userId: filters.user_id }),
        ...(filters.client_id === undefined
          ? {}
          : { clientId: filters.client_id }),
        ...(filters.q === undefined ? {} : { query: filters.q }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { pageSize: Number(query.limit) }),
      });
      return {
        data: {
          items: page.items.map(wireGrant),
          ...(page.nextCursor === undefined ? {} : { next_cursor: page.nextCursor }),
        },
      };
    }),
  }));
}

function registerGrantRevoke(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
): void {
  registry.register(defineControlRoute({
    id: "access.grants.revoke",
    method: "DELETE",
    path: "/api/v2/access/grants/{grant_id}",
    summary: "Revoke an own OAuth grant",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: { params: grantParams, response: revokeSchema },
    rateLimit: "management",
    auditAction: "oauth.grant_revoke",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, requestId }) => run(async () => {
      const result = await dependencies.repository.revokeGrant({
        viewer: viewer(authentication!),
        grantId: params.grant_id,
        correlationId: requestId,
      });
      return {
        data: {
          target_id: result.targetId,
          revoked: result.revoked,
          sessions_revoked: 0,
          grants_revoked: result.grantsRevoked,
          replayed: false,
        },
      };
    }),
  }));
}

function registerBulkGrantRevoke(
  registry: ControlRouteRegistry,
  dependencies: AccessRouteDependencies,
): void {
  const bodySchema = z.object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("user"), id: uuid }).strict(),
      z.object({ kind: z.literal("client"), id: uuid }).strict(),
      z.object({ kind: z.literal("all") }).strict(),
    ]),
    confirmation: z.string().min(1).max(128),
    justification: z.string().min(1).max(1024),
  }).strict();
  registry.register(defineControlRoute({
    id: "access.security_grants.revoke",
    method: "POST",
    path: "/api/v2/security/oauth-grants/revoke",
    summary: "Bulk revoke OAuth grants",
    tags: ["Access"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "always",
    schemas: { body: bodySchema, response: revokeSchema },
    rateLimit: "management",
    auditAction: "oauth.global_revoke",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    handler: async ({
      authentication,
      body,
      idempotencyKey,
      requestId,
      stepUpProof,
    }) => run(async () => {
      const actor = authentication!;
      const idempotency = {
        keyHash: dependencies.idempotency.keyHash({
          key: idempotencyKey!,
          principalId: actor.principalId,
          routeId: "access.security_grants.revoke",
        }),
        principalId: actor.principalId,
        routeId: "access.security_grants.revoke",
        requestDigest: dependencies.idempotency.requestDigest(body),
      };
      const result = await dependencies.repository.revokeGrantBulk({
        viewer: viewer(actor),
        target: body.target as GrantBulkTarget,
        confirmation: body.confirmation,
        justification: body.justification,
        correlationId: requestId,
        idempotency,
        ...(stepUpProof === undefined ? {} : { stepUpProof }),
      });
      return {
        data: result.kind === "executed"
          ? {
              target_id: result.value.targetId,
              revoked: result.value.revoked,
              sessions_revoked: 0,
              grants_revoked: result.value.grantsRevoked,
              replayed: false,
            }
          : {
              target_id: result.resultReference,
              revoked: false,
              sessions_revoked: 0,
              grants_revoked: 0,
              replayed: true,
            },
      };
    }),
  }));
}

function viewer(authentication: {
  principalId: string;
  role: string;
}): AccessViewer {
  if (!["superadmin", "admin", "user"].includes(authentication.role)) {
    throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
  }
  return {
    userId: authentication.principalId,
    role: authentication.role as AccessViewer["role"],
  };
}

function capabilityTarget(
  target:
    | { kind: "service" }
    | { kind: "credential"; id: string }
    | { kind: "policy"; id: string }
    | { kind: "assignment"; user_id: string },
): CapabilityInvalidationTarget {
  return target.kind === "assignment"
    ? { kind: "assignment", userId: target.user_id }
    : target;
}

function wireSession(item: SessionAccessItem) {
  return {
    id: item.id,
    user_id: item.userId,
    user_label: item.userLabel,
    role: item.role,
    current: item.current,
    issued_at: item.issuedAt,
    last_used_at: item.lastUsedAt,
    expires_at: item.expiresAt,
    status: item.status,
  };
}

function wireGrant(item: GrantAccessItem) {
  return {
    id: item.id,
    user_id: item.userId,
    user_label: item.userLabel,
    client_id: item.clientId,
    client_identifier: item.clientIdentifier,
    client_name: item.clientName,
    resource: item.resource,
    scopes: item.scopes,
    authentication_method: item.authenticationMethod,
    issued_at: item.issuedAt,
    last_used_at: item.lastUsedAt,
    expires_at: item.expiresAt,
    oauth_grant_status: item.status,
    usable: item.usable,
    services: item.services,
  };
}

function wireServiceAccess(item: ServiceAccessItem) {
  return {
    grant_id: item.grantId,
    user_id: item.userId,
    user_label: item.userLabel,
    client_id: item.clientId,
    client_identifier: item.clientIdentifier,
    client_name: item.clientName,
    service_id: item.serviceId,
    service_name: item.serviceName,
    issued_at: item.issuedAt,
    last_used_at: item.lastUsedAt,
    expires_at: item.expiresAt,
    oauth_grant_status: item.oauthGrantStatus,
    capability_status: item.capabilityStatus,
    credential_count: item.credentialCount,
    policy_count: item.policyCount,
    references: item.references,
  };
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof AccessManagementError)) throw error;
    if (error.code === "invalid_request") {
      throw new ControlContractError(400, "invalid_request", "The request is invalid.");
    }
    if (error.code === "forbidden") {
      throw new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
    throw new ControlContractError(503, "maintenance", "Access management is unavailable.");
  }
}
