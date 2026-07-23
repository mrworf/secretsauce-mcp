import {
  LocalAuthenticationError,
  type LocalAuthenticationService,
} from "../identity/localAuthentication.js";
import type { BrowserSessionAuthenticator } from "../identity/browserSessions.js";
import { ControlContractError } from "./contracts.js";
import {
  defineControlRoute,
  type ControlRouteRegistry,
} from "./routeRegistry.js";
import {
  clearControlSessionCookie,
  setControlSessionCookie,
} from "./security.js";
import { z } from "./zod.js";

export interface LocalIdentityControl {
  authentication: LocalAuthenticationService;
  browserSessions: BrowserSessionAuthenticator;
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
