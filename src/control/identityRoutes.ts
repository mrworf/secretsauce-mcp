import {
  LocalAuthenticationError,
  type LocalAuthenticationService,
} from "../identity/localAuthentication.js";
import type { BrowserSessionAuthenticator } from "../identity/browserSessions.js";
import type { StepUpService } from "../identity/stepUp.js";
import type { UserAdministrationService } from "../identity/userAdministration.js";
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
  setControlEnrollmentCookie,
  setControlSessionCookie,
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
