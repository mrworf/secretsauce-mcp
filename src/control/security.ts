import type { FastifyReply, FastifyRequest } from "fastify";
import type { ControlConfig } from "../types.js";
import {
  bindControlAuthentication,
  type ControlAuthenticator,
} from "./authentication.js";

export const CONTROL_API_PREFIX = "/api/v2";
export const CONTROL_BROWSER_PREFIX = "/control";
export const CONTROL_BODY_LIMIT_BYTES = 1_048_576;
export const CONTROL_SESSION_COOKIE = "__Host-secretsauce_session";

export interface ControlRouteSecurity {
  public: boolean;
  cache?: "no-store" | "immutable";
}

export function controlSecurityHooks(
  config: ControlConfig,
  authenticator: ControlAuthenticator,
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
      if (routeSecurity(request).public) return;

      const authentication = await authenticator.authenticate(request);
      if (authentication === undefined) {
        sendControlError(reply, request.id, 401, "unauthenticated", "Authentication required.");
        return;
      }
      bindControlAuthentication(request, authentication);
      if (authentication.method !== "browser_session" || isSafeMethod(request.method)) return;
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
  return { controlSecurity: { public: true, cache } };
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

export function sendControlError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
): void {
  void reply.code(statusCode).type("application/json; charset=utf-8").send({
    error: {
      code,
      message,
      request_id: requestId,
    },
  });
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
