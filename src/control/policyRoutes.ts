import {
  PolicyManagementError,
  type PolicyDetailView,
  type PolicyManagementService,
  type PolicyRuleView,
  type PolicySimulationView,
  type PolicyView,
} from "../policyManagement.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const uuid = z.string().uuid();
const serviceParams = z.object({ service_id: uuid }).strict();
const policyParams = z.object({ service_id: uuid, policy_id: uuid }).strict();
const ruleParams = z.object({
  service_id: uuid,
  policy_id: uuid,
  rule_id: uuid,
}).strict();
const boundary = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("service") }).strict(),
  z.object({ kind: z.literal("credential"), credential_id: uuid }).strict(),
]);
const selector = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("groups"), group_ids: z.array(uuid).min(1).max(1_000) }).strict(),
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
const hostMatcher = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), value: z.string().min(1).max(253) }).strict(),
  z.object({ kind: z.literal("suffix"), value: z.string().min(1).max(253) }).strict(),
  z.object({ kind: z.literal("regex"), value: z.string().min(3).max(256) }).strict(),
]);
const pathMatcher = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), value: z.string().min(1).max(2_048) }).strict(),
  z.object({ kind: z.literal("prefix"), value: z.string().min(1).max(2_048) }).strict(),
  z.object({ kind: z.literal("regex"), value: z.string().min(3).max(2_048) }).strict(),
]);
const safeguardsInput = z.object({
  secretlint: z.object({
    enabled: z.boolean(),
    disabled_rule_ids: z.array(z.string().min(1).max(128)).max(128),
  }).strict(),
  binary_response: z.object({
    scan: z.boolean(),
    max_bytes: z.number().int().min(1).max(100 * 1024 * 1024).nullable(),
  }).strict(),
}).strict();
const policyProfile = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  operating_mode: z.enum(["allow", "deny"]),
}).strict();
const policyCreate = policyProfile.extend({ boundary }).strict();
const ruleInput = z.object({
  name: z.string().min(1).max(120),
  reason: z.string().min(1).max(1_024).optional(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  enabled: z.boolean(),
  methods: z.array(z.string().min(1).max(32)).max(64),
  hosts: z.array(hostMatcher).max(64),
  paths: z.array(pathMatcher).max(128),
  response_safeguards: safeguardsInput,
  selector: selector.optional(),
}).strict();
const policySchema = z.object({
  id: uuid,
  service_id: uuid,
  boundary,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1_024).optional(),
  operating_mode: z.enum(["allow", "deny"]),
  lifecycle: z.enum(["active", "archived"]),
  evaluation_generation: z.number().int().nonnegative(),
  rule_count: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const ruleSchema = z.object({
  id: uuid,
  service_id: uuid,
  policy_id: uuid,
  name: z.string().min(1).max(120),
  reason: z.string().min(1).max(1_024).optional(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number().int(),
  enabled: z.boolean(),
  methods: z.array(z.string()).max(64),
  hosts: z.array(hostMatcher).max(64),
  paths: z.array(pathMatcher).max(128),
  response_safeguards: safeguardsInput,
  selector: normalizedSelector.optional(),
  version: z.number().int().positive(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const detailSchema = policySchema.extend({
  rules: z.array(ruleSchema).max(2_000),
}).strict();
const copyRule = ruleInput;
const copyDocument = z.object({
  format_version: z.literal(1),
  policy: z.object({
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(1_024).optional(),
    operating_mode: z.enum(["allow", "deny"]),
    rules: z.array(copyRule).max(2_000),
  }).strict(),
}).strict();
const cloneInput = z.object({
  target_service_id: uuid,
  boundary,
  name: z.string().min(1).max(120).optional(),
}).strict();
const bulkCopyInput = z.object({
  copies: z.array(z.object({
    source_policy_id: uuid,
    target_service_id: uuid,
    boundary,
    name: z.string().min(1).max(120).optional(),
  }).strict()).min(1).max(20),
}).strict();
const importInput = z.object({ boundary, document: copyDocument }).strict();
const simulationInput = z.object({
  user_id: uuid,
  destination_id: uuid,
  method: z.string().min(1).max(32),
  path: z.string().min(1).max(4_096).optional(),
  url: z.string().min(1).max(8_192).optional(),
  credential_ids: z.array(uuid).max(128),
}).strict();
const ruleExplanation = z.object({
  rule_id: uuid,
  applicable: z.boolean(),
  request_matched: z.boolean(),
  selected: z.boolean(),
  reason_code: z.enum([
    "disabled",
    "principal_not_applicable",
    "method_not_matched",
    "host_not_matched",
    "path_not_matched",
    "matched_lower_priority",
    "selected_allow",
    "selected_deny",
  ]),
  priority: z.number().int(),
  effect: z.enum(["allow", "deny"]),
}).strict();
const simulationSchema = z.object({
  allowed: z.boolean(),
  subject_id: uuid,
  group_ids: z.array(uuid).max(1_000),
  canonical_target: z.object({
    method: z.string(),
    host: z.string(),
    pathname: z.string(),
  }).strict(),
  boundaries: z.array(z.object({
    boundary_id: uuid,
    kind: z.enum(["service", "credential"]),
    assignment_allowed: z.boolean(),
    allowed: z.boolean(),
    mode: z.enum(["allow", "deny"]),
    selected_priority: z.number().int().optional(),
    selected_rule_ids: z.array(uuid).max(2_000),
    decisive_rule_id: uuid.optional(),
    reason_code: z.enum([
      "assignment_denied",
      "default_allow",
      "default_deny",
      "selected_allow",
      "selected_deny",
      "deny_tie",
    ]),
    rules: z.array(ruleExplanation).max(2_000),
  }).strict()).max(129),
  reason_code: z.enum(["all_boundaries_allow", "boundary_denied"]),
  links: z.array(z.object({
    kind: z.enum(["service", "credential", "group", "user", "policy"]),
    id: uuid,
    href: z.string().min(1).max(256),
  }).strict()).max(4_000),
}).strict();

export function registerPolicyRoutes(
  registry: ControlRouteRegistry,
  policies: PolicyManagementService,
): void {
  registerPolicyCrud(registry, policies);
  registerRuleCrud(registry, policies);
  registerPolicyTransfer(registry, policies);
  registry.register(defineControlRoute({
    id: "policies.simulate",
    method: "POST",
    path: "/api/v2/services/{service_id}/policy-simulations",
    summary: "Simulate persisted service and credential policy",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: serviceParams, body: simulationInput, response: simulationSchema },
    rateLimit: "management",
    auditAction: "policy.simulate",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => ({
      data: wireSimulation(await policies.simulate(
        context.authentication!,
        context.params.service_id,
        context.body,
        context.requestId,
      )),
    })),
  }));
}

function registerPolicyCrud(
  registry: ControlRouteRegistry,
  policies: PolicyManagementService,
): void {
  registry.register(defineControlRoute({
    id: "policies.list",
    method: "GET",
    path: "/api/v2/services/{service_id}/policies",
    summary: "List service policy boundaries",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      response: z.object({ policies: z.array(policySchema).max(1_001) }).strict(),
    },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => ({
      data: {
        policies: (await policies.policies(
          context.authentication!,
          context.params.service_id,
        )).map(wirePolicy),
      },
    })),
  }));
  registry.register(defineControlRoute({
    id: "policies.create",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies",
    summary: "Create a service or credential policy boundary",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: serviceParams, body: policyCreate, response: detailSchema },
    rateLimit: "management",
    auditAction: "policy.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await policies.createPolicy(
        context.authentication!,
        context.params.service_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireDetail(result.policy),
        statusCode: result.replayed ? 200 : 201,
        version: result.policy.version,
      };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.detail",
    method: "GET",
    path: "/api/v2/services/{service_id}/policies/{policy_id}",
    summary: "Read a policy boundary and its rules",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, response: detailSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const policy = await policies.policy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
      );
      return { data: wireDetail(policy), version: policy.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.update",
    method: "PATCH",
    path: "/api/v2/services/{service_id}/policies/{policy_id}",
    summary: "Update policy profile and operating mode",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, body: policyProfile, response: detailSchema },
    rateLimit: "management",
    auditAction: "policy.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const policy = await policies.updatePolicy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.expectedVersion!,
        context.body,
        context.requestId,
      );
      return { data: wireDetail(policy), version: policy.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.archive",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/archive",
    summary: "Archive a policy and disable its rules",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, body: z.object({}).strict(), response: detailSchema },
    rateLimit: "management",
    auditAction: "policy.archive",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const policy = await policies.archivePolicy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.expectedVersion!,
        context.requestId,
      );
      return { data: wireDetail(policy), version: policy.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.delete",
    method: "DELETE",
    path: "/api/v2/services/{service_id}/policies/{policy_id}",
    summary: "Permanently delete an archived policy",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: policyParams,
      body: z.object({}).strict(),
      response: z.object({ policy_id: uuid, deleted: z.literal(true) }).strict(),
    },
    rateLimit: "management",
    auditAction: "policy.delete",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      await policies.deleteArchived(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.expectedVersion!,
        context.requestId,
      );
      return { data: { policy_id: context.params.policy_id, deleted: true as const } };
    }),
  }));
}

function registerRuleCrud(
  registry: ControlRouteRegistry,
  policies: PolicyManagementService,
): void {
  registry.register(defineControlRoute({
    id: "policies.rules.create",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/rules",
    summary: "Create a principal-aware policy rule",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, body: ruleInput, response: ruleSchema },
    rateLimit: "management",
    auditAction: "policy.rule.create",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await policies.createRule(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireRule(result.rule),
        statusCode: result.replayed ? 200 : 201,
        version: result.rule.version,
      };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.rules.update",
    method: "PATCH",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/rules/{rule_id}",
    summary: "Update a policy rule",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: ruleParams, body: ruleInput, response: ruleSchema },
    rateLimit: "management",
    auditAction: "policy.rule.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const rule = await policies.updateRule(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.params.rule_id,
        context.expectedVersion!,
        context.body,
        context.requestId,
      );
      return { data: wireRule(rule), version: rule.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.rules.assignments",
    method: "GET",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/rules/{rule_id}/assignments",
    summary: "Read policy-rule principal assignments",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: ruleParams, response: normalizedSelector },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const policy = await policies.policy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
      );
      const rule = policy.rules.find(({ id }) => id === context.params.rule_id);
      if (rule?.selector === undefined) throw new PolicyManagementError("not_found");
      return { data: wireSelector(rule.selector), version: rule.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.rules.assignments.replace",
    method: "PUT",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/rules/{rule_id}/assignments",
    summary: "Replace policy-rule principal assignments",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: ruleParams, body: selector, response: ruleSchema },
    rateLimit: "management",
    auditAction: "policy.rule.assignments.replace",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      const rule = await policies.replaceRuleAssignments(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.params.rule_id,
        context.expectedVersion!,
        context.body,
        context.requestId,
      );
      return { data: wireRule(rule), version: rule.version };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.rules.delete",
    method: "DELETE",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/rules/{rule_id}",
    summary: "Delete a policy rule",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: ruleParams,
      body: z.object({}).strict(),
      response: z.object({ rule_id: uuid, deleted: z.literal(true) }).strict(),
    },
    rateLimit: "management",
    auditAction: "policy.rule.delete",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async (context) => run(async () => {
      await policies.deleteRule(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.params.rule_id,
        context.expectedVersion!,
        context.requestId,
      );
      return { data: { rule_id: context.params.rule_id, deleted: true as const } };
    }),
  }));
}

function registerPolicyTransfer(
  registry: ControlRouteRegistry,
  policies: PolicyManagementService,
): void {
  registry.register(defineControlRoute({
    id: "policies.copy",
    method: "GET",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/copy",
    summary: "Copy a closed secret-free policy document",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, response: copyDocument },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async (context) => run(async () => ({
      data: await policies.copy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
      ),
    })),
  }));
  registry.register(defineControlRoute({
    id: "policies.bulk-copy",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies/bulk-copy",
    summary: "Atomically copy complete policy sets to permitted boundaries",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: {
      params: serviceParams,
      body: bulkCopyInput,
      response: z.object({
        policies: z.array(detailSchema).min(1).max(20),
      }).strict(),
    },
    rateLimit: "management",
    auditAction: "policy.bulk_copy",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await policies.bulkCopy(
        context.authentication!,
        context.params.service_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: { policies: result.policies.map(wireDetail) },
        statusCode: result.replayed ? 200 : 201,
      };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.clone",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies/{policy_id}/clone",
    summary: "Clone a complete policy set with new IDs",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: policyParams, body: cloneInput, response: detailSchema },
    rateLimit: "management",
    auditAction: "policy.copy",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await policies.clonePolicy(
        context.authentication!,
        context.params.service_id,
        context.params.policy_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireDetail(result.policy),
        statusCode: result.replayed ? 200 : 201,
        version: result.policy.version,
      };
    }),
  }));
  registry.register(defineControlRoute({
    id: "policies.import",
    method: "POST",
    path: "/api/v2/services/{service_id}/policies/import",
    summary: "Import a complete closed policy document",
    tags: ["Policies"],
    authentication: ["browser_session"],
    permission: "manage_credentials_policies",
    stepUp: "none",
    schemas: { params: serviceParams, body: importInput, response: detailSchema },
    rateLimit: "management",
    auditAction: "policy.copy",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "required",
    successStatuses: [200, 201],
    handler: async (context) => run(async () => {
      const result = await policies.importPolicy(
        context.authentication!,
        context.params.service_id,
        context.body,
        context.idempotencyKey!,
        context.requestId,
      );
      return {
        data: wireDetail(result.policy),
        statusCode: result.replayed ? 200 : 201,
        version: result.policy.version,
      };
    }),
  }));
}

function wirePolicy(policy: PolicyView) {
  return {
    id: policy.id,
    service_id: policy.serviceId,
    boundary: policy.boundary.kind === "service"
      ? { kind: "service" as const }
      : {
          kind: "credential" as const,
          credential_id: policy.boundary.credentialId,
        },
    name: policy.name,
    ...(policy.description === undefined ? {} : { description: policy.description }),
    operating_mode: policy.operatingMode,
    lifecycle: policy.lifecycle,
    evaluation_generation: policy.evaluationGeneration,
    rule_count: policy.ruleCount,
    version: policy.version,
    created_at: policy.createdAt,
    updated_at: policy.updatedAt,
  };
}

function wireDetail(policy: PolicyDetailView) {
  return { ...wirePolicy(policy), rules: policy.rules.map(wireRule) };
}

function wireRule(rule: PolicyRuleView) {
  return {
    id: rule.id,
    service_id: rule.serviceId,
    policy_id: rule.policyId,
    name: rule.name,
    ...(rule.reason === undefined ? {} : { reason: rule.reason }),
    effect: rule.effect,
    priority: rule.priority,
    enabled: rule.enabled,
    methods: [...rule.matchers.methods],
    hosts: [...rule.matchers.hosts],
    paths: [...rule.matchers.paths],
    response_safeguards: {
      secretlint: {
        enabled: rule.responseSafeguards.secretlint.enabled,
        disabled_rule_ids: [...rule.responseSafeguards.secretlint.disabledRuleIds],
      },
      binary_response: {
        scan: rule.responseSafeguards.binaryResponse.scan,
        max_bytes: rule.responseSafeguards.binaryResponse.maxBytes,
      },
    },
    ...(rule.selector === undefined ? {} : { selector: wireSelector(rule.selector) }),
    version: rule.version,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
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

function wireSimulation(simulation: PolicySimulationView) {
  return {
    allowed: simulation.allowed,
    subject_id: simulation.subjectId,
    group_ids: simulation.groupIds,
    canonical_target: {
      method: simulation.canonicalTarget.method,
      host: simulation.canonicalTarget.host,
      pathname: simulation.canonicalTarget.pathname,
    },
    boundaries: simulation.boundaries.map((boundary) => ({
      boundary_id: boundary.boundaryId,
      kind: boundary.kind,
      assignment_allowed: boundary.assignmentAllowed,
      allowed: boundary.allowed,
      mode: boundary.mode,
      ...(boundary.selectedPriority === undefined
        ? {}
        : { selected_priority: boundary.selectedPriority }),
      selected_rule_ids: boundary.selectedRuleIds,
      ...(boundary.decisiveRuleId === undefined
        ? {}
        : { decisive_rule_id: boundary.decisiveRuleId }),
      reason_code: boundary.reasonCode,
      rules: boundary.rules.map((rule) => ({
        rule_id: rule.ruleId,
        applicable: rule.applicable,
        request_matched: rule.requestMatched,
        selected: rule.selected,
        reason_code: rule.reasonCode,
        priority: rule.priority,
        effect: rule.effect,
      })),
    })),
    reason_code: simulation.reasonCode,
    links: simulation.links,
  };
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw contractError(error);
  }
}

function contractError(error: unknown): ControlContractError {
  if (!(error instanceof PolicyManagementError)) {
    return new ControlContractError(500, "internal_error", "Policy management is unavailable.");
  }
  if (error.code === "invalid_request") {
    return new ControlContractError(400, "invalid_request", "Policy input is invalid.");
  }
  if (error.code === "not_found") {
    return new ControlContractError(404, "not_found", "Policy or service was not found.");
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
    return new ControlContractError(409, "service_conflict", "Policy state conflicts with the request.");
  }
  return new ControlContractError(503, "internal_error", "Policy management is unavailable.");
}
