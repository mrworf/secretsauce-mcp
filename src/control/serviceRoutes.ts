import {
  ServiceManagementError,
  type ServiceDetailView,
  type ServiceDestinationView,
  type ServiceManagementService,
  type ServiceValidationView,
  type ServiceView,
} from "../serviceManagement.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const lifecycleSchema = z.enum(["draft", "published", "archived"]);
const serviceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  documentation_url: z.string().url().max(2_048).optional(),
  lifecycle: lifecycleSchema,
  draft_matches_published: z.boolean(),
  publication_generation: z.number().int().nonnegative(),
  published_revision: z.object({
    id: z.string().uuid(),
    sequence: z.number().int().positive(),
    published_at: z.number().int().nonnegative(),
  }).strict().optional(),
  destination_count: z.number().int().nonnegative(),
  admin_count: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const serviceParams = z.object({ service_id: z.string().uuid() }).strict();
const adminParams = z.object({
  service_id: z.string().uuid(),
  user_id: z.string().uuid(),
}).strict();
const profileBody = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  documentation_url: z.string().url().max(2_048).optional(),
}).strict();
const profilePatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(1_024).nullable().optional(),
  documentation_url: z.string().url().max(2_048).nullable().optional(),
}).strict().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one profile field is required." },
);
const hostMatcherSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exact"), value: z.string().min(1).max(253) }).strict(),
  z.object({ type: z.literal("suffix"), value: z.string().min(1).max(253) }).strict(),
  z.object({ type: z.literal("regex"), value: z.string().min(1).max(256) }).strict(),
]);
const destinationBody = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  base_url: z.string().min(8).max(2_048),
  schemes: z.array(z.enum(["http", "https"])).min(1).max(2),
  hosts: z.array(hostMatcherSchema).min(1).max(32),
  ports: z.array(z.number().int().min(1).max(65_535)).min(1).max(32),
  tls_verify: z.boolean(),
}).strict();
const destinationPatchBody = destinationBody.omit({ slug: true });
const destinationSchema = destinationBody.extend({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const serviceDetailSchema = serviceSchema.extend({
  destinations: z.array(destinationSchema).max(64),
}).strict();
const destinationParams = z.object({
  service_id: z.string().uuid(),
  destination_id: z.string().uuid(),
}).strict();
const validationSchema = z.object({
  valid: z.boolean(),
  draft_digest: z.string().regex(/^[a-f0-9]{64}$/),
  issues: z.array(z.object({
    code: z.enum(["service_archived", "service_admin_required", "destination_required"]),
    pointer: z.enum(["/lifecycle", "/admins", "/destinations"]),
  }).strict()).max(3),
  warnings: z.array(z.object({
    code: z.literal("tls_verification_disabled"),
    pointer: z.string().regex(/^\/destinations\/(?:0|[1-5]?\d|6[0-3])\/tls_verify$/),
  }).strict()).max(64),
}).strict();

export function registerServiceManagementRoutes(
  registry: ControlRouteRegistry,
  services: ServiceManagementService,
): void {
  registry.register(defineControlRoute({
    id: "services.list",
    method: "GET",
    path: "/api/v2/services",
    summary: "List visible database-managed services",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "view_service_configuration",
    stepUp: "none",
    schemas: {
      query: z.object({
        limit: z.string().regex(/^(?:[1-9]|[1-9]\d|1\d\d|200)$/).optional(),
        cursor: z.string().max(2_048).optional(),
        q: z.string().min(1).max(512).optional(),
        lifecycle: lifecycleSchema.optional(),
      }).strict(),
      response: z.object({
        services: z.array(serviceSchema).max(200),
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
        const result = await services.list(authentication!, {
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.q === undefined ? {} : { q: query.q }),
          ...(query.lifecycle === undefined ? {} : { lifecycle: query.lifecycle }),
        });
        return {
          data: {
            services: result.services.map(wireService),
            ...(result.nextCursor === undefined ? {} : { next_cursor: result.nextCursor }),
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.detail",
    method: "GET",
    path: "/api/v2/services/{service_id}",
    summary: "Read a visible database-managed service",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "view_service_configuration",
    stepUp: "none",
    schemas: { params: serviceParams, response: serviceDetailSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        const service = await services.detail(authentication!, params.service_id);
        return { data: wireServiceDetail(service), version: service.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.profile_update",
    method: "PATCH",
    path: "/api/v2/services/{service_id}",
    summary: "Update a mutable service profile draft",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: profilePatchBody,
      response: serviceDetailSchema,
    },
    rateLimit: "management",
    auditAction: "service.profile_update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, params, body, expectedVersion, requestId }) => {
      try {
        const service = await services.updateProfile(
          authentication!,
          params.service_id,
          expectedVersion!,
          {
            ...(body.name === undefined ? {} : { name: body.name }),
            ...(body.description === undefined ? {} : { description: body.description }),
            ...(body.documentation_url === undefined
              ? {}
              : { documentationUrl: body.documentation_url }),
          },
          requestId,
        );
        return { data: wireServiceDetail(service), version: service.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.destination_create",
    method: "POST",
    path: "/api/v2/services/{service_id}/destinations",
    summary: "Add a destination to a service draft",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: destinationBody,
      response: serviceDetailSchema,
    },
    rateLimit: "management",
    auditAction: "service.destination_create",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, params, body, expectedVersion, requestId }) => {
      try {
        const service = await services.createDestination(
          authentication!,
          params.service_id,
          expectedVersion!,
          fromDestinationBody(body),
          requestId,
        );
        return { data: wireServiceDetail(service), version: service.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  for (const remove of [false, true] as const) {
    registry.register(defineControlRoute({
      id: remove ? "services.destination_delete" : "services.destination_update",
      method: remove ? "DELETE" : "PATCH",
      path: "/api/v2/services/{service_id}/destinations/{destination_id}",
      summary: remove
        ? "Remove a destination from a service draft"
        : "Update a service draft destination",
      tags: ["Services"],
      authentication: ["browser_session"],
      permission: "configure_service",
      stepUp: "none",
      schemas: {
        params: destinationParams,
        ...(remove ? {} : { body: destinationPatchBody }),
        response: serviceDetailSchema,
      },
      rateLimit: "management",
      auditAction: remove
        ? "service.destination_delete"
        : "service.destination_update",
      secretFields: [],
      cache: "no-store",
      concurrency: "if-match",
      idempotency: "none",
      handler: async ({ authentication, params, body, expectedVersion, requestId }) => {
        try {
          const service = remove
            ? await services.deleteDestination(
                authentication!,
                params.service_id,
                params.destination_id,
                expectedVersion!,
                requestId,
              )
            : await services.updateDestination(
                authentication!,
                params.service_id,
                params.destination_id,
                expectedVersion!,
                fromDestinationPatchBody(body),
                requestId,
              );
          return { data: wireServiceDetail(service), version: service.version };
        } catch (error) {
          throw contractError(error);
        }
      },
    }));
  }

  registry.register(defineControlRoute({
    id: "services.validate",
    method: "POST",
    path: "/api/v2/services/{service_id}/validate",
    summary: "Validate a service draft without publishing it",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: z.object({}).strict(),
      response: validationSchema,
    },
    rateLimit: "management",
    auditAction: "service.validate",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params, requestId }) => {
      try {
        const validation = await services.validate(
          authentication!,
          params.service_id,
          requestId,
        );
        return { data: wireValidation(validation) };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.publish",
    method: "POST",
    path: "/api/v2/services/{service_id}/publish",
    summary: "Publish an immutable validated service revision",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "configure_service",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: z.object({}).strict(),
      response: serviceDetailSchema,
    },
    rateLimit: "management",
    auditAction: "service.publish",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, params, expectedVersion, requestId }) => {
      try {
        const service = await services.publish(
          authentication!,
          params.service_id,
          expectedVersion!,
          requestId,
        );
        return { data: wireServiceDetail(service), version: service.version };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.create",
    method: "POST",
    path: "/api/v2/services",
    summary: "Create a non-routable service draft",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "create_service",
    stepUp: "none",
    schemas: { body: profileBody, response: serviceSchema },
    rateLimit: "management",
    auditAction: "service.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async ({ authentication, body, idempotencyKey, requestId }) => {
      try {
        const result = await services.create(
          authentication!,
          {
            slug: body.slug,
            name: body.name,
            ...(body.description === undefined ? {} : { description: body.description }),
            ...(body.documentation_url === undefined
              ? {}
              : { documentationUrl: body.documentation_url }),
          },
          idempotencyKey!,
          requestId,
        );
        return {
          data: wireService(result.service),
          version: result.service.version,
          statusCode: result.replayed ? 200 : 201,
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "services.admins",
    method: "GET",
    path: "/api/v2/services/{service_id}/admins",
    summary: "List administrators assigned to a service",
    tags: ["Services"],
    authentication: ["browser_session"],
    permission: "view_service_configuration",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      response: z.object({
        admins: z.array(z.object({
          id: z.string().uuid(),
          email: z.string().email().max(254),
          given_name: z.string().max(100),
          family_name: z.string().max(100),
          status: z.string().max(32),
          assigned_at: z.number().int().nonnegative(),
        }).strict()).max(200),
      }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => {
      try {
        const admins = await services.admins(authentication!, params.service_id);
        return {
          data: {
            admins: admins.map((admin) => ({
              id: admin.id,
              email: admin.email,
              given_name: admin.givenName,
              family_name: admin.familyName,
              status: admin.status,
              assigned_at: admin.createdAt,
            })),
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));

  for (const remove of [false, true] as const) {
    registry.register(defineControlRoute({
      id: remove ? "services.admin_remove" : "services.admin_assign",
      method: remove ? "DELETE" : "PUT",
      path: "/api/v2/services/{service_id}/admins/{user_id}",
      summary: remove
        ? "Remove a service administrator"
        : "Assign a service administrator",
      tags: ["Services"],
      authentication: ["browser_session"],
      permission: "assign_service_admin",
      stepUp: "none",
      schemas: {
        params: adminParams,
        body: z.object({}).strict(),
        response: serviceSchema,
      },
      rateLimit: "management",
      auditAction: remove ? "service.admin_remove" : "service.admin_assign",
      secretFields: [],
      cache: "no-store",
      concurrency: "if-match",
      idempotency: "none",
      handler: async ({ authentication, params, expectedVersion, requestId }) => {
        try {
          const service = await services.assign(
            authentication!,
            params.service_id,
            params.user_id,
            expectedVersion!,
            remove,
            requestId,
          );
          return { data: wireService(service), version: service.version };
        } catch (error) {
          throw contractError(error);
        }
      },
    }));
  }
}

function wireService(service: ServiceView) {
  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    ...(service.description === undefined ? {} : { description: service.description }),
    ...(service.documentationUrl === undefined
      ? {}
      : { documentation_url: service.documentationUrl }),
    lifecycle: service.lifecycle,
    draft_matches_published: service.draftMatchesPublished,
    publication_generation: service.publicationGeneration,
    ...(service.publishedRevision === undefined
      ? {}
      : {
          published_revision: {
            id: service.publishedRevision.id,
            sequence: service.publishedRevision.sequence,
            published_at: service.publishedRevision.publishedAt,
          },
        }),
    destination_count: service.destinationCount,
    admin_count: service.adminCount,
    version: service.version,
    created_at: service.createdAt,
    updated_at: service.updatedAt,
  };
}

function wireServiceDetail(service: ServiceDetailView) {
  return {
    ...wireService(service),
    destinations: service.destinations.map(wireDestination),
  };
}

function wireDestination(destination: ServiceDestinationView) {
  return {
    id: destination.id,
    slug: destination.slug,
    base_url: destination.baseUrl,
    schemes: destination.schemes,
    hosts: destination.hosts,
    ports: destination.ports,
    tls_verify: destination.tlsVerify,
    version: destination.version,
    created_at: destination.createdAt,
    updated_at: destination.updatedAt,
  };
}

function fromDestinationBody(body: {
  slug: string;
  base_url: string;
  schemes: Array<"http" | "https">;
  hosts: Array<
    | { type: "exact"; value: string }
    | { type: "suffix"; value: string }
    | { type: "regex"; value: string }
  >;
  ports: number[];
  tls_verify: boolean;
}) {
  return {
    slug: body.slug,
    baseUrl: body.base_url,
    schemes: body.schemes,
    hosts: body.hosts,
    ports: body.ports,
    tlsVerify: body.tls_verify,
  };
}

function fromDestinationPatchBody(body: {
  base_url: string;
  schemes: Array<"http" | "https">;
  hosts: Array<
    | { type: "exact"; value: string }
    | { type: "suffix"; value: string }
    | { type: "regex"; value: string }
  >;
  ports: number[];
  tls_verify: boolean;
}) {
  return {
    baseUrl: body.base_url,
    schemes: body.schemes,
    hosts: body.hosts,
    ports: body.ports,
    tlsVerify: body.tls_verify,
  };
}

function wireValidation(validation: ServiceValidationView) {
  return {
    valid: validation.valid,
    draft_digest: validation.draftDigest,
    issues: validation.issues,
    warnings: validation.warnings,
  };
}

function contractError(error: unknown): ControlContractError {
  if (error instanceof ServiceManagementError) {
    if (error.code === "invalid_request") {
      return new ControlContractError(400, "invalid_request", "The request is invalid.");
    }
    if (error.code === "stale") {
      return new ControlContractError(409, "stale_version", "The resource changed. Refresh and retry.");
    }
    if (error.code === "conflict") {
      return new ControlContractError(409, "service_conflict", "The service conflicts with current state.");
    }
    if (error.code === "idempotency_conflict") {
      return new ControlContractError(409, "idempotency_conflict", "The idempotency key conflicts with a prior request.");
    }
    if (error.code === "unavailable") {
      return new ControlContractError(503, "maintenance", "Service management is unavailable.");
    }
  }
  return new ControlContractError(404, "not_found", "The resource was not found.");
}
