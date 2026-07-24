import type { ControlAuthenticationContext } from "./control/authentication.js";
import {
  administrativeActorSnapshot,
  requireServiceApiKeyAuthority,
} from "./apiKeyAuthority.js";
import type { ControlIdempotencyHasher } from "./control/idempotency.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type {
  IdempotencyExecutionInput,
  IdempotencyExecutionResult,
} from "./persistence/idempotency.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import {
  normalizePrincipalSelector,
  PrincipalSelectorError,
  type NormalizedPrincipalSelector,
} from "./principalSelectors.js";
import {
  normalizeManagedPolicyMatchers,
  PolicyMatcherError,
  type ManagedPolicyMatchers,
} from "./policyMatchers.js";
import {
  evaluatePolicySnapshot,
  type PolicyBoundarySnapshot,
  type PolicyEvaluationExplanation,
  type PolicyPrincipalSelector,
} from "./policy.js";
import type { DestinationConfig, ServiceConfig } from "./types.js";
import { resolveDestinationTarget } from "./urlValidation.js";

const MAX_POLICIES_PER_SERVICE = 1_001;
const MAX_RULES_TOTAL = 20_000;
const MAX_RULES_PER_POLICY = 2_000;

export type PolicyBoundary =
  | { kind: "service" }
  | { kind: "credential"; credentialId: string };

export interface PolicyView {
  id: string;
  serviceId: string;
  boundary: PolicyBoundary;
  name: string;
  description?: string;
  operatingMode: "allow" | "deny";
  lifecycle: "active" | "archived";
  evaluationGeneration: number;
  ruleCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PolicyResponseSafeguards {
  secretlint: {
    enabled: boolean;
    disabledRuleIds: string[];
  };
  binaryResponse: {
    scan: boolean;
    maxBytes: number | null;
  };
}

export interface PolicyRuleView {
  id: string;
  serviceId: string;
  policyId: string;
  name: string;
  reason?: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: boolean;
  matchers: ManagedPolicyMatchers;
  responseSafeguards: PolicyResponseSafeguards;
  selector?: NormalizedPrincipalSelector;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PolicyDetailView extends PolicyView {
  rules: PolicyRuleView[];
}

export interface PolicyCopyDocument {
  format_version: 1;
  policy: {
    name: string;
    description?: string;
    operating_mode: "allow" | "deny";
    rules: Array<{
      name: string;
      reason?: string;
      effect: "allow" | "deny";
      priority: number;
      enabled: boolean;
      methods: string[];
      hosts: ManagedPolicyMatchers["hosts"];
      paths: ManagedPolicyMatchers["paths"];
      response_safeguards: {
        secretlint: {
          enabled: boolean;
          disabled_rule_ids: string[];
        };
        binary_response: {
          scan: boolean;
          max_bytes: number | null;
        };
      };
      selector?:
        | { kind: "all" }
        | {
            kind: "principals";
            group_ids: string[];
            user_ids: string[];
            direct_assignment_confirmed: boolean;
          };
    }>;
  };
}

export interface PolicySimulationView extends PolicyEvaluationExplanation {
  links: Array<{
    kind: "service" | "credential" | "group" | "user" | "policy";
    id: string;
    href: string;
  }>;
}

interface PolicyRow {
  id: string;
  service_id: string;
  credential_id: string | null;
  name: string;
  normalized_name: string;
  description: string | null;
  operating_mode: "allow" | "deny";
  lifecycle: "active" | "archived";
  evaluation_generation: number;
  version: number;
  created_at: number;
  updated_at: number;
  rule_count?: number;
}

interface RuleRow {
  id: string;
  service_id: string;
  policy_id: string;
  name: string;
  normalized_name: string;
  reason: string | null;
  effect: "allow" | "deny";
  priority: number;
  enabled: 0 | 1;
  methods_json: string;
  hosts_json: string;
  paths_json: string;
  response_safeguards_json: string;
  version: number;
  created_at: number;
  updated_at: number;
}

interface PolicyProfile {
  name: string;
  normalizedName: string;
  description?: string;
  operatingMode: "allow" | "deny";
}

interface RuleProfile {
  name: string;
  normalizedName: string;
  reason?: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: boolean;
  matchers: ManagedPolicyMatchers;
  safeguards: PolicyResponseSafeguards;
  selector?: NormalizedPrincipalSelector;
}

interface PolicyBulkCopySpec {
  sourcePolicyId: string;
  targetServiceId: string;
  boundary: PolicyBoundary;
  name?: string;
}

export class PolicyManagementError extends Error {
  constructor(readonly code:
    | "invalid_request"
    | "not_found"
    | "stale"
    | "conflict"
    | "idempotency_conflict"
    | "unavailable") {
    super("Policy management could not be completed.");
    this.name = "PolicyManagementError";
  }
}

export class PolicyManagementRepository {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
    uuid: () => string = defaultUuid(now),
  ) {
    this.#uuid = uuid;
  }

  async policies(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<PolicyView[]> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return query.all<PolicyRow>(policySelect(`
        WHERE p.service_id = ?
        ORDER BY p.lifecycle, p.credential_id, p.normalized_name, p.id
        LIMIT ?
      `), [serviceId, MAX_POLICIES_PER_SERVICE]).map(projectPolicy);
    });
  }

  async policy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
  ): Promise<PolicyDetailView> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      const row = requiredPolicy(query, serviceId, policyId);
      return {
        ...projectPolicy({
          ...row,
          rule_count: query.get<{ count: number }>(
            "SELECT count(*) AS count FROM policy_rules WHERE policy_id = ?",
            [policyId],
          )?.count ?? 0,
        }),
        rules: ruleRows(query, serviceId, policyId).map((rule) =>
          projectRule(query, rule)),
      };
    });
  }

  async createPolicy(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    boundary: PolicyBoundary;
    profile: PolicyProfile;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        validateBoundary(transaction, input.serviceId, input.boundary);
        const count = transaction.get<{ count: number }>(
          "SELECT count(*) AS count FROM policies WHERE service_id = ?",
          [input.serviceId],
        )?.count ?? MAX_POLICIES_PER_SERVICE;
        if (count >= MAX_POLICIES_PER_SERVICE) {
          throw new PersistenceError("identity_conflict");
        }
        const now = transaction.timestamp();
        transaction.run(`
          INSERT INTO policies (
            id, service_id, credential_id, name, normalized_name, description,
            operating_mode, lifecycle, evaluation_generation, version,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)
        `, [
          input.policyId,
          input.serviceId,
          input.boundary.kind === "credential"
            ? input.boundary.credentialId
            : null,
          input.profile.name,
          input.profile.normalizedName,
          input.profile.description ?? null,
          input.profile.operatingMode,
          now,
          now,
        ]);
        return {
          value: input.policyId,
          resultReference: input.policyId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: policyAudit(
          input.actor,
          "policy.create",
          input.serviceId,
          result.kind === "executed" ? result.value : result.resultReference,
          input.correlationId,
          [
            { field: "boundary_kind", after: input.boundary.kind },
            { field: "operating_mode", after: input.profile.operatingMode },
          ],
        ),
      };
    });
  }

  async updatePolicy(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    expectedVersion: number;
    profile: PolicyProfile;
    correlationId: string;
  }): Promise<PolicyDetailView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredPolicy(
        transaction,
        input.serviceId,
        input.policyId,
      );
      requireActive(current);
      const generation = current.evaluation_generation + 1;
      const updated = transaction.optimisticUpdate(
        "policies",
        current.id,
        input.expectedVersion,
        {
          name: input.profile.name,
          normalized_name: input.profile.normalizedName,
          description: input.profile.description ?? null,
          operating_mode: input.profile.operatingMode,
          evaluation_generation: generation,
        },
      );
      if (updated.status === "stale") throw new PersistenceError("identity_stale");
      invalidatePolicy(transaction, this.#uuid, current, null, null, generation, "policy");
      return {
        value: policyDetail(transaction, input.serviceId, input.policyId),
        auditInput: policyAudit(
          input.actor,
          "policy.update",
          input.serviceId,
          input.policyId,
          input.correlationId,
          [{ field: "operating_mode", after: input.profile.operatingMode }],
        ),
      };
    });
  }

  async createRule(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    ruleId: string;
    profile: RuleProfile;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      requireActive(policy);
      const result = transaction.idempotent(input.idempotency, () => {
        requireRuleCapacity(transaction, input.policyId);
        if (input.profile.enabled && input.profile.selector === undefined) {
          throw new PersistenceError("identity_conflict");
        }
        if (input.profile.selector !== undefined) {
          validateSelectorTargets(transaction, input.serviceId, input.profile.selector);
        }
        const now = transaction.timestamp();
        insertRule(transaction, input.ruleId, policy, input.profile, now);
        if (input.profile.selector !== undefined) {
          replaceRuleAssignments(
            transaction,
            this.#uuid,
            input.actor.principalId,
            policy,
            input.ruleId,
            input.profile.selector,
            now,
          );
        }
        bumpPolicyGeneration(transaction, this.#uuid, policy, input.ruleId, "rule");
        return {
          value: input.ruleId,
          resultReference: input.ruleId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: policyAudit(
          input.actor,
          "policy.rule.create",
          input.serviceId,
          input.ruleId,
          input.correlationId,
          ruleAuditChanges(input.policyId, input.profile),
        ),
      };
    });
  }

  async updateRule(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    ruleId: string;
    expectedVersion: number;
    profile: RuleProfile;
    correlationId: string;
  }): Promise<PolicyRuleView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      requireActive(policy);
      requiredRule(transaction, input.serviceId, input.policyId, input.ruleId);
      if (input.profile.enabled && input.profile.selector === undefined) {
        throw new PersistenceError("identity_conflict");
      }
      if (input.profile.selector !== undefined) {
        validateSelectorTargets(transaction, input.serviceId, input.profile.selector);
      }
      const updated = transaction.optimisticUpdate(
        "policy_rules",
        input.ruleId,
        input.expectedVersion,
        ruleUpdateFields(input.profile),
      );
      if (updated.status === "stale") throw new PersistenceError("identity_stale");
      transaction.run(
        "DELETE FROM policy_rule_principal_assignments WHERE rule_id = ?",
        [input.ruleId],
      );
      if (input.profile.selector !== undefined) {
        replaceRuleAssignments(
          transaction,
          this.#uuid,
          input.actor.principalId,
          policy,
          input.ruleId,
          input.profile.selector,
          transaction.timestamp(),
        );
      }
      bumpPolicyGeneration(transaction, this.#uuid, policy, input.ruleId, "rule");
      return {
        value: projectRule(
          transaction,
          requiredRule(transaction, input.serviceId, input.policyId, input.ruleId),
        ),
        auditInput: policyAudit(
          input.actor,
          "policy.rule.update",
          input.serviceId,
          input.ruleId,
          input.correlationId,
          ruleAuditChanges(input.policyId, input.profile),
        ),
      };
    });
  }

  async replaceRuleAssignments(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    ruleId: string;
    expectedVersion: number;
    selector: NormalizedPrincipalSelector;
    correlationId: string;
  }): Promise<PolicyRuleView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      requireActive(policy);
      const rule = requiredRule(
        transaction,
        input.serviceId,
        input.policyId,
        input.ruleId,
      );
      validateSelectorTargets(transaction, input.serviceId, input.selector);
      const updated = transaction.optimisticUpdate(
        "policy_rules",
        rule.id,
        input.expectedVersion,
        { enabled: rule.enabled },
      );
      if (updated.status === "stale") throw new PersistenceError("identity_stale");
      replaceRuleAssignments(
        transaction,
        this.#uuid,
        input.actor.principalId,
        policy,
        rule.id,
        input.selector,
        transaction.timestamp(),
      );
      bumpPolicyGeneration(transaction, this.#uuid, policy, rule.id, "selector");
      return {
        value: projectRule(
          transaction,
          requiredRule(transaction, input.serviceId, input.policyId, input.ruleId),
        ),
        auditInput: policyAudit(
          input.actor,
          "policy.rule.assignments.replace",
          input.serviceId,
          input.ruleId,
          input.correlationId,
          [
            { field: "selector_kind", after: input.selector.kind },
            { field: "group_count", after: input.selector.groupIds.length },
            { field: "direct_user_count", after: input.selector.userIds.length },
          ],
        ),
      };
    });
  }

  async deleteRule(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    ruleId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<void> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      requireActive(policy);
      const deleted = transaction.run(`
        DELETE FROM policy_rules
        WHERE service_id = ? AND policy_id = ? AND id = ? AND version = ?
      `, [
        input.serviceId,
        input.policyId,
        input.ruleId,
        input.expectedVersion,
      ]);
      if (deleted.changes !== 1) {
        requiredRule(transaction, input.serviceId, input.policyId, input.ruleId);
        throw new PersistenceError("identity_stale");
      }
      bumpPolicyGeneration(transaction, this.#uuid, policy, input.ruleId, "rule");
      return {
        value: undefined,
        auditInput: policyAudit(
          input.actor,
          "policy.rule.delete",
          input.serviceId,
          input.ruleId,
          input.correlationId,
          [{ field: "policy_id", after: input.policyId }],
        ),
      };
    });
  }

  async archivePolicy(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<PolicyDetailView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      requireActive(policy);
      const generation = policy.evaluation_generation + 1;
      const updated = transaction.optimisticUpdate(
        "policies",
        policy.id,
        input.expectedVersion,
        {
          lifecycle: "archived",
          evaluation_generation: generation,
        },
      );
      if (updated.status === "stale") throw new PersistenceError("identity_stale");
      transaction.run(
        "UPDATE policy_rules SET enabled = 0, version = version + 1, updated_at = ? WHERE policy_id = ?",
        [transaction.timestamp(), policy.id],
      );
      invalidatePolicy(transaction, this.#uuid, policy, null, null, generation, "archive");
      return {
        value: policyDetail(transaction, input.serviceId, input.policyId),
        auditInput: policyAudit(
          input.actor,
          "policy.archive",
          input.serviceId,
          input.policyId,
          input.correlationId,
          [{ field: "lifecycle", after: "archived" }],
        ),
      };
    });
  }

  async importPolicy(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    ruleIds: readonly string[];
    boundary: PolicyBoundary;
    profile: PolicyProfile;
    rules: readonly RuleProfile[];
    preserveSelectors: boolean;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        if (input.rules.length !== input.ruleIds.length) {
          throw new PersistenceError("identity_conflict");
        }
        validateBoundary(transaction, input.serviceId, input.boundary);
        const existing = transaction.get<{ count: number }>(
          "SELECT count(*) AS count FROM policies WHERE service_id = ?",
          [input.serviceId],
        )?.count ?? MAX_POLICIES_PER_SERVICE;
        const totalRules = transaction.get<{ count: number }>(
          "SELECT count(*) AS count FROM policy_rules",
        )?.count ?? MAX_RULES_TOTAL;
        if (
          existing >= MAX_POLICIES_PER_SERVICE
          || input.rules.length > MAX_RULES_PER_POLICY
          || totalRules + input.rules.length > MAX_RULES_TOTAL
        ) throw new PersistenceError("identity_conflict");
        const now = transaction.timestamp();
        transaction.run(`
          INSERT INTO policies (
            id, service_id, credential_id, name, normalized_name, description,
            operating_mode, lifecycle, evaluation_generation, version,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, ?)
        `, [
          input.policyId,
          input.serviceId,
          input.boundary.kind === "credential"
            ? input.boundary.credentialId
            : null,
          input.profile.name,
          input.profile.normalizedName,
          input.profile.description ?? null,
          input.profile.operatingMode,
          now,
          now,
        ]);
        const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
        input.rules.forEach((source, index) => {
          const ruleId = input.ruleIds[index]!;
          const { selector: sourceSelector, ...sourceWithoutSelector } = source;
          const selector = input.preserveSelectors ? sourceSelector : undefined;
          const profile: RuleProfile = {
            ...sourceWithoutSelector,
            enabled: input.preserveSelectors && source.enabled,
            ...(selector === undefined ? {} : { selector }),
          };
          if (selector !== undefined) {
            validateSelectorTargets(transaction, input.serviceId, selector);
          }
          insertRule(transaction, ruleId, policy, profile, now);
          if (selector !== undefined) {
            replaceRuleAssignments(
              transaction,
              this.#uuid,
              input.actor.principalId,
              policy,
              ruleId,
              selector,
              now,
            );
          }
        });
        invalidatePolicy(
          transaction,
          this.#uuid,
          policy,
          null,
          null,
          1,
          "copy",
        );
        return {
          value: input.policyId,
          resultReference: input.policyId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: policyAudit(
          input.actor,
          "policy.copy",
          input.serviceId,
          result.kind === "executed" ? result.value : result.resultReference,
          input.correlationId,
          [
            { field: "boundary_kind", after: input.boundary.kind },
            { field: "rule_count", after: input.rules.length },
            {
              field: "selectors_preserved",
              after: input.preserveSelectors ? 1 : 0,
            },
          ],
        ),
      };
    });
  }

  async bulkCopy(input: {
    actor: ControlAuthenticationContext;
    sourceServiceId: string;
    batchId: string;
    copies: readonly PolicyBulkCopySpec[];
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.sourceServiceId, false);
      const result = transaction.idempotent(input.idempotency, () => {
        if (input.copies.length < 1 || input.copies.length > 20) {
          throw new PersistenceError("identity_conflict");
        }
        const prepared = input.copies.map((copy) => {
          requireScopedService(transaction, input.actor, copy.targetServiceId, true);
          validateBoundary(transaction, copy.targetServiceId, copy.boundary);
          const source = policyDetail(
            transaction,
            input.sourceServiceId,
            copy.sourcePolicyId,
          );
          const copied = copyProfiles(copyDocument(source));
          return {
            ...copy,
            profile: copy.name === undefined
              ? copied.profile
              : {
                  ...copied.profile,
                  ...normalizedProfile(copy.name, copied.profile.description),
                },
            rules: copied.rules,
            preserveSelectors: input.sourceServiceId === copy.targetServiceId,
          };
        });
        const boundaryKeys = prepared.map((copy) =>
          `${copy.targetServiceId}:${copy.boundary.kind === "service"
            ? "service"
            : copy.boundary.credentialId}`);
        if (new Set(boundaryKeys).size !== boundaryKeys.length) {
          throw new PersistenceError("identity_conflict");
        }
        const targetCounts = new Map<string, number>();
        for (const copy of prepared) {
          targetCounts.set(
            copy.targetServiceId,
            (targetCounts.get(copy.targetServiceId) ?? 0) + 1,
          );
          const occupied = copy.boundary.kind === "service"
            ? transaction.get(`
                SELECT 1 FROM policies
                WHERE service_id = ? AND credential_id IS NULL
                  AND lifecycle = 'active'
              `, [copy.targetServiceId])
            : transaction.get(`
                SELECT 1 FROM policies
                WHERE service_id = ? AND credential_id = ?
                  AND lifecycle = 'active'
              `, [copy.targetServiceId, copy.boundary.credentialId]);
          if (occupied !== undefined) throw new PersistenceError("identity_conflict");
        }
        for (const [serviceId, added] of targetCounts) {
          const existing = transaction.get<{ count: number }>(
            "SELECT count(*) AS count FROM policies WHERE service_id = ?",
            [serviceId],
          )?.count ?? MAX_POLICIES_PER_SERVICE;
          if (existing + added > MAX_POLICIES_PER_SERVICE) {
            throw new PersistenceError("identity_conflict");
          }
        }
        const addedRules = prepared.reduce((sum, copy) => sum + copy.rules.length, 0);
        const totalRules = transaction.get<{ count: number }>(
          "SELECT count(*) AS count FROM policy_rules",
        )?.count ?? MAX_RULES_TOTAL;
        if (
          totalRules + addedRules > MAX_RULES_TOTAL
          || prepared.some((copy) => copy.rules.length > MAX_RULES_PER_POLICY)
        ) throw new PersistenceError("identity_conflict");

        const now = transaction.timestamp();
        prepared.forEach((copy, ordinal) => {
          const policyId = this.#uuid();
          transaction.run(`
            INSERT INTO policies (
              id, service_id, credential_id, name, normalized_name, description,
              operating_mode, lifecycle, evaluation_generation, version,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, ?)
          `, [
            policyId,
            copy.targetServiceId,
            copy.boundary.kind === "credential"
              ? copy.boundary.credentialId
              : null,
            copy.profile.name,
            copy.profile.normalizedName,
            copy.profile.description ?? null,
            copy.profile.operatingMode,
            now,
            now,
          ]);
          const policy = requiredPolicy(transaction, copy.targetServiceId, policyId);
          for (const source of copy.rules) {
            const { selector: sourceSelector, ...sourceWithoutSelector } = source;
            const selector = copy.preserveSelectors ? sourceSelector : undefined;
            const profile: RuleProfile = {
              ...sourceWithoutSelector,
              enabled: copy.preserveSelectors && source.enabled,
              ...(selector === undefined ? {} : { selector }),
            };
            if (selector !== undefined) {
              validateSelectorTargets(transaction, copy.targetServiceId, selector);
            }
            const ruleId = this.#uuid();
            insertRule(transaction, ruleId, policy, profile, now);
            if (selector !== undefined) {
              replaceRuleAssignments(
                transaction,
                this.#uuid,
                input.actor.principalId,
                policy,
                ruleId,
                selector,
                now,
              );
            }
          }
          invalidatePolicy(
            transaction,
            this.#uuid,
            policy,
            null,
            null,
            1,
            "copy",
          );
          transaction.run(`
            INSERT INTO policy_copy_batch_members (
              batch_id, ordinal, service_id, policy_id
            ) VALUES (?, ?, ?, ?)
          `, [input.batchId, ordinal, copy.targetServiceId, policyId]);
        });
        return {
          value: input.batchId,
          resultReference: input.batchId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: policyAudit(
          input.actor,
          "policy.bulk_copy",
          input.sourceServiceId,
          input.batchId,
          input.correlationId,
          [
            { field: "copy_count", after: input.copies.length },
            {
              field: "cross_service_count",
              after: input.copies.filter(
                ({ targetServiceId }) => targetServiceId !== input.sourceServiceId,
              ).length,
            },
          ],
        ),
      };
    });
  }

  async copyBatch(
    actor: ControlAuthenticationContext,
    batchId: string,
  ): Promise<PolicyDetailView[]> {
    return this.read((query) => {
      const rows = query.all<{ service_id: string; policy_id: string }>(`
        SELECT service_id, policy_id
        FROM policy_copy_batch_members
        WHERE batch_id = ?
        ORDER BY ordinal
      `, [batchId]);
      if (rows.length < 1) throw new PersistenceError("identity_not_found");
      return rows.map((row) => {
        requireScopedService(query, actor, row.service_id, false);
        return policyDetail(query, row.service_id, row.policy_id);
      });
    });
  }

  async deleteArchived(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    policyId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<void> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const policy = requiredPolicy(transaction, input.serviceId, input.policyId);
      if (policy.lifecycle !== "archived") throw new PersistenceError("identity_conflict");
      const deleted = transaction.run(
        "DELETE FROM policies WHERE id = ? AND service_id = ? AND version = ?",
        [input.policyId, input.serviceId, input.expectedVersion],
      );
      if (deleted.changes !== 1) throw new PersistenceError("identity_stale");
      return {
        value: undefined,
        auditInput: policyAudit(
          input.actor,
          "policy.delete",
          input.serviceId,
          input.policyId,
          input.correlationId,
          [{ field: "deleted", after: 1 }],
        ),
      };
    });
  }

  async simulate(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    userId: string;
    destinationId: string;
    method: string;
    target: { path?: string; url?: string };
    credentialIds: readonly string[];
    correlationId: string;
  }): Promise<PolicySimulationView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, false);
      const user = transaction.get<{ role: string; status: string }>(
        "SELECT role, status FROM users WHERE id = ?",
        [input.userId],
      );
      if (user?.role !== "user" || user.status !== "active") {
        throw new PersistenceError("identity_not_found");
      }
      const destination = simulationDestination(
        transaction,
        input.serviceId,
        input.destinationId,
      );
      let target;
      try {
        target = resolveDestinationTarget(
          simulationService(input.serviceId, destination),
          destination.id,
          input.target,
        );
      } catch {
        throw new PolicyManagementError("invalid_request");
      }
      const groupIds = activeMemberships(transaction, input.serviceId, input.userId);
      const serviceAllowed = serviceAuthorizes(
        transaction,
        input.serviceId,
        input.userId,
      );
      const serviceBoundary = policyBoundarySnapshot(
        transaction,
        input.serviceId,
        null,
        serviceAllowed,
      );
      const credentialIds = [...new Set(input.credentialIds)].sort();
      const credentials = credentialIds.map((credentialId) => {
        const credential = transaction.get<{ status: string }>(`
          SELECT status FROM service_credentials
          WHERE service_id = ? AND id = ?
        `, [input.serviceId, credentialId]);
        if (credential === undefined || credential.status === "archived") {
          throw new PersistenceError("identity_not_found");
        }
        return policyBoundarySnapshot(
          transaction,
          input.serviceId,
          credentialId,
          serviceAllowed && credentialAuthorizes(
            transaction,
            input.serviceId,
            credentialId,
            input.userId,
          ),
        );
      });
      const explanation = evaluatePolicySnapshot({
        subjectId: input.userId,
        groupIds,
        method: input.method,
        host: target.url.hostname,
        pathname: target.methodPath,
        service: serviceBoundary,
        credentials,
      });
      const links = simulationLinks(
        input.actor,
        input.serviceId,
        input.userId,
        credentialIds,
        groupIds,
        [serviceBoundary, ...credentials],
        serviceAllowed,
      );
      return {
        value: { ...explanation, links },
        auditInput: policyAudit(
          input.actor,
          "policy.simulate",
          input.serviceId,
          input.serviceId,
          input.correlationId,
          [
            { field: "method", after: input.method },
            { field: "credential_count", after: credentialIds.length },
            { field: "boundary_count", after: explanation.boundaries.length },
            { field: "outcome", after: explanation.allowed ? "allow" : "deny" },
            { field: "reason_code", after: explanation.reasonCode },
          ],
        ),
      };
    });
  }

  async copy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
  ): Promise<PolicyCopyDocument> {
    const detail = await this.policy(actor, serviceId, policyId);
    return copyDocument(detail);
  }

  private async read<T>(operation: (query: PersistenceQuery) => T): Promise<T> {
    try {
      return await this.owner.execute({
        run: (database) => database.read(operation),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  private async audited<T>(
    operation: (transaction: PersistenceTransaction) => {
      value: T;
      auditInput: AdministrativeAuditEventInput;
    },
  ): Promise<T> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(operation),
      });
    } catch (error) {
      throw mapError(error);
    }
  }
}

export class PolicyManagementService {
  readonly #uuid: () => string;

  constructor(
    private readonly repository: PolicyManagementRepository,
    private readonly idempotency: ControlIdempotencyHasher,
    now: () => number = Date.now,
  ) {
    this.#uuid = defaultUuid(now);
  }

  policies(actor: ControlAuthenticationContext, serviceId: string) {
    return this.repository.policies(actor, requiredUuid(serviceId));
  }

  policy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
  ) {
    return this.repository.policy(
      actor,
      requiredUuid(serviceId),
      requiredUuid(policyId),
    );
  }

  async createPolicy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ policy: PolicyDetailView; replayed: boolean }> {
    const service = requiredUuid(serviceId);
    const input = policyBody(body);
    const policyId = this.#uuid();
    const result = await this.repository.createPolicy({
      actor,
      serviceId: service,
      policyId,
      boundary: input.boundary,
      profile: input.profile,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "policies.create",
        idempotencyKey,
        { serviceId: service, input },
      ),
    });
    const id = result.kind === "executed" ? result.value : result.resultReference;
    return {
      policy: await this.repository.policy(actor, service, id),
      replayed: result.kind === "replayed",
    };
  }

  updatePolicy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    expectedVersion: number,
    body: unknown,
    correlationId: string,
  ) {
    return this.repository.updatePolicy({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      expectedVersion: requiredVersion(expectedVersion),
      profile: policyProfile(body),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  async createRule(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ rule: PolicyRuleView; replayed: boolean }> {
    const service = requiredUuid(serviceId);
    const policy = requiredUuid(policyId);
    const profile = ruleBody(body);
    const ruleId = this.#uuid();
    const result = await this.repository.createRule({
      actor,
      serviceId: service,
      policyId: policy,
      ruleId,
      profile,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "policies.rules.create",
        idempotencyKey,
        { serviceId: service, policyId: policy, profile },
      ),
    });
    const id = result.kind === "executed" ? result.value : result.resultReference;
    const detail = await this.repository.policy(actor, service, policy);
    const rule = detail.rules.find((candidate) => candidate.id === id);
    if (rule === undefined) throw new PolicyManagementError("unavailable");
    return { rule, replayed: result.kind === "replayed" };
  }

  updateRule(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    ruleId: string,
    expectedVersion: number,
    body: unknown,
    correlationId: string,
  ) {
    return this.repository.updateRule({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      ruleId: requiredUuid(ruleId),
      expectedVersion: requiredVersion(expectedVersion),
      profile: ruleBody(body),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  replaceRuleAssignments(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    ruleId: string,
    expectedVersion: number,
    body: unknown,
    correlationId: string,
  ) {
    return this.repository.replaceRuleAssignments({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      ruleId: requiredUuid(ruleId),
      expectedVersion: requiredVersion(expectedVersion),
      selector: normalizeSelector(body),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  deleteRule(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    ruleId: string,
    expectedVersion: number,
    correlationId: string,
  ) {
    return this.repository.deleteRule({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      ruleId: requiredUuid(ruleId),
      expectedVersion: requiredVersion(expectedVersion),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  archivePolicy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    expectedVersion: number,
    correlationId: string,
  ) {
    return this.repository.archivePolicy({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      expectedVersion: requiredVersion(expectedVersion),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  async clonePolicy(
    actor: ControlAuthenticationContext,
    sourceServiceId: string,
    sourcePolicyId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ policy: PolicyDetailView; replayed: boolean }> {
    const sourceService = requiredUuid(sourceServiceId);
    const sourcePolicy = requiredUuid(sourcePolicyId);
    const target = cloneBody(body);
    const document = await this.repository.copy(actor, sourceService, sourcePolicy);
    const copied = copyProfiles(document);
    const profile = target.name === undefined
      ? copied.profile
      : {
          ...copied.profile,
          ...normalizedProfile(target.name, copied.profile.description),
        };
    return this.importNormalized(
      actor,
      target.serviceId,
      target.boundary,
      { ...copied, profile },
      sourceService === target.serviceId,
      idempotencyKey,
      correlationId,
      {
        sourceServiceId: sourceService,
        sourcePolicyId: sourcePolicy,
      },
    );
  }

  async bulkCopy(
    actor: ControlAuthenticationContext,
    sourceServiceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ policies: PolicyDetailView[]; replayed: boolean }> {
    const sourceService = requiredUuid(sourceServiceId);
    const copies = bulkCopyBody(body);
    const batchId = this.#uuid();
    const result = await this.repository.bulkCopy({
      actor,
      sourceServiceId: sourceService,
      batchId,
      copies,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "policies.bulk-copy",
        idempotencyKey,
        { sourceServiceId: sourceService, copies },
      ),
    });
    const id = result.kind === "executed" ? result.value : result.resultReference;
    return {
      policies: await this.repository.copyBatch(actor, id),
      replayed: result.kind === "replayed",
    };
  }

  async importPolicy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ policy: PolicyDetailView; replayed: boolean }> {
    const targetService = requiredUuid(serviceId);
    const input = importBody(body);
    return this.importNormalized(
      actor,
      targetService,
      input.boundary,
      copyProfiles(input.document),
      true,
      idempotencyKey,
      correlationId,
      { imported: true },
    );
  }

  deleteArchived(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
    expectedVersion: number,
    correlationId: string,
  ) {
    return this.repository.deleteArchived({
      actor,
      serviceId: requiredUuid(serviceId),
      policyId: requiredUuid(policyId),
      expectedVersion: requiredVersion(expectedVersion),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  async simulate(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    correlationId: string,
  ) {
    const input = simulationBody(body);
    return await this.repository.simulate({
      actor,
      serviceId: requiredUuid(serviceId),
      userId: input.userId,
      destinationId: input.destinationId,
      method: input.method,
      target: input.target,
      credentialIds: input.credentialIds,
      correlationId: requiredCorrelation(correlationId),
    });
  }

  copy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    policyId: string,
  ) {
    return this.repository.copy(
      actor,
      requiredUuid(serviceId),
      requiredUuid(policyId),
    );
  }

  private idempotencyInput(
    actor: ControlAuthenticationContext,
    routeId: string,
    key: string,
    body: unknown,
  ): IdempotencyExecutionInput {
    try {
      return {
        keyHash: this.idempotency.keyHash({
          key,
          principalId: actor.principalId,
          routeId,
        }),
        principalId: actor.principalId,
        routeId,
        requestDigest: this.idempotency.requestDigest(body),
      };
    } catch {
      throw new PolicyManagementError("invalid_request");
    }
  }

  private async importNormalized(
    actor: ControlAuthenticationContext,
    serviceId: string,
    boundary: PolicyBoundary,
    input: { profile: PolicyProfile; rules: RuleProfile[] },
    preserveSelectors: boolean,
    idempotencyKey: string,
    correlationId: string,
    source: unknown,
  ): Promise<{ policy: PolicyDetailView; replayed: boolean }> {
    const policyId = this.#uuid();
    const ruleIds = input.rules.map(() => this.#uuid());
    const result = await this.repository.importPolicy({
      actor,
      serviceId,
      policyId,
      ruleIds,
      boundary,
      profile: input.profile,
      rules: input.rules,
      preserveSelectors,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "policies.copy",
        idempotencyKey,
        { serviceId, boundary, input, preserveSelectors, source },
      ),
    });
    const id = result.kind === "executed" ? result.value : result.resultReference;
    return {
      policy: await this.repository.policy(actor, serviceId, id),
      replayed: result.kind === "replayed",
    };
  }
}

function policySelect(fragment: string): string {
  return `
    SELECT p.*,
      (SELECT count(*) FROM policy_rules r WHERE r.policy_id = p.id) AS rule_count
    FROM policies p
    ${fragment}
  `;
}

function ruleRows(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
  policyId: string,
): RuleRow[] {
  return query.all<RuleRow>(`
    SELECT * FROM policy_rules
    WHERE service_id = ? AND policy_id = ?
    ORDER BY priority DESC, effect DESC, normalized_name, id
    LIMIT ?
  `, [serviceId, policyId, MAX_RULES_PER_POLICY]);
}

function policyDetail(
  query: Pick<PersistenceQuery, "get" | "all">,
  serviceId: string,
  policyId: string,
): PolicyDetailView {
  const policy = requiredPolicy(query, serviceId, policyId);
  const rules = ruleRows(query, serviceId, policyId).map((row) =>
    projectRule(query, row));
  return { ...projectPolicy({ ...policy, rule_count: rules.length }), rules };
}

function projectPolicy(row: PolicyRow): PolicyView {
  return {
    id: row.id,
    serviceId: row.service_id,
    boundary: row.credential_id === null
      ? { kind: "service" }
      : { kind: "credential", credentialId: row.credential_id },
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    operatingMode: row.operating_mode,
    lifecycle: row.lifecycle,
    evaluationGeneration: row.evaluation_generation,
    ruleCount: row.rule_count ?? 0,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectRule(
  query: Pick<PersistenceQuery, "all">,
  row: RuleRow,
): PolicyRuleView {
  const selector = selectorView(query, row.id);
  return {
    id: row.id,
    serviceId: row.service_id,
    policyId: row.policy_id,
    name: row.name,
    ...(row.reason === null ? {} : { reason: row.reason }),
    effect: row.effect,
    priority: row.priority,
    enabled: row.enabled === 1,
    matchers: {
      methods: parseJson(row.methods_json),
      hosts: parseJson(row.hosts_json),
      paths: parseJson(row.paths_json),
    },
    responseSafeguards: parseJson(row.response_safeguards_json),
    ...(selector === undefined ? {} : { selector }),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requiredPolicy(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  policyId: string,
): PolicyRow {
  if (!isUuidV7(policyId)) throw new PersistenceError("identity_not_found");
  const row = query.get<PolicyRow>(
    "SELECT * FROM policies WHERE service_id = ? AND id = ?",
    [serviceId, policyId],
  );
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requiredRule(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  policyId: string,
  ruleId: string,
): RuleRow {
  if (!isUuidV7(ruleId)) throw new PersistenceError("identity_not_found");
  const row = query.get<RuleRow>(`
    SELECT * FROM policy_rules
    WHERE service_id = ? AND policy_id = ? AND id = ?
  `, [serviceId, policyId, ruleId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requireActive(policy: PolicyRow): void {
  if (policy.lifecycle !== "active") throw new PersistenceError("identity_conflict");
}

function validateBoundary(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  boundary: PolicyBoundary,
): void {
  if (boundary.kind === "service") return;
  const credential = query.get<{ status: string }>(`
    SELECT status FROM service_credentials
    WHERE service_id = ? AND id = ?
  `, [serviceId, boundary.credentialId]);
  if (credential === undefined || credential.status === "archived") {
    throw new PersistenceError("identity_not_found");
  }
}

function simulationDestination(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  destinationId: string,
): DestinationConfig {
  const row = query.get<{
    id: string;
    base_url: string;
    schemes_json: string;
    hosts_json: string;
    ports_json: string;
    tls_verify: 0 | 1;
  }>(`
    SELECT id, base_url, schemes_json, hosts_json, ports_json, tls_verify
    FROM service_destinations
    WHERE service_id = ? AND id = ?
  `, [serviceId, destinationId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  try {
    const hosts = parseJson<Array<
      | { type: "exact"; value: string }
      | { type: "suffix"; value: string }
      | { type: "regex"; value: string }
    >>(row.hosts_json).map((matcher) =>
      matcher.type === "regex"
        ? { ...matcher, regex: new RegExp(matcher.value) }
        : matcher);
    return {
      id: row.id,
      baseUrl: row.base_url,
      schemes: parseJson(row.schemes_json),
      hosts,
      ports: parseJson(row.ports_json),
      tls: { verify: row.tls_verify === 1 },
    };
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function simulationService(
  serviceId: string,
  destination: DestinationConfig,
): ServiceConfig {
  return {
    id: serviceId,
    type: "http",
    name: "managed service",
    destinations: [destination],
    tls: destination.tls,
    credentials: [],
    access: { users: [] },
    policy: { mode: "deny", rules: [] },
  };
}

function activeMemberships(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
  userId: string,
): string[] {
  return query.all<{ id: string }>(`
    SELECT g.id
    FROM service_groups g
    JOIN service_group_members gm
      ON gm.service_id = g.service_id AND gm.group_id = g.id
    WHERE g.service_id = ? AND g.lifecycle = 'active' AND gm.user_id = ?
    ORDER BY g.id
  `, [serviceId, userId]).map(({ id }) => id);
}

function serviceAuthorizes(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  userId: string,
): boolean {
  return query.get(`
    SELECT 1 FROM users u
    WHERE u.id = ? AND u.role = 'user' AND u.status = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM service_principal_assignments a
          WHERE a.service_id = ? AND a.selector_kind = 'all'
        )
        OR EXISTS (
          SELECT 1 FROM service_principal_assignments d
          WHERE d.service_id = ? AND d.selector_kind = 'user'
            AND d.user_id = u.id
        )
        OR EXISTS (
          SELECT 1 FROM service_principal_assignments s
          JOIN service_groups g
            ON g.service_id = s.service_id AND g.id = s.group_id
          JOIN service_group_members gm
            ON gm.service_id = g.service_id AND gm.group_id = g.id
          WHERE s.service_id = ? AND s.selector_kind = 'group'
            AND g.lifecycle = 'active' AND gm.user_id = u.id
        )
      )
  `, [userId, serviceId, serviceId, serviceId]) !== undefined;
}

function credentialAuthorizes(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  credentialId: string,
  userId: string,
): boolean {
  return query.get(`
    SELECT 1 WHERE
      EXISTS (
        SELECT 1 FROM credential_principal_assignments a
        WHERE a.service_id = ? AND a.credential_id = ?
          AND a.selector_kind = 'all'
      )
      OR EXISTS (
        SELECT 1 FROM credential_principal_assignments d
        WHERE d.service_id = ? AND d.credential_id = ?
          AND d.selector_kind = 'user' AND d.user_id = ?
      )
      OR EXISTS (
        SELECT 1 FROM credential_principal_assignments s
        JOIN service_groups g
          ON g.service_id = s.service_id AND g.id = s.group_id
        JOIN service_group_members gm
          ON gm.service_id = g.service_id AND gm.group_id = g.id
        WHERE s.service_id = ? AND s.credential_id = ?
          AND s.selector_kind = 'group' AND g.lifecycle = 'active'
          AND gm.user_id = ?
      )
  `, [
    serviceId,
    credentialId,
    serviceId,
    credentialId,
    userId,
    serviceId,
    credentialId,
    userId,
  ]) !== undefined;
}

function policyBoundarySnapshot(
  query: Pick<PersistenceQuery, "get" | "all">,
  serviceId: string,
  credentialId: string | null,
  assignmentAllowed: boolean,
): PolicyBoundarySnapshot {
  const policy = credentialId === null
    ? query.get<PolicyRow>(`
        SELECT * FROM policies
        WHERE service_id = ? AND credential_id IS NULL AND lifecycle = 'active'
      `, [serviceId])
    : query.get<PolicyRow>(`
        SELECT * FROM policies
        WHERE service_id = ? AND credential_id = ? AND lifecycle = 'active'
      `, [serviceId, credentialId]);
  if (policy === undefined) {
    return {
      id: credentialId ?? serviceId,
      kind: credentialId === null ? "service" : "credential",
      mode: "deny",
      assignmentAllowed,
      rules: [],
    };
  }
  return {
    id: policy.id,
    kind: credentialId === null ? "service" : "credential",
    mode: policy.operating_mode,
    assignmentAllowed,
    rules: ruleRows(query, serviceId, policy.id).map((row) => ({
      id: row.id,
      effect: row.effect,
      priority: row.priority,
      enabled: row.enabled === 1,
      methods: parseJson(row.methods_json),
      hosts: parseJson(row.hosts_json),
      paths: parseJson(row.paths_json),
      selector: evaluatorSelector(selectorView(query, row.id)),
      ...(row.reason === null ? {} : { reason: row.reason }),
    })),
  };
}

function evaluatorSelector(
  selector: NormalizedPrincipalSelector | undefined,
): PolicyPrincipalSelector {
  if (selector === undefined) return { kind: "principals", groupIds: [], userIds: [] };
  if (selector.kind === "all") return { kind: "all" };
  if (selector.groupIds.length > 0 && selector.userIds.length > 0) {
    return {
      kind: "principals",
      groupIds: selector.groupIds,
      userIds: selector.userIds,
    };
  }
  if (selector.groupIds.length > 0) {
    return { kind: "groups", groupIds: selector.groupIds };
  }
  return { kind: "users", userIds: selector.userIds };
}

function simulationLinks(
  actor: ControlAuthenticationContext,
  serviceId: string,
  userId: string,
  credentialIds: readonly string[],
  groupIds: readonly string[],
  boundaries: readonly PolicyBoundarySnapshot[],
  serviceAllowed: boolean,
): PolicySimulationView["links"] {
  const links: PolicySimulationView["links"] = [{
    kind: "service",
    id: serviceId,
    href: `/control/services/${serviceId}`,
  }];
  for (const credentialId of credentialIds) {
    links.push({
      kind: "credential",
      id: credentialId,
      href: `/control/credentials/${credentialId}`,
    });
  }
  for (const groupId of groupIds) {
    links.push({
      kind: "group",
      id: groupId,
      href: `/control/groups/${groupId}`,
    });
  }
  if (actor.role === "superadmin" || serviceAllowed) {
    links.push({ kind: "user", id: userId, href: `/control/users/${userId}` });
  }
  for (const boundary of boundaries) {
    if (isUuidV7(boundary.id)) {
      links.push({
        kind: "policy",
        id: boundary.id,
        href: `/control/policies/${boundary.id}`,
      });
    }
  }
  return links;
}

function requireRuleCapacity(
  query: Pick<PersistenceQuery, "get">,
  policyId: string,
): void {
  const total = query.get<{ count: number }>(
    "SELECT count(*) AS count FROM policy_rules",
  )?.count ?? MAX_RULES_TOTAL;
  const policy = query.get<{ count: number }>(
    "SELECT count(*) AS count FROM policy_rules WHERE policy_id = ?",
    [policyId],
  )?.count ?? MAX_RULES_PER_POLICY;
  if (total >= MAX_RULES_TOTAL || policy >= MAX_RULES_PER_POLICY) {
    throw new PersistenceError("identity_conflict");
  }
}

function insertRule(
  transaction: PersistenceTransaction,
  ruleId: string,
  policy: PolicyRow,
  profile: RuleProfile,
  now: number,
): void {
  transaction.run(`
    INSERT INTO policy_rules (
      id, service_id, policy_id, name, normalized_name, reason, effect,
      priority, enabled, methods_json, hosts_json, paths_json,
      response_safeguards_json, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [
    ruleId,
    policy.service_id,
    policy.id,
    profile.name,
    profile.normalizedName,
    profile.reason ?? null,
    profile.effect,
    profile.priority,
    profile.enabled ? 1 : 0,
    JSON.stringify(profile.matchers.methods),
    JSON.stringify(profile.matchers.hosts),
    JSON.stringify(profile.matchers.paths),
    JSON.stringify(profile.safeguards),
    now,
    now,
  ]);
}

function ruleUpdateFields(
  profile: RuleProfile,
): Record<string, string | number | null> {
  return {
    name: profile.name,
    normalized_name: profile.normalizedName,
    reason: profile.reason ?? null,
    effect: profile.effect,
    priority: profile.priority,
    enabled: profile.enabled ? 1 : 0,
    methods_json: JSON.stringify(profile.matchers.methods),
    hosts_json: JSON.stringify(profile.matchers.hosts),
    paths_json: JSON.stringify(profile.matchers.paths),
    response_safeguards_json: JSON.stringify(profile.safeguards),
  };
}

function replaceRuleAssignments(
  transaction: PersistenceTransaction,
  uuid: () => string,
  actorId: string,
  policy: PolicyRow,
  ruleId: string,
  selector: NormalizedPrincipalSelector,
  now: number,
): void {
  transaction.run(
    "DELETE FROM policy_rule_principal_assignments WHERE rule_id = ?",
    [ruleId],
  );
  if (selector.kind === "all") {
    insertRuleAssignment(
      transaction,
      uuid(),
      actorId,
      policy,
      ruleId,
      "all",
      undefined,
      now,
    );
    return;
  }
  for (const groupId of selector.groupIds) {
    insertRuleAssignment(
      transaction,
      uuid(),
      actorId,
      policy,
      ruleId,
      "group",
      groupId,
      now,
    );
  }
  for (const userId of selector.userIds) {
    insertRuleAssignment(
      transaction,
      uuid(),
      actorId,
      policy,
      ruleId,
      "user",
      userId,
      now,
    );
  }
}

function insertRuleAssignment(
  transaction: PersistenceTransaction,
  id: string,
  actorId: string,
  policy: PolicyRow,
  ruleId: string,
  kind: "all" | "group" | "user",
  targetId: string | undefined,
  now: number,
): void {
  transaction.run(`
    INSERT INTO policy_rule_principal_assignments (
      id, service_id, policy_id, rule_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    policy.service_id,
    policy.id,
    ruleId,
    kind,
    kind === "group" ? targetId! : null,
    kind === "user" ? targetId! : null,
    actorId,
    now,
  ]);
}

function selectorView(
  query: Pick<PersistenceQuery, "all">,
  ruleId: string,
): NormalizedPrincipalSelector | undefined {
  const rows = query.all<{
    selector_kind: "all" | "group" | "user";
    target_id: string | null;
  }>(`
    SELECT selector_kind, coalesce(group_id, user_id) AS target_id
    FROM policy_rule_principal_assignments
    WHERE rule_id = ?
    ORDER BY selector_kind, target_id
  `, [ruleId]);
  if (rows.some((row) => row.selector_kind === "all")) {
    return { kind: "all", groupIds: [], userIds: [] };
  }
  const groupIds = rows.filter((row) => row.selector_kind === "group")
    .map((row) => row.target_id!);
  const userIds = rows.filter((row) => row.selector_kind === "user")
    .map((row) => row.target_id!);
  if (groupIds.length + userIds.length === 0) return undefined;
  return { kind: "explicit", groupIds, userIds };
}

function validateSelectorTargets(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  selector: NormalizedPrincipalSelector,
): void {
  if (selector.kind === "all") return;
  if (selector.groupIds.length > 0) {
    const placeholders = selector.groupIds.map(() => "?").join(",");
    const count = query.get<{ count: number }>(`
      SELECT count(*) AS count FROM service_groups
      WHERE service_id = ? AND lifecycle = 'active'
        AND id IN (${placeholders})
    `, [serviceId, ...selector.groupIds])?.count ?? -1;
    if (count !== selector.groupIds.length) {
      throw new PersistenceError("identity_not_found");
    }
  }
  if (selector.userIds.length > 0) {
    if (selector.userIds.some((userId) =>
      !serviceAuthorizes(query, serviceId, userId))) {
      throw new PersistenceError("identity_not_found");
    }
  }
}

function bumpPolicyGeneration(
  transaction: PersistenceTransaction,
  uuid: () => string,
  policy: PolicyRow,
  ruleId: string | null,
  reason: "rule" | "selector",
): number {
  const current = requiredPolicy(transaction, policy.service_id, policy.id);
  const generation = current.evaluation_generation + 1;
  const changed = transaction.run(`
    UPDATE policies
    SET evaluation_generation = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `, [generation, transaction.timestamp(), current.id, current.version]);
  if (changed.changes !== 1) throw new PersistenceError("identity_stale");
  invalidatePolicy(
    transaction,
    uuid,
    current,
    ruleId,
    null,
    generation,
    reason,
  );
  return generation;
}

function invalidatePolicy(
  transaction: PersistenceTransaction,
  uuid: () => string,
  policy: PolicyRow,
  ruleId: string | null,
  affectedUserId: string | null,
  generation: number,
  reason: "policy" | "rule" | "selector" | "archive" | "copy",
): void {
  transaction.run(`
    INSERT INTO policy_invalidation_events (
      id, service_id, policy_id, rule_id, affected_user_id,
      evaluation_generation, reason, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
  `, [
    uuid(),
    policy.service_id,
    policy.id,
    ruleId,
    affectedUserId,
    generation,
    reason,
    transaction.timestamp(),
  ]);
}

function requireScopedService(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
  mutable: boolean,
): void {
  if (!isUuidV7(serviceId)) {
    throw new PersistenceError("identity_not_found");
  }
  const service = query.get<{ lifecycle: string }>(
    "SELECT lifecycle FROM services WHERE id = ?",
    [serviceId],
  );
  if (service === undefined || (mutable && service.lifecycle === "archived")) {
    throw new PersistenceError("identity_not_found");
  }
  if (requireServiceApiKeyAuthority(query, actor, serviceId)) return;
  if (actor.method !== "browser_session") {
    throw new PersistenceError("identity_not_found");
  }
  if (actor.role === "superadmin") {
    const live = query.get<{ role: string; status: string }>(
      "SELECT role, status FROM users WHERE id = ?",
      [actor.principalId],
    );
    if (live?.role === "superadmin" && live.status === "active") return;
  }
  if (actor.role === "admin") {
    const live = query.get(`
      SELECT 1 FROM service_admins sa
      JOIN users u ON u.id = sa.user_id
      WHERE sa.service_id = ? AND sa.user_id = ?
        AND u.role = 'admin' AND u.status = 'active'
    `, [serviceId, actor.principalId]);
    if (live !== undefined) return;
  }
  throw new PersistenceError("identity_not_found");
}

function policyBody(value: unknown): {
  boundary: PolicyBoundary;
  profile: PolicyProfile;
} {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["boundary", "name", "description", "operating_mode"], ["description"]);
  if (!plainObject(value.boundary)) invalid();
  let boundary: PolicyBoundary;
  if (
    value.boundary.kind === "service"
    && Object.keys(value.boundary).length === 1
  ) {
    boundary = { kind: "service" };
  } else if (
    value.boundary.kind === "credential"
    && Object.keys(value.boundary).sort().join(",") === "credential_id,kind"
    && typeof value.boundary.credential_id === "string"
  ) {
    boundary = {
      kind: "credential",
      credentialId: requiredUuid(value.boundary.credential_id),
    };
  } else {
    invalid();
  }
  return { boundary, profile: policyProfileFields(value) };
}

function normalizeBoundary(value: unknown): PolicyBoundary {
  if (!plainObject(value)) invalid();
  if (value.kind === "service" && Object.keys(value).length === 1) {
    return { kind: "service" };
  }
  if (
    value.kind === "credential"
    && Object.keys(value).sort().join(",") === "credential_id,kind"
    && typeof value.credential_id === "string"
  ) {
    return {
      kind: "credential",
      credentialId: requiredUuid(value.credential_id),
    };
  }
  invalid();
}

function cloneBody(value: unknown): {
  serviceId: string;
  boundary: PolicyBoundary;
  name?: string;
} {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["target_service_id", "boundary", "name"], ["name"]);
  if (typeof value.target_service_id !== "string") invalid();
  if (value.name !== undefined && typeof value.name !== "string") invalid();
  return {
    serviceId: requiredUuid(value.target_service_id),
    boundary: normalizeBoundary(value.boundary),
    ...(value.name === undefined ? {} : { name: value.name }),
  };
}

function importBody(value: unknown): {
  boundary: PolicyBoundary;
  document: PolicyCopyDocument;
} {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["boundary", "document"]);
  return {
    boundary: normalizeBoundary(value.boundary),
    document: parseCopyDocument(value.document),
  };
}

function bulkCopyBody(value: unknown): PolicyBulkCopySpec[] {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["copies"]);
  if (
    !Array.isArray(value.copies)
    || value.copies.length < 1
    || value.copies.length > 20
  ) invalid();
  return value.copies.map((copy) => {
    if (!plainObject(copy)) invalid();
    requireKeys(
      copy,
      ["source_policy_id", "target_service_id", "boundary", "name"],
      ["name"],
    );
    if (
      typeof copy.source_policy_id !== "string"
      || typeof copy.target_service_id !== "string"
      || (copy.name !== undefined && typeof copy.name !== "string")
    ) invalid();
    return {
      sourcePolicyId: requiredUuid(copy.source_policy_id),
      targetServiceId: requiredUuid(copy.target_service_id),
      boundary: normalizeBoundary(copy.boundary),
      ...(copy.name === undefined
        ? {}
        : { name: normalizedProfile(copy.name, undefined).name }),
    };
  });
}

function parseCopyDocument(value: unknown): PolicyCopyDocument {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["format_version", "policy"]);
  if (value.format_version !== 1 || !plainObject(value.policy)) invalid();
  requireKeys(
    value.policy,
    ["name", "description", "operating_mode", "rules"],
    ["description"],
  );
  if (!Array.isArray(value.policy.rules) || value.policy.rules.length > MAX_RULES_PER_POLICY) {
    invalid();
  }
  const profile = policyProfileFields(value.policy);
  const rules = value.policy.rules.map((rule) => ruleBody(rule));
  return copyDocumentFromProfiles(profile, rules);
}

function copyProfiles(document: PolicyCopyDocument): {
  profile: PolicyProfile;
  rules: RuleProfile[];
} {
  const profile = policyProfileFields({
    name: document.policy.name,
    ...(document.policy.description === undefined
      ? {}
      : { description: document.policy.description }),
    operating_mode: document.policy.operating_mode,
  });
  const rules = document.policy.rules.map((rule) => ruleBody(rule));
  return { profile, rules };
}

function copyDocumentFromProfiles(
  profile: PolicyProfile,
  rules: readonly RuleProfile[],
): PolicyCopyDocument {
  return {
    format_version: 1,
    policy: {
      name: profile.name,
      ...(profile.description === undefined ? {} : {
        description: profile.description,
      }),
      operating_mode: profile.operatingMode,
      rules: rules.map((rule) => ({
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
            enabled: rule.safeguards.secretlint.enabled,
            disabled_rule_ids: [...rule.safeguards.secretlint.disabledRuleIds],
          },
          binary_response: {
            scan: rule.safeguards.binaryResponse.scan,
            max_bytes: rule.safeguards.binaryResponse.maxBytes,
          },
        },
        ...(rule.selector === undefined
          ? {}
          : rule.selector.kind === "all"
            ? { selector: { kind: "all" as const } }
            : {
                selector: {
                  kind: "principals" as const,
                  group_ids: [...rule.selector.groupIds],
                  user_ids: [...rule.selector.userIds],
                  direct_assignment_confirmed: rule.selector.userIds.length > 0,
                },
              }),
      })),
    },
  };
}

function policyProfile(value: unknown): PolicyProfile {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["name", "description", "operating_mode"], ["description"]);
  return policyProfileFields(value);
}

function policyProfileFields(value: Record<string, unknown>): PolicyProfile {
  const profile = normalizedProfile(value.name, value.description);
  if (value.operating_mode !== "allow" && value.operating_mode !== "deny") {
    invalid();
  }
  return { ...profile, operatingMode: value.operating_mode };
}

function ruleBody(value: unknown): RuleProfile {
  if (!plainObject(value)) invalid();
  requireKeys(value, [
    "name",
    "reason",
    "effect",
    "priority",
    "enabled",
    "methods",
    "hosts",
    "paths",
    "response_safeguards",
    "selector",
  ], ["reason", "selector"]);
  const profile = normalizedProfile(value.name, value.reason);
  if (
    (value.effect !== "allow" && value.effect !== "deny")
    || !Number.isSafeInteger(value.priority)
    || (value.priority as number) < -1_000_000_000
    || (value.priority as number) > 1_000_000_000
    || typeof value.enabled !== "boolean"
  ) invalid();
  let matchers: ManagedPolicyMatchers;
  try {
    matchers = normalizeManagedPolicyMatchers({
      methods: value.methods as string[],
      hosts: value.hosts as ManagedPolicyMatchers["hosts"],
      paths: value.paths as ManagedPolicyMatchers["paths"],
    });
  } catch (error) {
    if (error instanceof PolicyMatcherError) invalid();
    throw error;
  }
  const selector = value.selector === undefined
    ? undefined
    : normalizeSelector(value.selector);
  if (value.enabled && selector === undefined) invalid();
  return {
    name: profile.name,
    normalizedName: profile.normalizedName,
    ...(profile.description === undefined ? {} : { reason: profile.description }),
    effect: value.effect,
    priority: value.priority as number,
    enabled: value.enabled,
    matchers,
    safeguards: normalizeSafeguards(value.response_safeguards),
    ...(selector === undefined ? {} : { selector }),
  };
}

function simulationBody(value: unknown): {
  userId: string;
  destinationId: string;
  method: string;
  target: { path?: string; url?: string };
  credentialIds: string[];
} {
  if (!plainObject(value)) invalid();
  requireKeys(value, [
    "user_id",
    "destination_id",
    "method",
    "path",
    "url",
    "credential_ids",
  ], ["path", "url"]);
  if (
    typeof value.method !== "string"
    || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,32}$/.test(value.method)
    || !Array.isArray(value.credential_ids)
    || value.credential_ids.length > 128
  ) invalid();
  const credentialIds = value.credential_ids.map((id) => {
    if (typeof id !== "string") invalid();
    return requiredUuid(id);
  });
  if (new Set(credentialIds).size !== credentialIds.length) invalid();
  const hasPath = typeof value.path === "string";
  const hasUrl = typeof value.url === "string";
  if (hasPath === hasUrl) invalid();
  const target = hasPath
    ? { path: value.path as string }
    : { url: value.url as string };
  validateSimulationTarget(target);
  return {
    userId: typeof value.user_id === "string"
      ? requiredUuid(value.user_id)
      : invalid(),
    destinationId: typeof value.destination_id === "string"
      ? requiredUuid(value.destination_id)
      : invalid(),
    method: value.method.toUpperCase(),
    target,
    credentialIds: credentialIds.sort(),
  };
}

function validateSimulationTarget(target: { path?: string; url?: string }): void {
  let pathname: string;
  if (target.path !== undefined) {
    if (
      target.path.length < 1
      || target.path.length > 4_096
      || !target.path.startsWith("/")
    ) invalid();
    pathname = target.path.split(/[?#]/, 1)[0] ?? "/";
  } else {
    const url = target.url!;
    if (url.length < 1 || url.length > 8_192) invalid();
    const match = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/.exec(url);
    if (match === null) invalid();
    pathname = match[1] ?? "/";
  }
  for (let index = 0; index < pathname.length; index += 1) {
    if (pathname[index] !== "%") continue;
    const escape = pathname.slice(index + 1, index + 3);
    if (!/^[0-9a-f]{2}$/i.test(escape)) invalid();
    const byte = Number.parseInt(escape, 16);
    const character = String.fromCharCode(byte);
    if (
      /^[A-Za-z0-9._~-]$/.test(character)
      || byte === 0x2f
      || byte === 0x5c
      || byte === 0x00
      || byte === 0x25
    ) invalid();
    index += 2;
  }
}

function normalizeSafeguards(value: unknown): PolicyResponseSafeguards {
  if (!plainObject(value)) invalid();
  requireKeys(value, ["secretlint", "binary_response"]);
  if (!plainObject(value.secretlint) || !plainObject(value.binary_response)) invalid();
  requireKeys(value.secretlint, ["enabled", "disabled_rule_ids"]);
  requireKeys(value.binary_response, ["scan", "max_bytes"]);
  if (
    typeof value.secretlint.enabled !== "boolean"
    || !Array.isArray(value.secretlint.disabled_rule_ids)
    || value.secretlint.disabled_rule_ids.length > 128
    || value.secretlint.disabled_rule_ids.some((entry) =>
      typeof entry !== "string"
      || entry.length < 1
      || entry.length > 128
      || !/^[A-Za-z0-9@/_.-]+$/.test(entry))
    || new Set(value.secretlint.disabled_rule_ids).size
      !== value.secretlint.disabled_rule_ids.length
    || typeof value.binary_response.scan !== "boolean"
    || (
      value.binary_response.max_bytes !== null
      && (
        !Number.isSafeInteger(value.binary_response.max_bytes)
        || (value.binary_response.max_bytes as number) < 1
        || (value.binary_response.max_bytes as number) > 100 * 1024 * 1024
      )
    )
  ) invalid();
  return {
    secretlint: {
      enabled: value.secretlint.enabled,
      disabledRuleIds: [...value.secretlint.disabled_rule_ids].sort(),
    },
    binaryResponse: {
      scan: value.binary_response.scan,
      maxBytes: value.binary_response.max_bytes as number | null,
    },
  };
}

function normalizedProfile(
  nameValue: unknown,
  descriptionValue: unknown,
): { name: string; normalizedName: string; description?: string } {
  if (typeof nameValue !== "string") invalid();
  const name = nameValue.normalize("NFKC").trim();
  const normalizedName = name.toLocaleLowerCase("und");
  if (
    name.length < 1
    || name.length > 120
    || normalizedName.length > 120
    || /[\u0000-\u001f\u007f]/u.test(name)
  ) invalid();
  if (descriptionValue === undefined) return { name, normalizedName };
  if (typeof descriptionValue !== "string") invalid();
  const description = descriptionValue.normalize("NFKC").trim();
  if (
    description.length < 1
    || description.length > 1_024
    || description.includes("\0")
  ) invalid();
  return { name, normalizedName, description };
}

function normalizeSelector(value: unknown): NormalizedPrincipalSelector {
  try {
    return normalizePrincipalSelector(value);
  } catch (error) {
    if (error instanceof PrincipalSelectorError) invalid();
    throw error;
  }
}

function copyDocument(detail: PolicyDetailView): PolicyCopyDocument {
  return {
    format_version: 1,
    policy: {
      name: detail.name,
      ...(detail.description === undefined ? {} : {
        description: detail.description,
      }),
      operating_mode: detail.operatingMode,
      rules: detail.rules.map((rule) => ({
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
            disabled_rule_ids: [
              ...rule.responseSafeguards.secretlint.disabledRuleIds,
            ],
          },
          binary_response: {
            scan: rule.responseSafeguards.binaryResponse.scan,
            max_bytes: rule.responseSafeguards.binaryResponse.maxBytes,
          },
        },
        ...(rule.selector === undefined
          ? {}
          : rule.selector.kind === "all"
            ? { selector: { kind: "all" as const } }
            : {
                selector: {
                  kind: "principals" as const,
                  group_ids: [...rule.selector.groupIds],
                  user_ids: [...rule.selector.userIds],
                  direct_assignment_confirmed: rule.selector.userIds.length > 0,
                },
              }),
      })),
    },
  };
}

function ruleAuditChanges(
  policyId: string,
  profile: RuleProfile,
): NonNullable<AdministrativeAuditEventInput["changes"]> {
  return [
    { field: "policy_id", after: policyId },
    { field: "effect", after: profile.effect },
    { field: "priority", after: profile.priority },
    { field: "enabled", after: profile.enabled ? 1 : 0 },
    { field: "method_count", after: profile.matchers.methods.length },
    { field: "host_matcher_count", after: profile.matchers.hosts.length },
    { field: "path_matcher_count", after: profile.matchers.paths.length },
    {
      field: "selector_kind",
      after: profile.selector?.kind ?? "unassigned",
    },
  ];
}

function policyAudit(
  actor: ControlAuthenticationContext,
  action: string,
  serviceId: string,
  targetId: string,
  correlationId: string,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: administrativeActorSnapshot(actor),
    action,
    result: "allow",
    target: {
      type: "service_policy",
      id: targetId,
      label: `policy:${targetId}`,
    },
    serviceId,
    changes,
    correlationId,
    source: { category: "policy_management" },
  };
}

function requireKeys(
  value: Record<string, unknown>,
  all: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set(all);
  const required = all.filter((key) => !optional.includes(key));
  const keys = Object.keys(value);
  if (
    keys.some((key) => !allowed.has(key))
    || required.some((key) => !Object.hasOwn(value, key))
  ) invalid();
}

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiredUuid(value: string): string {
  if (!isUuidV7(value)) invalid();
  return value;
}

function requiredVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) invalid();
  return value;
}

function requiredCorrelation(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 8
    || value.length > 128
    || !/^req_[A-Za-z0-9._-]+$/.test(value)
  ) invalid();
  return value;
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function defaultUuid(now: () => number): () => string {
  const generator = new UuidV7Generator({ now });
  return () => generator.next();
}

function invalid(): never {
  throw new PolicyManagementError("invalid_request");
}

function mapError(error: unknown): PolicyManagementError {
  if (error instanceof PolicyManagementError) return error;
  if (error instanceof PersistenceError) {
    if (
      error.code === "identity_not_found"
      || error.code === "authentication_failed"
    ) return new PolicyManagementError("not_found");
    if (error.code === "identity_stale") return new PolicyManagementError("stale");
    if (
      error.code === "identity_conflict"
      || error.code === "database_unavailable"
    ) return new PolicyManagementError("conflict");
    if (error.code === "idempotency_conflict") {
      return new PolicyManagementError("idempotency_conflict");
    }
  }
  return new PolicyManagementError("unavailable");
}
