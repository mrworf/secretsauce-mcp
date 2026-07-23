import type { FastifyReply, FastifyRequest } from "fastify";
import type { ControlConfig } from "../types.js";
import {
  bindControlAuthentication,
  type ControlAuthenticationMethod,
  type ControlAuthenticator,
} from "./authentication.js";
import {
  ControlRateLimiter,
  type ControlRateLimitClass,
} from "./rateLimiter.js";

export const CONTROL_API_PREFIX = "/api/v2";
export const CONTROL_BROWSER_PREFIX = "/control";
export const CONTROL_BODY_LIMIT_BYTES = 1_048_576;
export const CONTROL_SESSION_COOKIE = "__Host-secretsauce_session";
export const CONTROL_ENROLLMENT_COOKIE = "__Host-secretsauce_enrollment";
export const CONTROL_OIDC_FLOW_COOKIE = "__Host-secretsauce_oidc";

export interface ControlRouteSecurity {
  public: boolean;
  cache?: "no-store" | "immutable";
  authenticationMethods?: readonly ControlAuthenticationMethod[];
  rateLimit?: ControlRateLimitClass;
}

export function controlSecurityHooks(
  config: ControlConfig,
  authenticator: ControlAuthenticator,
  rateLimiter: ControlRateLimiter,
): {
  onRequest(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  onSend(request: FastifyRequest, reply: FastifyReply): Promise<void>;
} {
  return {
    async onRequest(request, reply) {
      reply.header("x-request-id", request.id);
      if (!hasExpectedHost(request, config.publicAuthority)) {
        sendControlError(reply, request.id, 400, "invalid_request", "Invalid request authority.");
        return;
      }
      const origin = request.headers.origin;
      if (origin !== undefined && (typeof origin !== "string" || origin !== config.publicOrigin)) {
        sendControlError(reply, request.id, 403, "forbidden", "Cross-origin request denied.");
        return;
      }
      const security = routeSecurity(request);
      if (security.public) {
        if (!applyRateLimit(request, reply, rateLimiter, security.rateLimit ?? "none")) return;
        return;
      }

      const authentication = await authenticator.authenticate(request);
      if (authentication === undefined) {
        sendControlError(reply, request.id, 401, "unauthenticated", "Authentication required.");
        return;
      }
      if (
        security.authenticationMethods !== undefined &&
        !security.authenticationMethods.includes(authentication.method)
      ) {
        sendControlError(reply, request.id, 403, "forbidden", "Authentication method not permitted.");
        return;
      }
      if (!applyRateLimit(
        request,
        reply,
        rateLimiter,
        security.rateLimit ?? "management",
        authentication.principalId,
      )) return;
      bindControlAuthentication(request, authentication);
      if (
        !["browser_session", "restricted_session"].includes(authentication.method) ||
        isSafeMethod(request.method)
      ) return;
      if (origin !== config.publicOrigin) {
        sendControlError(reply, request.id, 403, "forbidden", "CSRF validation failed.");
        return;
      }
      const proof = request.headers["x-csrf-token"];
      if (
        typeof proof !== "string" ||
        proof.length < 16 ||
        proof.length > 256 ||
        !(await authenticator.verifyCsrf(authentication, proof, request))
      ) {
        sendControlError(reply, request.id, 403, "forbidden", "CSRF validation failed.");
      }
    },
    async onSend(request, reply) {
      reply
        .header(
          "content-security-policy",
          "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'",
        )
        .header("x-frame-options", "DENY")
        .header("x-content-type-options", "nosniff")
        .header("referrer-policy", "no-referrer")
        .header("permissions-policy", "camera=(), microphone=(), geolocation=()")
        .header("cross-origin-opener-policy", "same-origin")
        .header("cross-origin-resource-policy", "same-origin");
      if (routeSecurity(request).cache === "immutable") {
        reply.header("cache-control", "public, max-age=31536000, immutable");
      } else {
        reply.header("cache-control", "no-store").header("pragma", "no-cache");
      }
      reply.removeHeader("access-control-allow-origin");
      reply.removeHeader("access-control-allow-credentials");
    },
  };
}

export function publicControlRoute(
  cache: ControlRouteSecurity["cache"] = "no-store",
): { controlSecurity: ControlRouteSecurity } {
  return { controlSecurity: { public: true, cache, rateLimit: "none" } };
}

export function setControlSessionCookie(
  reply: FastifyReply,
  value: string,
  maxAgeSeconds: number,
): void {
  reply.setCookie(CONTROL_SESSION_COOKIE, value, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: maxAgeSeconds,
  });
}

export function clearControlSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(CONTROL_SESSION_COOKIE, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict",
  });
}

export function setControlEnrollmentCookie(
  reply: FastifyReply,
  value: string,
  maxAgeSeconds: number,
): void {
  reply.setCookie(CONTROL_ENROLLMENT_COOKIE, value, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: maxAgeSeconds,
  });
}

export function clearControlEnrollmentCookie(reply: FastifyReply): void {
  reply.clearCookie(CONTROL_ENROLLMENT_COOKIE, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict",
  });
}

export function setControlOidcFlowCookie(
  reply: FastifyReply,
  value: string,
  maxAgeSeconds: number,
): void {
  reply.setCookie(CONTROL_OIDC_FLOW_COOKIE, value, {
    path: "/api/v2/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: maxAgeSeconds,
  });
}

export function clearControlOidcFlowCookie(reply: FastifyReply): void {
  reply.clearCookie(CONTROL_OIDC_FLOW_COOKIE, {
    path: "/api/v2/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
}

export function sendControlError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  void reply.code(statusCode).type("application/json; charset=utf-8").send({
    error: {
      code,
      message,
      request_id: requestId,
      ...(details === undefined ? {} : { details }),
    },
  });
}

function applyRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  limiter: ControlRateLimiter,
  rateClass: ControlRateLimitClass,
  principalId?: string,
): boolean {
  const result = limiter.check(rateClass, request.ip, principalId);
  if (result.allowed) return true;
  const retryAfter = result.retryAfterSeconds ?? 60;
  reply.header("retry-after", String(retryAfter));
  sendControlError(
    reply,
    request.id,
    429,
    "rate_limited",
    "Request rate limit exceeded.",
    { retry_after_seconds: retryAfter },
  );
  return false;
}

function hasExpectedHost(request: FastifyRequest, authority: string): boolean {
  const host = request.headers.host;
  return typeof host === "string" && host.toLowerCase() === authority;
}

function routeSecurity(request: FastifyRequest): ControlRouteSecurity {
  const config = request.routeOptions.config as {
    controlSecurity?: ControlRouteSecurity;
  };
  return config.controlSecurity ?? { public: false, cache: "no-store" };
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}
