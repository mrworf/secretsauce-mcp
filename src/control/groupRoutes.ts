import {
  GroupAssignmentError,
  type EffectiveServiceAccess,
  type GroupAssignmentService,
  type ServiceAssignmentView,
  type ServiceGroupView,
} from "../groupAssignments.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const uuid = z.string().uuid();
const serviceParams = z.object({ service_id: uuid }).strict();
const groupParams = z.object({ service_id: uuid, group_id: uuid }).strict();
const lifecycle = z.enum(["active", "archived"]);
const groupProfile = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
}).strict();
const groupSchema = z.object({
  id: uuid,
  service_id: uuid,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  lifecycle,
  member_count: z.number().int().min(0).max(1_000),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const memberSchema = z.object({
  id: uuid,
  email: z.string().email().max(254),
  given_name: z.string().max(128),
  family_name: z.string().max(128),
  status: z.enum(["invited", "enrollment_required", "active", "suspended", "deactivated"]),
}).strict();
const membersBody = z.object({
  user_ids: z.array(uuid).max(200),
}).strict().refine(
  ({ user_ids }) => new Set(user_ids).size === user_ids.length,
  { message: "Member UUIDs must be unique." },
);
const justificationBody = z.object({
  justification: z.string().min(1).max(1_024)
    .refine((value) => value === value.trim() && !value.includes("\0")),
}).strict();
const selectorBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({
    kind: z.literal("groups"),
    group_ids: z.array(uuid).min(1).max(1_000),
  }).strict(),
  z.object({
    kind: z.literal("users"),
    user_ids: z.array(uuid).min(1).max(1_000),
    direct_assignment_confirmed: z.literal(true),
  }).strict(),
  z.object({
    kind: z.literal("principals"),
    group_ids: z.array(uuid).max(1_000),
    user_ids: z.array(uuid).max(1_000),
    direct_assignment_confirmed: z.boolean(),
  }).strict().superRefine((value, context) => {
    if (value.group_ids.length === 0 && value.user_ids.length === 0) {
      context.addIssue({ code: "custom", path: [], message: "A principal is required." });
    }
    if (value.user_ids.length > 0 && value.direct_assignment_confirmed !== true) {
      context.addIssue({
        code: "custom",
        path: ["direct_assignment_confirmed"],
        message: "Direct assignment confirmation is required.",
      });
    }
    if (value.user_ids.length === 0 && value.direct_assignment_confirmed !== false) {
      context.addIssue({
        code: "custom",
        path: ["direct_assignment_confirmed"],
        message: "Direct assignment confirmation must match the selection.",
      });
    }
  }),
]);
const normalizedSelectorSchema = z.union([
  z.object({
    kind: z.literal("all"),
    group_ids: z.tuple([]),
    user_ids: z.tuple([]),
  }).strict(),
  z.object({
    kind: z.literal("explicit"),
    group_ids: z.array(uuid).max(1_000),
    user_ids: z.array(uuid).max(1_000),
  }).strict(),
]);
const assignmentSchema = z.object({
  service_id: uuid,
  selector: normalizedSelectorSchema.optional(),
  version: z.number().int().positive(),
  authorization_generation: z.number().int().nonnegative(),
}).strict();
const contributionSchema = z.union([
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("direct") }).strict(),
  z.object({
    kind: z.literal("group"),
    group_id: uuid,
    group_name: z.string().min(1).max(120),
  }).strict(),
]);
const accessSchema = z.object({
  service_id: uuid,
  user_id: uuid,
  email: z.string().email().max(254),
  given_name: z.string().max(128),
  family_name: z.string().max(128),
  contributions: z.array(contributionSchema).min(1).max(201),
}).strict();
const ownServiceSchema = z.object({
  id: uuid,
  slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(120),
}).strict();

export function registerGroupAssignmentRoutes(
  registry: ControlRouteRegistry,
  groups: GroupAssignmentService,
): void {
  registry.register(defineControlRoute({
    id: "groups.list",
    method: "GET",
    path: "/api/v2/services/{service_id}/groups",
    summary: "List service-scoped groups",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      response: z.object({ groups: z.array(groupSchema).max(200) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        return {
          data: {
            groups: (await groups.groups(authentication!, params.service_id)).map(wireGroup),
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.create",
    method: "POST",
    path: "/api/v2/services/{service_id}/groups",
    summary: "Create a service-scoped group",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: { params: serviceParams, body: groupProfile, response: groupSchema },
    rateLimit: "management",
    auditAction: "group.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async ({ authentication, params, body, idempotencyKey, requestId }) => {
      try {
        const result = await groups.createGroup(
          authentication!,
          params.service_id,
          body,
          idempotencyKey!,
          requestId,
        );
        return {
          data: wireGroup(result.group),
          statusCode: result.replayed ? 200 : 201,
          version: result.group.version,
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.detail",
    method: "GET",
    path: "/api/v2/services/{service_id}/groups/{group_id}",
    summary: "Read a service-scoped group",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: { params: groupParams, response: groupSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        const group = await groups.group(
          authentication!,
          params.service_id,
          params.group_id,
        );
        return { data: wireGroup(group), version: group.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.update",
    method: "PATCH",
    path: "/api/v2/services/{service_id}/groups/{group_id}",
    summary: "Update an active service-scoped group",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: { params: groupParams, body: groupProfile, response: groupSchema },
    rateLimit: "management",
    auditAction: "group.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, params, body, expectedVersion, requestId }) => {
      try {
        const group = await groups.updateGroup(
          authentication!,
          params.service_id,
          params.group_id,
          expectedVersion!,
          body,
          requestId,
        );
        return { data: wireGroup(group), version: group.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.members",
    method: "GET",
    path: "/api/v2/services/{service_id}/groups/{group_id}/members",
    summary: "List service group members",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_membership",
    stepUp: "none",
    schemas: {
      params: groupParams,
      response: z.object({ members: z.array(memberSchema).max(1_000) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        return {
          data: {
            members: (await groups.members(
              authentication!,
              params.service_id,
              params.group_id,
            )).map((member) => ({
              id: member.id,
              email: member.email,
              given_name: member.givenName,
              family_name: member.familyName,
              status: member.status as "invited" | "enrollment_required" | "active" |
                "suspended" | "deactivated",
            })),
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.members.replace",
    method: "PUT",
    path: "/api/v2/services/{service_id}/groups/{group_id}/members",
    summary: "Replace active ordinary-user group membership",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_membership",
    stepUp: "none",
    schemas: { params: groupParams, body: membersBody, response: groupSchema },
    rateLimit: "management",
    auditAction: "group.members.replace",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      idempotencyKey,
      requestId,
    }) => {
      try {
        const result = await groups.replaceMembers(
          authentication!,
          params.service_id,
          params.group_id,
          expectedVersion!,
          body,
          idempotencyKey!,
          requestId,
        );
        return { data: wireGroup(result.group), version: result.group.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.archive",
    method: "POST",
    path: "/api/v2/services/{service_id}/groups/{group_id}/archive",
    summary: "Archive a service group and remove its selector",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: { params: groupParams, body: justificationBody, response: groupSchema },
    rateLimit: "management",
    auditAction: "group.archive",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      idempotencyKey,
      requestId,
    }) => {
      try {
        const result = await groups.archiveGroup(
          authentication!,
          params.service_id,
          params.group_id,
          expectedVersion!,
          body,
          idempotencyKey!,
          requestId,
        );
        return { data: wireGroup(result.group), version: result.group.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "groups.delete",
    method: "DELETE",
    path: "/api/v2/services/{service_id}/groups/{group_id}",
    summary: "Permanently delete an archived service group",
    tags: ["Groups"],
    authentication: ["browser_session"],
    permission: "manage_service_groups",
    stepUp: "none",
    schemas: {
      params: groupParams,
      body: justificationBody,
      response: z.object({
        group_id: uuid,
        deleted: z.literal(true),
        replayed: z.boolean(),
      }).strict(),
    },
    rateLimit: "management",
    auditAction: "group.delete",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      idempotencyKey,
      requestId,
    }) => {
      try {
        const result = await groups.deleteGroup(
          authentication!,
          params.service_id,
          params.group_id,
          expectedVersion!,
          body,
          idempotencyKey!,
          requestId,
        );
        return {
          data: {
            group_id: result.groupId,
            deleted: true as const,
            replayed: result.replayed,
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.assignments",
    method: "GET",
    path: "/api/v2/services/{service_id}/assignments",
    summary: "Read the normalized service principal selector",
    tags: ["Assignments"],
    authentication: ["browser_session"],
    permission: "manage_service_membership",
    stepUp: "none",
    schemas: { params: serviceParams, response: assignmentSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        const assignments = await groups.assignments(authentication!, params.service_id);
        return { data: wireAssignments(assignments), version: assignments.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.assignments.replace",
    method: "PUT",
    path: "/api/v2/services/{service_id}/assignments",
    summary: "Replace the service principal selector",
    tags: ["Assignments"],
    authentication: ["browser_session"],
    permission: "manage_service_membership",
    stepUp: "none",
    schemas: { params: serviceParams, body: selectorBody, response: assignmentSchema },
    rateLimit: "management",
    auditAction: "service.assignments.replace",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      idempotencyKey,
      requestId,
    }) => {
      try {
        const result = await groups.replaceAssignments(
          authentication!,
          params.service_id,
          expectedVersion!,
          body,
          idempotencyKey!,
          requestId,
        );
        return {
          data: wireAssignments(result.assignments),
          version: result.assignments.version,
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.access",
    method: "GET",
    path: "/api/v2/services/{service_id}/access",
    summary: "Explain effective ordinary-user service access",
    tags: ["Assignments"],
    authentication: ["browser_session"],
    permission: "manage_service_membership",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      response: z.object({ access: z.array(accessSchema).max(1_000) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        return {
          data: {
            access: (await groups.access(authentication!, params.service_id)).map(wireAccess),
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "users.me.services",
    method: "GET",
    path: "/api/v2/users/me/services",
    summary: "List the current ordinary user's effective service names",
    tags: ["Assignments"],
    authentication: ["browser_session"],
    permission: "view_service_configuration",
    stepUp: "none",
    schemas: {
      response: z.object({ services: z.array(ownServiceSchema).max(500) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      try {
        return { data: { services: await groups.ownServices(authentication!) } };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));
}

function wireGroup(group: ServiceGroupView) {
  return {
    id: group.id,
    service_id: group.serviceId,
    name: group.name,
    ...(group.description === undefined ? {} : { description: group.description }),
    lifecycle: group.lifecycle,
    member_count: group.memberCount,
    version: group.version,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  };
}

function wireAssignments(assignments: ServiceAssignmentView) {
  return {
    service_id: assignments.serviceId,
    ...(assignments.selector === undefined
      ? {}
      : assignments.selector.kind === "all"
        ? { selector: { kind: "all" as const, group_ids: [] as [], user_ids: [] as [] } }
        : {
            selector: {
              kind: "explicit" as const,
              group_ids: [...assignments.selector.groupIds],
              user_ids: [...assignments.selector.userIds],
            },
          }),
    version: assignments.version,
    authorization_generation: assignments.authorizationGeneration,
  };
}

function wireAccess(access: EffectiveServiceAccess) {
  return {
    service_id: access.serviceId,
    user_id: access.userId,
    email: access.email!,
    given_name: access.givenName!,
    family_name: access.familyName!,
    contributions: access.contributions.map((contribution) =>
      contribution.kind === "group"
        ? {
            kind: "group" as const,
            group_id: contribution.groupId,
            group_name: contribution.groupName,
          }
        : contribution),
  };
}

function contractError(error: unknown): ControlContractError {
  if (!(error instanceof GroupAssignmentError)) {
    return new ControlContractError(500, "internal_error", "Group management is unavailable.");
  }
  if (error.code === "invalid_request") {
    return new ControlContractError(400, "invalid_request", "Group management input is invalid.");
  }
  if (error.code === "not_found") {
    return new ControlContractError(404, "not_found", "Group or service was not found.");
  }
  if (error.code === "stale") {
    return new ControlContractError(
      409,
      "stale_version",
      "The resource changed. Refresh and retry.",
    );
  }
  if (error.code === "idempotency_conflict") {
    return new ControlContractError(
      409,
      "idempotency_conflict",
      "The idempotency key was already used for different inputs.",
    );
  }
  if (error.code === "conflict") {
    return new ControlContractError(
      409,
      "service_conflict",
      "The group or assignment conflicts with current state.",
    );
  }
  return new ControlContractError(500, "internal_error", "Group management is unavailable.");
}
