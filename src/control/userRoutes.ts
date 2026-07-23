import type {
  UserAdministrationService,
  UserAdministrationView,
} from "../identity/userAdministration.js";
import { UserAdministrationError } from "../identity/userAdministration.js";
import {
  UserLifecycleAdministrationError,
  type OneTimeUserResult,
  type UserLifecycleAdministrationService,
} from "../identity/userLifecycleAdministration.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const roleSchema = z.enum(["superadmin", "admin", "user"]);
const statusSchema = z.enum([
  "invited",
  "enrollment_required",
  "active",
  "suspended",
  "deactivated",
]);
const passwordStateSchema = z.enum([
  "not_configured",
  "temporary",
  "configured",
  "disabled",
]);
const totpStateSchema = z.enum(["not_configured", "configured", "disabled"]);
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  given_name: z.string().max(100),
  family_name: z.string().max(100),
  role: roleSchema,
  status: statusSchema,
  password_state: passwordStateSchema,
  totp_state: totpStateSchema,
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const profileBodySchema = z.object({
  email: z.string().min(3).max(254),
  given_name: z.string().max(100),
  family_name: z.string().max(100),
}).strict();
const userParamsSchema = z.object({
  user_id: z.string().uuid(),
}).strict();
const justificationBodySchema = z.object({
  justification: z.string().min(1).max(1_024),
}).strict();
const oneTimeUserSchema = z.object({
  user: userSchema,
  one_time_value_displayed: z.boolean(),
  temporary_password: z.string().min(8).max(128).optional(),
  expires_at: z.number().int().nonnegative().optional(),
}).strict();

export function registerUserAdministrationRoutes(
  registry: ControlRouteRegistry,
  users: UserAdministrationService,
  lifecycle?: UserLifecycleAdministrationService,
): void {
  registry.register(defineControlRoute({
    id: "identity.self_profile",
    method: "GET",
    path: "/api/v2/auth/self/profile",
    summary: "Read the current local profile",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: { response: userSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      try {
        const user = await users.self(authentication!);
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw userContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "identity.self_profile_update",
    method: "PATCH",
    path: "/api/v2/auth/self/profile",
    summary: "Update the current local profile",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: {
      body: profileBodySchema,
      response: userSchema,
    },
    rateLimit: "management",
    auditAction: "identity.self_profile_update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, expectedVersion, body, requestId }) => {
      try {
        const user = await users.updateSelf(
          authentication!,
          expectedVersion,
          {
            email: body.email,
            givenName: body.given_name,
            familyName: body.family_name,
          },
          requestId,
        );
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw userContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.list",
    method: "GET",
    path: "/api/v2/users",
    summary: "List visible users",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "view_ordinary_users",
    stepUp: "none",
    schemas: {
      query: z.object({
        limit: z.string().regex(/^(?:[1-9]|[1-9]\d|1\d\d|200)$/).optional(),
        cursor: z.string().max(2_048).optional(),
        q: z.string().min(1).max(512).optional(),
        role: roleSchema.optional(),
        status: statusSchema.optional(),
      }).strict(),
      response: z.object({
        users: z.array(userSchema).max(200),
        next_cursor: z.string().max(2_048).optional(),
      }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => {
      try {
        const result = await users.list(authentication!, {
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.q === undefined ? {} : { q: query.q }),
          ...(query.role === undefined ? {} : { role: query.role }),
          ...(query.status === undefined ? {} : { status: query.status }),
        });
        return {
          data: {
            users: result.users.map(wireUser),
            ...(result.nextCursor === undefined
              ? {}
              : { next_cursor: result.nextCursor }),
          },
        };
      } catch (error) {
        throw userContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.detail",
    method: "GET",
    path: "/api/v2/users/{user_id}",
    summary: "Read a visible user",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "view_ordinary_users",
    stepUp: "none",
    schemas: {
      params: userParamsSchema,
      response: userSchema,
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        const user = await users.detail(authentication!, params.user_id);
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw userContractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.profile_update",
    method: "PATCH",
    path: "/api/v2/users/{user_id}/profile",
    summary: "Update an authorized user profile",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "edit_ordinary_user_profile",
    stepUp: "none",
    schemas: {
      params: userParamsSchema,
      body: profileBodySchema,
      response: userSchema,
    },
    rateLimit: "management",
    auditAction: "identity.profile_update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      expectedVersion,
      body,
      requestId,
    }) => {
      try {
        const user = await users.updateOther(
          authentication!,
          params.user_id,
          expectedVersion,
          {
            email: body.email,
            givenName: body.given_name,
            familyName: body.family_name,
          },
          requestId,
        );
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw userContractError(error);
      }
    },
  }));

  if (lifecycle === undefined) return;

  registry.register(defineControlRoute({
    id: "users.invite",
    method: "POST",
    path: "/api/v2/users",
    summary: "Invite a local user",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "invite_ordinary_user",
    stepUp: "none",
    schemas: {
      body: z.object({
        email: z.string().min(3).max(254),
        given_name: z.string().max(100),
        family_name: z.string().max(100),
        role: z.enum(["admin", "user"]),
      }).strict(),
      response: oneTimeUserSchema,
    },
    rateLimit: "management",
    auditAction: "identity.invite",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [201],
    handler: async ({ authentication, body, idempotencyKey, requestId }) => {
      try {
        const result = await lifecycle.invite(
          authentication!,
          body,
          idempotencyKey!,
          requestId,
        );
        return {
          statusCode: 201,
          data: wireOneTimeUser(result),
          version: result.user.version,
        };
      } catch (error) {
        throw lifecycleContractError(error);
      }
    },
  }));

  registerOneTimeMutation(
    registry,
    lifecycle,
    "users.password_reset",
    "/api/v2/users/{user_id}/password-reset",
    "Reset a local password",
    "reset_ordinary_user_password",
    (context) => lifecycle.resetPassword(
      context.authentication!,
      context.params.user_id,
      context.expectedVersion,
      context.body,
      context.idempotencyKey!,
      context.requestId,
      context.stepUpProof,
    ),
  );

  registry.register(defineControlRoute({
    id: "users.totp_reset",
    method: "POST",
    path: "/api/v2/users/{user_id}/totp-reset",
    summary: "Reset a local TOTP authenticator",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "reset_ordinary_user_totp",
    stepUp: "five_minutes",
    schemas: {
      params: userParamsSchema,
      body: justificationBodySchema,
      response: userSchema,
    },
    rateLimit: "management",
    auditAction: "identity.totp_reset",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async ({
      authentication,
      params,
      expectedVersion,
      body,
      idempotencyKey,
      requestId,
      stepUpProof,
    }) => {
      try {
        const user = await lifecycle.resetTotp(
          authentication!,
          params.user_id,
          expectedVersion,
          body,
          idempotencyKey!,
          requestId,
          stepUpProof,
        );
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw lifecycleContractError(error);
      }
    },
  }));

  for (const transition of ["suspend", "reactivate", "deactivate"] as const) {
    registry.register(defineControlRoute({
      id: `users.${transition}`,
      method: "POST",
      path: `/api/v2/users/{user_id}/${transition}`,
      summary: `${transition[0]!.toUpperCase()}${transition.slice(1)} a local user`,
      tags: ["Users"],
      authentication: ["browser_session"],
      permission: transition === "deactivate"
        ? "deactivate_user"
        : "suspend_reactivate_user",
      stepUp: "five_minutes",
      schemas: {
        params: userParamsSchema,
        body: justificationBodySchema,
        response: userSchema,
      },
      rateLimit: "management",
      auditAction: `identity.${transition}`,
      secretFields: [],
      cache: "no-store",
      concurrency: "if-match",
      idempotency: "none",
      handler: async ({
        authentication,
        params,
        expectedVersion,
        body,
        requestId,
        stepUpProof,
      }) => {
        try {
          const user = await lifecycle.transition(
            transition,
            authentication!,
            params.user_id,
            expectedVersion,
            body,
            requestId,
            stepUpProof,
          );
          return { data: wireUser(user), version: user.version };
        } catch (error) {
          throw lifecycleContractError(error);
        }
      },
    }));
  }

  registerOneTimeMutation(
    registry,
    lifecycle,
    "users.enrollment_restore",
    "/api/v2/users/{user_id}/restore-enrollment",
    "Restore local enrollment",
    "deactivate_user",
    (context) => lifecycle.restoreEnrollment(
      context.authentication!,
      context.params.user_id,
      context.expectedVersion,
      context.body,
      context.idempotencyKey!,
      context.requestId,
      context.stepUpProof,
    ),
  );

  registry.register(defineControlRoute({
    id: "users.role_change",
    method: "PATCH",
    path: "/api/v2/users/{user_id}/role",
    summary: "Change a local user role",
    tags: ["Users"],
    authentication: ["browser_session"],
    permission: "change_account_role",
    stepUp: "five_minutes",
    schemas: {
      params: userParamsSchema,
      body: z.object({
        role: roleSchema,
        justification: z.string().min(1).max(1_024),
      }).strict(),
      response: userSchema,
    },
    rateLimit: "management",
    auditAction: "identity.role_change",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      expectedVersion,
      body,
      requestId,
      stepUpProof,
    }) => {
      try {
        const user = await lifecycle.changeRole(
          authentication!,
          params.user_id,
          expectedVersion,
          body,
          requestId,
          stepUpProof,
        );
        return { data: wireUser(user), version: user.version };
      } catch (error) {
        throw lifecycleContractError(error);
      }
    },
  }));
}

function wireUser(user: UserAdministrationView) {
  return {
    id: user.id,
    email: user.email,
    given_name: user.givenName,
    family_name: user.familyName,
    role: user.role,
    status: user.status,
    password_state: user.passwordState,
    totp_state: user.totpState,
    version: user.version,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

type OneTimeContext = {
  authentication?: Parameters<UserLifecycleAdministrationService["resetPassword"]>[0];
  params: { user_id: string };
  expectedVersion?: number;
  body: { justification: string };
  idempotencyKey?: string;
  requestId: string;
  stepUpProof?: Parameters<UserLifecycleAdministrationService["resetPassword"]>[6];
};

function registerOneTimeMutation(
  registry: ControlRouteRegistry,
  lifecycle: UserLifecycleAdministrationService,
  id: "users.password_reset" | "users.enrollment_restore",
  path: string,
  summary: string,
  permission: "reset_ordinary_user_password" | "deactivate_user",
  invoke: (context: OneTimeContext) => ReturnType<
    UserLifecycleAdministrationService["resetPassword"]
  >,
): void {
  registry.register(defineControlRoute({
    id,
    method: "POST",
    path,
    summary,
    tags: ["Users"],
    authentication: ["browser_session"],
    permission,
    stepUp: "five_minutes",
    schemas: {
      params: userParamsSchema,
      body: justificationBodySchema,
      response: oneTimeUserSchema,
    },
    rateLimit: "management",
    auditAction: id === "users.password_reset"
      ? "identity.password_reset"
      : "identity.enrollment_restore",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => {
      try {
        const result = await invoke(context);
        return {
          data: wireOneTimeUser(result),
          version: result.user.version,
        };
      } catch (error) {
        throw lifecycleContractError(error);
      }
    },
  }));
}

function wireOneTimeUser(result: OneTimeUserResult) {
  return {
    user: wireUser(result.user),
    one_time_value_displayed: result.oneTimeValueDisplayed,
    ...(result.temporaryPassword === undefined
      ? {}
      : { temporary_password: result.temporaryPassword }),
    ...(result.expiresAt === undefined ? {} : { expires_at: result.expiresAt }),
  };
}

function userContractError(error: unknown): ControlContractError {
  if (!(error instanceof UserAdministrationError)) {
    return new ControlContractError(503, "maintenance", "User administration is unavailable.");
  }
  if (error.code === "invalid_request") {
    return new ControlContractError(400, "validation_failed", "User input is invalid.");
  }
  if (error.code === "forbidden") {
    return new ControlContractError(403, "forbidden", "The operation is not permitted.");
  }
  if (error.code === "not_found") {
    return new ControlContractError(404, "not_found", "User not found.");
  }
  if (error.code === "stale") {
    return new ControlContractError(409, "stale_version", "The user changed. Refresh and retry.");
  }
  if (error.code === "conflict") {
    return new ControlContractError(409, "identity_conflict", "A user with that profile already exists.");
  }
  return new ControlContractError(503, "maintenance", "User administration is unavailable.");
}

function lifecycleContractError(error: unknown): ControlContractError {
  if (!(error instanceof UserLifecycleAdministrationError)) {
    return new ControlContractError(503, "maintenance", "User administration is unavailable.");
  }
  if (error.code === "invalid_request") {
    return new ControlContractError(400, "validation_failed", "User input is invalid.");
  }
  if (error.code === "forbidden") {
    return new ControlContractError(403, "forbidden", "The operation is not permitted.");
  }
  if (error.code === "not_found") {
    return new ControlContractError(404, "not_found", "User not found.");
  }
  if (error.code === "stale") {
    return new ControlContractError(409, "stale_version", "The user changed. Refresh and retry.");
  }
  if (error.code === "conflict") {
    return new ControlContractError(
      409,
      "identity_conflict",
      "A user with that profile already exists.",
    );
  }
  if (error.code === "last_superadmin") {
    return new ControlContractError(
      409,
      "last_active_superadmin",
      "The final active superadmin must be retained.",
    );
  }
  if (error.code === "idempotency_conflict") {
    return new ControlContractError(
      409,
      "idempotency_conflict",
      "The idempotency key was already used for another request.",
    );
  }
  return new ControlContractError(503, "maintenance", "User administration is unavailable.");
}
