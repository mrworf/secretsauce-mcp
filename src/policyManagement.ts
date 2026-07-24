import type { ControlAuthenticationContext } from "./control/authentication.js";
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
      selector?: {
        kind: "all" | "principals";
        group_ids?: string[];
        user_ids?: string[];
        direct_assignment_confirmed?: boolean;
      };
    }>;
  };
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
    const placeholders = selector.userIds.map(() => "?").join(",");
    const count = query.get<{ count: number }>(`
      SELECT count(*) AS count FROM users
      WHERE role = 'user' AND status = 'active'
        AND id IN (${placeholders})
    `, selector.userIds)?.count ?? -1;
    if (count !== selector.userIds.length) {
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
  if (!isUuidV7(serviceId) || actor.method !== "browser_session") {
    throw new PersistenceError("identity_not_found");
  }
  const service = query.get<{ lifecycle: string }>(
    "SELECT lifecycle FROM services WHERE id = ?",
    [serviceId],
  );
  if (service === undefined || (mutable && service.lifecycle === "archived")) {
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
    actor: {
      type: "browser_session",
      id: actor.principalId,
      label: `user:${actor.principalId}`,
      role: actor.role,
      authenticationMethod: actor.method,
    },
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
