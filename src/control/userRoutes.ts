import type { UserAdministrationService } from "../identity/userAdministration.js";
import { UserAdministrationError } from "../identity/userAdministration.js";
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

export function registerUserAdministrationRoutes(
  registry: ControlRouteRegistry,
  users: UserAdministrationService,
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
}

function wireUser(user: Awaited<ReturnType<UserAdministrationService["self"]>>) {
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
