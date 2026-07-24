import {
  LocalAuthenticationError,
  type LocalAuthenticationService,
} from "../identity/localAuthentication.js";
import type { BrowserSessionAuthenticator } from "../identity/browserSessions.js";
import type { StepUpService } from "../identity/stepUp.js";
import type { UserAdministrationService } from "../identity/userAdministration.js";
import type { UserLifecycleAdministrationService } from "../identity/userLifecycleAdministration.js";
import type { OidcFlowService } from "../identity/oidcFlow.js";
import type { OidcLoginService } from "../identity/oidcLogin.js";
import {
  OidcLinkError,
  type OidcLinkService,
} from "../identity/oidcLink.js";
import type { OidcProviderConfig } from "../types.js";
import type { DatabaseOAuthRepository } from "../oauth/databaseOAuth.js";
import type { OAuthIntentStateCodec } from "../oauth/intentState.js";
import {
  EnrollmentError,
  type LocalEnrollmentService,
  type RestrictedSessionAuthenticator,
  type LocalControlAuthenticator,
} from "../identity/enrollment.js";
import { ControlContractError } from "./contracts.js";
import {
  defineControlRoute,
  type ControlAuthorizationSeam,
  type ControlRouteRegistry,
} from "./routeRegistry.js";
import {
  clearControlSessionCookie,
  clearControlEnrollmentCookie,
  clearControlOidcFlowCookie,
  setControlEnrollmentCookie,
  setControlOidcFlowCookie,
  setControlSessionCookie,
  CONTROL_OIDC_FLOW_COOKIE,
} from "./security.js";
import { z } from "./zod.js";

export interface LocalIdentityControl {
  authentication: LocalAuthenticationService;
  browserSessions: BrowserSessionAuthenticator;
  stepUp?: StepUpService;
  authorization?: ControlAuthorizationSeam;
  enrollment?: LocalEnrollmentService;
  restrictedSessions?: RestrictedSessionAuthenticator;
  authenticator?: LocalControlAuthenticator;
  users?: UserAdministrationService;
  userLifecycle?: UserLifecycleAdministrationService;
  oidc?: {
    flow: OidcFlowService;
    login: OidcLoginService;
    providers: Record<string, OidcProviderConfig>;
    flowTtlMs: number;
    link?: OidcLinkService;
    mcpOAuth?: {
      repository: DatabaseOAuthRepository;
      intentState: OAuthIntentStateCodec;
    };
  };
}

const roleSchema = z.enum(["superadmin", "admin", "user"]);
const sessionDataSchema = z.object({
  user_id: z.string().uuid(),
  role: roleSchema,
  csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expires_at: z.number().int().nonnegative(),
}).strict();

export function registerLocalIdentityRoutes(
  registry: ControlRouteRegistry,
  identity: LocalIdentityControl,
): void {
  if (identity.enrollment !== undefined && identity.restrictedSessions !== undefined) {
    registerEnrollmentRoutes(registry, identity.enrollment, identity.restrictedSessions);
    registerSelfServiceRoutes(
      registry,
      identity.enrollment,
      identity.browserSessions,
      identity.restrictedSessions,
    );
  }
  if (identity.oidc !== undefined) registerOidcLoginRoutes(registry, identity.oidc);
  if (
    identity.oidc?.link !== undefined &&
    identity.restrictedSessions !== undefined
  ) {
    registerOidcLinkRoutes(
      registry,
      identity.oidc,
      identity.restrictedSessions,
      identity.browserSessions,
    );
  }
  registry.register(defineControlRoute({
    id: "identity.login",
    method: "POST",
    path: "/api/v2/auth/login",
    summary: "Authenticate a configured local identity",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      body: z.object({
        email: z.string().min(3).max(254),
        password: z.string().max(4_096),
        totp: z.string().regex(/^\d{6}$/),
      }).strict(),
      response: sessionDataSchema,
    },
    rateLimit: "authentication",
    secretFields: ["/password", "/totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      try {
        const result = await identity.authentication.login({
          ...body,
          source: request.ip,
          correlationId: request.id,
        });
        setControlSessionCookie(
          reply,
          result.sessionToken,
          Math.max(1, Math.floor((result.absoluteExpiresAt - result.issuedAt) / 1_000)),
        );
        return {
          data: {
            user_id: result.userId,
            role: result.role,
            csrf_token: result.csrfToken,
            expires_at: result.absoluteExpiresAt,
          },
        };
      } catch (error) {
        if (!(error instanceof LocalAuthenticationError)) throw error;
        if (error.code === "rate_limited") {
          throw new ControlContractError(429, "rate_limited", "Authentication is temporarily unavailable.");
        }
        if (error.code === "authentication_unavailable") {
          throw new ControlContractError(503, "maintenance", "Authentication is unavailable.");
        }
        throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
      }
    },
  }));

  if (identity.stepUp !== undefined) {
    registry.register(defineControlRoute({
      id: "identity.step_up",
      method: "POST",
      path: "/api/v2/auth/step-up",
      summary: "Perform password and TOTP step-up for the current browser session",
      tags: ["Identity"],
      authentication: ["browser_session"],
      permission: "authenticated",
      stepUp: "none",
      schemas: {
        body: z.object({
          password: z.string().max(4_096),
          totp: z.string().regex(/^\d{6}$/),
          operation: z.object({
            method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
            route_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/),
            target_ids: z.array(z.string().uuid()).max(100),
            expected_version: z.number().int().positive().optional(),
            idempotency_key: z.string().min(16).max(128).optional(),
            body: z.unknown(),
          }).strict().optional(),
        }).strict(),
        response: z.object({
          mode: z.enum(["five_minutes", "always"]),
          expires_at: z.number().int().nonnegative(),
          proof: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
        }).strict(),
      },
      rateLimit: "authentication",
      auditAction: "identity.step_up",
      secretFields: ["/password", "/totp"],
      cache: "no-store",
      concurrency: "none",
      idempotency: "none",
      handler: async ({ body, request }) => {
        const session = identity.browserSessions.session(request);
        if (session === undefined) {
          throw new ControlContractError(401, "unauthenticated", "Authentication required.");
        }
        try {
          const result = await identity.stepUp!.stepUp({
            userId: session.userId,
            sessionId: session.sessionId,
            role: session.role,
            password: body.password,
            totp: body.totp,
            source: request.ip,
            correlationId: request.id,
            ...(body.operation === undefined ? {} : {
              operation: {
                method: body.operation.method,
                routeId: body.operation.route_id,
                targets: body.operation.target_ids,
                ...(body.operation.expected_version === undefined
                  ? {}
                  : { expectedVersion: body.operation.expected_version }),
                ...(body.operation.idempotency_key === undefined
                  ? {}
                  : { idempotencyKey: body.operation.idempotency_key }),
                body: body.operation.body,
              },
            }),
          });
          return {
            data: {
              mode: result.mode,
              expires_at: result.expiresAt,
              ...(result.proof === undefined ? {} : { proof: result.proof }),
            },
          };
        } catch (error) {
          if (!(error instanceof LocalAuthenticationError)) throw error;
          if (error.code === "rate_limited") {
            throw new ControlContractError(429, "rate_limited", "Authentication is temporarily unavailable.");
          }
          if (error.code === "authentication_unavailable") {
            throw new ControlContractError(503, "maintenance", "Authentication is unavailable.");
          }
          throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
        }
      },
    }));
  }

  registry.register(defineControlRoute({
    id: "identity.current_session",
    method: "GET",
    path: "/api/v2/auth/session",
    summary: "Read the current local browser session and rotate its CSRF proof",
    tags: ["Identity"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: { response: sessionDataSchema },
    rateLimit: "authentication",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ request }) => {
      const session = identity.browserSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        return {
          data: {
            user_id: session.userId,
            role: session.role,
            csrf_token: await identity.browserSessions.rotateCsrf(request),
            expires_at: session.absoluteExpiresAt,
          },
        };
      } catch {
        throw new ControlContractError(503, "maintenance", "Authentication is unavailable.");
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.logout",
    method: "POST",
    path: "/api/v2/auth/logout",
    summary: "Revoke the current local browser session",
    tags: ["Identity"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      response: z.object({ logged_out: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.logout",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ request, reply }) => {
      try {
        await identity.browserSessions.logout(request);
        clearControlSessionCookie(reply);
        return { data: { logged_out: true as const } };
      } catch {
        throw new ControlContractError(503, "maintenance", "Authentication is unavailable.");
      }
    },
  }));
}

function registerOidcLoginRoutes(
  registry: ControlRouteRegistry,
  oidc: NonNullable<LocalIdentityControl["oidc"]>,
): void {
  if (oidc.mcpOAuth !== undefined) {
    registry.register(defineControlRoute({
      id: "identity.oidc_mcp_begin",
      method: "GET",
      path: "/api/v2/auth/oidc/{provider_id}/mcp-begin",
      summary: "Begin external MCP authorization",
      tags: ["Identity"],
      authentication: "public",
      permission: null,
      stepUp: "none",
      schemas: {
        query: z.object({
          intent: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        }).strict(),
        params: z.object({
          provider_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
        }).strict(),
        response: z.null(),
      },
      rateLimit: "authentication",
      secretFields: [],
      cache: "no-store",
      concurrency: "none",
      idempotency: "none",
      redirectResponse: true,
      successStatuses: [302],
      handler: async ({ params, query, reply }) => {
        try {
          const intent = await oidc.mcpOAuth!.repository.resolveExternalIntent(
            query.intent,
            params.provider_id,
          );
          const started = await oidc.flow.begin(params.provider_id, {
            purpose: "mcp_oauth",
            oauthIntentId: intent.id,
          });
          const state = new URL(started.authorizationUrl).searchParams.get("state");
          if (state === null) throw new Error("missing OIDC state");
          setControlOidcFlowCookie(
            reply,
            state,
            Math.max(1, Math.ceil(oidc.flowTtlMs / 1_000)),
          );
          return {
            data: null,
            statusCode: 302,
            redirectLocation: started.authorizationUrl,
          };
        } catch {
          throw new ControlContractError(
            401,
            "unauthenticated",
            "Authentication failed.",
          );
        }
      },
    }));
  }

  registry.register(defineControlRoute({
    id: "identity.oidc_providers",
    method: "GET",
    path: "/api/v2/auth/oidc/providers",
    summary: "List configured external identity providers",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      response: z.object({
        providers: z.array(z.object({
          id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
          display_name: z.string().min(1).max(120),
        }).strict()).max(8),
      }).strict(),
    },
    rateLimit: "authentication",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async () => ({
      data: {
        providers: Object.values(oidc.providers)
          .map((provider) => ({ id: provider.id, display_name: provider.displayName }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      },
    }),
  }));

  registry.register(defineControlRoute({
    id: "identity.oidc_begin",
    method: "POST",
    path: "/api/v2/auth/oidc/{provider_id}/begin",
    summary: "Begin external browser authentication",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      body: z.object({}).strict(),
      params: z.object({
        provider_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
      }).strict(),
      response: z.object({
        authorization_url: z.string().url(),
        expires_at: z.number().int().nonnegative(),
      }).strict(),
    },
    rateLimit: "authentication",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ params, reply }) => {
      try {
        const started = await oidc.flow.begin(params.provider_id, { purpose: "login" });
        const state = new URL(started.authorizationUrl).searchParams.get("state");
        if (state === null) throw new Error("missing OIDC state");
        setControlOidcFlowCookie(
          reply,
          state,
          Math.max(1, Math.ceil(oidc.flowTtlMs / 1_000)),
        );
        return {
          data: {
            authorization_url: started.authorizationUrl,
            expires_at: started.expiresAt,
          },
        };
      } catch {
        throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.oidc_callback",
    method: "GET",
    path: "/api/v2/auth/oidc/{provider_id}/callback",
    summary: "Complete external browser authentication",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      query: z.object({}).passthrough(),
      params: z.object({
        provider_id: z.string().min(1).max(256),
      }).strict(),
      response: z.null(),
    },
    rateLimit: "authentication",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    redirectResponse: true,
    successStatuses: [302],
    handler: async ({ params, query, request, reply }) => {
      let redirectLocation = "/control/";
      try {
        const state = query.state;
        const code = query.code;
        if (
          typeof state !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(state) ||
          typeof code !== "string" ||
          code.length < 1 ||
          Buffer.byteLength(code, "utf8") > 4_096 ||
          /[\u0000\r\n]/.test(code) ||
          Object.keys(query).sort().join(",") !== "code,state" ||
          request.cookies[CONTROL_OIDC_FLOW_COOKIE] !== state
        ) {
          await oidc.flow.deny(request.id);
          throw new Error("OIDC browser binding mismatch");
        }
        const completed = await oidc.flow.callback(
          params.provider_id,
          state,
          code,
          request.id,
        );
        if (completed.binding.purpose === "login") {
          const login = await oidc.login.login(completed.assertion, request.id);
          setBrowserSession(reply, login);
        } else if (completed.binding.purpose === "restricted_link" && oidc.link !== undefined) {
          const login = await oidc.link.completeRestricted(
            completed.assertion,
            completed.binding,
            request.id,
          );
          setBrowserSession(reply, login);
          clearControlEnrollmentCookie(reply);
        } else if (
          completed.binding.purpose === "superadmin_link" &&
          oidc.link !== undefined
        ) {
          await oidc.link.completeAdmin(completed.assertion, completed.binding, request.id);
        } else if (
          completed.binding.purpose === "mcp_oauth"
          && completed.binding.oauthIntentId !== undefined
          && oidc.mcpOAuth !== undefined
        ) {
          const authorization =
            await oidc.mcpOAuth.repository.authorizeExternalIntent(
              completed.binding.oauthIntentId,
              completed.assertion,
              request.id,
            );
          const redirect = new URL(authorization.redirectUri);
          redirect.searchParams.set("code", authorization.code);
          const clientState = oidc.mcpOAuth.intentState.decrypt(
            authorization.stateEnvelopeJson,
            params.provider_id,
          );
          if (clientState !== undefined) {
            redirect.searchParams.set("state", clientState);
          }
          redirectLocation = redirect.toString();
        } else {
          throw new Error("OIDC purpose mismatch");
        }
      } catch {
        // The browser observes the same fixed redirect for every callback outcome.
      } finally {
        clearControlOidcFlowCookie(reply);
      }
      return { data: null, statusCode: 302, redirectLocation };
    },
  }));
}

function registerOidcLinkRoutes(
  registry: ControlRouteRegistry,
  oidc: NonNullable<LocalIdentityControl["oidc"]>,
  restrictedSessions: RestrictedSessionAuthenticator,
  browserSessions: BrowserSessionAuthenticator,
): void {
  const beginResponse = z.object({
    authorization_url: z.string().url(),
    expires_at: z.number().int().nonnegative(),
  }).strict();
  const providerParams = z.object({
    provider_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  }).strict();
  registry.register(defineControlRoute({
    id: "identity.oidc_restricted_options",
    method: "GET",
    path: "/api/v2/auth/enrollment/oidc/providers",
    summary: "Read external identity options for restricted enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      response: z.object({
        csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        providers: z.array(z.object({
          id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
          display_name: z.string().min(1).max(120),
        }).strict()).max(8),
      }).strict(),
    },
    rateLimit: "authentication",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ request }) => {
      try {
        return {
          data: {
            csrf_token: await restrictedSessions.rotateCsrf(request),
            providers: Object.values(oidc.providers)
              .map((provider) => ({ id: provider.id, display_name: provider.displayName }))
              .sort((left, right) => left.id.localeCompare(right.id)),
          },
        };
      } catch {
        throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.oidc_restricted_link_begin",
    method: "POST",
    path: "/api/v2/auth/enrollment/oidc/{provider_id}/begin",
    summary: "Link an external identity during restricted enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({}).strict(),
      params: providerParams,
      response: beginResponse,
    },
    rateLimit: "authentication",
    auditAction: "identity.oidc_link_begin",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ params, request, reply }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
      try {
        const binding = await oidc.link!.restrictedBinding(session);
        const started = await oidc.flow.begin(params.provider_id, binding);
        setOidcFlowCookie(reply, started.authorizationUrl, oidc.flowTtlMs);
        return {
          data: {
            authorization_url: started.authorizationUrl,
            expires_at: started.expiresAt,
          },
        };
      } catch {
        throw new ControlContractError(401, "unauthenticated", "Authentication failed.");
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.oidc_links",
    method: "GET",
    path: "/api/v2/users/{user_id}/oidc-links",
    summary: "List safe external identity links for a user",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "manage_admin_accounts",
    stepUp: "none",
    schemas: {
      params: z.object({ user_id: z.string().uuid() }).strict(),
      response: z.object({
        links: z.array(z.object({
          id: z.string().uuid(),
          provider_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
          provider_display_name: z.string().min(1).max(120),
          created_at: z.number().int().nonnegative(),
          last_authenticated_at: z.number().int().nonnegative().optional(),
        }).strict()).max(64),
      }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ params }) => {
      try {
        const links = await oidc.link!.links(params.user_id);
        return {
          data: {
            links: links.map((link) => ({
              id: link.id,
              provider_id: link.providerId,
              provider_display_name: link.providerDisplayName,
              created_at: link.createdAt,
              ...(link.lastAuthenticatedAt === undefined
                ? {}
                : { last_authenticated_at: link.lastAuthenticatedAt }),
            })),
          },
        };
      } catch {
        throw new ControlContractError(404, "not_found", "The resource was not found.");
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.oidc_link_begin",
    method: "POST",
    path: "/api/v2/users/{user_id}/oidc-links/{provider_id}/begin",
    summary: "Begin a guarded external identity link",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "manage_admin_accounts",
    stepUp: "five_minutes",
    schemas: {
      params: z.object({
        user_id: z.string().uuid(),
        provider_id: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
      }).strict(),
      body: z.object({
        justification: z.string().min(1).max(1_024),
      }).strict(),
      response: beginResponse,
    },
    rateLimit: "management",
    auditAction: "identity.oidc_link_begin",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      request,
      requestId,
      reply,
      stepUpProof,
    }) => {
      const session = oidcBrowserSession(request, browserSessions);
      try {
        const binding = await oidc.link!.adminBinding(
          authentication!,
          session,
          params.user_id,
          expectedVersion!,
        );
        const authorization = oidc.link!.beginStepUp(
          authentication!,
          params.user_id,
          params.provider_id,
          body.justification,
          requestId,
          stepUpProof,
        );
        const started = await oidc.flow.begin(params.provider_id, binding, authorization);
        setOidcFlowCookie(reply, started.authorizationUrl, oidc.flowTtlMs);
        return {
          data: {
            authorization_url: started.authorizationUrl,
            expires_at: started.expiresAt,
          },
        };
      } catch (error) {
        throw oidcLinkContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.oidc_unlink",
    method: "DELETE",
    path: "/api/v2/users/{user_id}/oidc-links/{link_id}",
    summary: "Remove a guarded external identity link",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "manage_admin_accounts",
    stepUp: "five_minutes",
    schemas: {
      params: z.object({
        user_id: z.string().uuid(),
        link_id: z.string().uuid(),
      }).strict(),
      body: z.object({
        justification: z.string().min(1).max(1_024),
      }).strict(),
      response: z.object({
        user_id: z.string().uuid(),
        deleted: z.literal(true),
        version: z.number().int().positive(),
      }).strict(),
    },
    rateLimit: "management",
    auditAction: "identity.oidc_unlink",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      request,
      requestId,
      stepUpProof,
    }) => {
      try {
        const version = await oidc.link!.unlink({
          actor: authentication!,
          session: oidcBrowserSession(request, browserSessions),
          targetUserId: params.user_id,
          linkId: params.link_id,
          expectedVersion: expectedVersion!,
          justification: body.justification,
          correlationId: requestId,
          ...(stepUpProof === undefined ? {} : { proof: stepUpProof }),
        });
        return {
          data: { user_id: params.user_id, deleted: true as const, version },
          version,
        };
      } catch (error) {
        throw oidcLinkContractError(error);
      }
    },
  }));
}

function oidcBrowserSession(
  request: Parameters<BrowserSessionAuthenticator["session"]>[0],
  browserSessions: BrowserSessionAuthenticator,
) {
  const session = browserSessions.session(request);
  if (session === undefined) throw new OidcLinkError("invalid");
  return session;
}

function setOidcFlowCookie(
  reply: Parameters<typeof setControlOidcFlowCookie>[0],
  authorizationUrl: string,
  flowTtlMs: number,
): void {
  const state = new URL(authorizationUrl).searchParams.get("state");
  if (state === null) throw new Error("missing OIDC state");
  setControlOidcFlowCookie(reply, state, Math.max(1, Math.ceil(flowTtlMs / 1_000)));
}

function setBrowserSession(
  reply: Parameters<typeof setControlSessionCookie>[0],
  login: {
    sessionToken: string;
    absoluteExpiresAt: number;
    issuedAt: number;
  },
): void {
  setControlSessionCookie(
    reply,
    login.sessionToken,
    Math.max(1, Math.floor((login.absoluteExpiresAt - login.issuedAt) / 1_000)),
  );
}

function oidcLinkContractError(error: unknown): ControlContractError {
  if (error instanceof OidcLinkError) {
    if (error.code === "stale") {
      return new ControlContractError(409, "stale_version", "The resource changed. Refresh and retry.");
    }
    if (error.code === "conflict" || error.code === "last_method") {
      return new ControlContractError(409, "identity_conflict", "The identity change conflicts with current state.");
    }
    if (error.code === "unavailable") {
      return new ControlContractError(503, "maintenance", "Identity linking is unavailable.");
    }
  }
  return new ControlContractError(404, "not_found", "The resource was not found.");
}

function registerEnrollmentRoutes(
  registry: ControlRouteRegistry,
  enrollment: LocalEnrollmentService,
  restrictedSessions: RestrictedSessionAuthenticator,
): void {
  const restrictedData = z.object({
    user_id: z.string().uuid(),
    role: roleSchema,
    purpose: z.enum(["initial_enrollment", "password_change", "totp_enrollment"]),
    csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expires_at: z.number().int().nonnegative(),
  }).strict();
  registry.register(defineControlRoute({
    id: "identity.enrollment_login",
    method: "POST",
    path: "/api/v2/auth/enrollment/login",
    summary: "Enter the restricted local enrollment flow",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      body: z.object({
        email: z.string().min(3).max(254),
        temporary_password: z.string().max(4_096),
      }).strict(),
      response: restrictedData,
    },
    rateLimit: "authentication",
    secretFields: ["/temporary_password"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      try {
        const result = await enrollment.temporaryLogin({
          email: body.email,
          temporaryPassword: body.temporary_password,
          source: request.ip,
          correlationId: request.id,
        });
        setControlEnrollmentCookie(
          reply,
          result.sessionToken,
          Math.max(1, Math.floor((result.expiresAt - Date.now()) / 1_000)),
        );
        return {
          data: {
            user_id: result.userId,
            role: result.role,
            purpose: result.purpose,
            csrf_token: result.csrfToken,
            expires_at: result.expiresAt,
          },
        };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.totp_recovery_login",
    method: "POST",
    path: "/api/v2/auth/totp-recovery/login",
    summary: "Enter the restricted TOTP recovery flow",
    tags: ["Identity"],
    authentication: "public",
    permission: null,
    stepUp: "none",
    schemas: {
      body: z.object({
        email: z.string().min(3).max(254),
        password: z.string().max(4_096),
      }).strict(),
      response: restrictedData,
    },
    rateLimit: "authentication",
    secretFields: ["/password"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      try {
        const result = await enrollment.totpRecoveryLogin({
          email: body.email,
          password: body.password,
          source: request.ip,
          correlationId: request.id,
        });
        setControlEnrollmentCookie(
          reply,
          result.sessionToken,
          Math.max(1, Math.floor((result.expiresAt - Date.now()) / 1_000)),
        );
        return {
          data: {
            user_id: result.userId,
            role: result.role,
            purpose: result.purpose,
            csrf_token: result.csrfToken,
            expires_at: result.expiresAt,
          },
        };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.enrollment_begin",
    method: "POST",
    path: "/api/v2/auth/enrollment/begin",
    summary: "Begin restricted permanent-password and TOTP enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({
        new_password: z.string().max(4_096),
      }).strict(),
      response: z.object({
        secret: z.string().regex(/^[A-Z2-7]{32}$/),
        otpauth_uri: z.string().startsWith("otpauth://totp/").max(2_048),
        csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        expires_at: z.number().int().nonnegative(),
      }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.enrollment_begin",
    secretFields: ["/new_password"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        const result = await enrollment.beginInitial(session, body.new_password);
        return {
          data: {
            secret: result.secret,
            otpauth_uri: result.uri,
            csrf_token: await restrictedSessions.rotateCsrf(request),
            expires_at: result.expiresAt,
          },
        };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.enrollment_confirm",
    method: "POST",
    path: "/api/v2/auth/enrollment/confirm",
    summary: "Confirm restricted local enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({
        new_password: z.string().max(4_096),
        totp: z.string().regex(/^\d{6}$/),
      }).strict(),
      response: z.object({ enrolled: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.enrollment_complete",
    secretFields: ["/new_password", "/totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        await enrollment.confirmInitial(session, {
          newPassword: body.new_password,
          totp: body.totp,
          correlationId: request.id,
          source: request.ip,
        });
        clearControlEnrollmentCookie(reply);
        return { data: { enrolled: true as const } };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.password_change",
    method: "POST",
    path: "/api/v2/auth/password-change",
    summary: "Complete a reset-required password change",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({
        new_password: z.string().max(4_096),
        totp: z.string().regex(/^\d{6}$/),
      }).strict(),
      response: z.object({ changed: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.password_change",
    secretFields: ["/new_password", "/totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        await enrollment.confirmPasswordChange(session, {
          newPassword: body.new_password,
          totp: body.totp,
          correlationId: request.id,
          source: request.ip,
        });
        clearControlEnrollmentCookie(reply);
        return { data: { changed: true as const } };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.totp_enrollment_begin",
    method: "POST",
    path: "/api/v2/auth/totp-enrollment/begin",
    summary: "Begin restricted TOTP re-enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      response: z.object({
        secret: z.string().regex(/^[A-Z2-7]{32}$/),
        otpauth_uri: z.string().startsWith("otpauth://totp/").max(2_048),
        csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        expires_at: z.number().int().nonnegative(),
      }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.totp_enrollment_begin",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ request }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        const result = await enrollment.beginTotpEnrollment(session);
        return {
          data: {
            secret: result.secret,
            otpauth_uri: result.uri,
            csrf_token: await restrictedSessions.rotateCsrf(request),
            expires_at: result.expiresAt,
          },
        };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.totp_enrollment_confirm",
    method: "POST",
    path: "/api/v2/auth/totp-enrollment/confirm",
    summary: "Confirm restricted TOTP re-enrollment",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({ totp: z.string().regex(/^\d{6}$/) }).strict(),
      response: z.object({ enrolled: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.totp_enrollment_complete",
    secretFields: ["/totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        await enrollment.confirmTotpEnrollment(session, {
          totp: body.totp,
          correlationId: request.id,
          source: request.ip,
        });
        clearControlEnrollmentCookie(reply);
        return { data: { enrolled: true as const } };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));
}

function registerSelfServiceRoutes(
  registry: ControlRouteRegistry,
  enrollment: LocalEnrollmentService,
  browserSessions: BrowserSessionAuthenticator,
  restrictedSessions: RestrictedSessionAuthenticator,
): void {
  registry.register(defineControlRoute({
    id: "identity.self_password_change",
    method: "POST",
    path: "/api/v2/auth/self/password",
    summary: "Change the current local password",
    tags: ["Identity"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({
        current_password: z.string().max(4_096),
        current_totp: z.string().regex(/^\d{6}$/),
        new_password: z.string().max(4_096),
      }).strict(),
      response: z.object({ changed: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.self_password_change",
    secretFields: ["/current_password", "/current_totp", "/new_password"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = browserSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        await enrollment.selfPasswordChange(session, {
          currentPassword: body.current_password,
          currentTotp: body.current_totp,
          newPassword: body.new_password,
          correlationId: request.id,
          source: request.ip,
        });
        clearControlSessionCookie(reply);
        clearControlEnrollmentCookie(reply);
        return { data: { changed: true as const } };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.self_totp_begin",
    method: "POST",
    path: "/api/v2/auth/self/totp/begin",
    summary: "Begin replacement of the current TOTP authenticator",
    tags: ["Identity"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({
        current_password: z.string().max(4_096),
        current_totp: z.string().regex(/^\d{6}$/),
      }).strict(),
      response: z.object({
        secret: z.string().regex(/^[A-Z2-7]{32}$/),
        otpauth_uri: z.string().startsWith("otpauth://totp/").max(2_048),
        csrf_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        expires_at: z.number().int().nonnegative(),
      }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.self_totp_begin",
    secretFields: ["/current_password", "/current_totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = browserSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        const result = await enrollment.beginTotpReplacement(session, {
          currentPassword: body.current_password,
          currentTotp: body.current_totp,
          correlationId: request.id,
          source: request.ip,
        });
        setControlEnrollmentCookie(
          reply,
          result.sessionToken,
          Math.max(1, Math.floor((result.expiresAt - Date.now()) / 1_000)),
        );
        return {
          data: {
            secret: result.secret,
            otpauth_uri: result.uri,
            csrf_token: result.csrfToken,
            expires_at: result.expiresAt,
          },
        };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.self_totp_confirm",
    method: "POST",
    path: "/api/v2/auth/self/totp/confirm",
    summary: "Confirm replacement of the current TOTP authenticator",
    tags: ["Identity"],
    authentication: ["restricted_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: z.object({ totp: z.string().regex(/^\d{6}$/) }).strict(),
      response: z.object({ changed: z.literal(true) }).strict(),
    },
    rateLimit: "authentication",
    auditAction: "identity.self_totp_change",
    secretFields: ["/totp"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ body, request, reply }) => {
      const session = restrictedSessions.session(request);
      if (session === undefined) {
        throw new ControlContractError(401, "unauthenticated", "Authentication required.");
      }
      try {
        await enrollment.confirmTotpReplacement(session, {
          totp: body.totp,
          correlationId: request.id,
          source: request.ip,
        });
        clearControlSessionCookie(reply);
        clearControlEnrollmentCookie(reply);
        return { data: { changed: true as const } };
      } catch (error) {
        throw enrollmentContractError(error);
      }
    },
  }));
}

function enrollmentContractError(error: unknown): ControlContractError {
  if (error instanceof EnrollmentError) {
    if (error.code === "rate_limited") {
      return new ControlContractError(429, "rate_limited", "Authentication is temporarily unavailable.");
    }
    if (error.code === "enrollment_unavailable") {
      return new ControlContractError(503, "maintenance", "Enrollment is unavailable.");
    }
    if (error.code === "invalid_request") {
      return new ControlContractError(400, "validation_failed", "Enrollment input is invalid.");
    }
    return new ControlContractError(401, "unauthenticated", "Authentication failed.");
  }
  if (error instanceof Error && error.name === "PasswordPolicyError") {
    return new ControlContractError(400, "validation_failed", "Password policy was not satisfied.");
  }
  return new ControlContractError(503, "maintenance", "Enrollment is unavailable.");
}
