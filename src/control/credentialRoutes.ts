import {
  CredentialManagementError,
  type CredentialManagementService,
  type CredentialView,
} from "../credentialManagement.js";
import type { CredentialVaultCoordinator } from "../credentialVaultCoordinator.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const uuid = z.string().uuid();
const serviceParams = z.object({ service_id: uuid }).strict();
const credentialParams = z.object({
  service_id: uuid,
  credential_id: uuid,
}).strict();
const placement = z.object({
  kind: z.enum(["header", "query", "body"]),
  name: z.string().min(1).max(256),
  prefix: z.string().min(1).max(512).optional(),
  suffix: z.string().min(1).max(512).optional(),
  enforce_header_ownership: z.boolean().optional(),
}).strict();
const selector = z.discriminatedUnion("kind", [
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
  }).strict(),
]);
const normalizedSelector = z.union([
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
const credentialProfile = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  placement,
}).strict();
const credentialCreate = credentialProfile.extend({ selector }).strict();
const placementView = z.object({
  kind: z.enum(["header", "query", "body"]),
  name: z.string().min(1).max(256),
  prefix: z.string().min(1).max(512).optional(),
  suffix: z.string().min(1).max(512).optional(),
  enforce_header_ownership: z.boolean(),
}).strict();
const credentialSchema = z.object({
  id: uuid,
  service_id: uuid,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  placement: placementView,
  selector: normalizedSelector.optional(),
  status: z.enum(["configured", "unconfigured", "disabled", "archived"]),
  last_four: z.string().min(1).max(4).optional(),
  value_updated_at: z.number().int().nonnegative().optional(),
  authorization_generation: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const justification = z.object({
  justification: z.string().min(1).max(1_024)
    .refine((value) => value === value.trim() && !value.includes("\0")),
}).strict();
const cloneBody = z.object({ name: z.string().min(1).max(120) }).strict();
const valueBody = z.object({
  value: z.string().min(1).max(65_536),
  capture_last_four: z.boolean().optional(),
}).strict();
const copyPlacement = placementView;
const copySelector = z.union([
  z.object({ kind: z.literal("all") }).strict(),
  z.object({
    kind: z.literal("principals"),
    group_ids: z.array(uuid).max(1_000),
    user_ids: z.array(uuid).max(1_000),
    direct_assignment_confirmed: z.boolean(),
  }).strict(),
]);
const copyDocument = z.object({
  format_version: z.literal(1),
  credential: z.object({
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(1_024).optional(),
    placement: copyPlacement,
    selector: copySelector,
  }).strict(),
}).strict();
const deletedSchema = z.object({
  credential_id: uuid,
  deleted: z.literal(true),
  replayed: z.boolean(),
}).strict();

export function registerCredentialRoutes(
  registry: ControlRouteRegistry,
  credentials: CredentialManagementService,
  vault?: CredentialVaultCoordinator,
): void {
  registry.register(defineControlRoute({
    id: "credentials.list",
    method: "GET",
    path: "/api/v2/services/{service_id}/credentials",
    summary: "List safe service credential metadata",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      response: z.object({ credentials: z.array(credentialSchema).max(1_000) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => run(async () => ({
      data: {
        credentials: (await credentials.credentials(
          authentication!,
          params.service_id,
        )).map(wireCredential),
      },
    })),
  }));

  registry.register(defineControlRoute({
    id: "credentials.create",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials",
    summary: "Create unconfigured credential metadata",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: serviceParams, body: credentialCreate, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async ({ authentication, params, body, idempotencyKey, requestId }) =>
      run(async () => {
        const result = await credentials.create(
          authentication!,
          params.service_id,
          body,
          idempotencyKey!,
          requestId,
        );
        return {
          data: wireCredential(result.credential),
          statusCode: result.replayed ? 200 : 201,
          version: result.credential.version,
        };
      }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.detail",
    method: "GET",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}",
    summary: "Read safe credential metadata",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, response: credentialSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => run(async () => {
      const credential = await credentials.credential(
        authentication!,
        params.service_id,
        params.credential_id,
      );
      return { data: wireCredential(credential), version: credential.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.update",
    method: "PATCH",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}",
    summary: "Update credential metadata and placement",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: credentialProfile, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({ authentication, params, body, expectedVersion, requestId }) =>
      run(async () => {
        const credential = await credentials.update(
          authentication!,
          params.service_id,
          params.credential_id,
          expectedVersion!,
          body,
          requestId,
        );
        return { data: wireCredential(credential), version: credential.version };
      }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.assignments",
    method: "GET",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/assignments",
    summary: "Read credential principal assignments",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, response: normalizedSelector },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, params }) => run(async () => {
      const credential = await credentials.credential(
        authentication!,
        params.service_id,
        params.credential_id,
      );
      if (credential.selector === undefined) {
        throw new CredentialManagementError("conflict");
      }
      return { data: wireSelector(credential.selector), version: credential.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.assignments.replace",
    method: "PUT",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/assignments",
    summary: "Replace credential principal assignments",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: selector, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.assignments.replace",
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
    }) => run(async () => {
      const result = await credentials.replaceAssignments(
        authentication!,
        params.service_id,
        params.credential_id,
        expectedVersion!,
        body,
        idempotencyKey!,
        requestId,
      );
      return { data: wireCredential(result.credential), version: result.credential.version };
    }),
  }));

  registerLifecycleRoutes(registry, credentials, vault);
  registerTransferRoutes(registry, credentials);
  registerValueRoutes(registry, vault);
}

function registerLifecycleRoutes(
  registry: ControlRouteRegistry,
  credentials: CredentialManagementService,
  vault?: CredentialVaultCoordinator,
): void {
  registry.register(defineControlRoute({
    id: "credentials.disable",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/disable",
    summary: "Disable a configured credential",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: justification, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.disable",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => run(async () => {
      const result = await credentials.disable(
        context.authentication!,
        context.params.service_id,
        context.params.credential_id,
        context.expectedVersion!,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return { data: wireCredential(result.credential), version: result.credential.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.enable",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/enable",
    summary: "Enable a disabled credential after vault verification",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: z.object({}).strict(), response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.enable",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const coordinator = requireVault(vault);
      const credential = await coordinator.enable({
        actor: context.authentication!,
        serviceId: context.params.service_id,
        credentialId: context.params.credential_id,
        expectedVersion: context.expectedVersion!,
        correlationId: context.requestId,
      });
      return { data: wireCredential(credential), version: credential.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.archive",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/archive",
    summary: "Archive credential metadata after removing any value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: justification, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.archive",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => run(async () => {
      const current = await credentials.credential(
        context.authentication!,
        context.params.service_id,
        context.params.credential_id,
      );
      if (current.version !== context.expectedVersion) {
        throw new CredentialManagementError("stale");
      }
      if (current.status === "unconfigured") {
        const result = await credentials.archiveUnconfigured(
          context.authentication!,
          context.params.service_id,
          context.params.credential_id,
          context.expectedVersion!,
          context.body,
          context.idempotencyKey!,
          context.requestId,
        );
        return {
          data: wireCredential(result.credential),
          version: result.credential.version,
        };
      }
      const credential = await requireVault(vault).deleteValue({
        actor: context.authentication!,
        serviceId: context.params.service_id,
        credentialId: context.params.credential_id,
        expectedVersion: context.expectedVersion!,
        archive: true,
        correlationId: context.requestId,
      });
      return { data: wireCredential(credential), version: credential.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.delete",
    method: "DELETE",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}",
    summary: "Permanently delete archived credential metadata",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "always",
    schemas: { params: credentialParams, body: justification, response: deletedSchema },
    rateLimit: "management",
    auditAction: "credential.delete",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => run(async () => {
      const result = await credentials.deleteArchived(
        context.authentication!,
        context.params.service_id,
        context.params.credential_id,
        context.expectedVersion!,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: {
          credential_id: result.credentialId,
          deleted: true as const,
          replayed: result.replayed,
        },
      };
    }),
  }));
}

function registerTransferRoutes(
  registry: ControlRouteRegistry,
  credentials: CredentialManagementService,
): void {
  registry.register(defineControlRoute({
    id: "credentials.clone",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/clone",
    summary: "Clone credential metadata without a value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: cloneBody, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.clone",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await credentials.clone(
        context.authentication!,
        context.params.service_id,
        context.params.credential_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireCredential(result.credential),
        statusCode: result.replayed ? 200 : 201,
        version: result.credential.version,
      };
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.copy",
    method: "GET",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/copy",
    summary: "Copy a closed credential document without a value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, response: copyDocument },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => ({
      data: await credentials.copy(
        context.authentication!,
        context.params.service_id,
        context.params.credential_id,
      ),
    })),
  }));

  registry.register(defineControlRoute({
    id: "credentials.import",
    method: "POST",
    path: "/api/v2/services/{service_id}/credentials/import",
    summary: "Import a closed credential document without a value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: serviceParams, body: copyDocument, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.import",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await credentials.import(
        context.authentication!,
        context.params.service_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireCredential(result.credential),
        statusCode: result.replayed ? 200 : 201,
        version: result.credential.version,
      };
    }),
  }));
}

function registerValueRoutes(
  registry: ControlRouteRegistry,
  vault?: CredentialVaultCoordinator,
): void {
  registry.register(defineControlRoute({
    id: "credentials.value.replace",
    method: "PUT",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/value",
    summary: "Create or replace a write-only credential value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: valueBody, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.value.replace",
    secretFields: ["/value"],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => run(async () => {
      const value = Buffer.from(context.body.value, "utf8");
      try {
        const credential = await requireVault(vault).setValue({
          actor: context.authentication!,
          serviceId: context.params.service_id,
          credentialId: context.params.credential_id,
          expectedVersion: context.expectedVersion!,
          value,
          ...(context.body.capture_last_four === undefined
            ? {}
            : { captureLastFour: context.body.capture_last_four }),
          correlationId: context.requestId,
        });
        return { data: wireCredential(credential), version: credential.version };
      } finally {
        value.fill(0);
      }
    }),
  }));

  registry.register(defineControlRoute({
    id: "credentials.value.delete",
    method: "DELETE",
    path: "/api/v2/services/{service_id}/credentials/{credential_id}/value",
    summary: "Delete a stored credential value",
    tags: ["Credentials"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: credentialParams, body: justification, response: credentialSchema },
    rateLimit: "management",
    auditAction: "credential.value.delete",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "required",
    handler: async (context) => run(async () => {
      const credential = await requireVault(vault).deleteValue({
        actor: context.authentication!,
        serviceId: context.params.service_id,
        credentialId: context.params.credential_id,
        expectedVersion: context.expectedVersion!,
        archive: false,
        correlationId: context.requestId,
      });
      return { data: wireCredential(credential), version: credential.version };
    }),
  }));
}

function wireCredential(credential: CredentialView) {
  return {
    id: credential.id,
    service_id: credential.serviceId,
    name: credential.name,
    ...(credential.description === undefined ? {} : { description: credential.description }),
    placement: {
      kind: credential.placement.kind,
      name: credential.placement.name,
      ...(credential.placement.prefix === undefined
        ? {}
        : { prefix: credential.placement.prefix }),
      ...(credential.placement.suffix === undefined
        ? {}
        : { suffix: credential.placement.suffix }),
      enforce_header_ownership: credential.placement.enforceHeaderOwnership,
    },
    ...(credential.selector === undefined
      ? {}
      : { selector: wireSelector(credential.selector) }),
    status: credential.status,
    ...(credential.lastFour === undefined ? {} : { last_four: credential.lastFour }),
    ...(credential.valueUpdatedAt === undefined
      ? {}
      : { value_updated_at: credential.valueUpdatedAt }),
    authorization_generation: credential.authorizationGeneration,
    version: credential.version,
    created_at: credential.createdAt,
    updated_at: credential.updatedAt,
  };
}

function wireSelector(selector: {
  kind: "all" | "explicit";
  groupIds: readonly string[];
  userIds: readonly string[];
}) {
  return selector.kind === "all"
    ? { kind: "all" as const, group_ids: [] as [], user_ids: [] as [] }
    : {
        kind: "explicit" as const,
        group_ids: [...selector.groupIds],
        user_ids: [...selector.userIds],
      };
}

function requireVault(
  vault: CredentialVaultCoordinator | undefined,
): CredentialVaultCoordinator {
  if (vault === undefined) {
    throw new ControlContractError(503, "vault_unavailable", "Vault is unavailable.");
  }
  return vault;
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw contractError(error);
  }
}

function contractError(error: unknown): ControlContractError {
  if (error instanceof ControlContractError) return error;
  if (!(error instanceof CredentialManagementError)) {
    return new ControlContractError(500, "internal_error", "Credential management is unavailable.");
  }
  if (error.code === "invalid_request") {
    return new ControlContractError(400, "invalid_request", "Credential input is invalid.");
  }
  if (error.code === "not_found") {
    return new ControlContractError(404, "not_found", "Credential or service was not found.");
  }
  if (error.code === "stale") {
    return new ControlContractError(409, "stale_version", "The resource changed. Refresh and retry.");
  }
  if (error.code === "idempotency_conflict") {
    return new ControlContractError(
      409,
      "idempotency_conflict",
      "The idempotency key was already used for different inputs.",
    );
  }
  if (error.code === "conflict") {
    return new ControlContractError(409, "service_conflict", "Credential state conflicts with the request.");
  }
  return new ControlContractError(503, "vault_unavailable", "Vault is unavailable.");
}
