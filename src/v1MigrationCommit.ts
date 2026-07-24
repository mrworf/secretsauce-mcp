import type { PersistenceTransaction } from "./persistence/transaction.js";
import { PersistenceError } from "./persistence/errors.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { canonicalServiceDraft } from "./serviceConfiguration.js";
import {
  validateV1MigrationPlan,
  type V1MigrationPlan,
} from "./v1MigrationPlan.js";
import {
  V1MigrationStateError,
  V1MigrationStateRepository,
  type V1MigrationPreflight,
  type V1MigrationPreflightCode,
} from "./v1MigrationState.js";

export type V1MigrationCommitErrorCode =
  | V1MigrationPreflightCode
  | "invalid_plan"
  | "preflight_changed"
  | "unavailable";

export class V1MigrationCommitError extends Error {
  constructor(readonly code: V1MigrationCommitErrorCode) {
    super("V1 migration commit could not be completed.");
    this.name = "V1MigrationCommitError";
  }
}

export interface V1MigrationCommitResult {
  migrationId: string;
  activationGeneration: number;
  globalReferenceEpoch: number;
  serviceCount: number;
  remediationCount: number;
}

export interface V1MigratedVaultRecord {
  locator: string;
  generation: number;
}

type FaultPhase =
  | "after_preflight"
  | "after_portable_rows"
  | "after_activation"
  | "after_marker"
  | "after_remediations";

export class V1MigrationCommitRepository {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
    uuid?: () => string,
    private readonly fault?: (phase: FaultPhase) => void,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#uuid = uuid ?? (() => generator.next());
  }

  async commitDefinitions(input: {
    plan: V1MigrationPlan;
    correlationId: string;
    osActor: string;
  }): Promise<V1MigrationCommitResult> {
    if (!validateV1MigrationPlan(input.plan)) {
      throw new V1MigrationCommitError("invalid_plan");
    }
    const guard = await this.preflight();
    this.fault?.("after_preflight");
    return this.commitPlan({
      plan: input.plan,
      guard,
      migrationId: this.#uuid(),
      planDigest: input.plan.digest,
      resolutionMode: "definitions_only",
      records: new Map(),
      correlationId: input.correlationId,
      osActor: input.osActor,
    });
  }

  async preflight(): Promise<V1MigrationPreflight> {
    let guard: V1MigrationPreflight;
    try {
      guard = await new V1MigrationStateRepository(this.owner).preflight();
    } catch (error) {
      if (error instanceof V1MigrationStateError) {
        throw new V1MigrationCommitError(error.code);
      }
      throw new V1MigrationCommitError("unavailable");
    }
    return guard;
  }

  commitResolved(input: {
    plan: V1MigrationPlan;
    guard: V1MigrationPreflight;
    migrationId: string;
    planDigest: string;
    records: ReadonlyMap<string, V1MigratedVaultRecord>;
    correlationId: string;
    osActor: string;
  }): Promise<V1MigrationCommitResult> {
    if (
      !validateV1MigrationPlan(input.plan)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.migrationId)
      || !/^[a-f0-9]{64}$/.test(input.planDigest)
      || !validRecords(input.plan, input.records)
    ) throw new V1MigrationCommitError("invalid_plan");
    return this.commitPlan({
      ...input,
      resolutionMode: "resolved_credentials",
    });
  }

  private async commitPlan(input: {
    plan: V1MigrationPlan;
    guard: V1MigrationPreflight;
    migrationId: string;
    planDigest: string;
    resolutionMode: "definitions_only" | "resolved_credentials";
    records: ReadonlyMap<string, V1MigratedVaultRecord>;
    correlationId: string;
    osActor: string;
  }): Promise<V1MigrationCommitResult> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          assertGuard(transaction, input.guard);
          const now = transaction.timestamp();
          insertPortableRows(transaction, input.plan, input.records, now);
          this.fault?.("after_portable_rows");

          const activationGeneration = input.guard.activationGeneration + 1;
          const globalReferenceEpoch = input.guard.globalReferenceEpoch + 1;
          const activation = transaction.run(`
            UPDATE runtime_activation
            SET state = 'active', activation_generation = ?,
              global_reference_epoch = ?, version = version + 1,
              activated_at = ?, updated_at = ?
            WHERE singleton = 1 AND state = 'inactive' AND version = ?
              AND activation_generation = ? AND global_reference_epoch = ?
          `, [
            activationGeneration,
            globalReferenceEpoch,
            now,
            now,
            input.guard.activationVersion,
            input.guard.activationGeneration,
            input.guard.globalReferenceEpoch,
          ]);
          if (activation.changes !== 1) {
            throw new PersistenceError("identity_conflict");
          }
          this.fault?.("after_activation");

          const counts = input.plan.report.counts;
          const marker = transaction.run(`
            UPDATE v1_migration_state SET
              state = 'completed', migration_id = ?, source_sha256 = ?,
              plan_digest = ?, source_schema_version = 1,
              resolution_mode = ?,
              service_count = ?, destination_count = ?, credential_count = ?,
              configured_credential_count = ?, policy_count = ?, rule_count = ?,
              discarded_acl_count = ?, retained_slug_count = ?,
              generated_slug_count = ?, activation_generation = ?,
              completed_at = ?, updated_at = ?, version = version + 1
            WHERE singleton = 1 AND state = 'pending' AND version = ?
          `, [
            input.migrationId,
            input.plan.sourceSha256,
            input.planDigest,
            input.resolutionMode,
            counts.services,
            counts.destinations,
            counts.credentials,
            input.records.size,
            counts.policies,
            counts.rules,
            counts.discardedAclEntries,
            counts.retainedServiceSlugs,
            counts.generatedServiceSlugs,
            activationGeneration,
            now,
            now,
            input.guard.migrationStateVersion,
          ]);
          if (marker.changes !== 1) throw new PersistenceError("identity_conflict");
          this.fault?.("after_marker");

          const remediationCount = insertRemediations(
            transaction,
            input.plan,
            input.migrationId,
            input.records,
            now,
            this.#uuid,
          );
          this.fault?.("after_remediations");
          const result = {
            migrationId: input.migrationId,
            activationGeneration,
            globalReferenceEpoch,
            serviceCount: counts.services,
            remediationCount,
          };
          return {
            value: result,
            auditInput: {
              actor: {
                type: "local_cli" as const,
                label: "host-local operator",
                authenticationMethod: "host_terminal",
              },
              action: "migration.v1.commit",
              category: "system" as const,
              result: "allow" as const,
              target: {
                type: "v1_migration",
                id: input.migrationId,
                label: "portable v1 configuration migration",
              },
              justification: "Make migrated database configuration the sole runtime authority.",
              changes: [
                { field: "service_count", after: counts.services },
                { field: "destination_count", after: counts.destinations },
                { field: "credential_count", after: counts.credentials },
                { field: "policy_count", after: counts.policies },
                { field: "rule_count", after: counts.rules },
                { field: "discarded_acl_count", after: counts.discardedAclEntries },
                { field: "configured_credential_count", after: input.records.size },
                { field: "activation_generation", after: activationGeneration },
              ],
              correlationId: input.correlationId,
              source: {
                category: "v1_migration",
                client: "migrate-v1-cli",
                osActor: boundedOsActor(input.osActor),
              },
            },
          };
        }),
      });
    } catch (error) {
      if (error instanceof V1MigrationCommitError) throw error;
      if (error instanceof PersistenceError && error.code === "identity_conflict") {
        throw new V1MigrationCommitError("preflight_changed");
      }
      throw new V1MigrationCommitError("unavailable");
    }
  }
}

function assertGuard(
  transaction: PersistenceTransaction,
  guard: V1MigrationPreflight,
): void {
  const row = transaction.get<{
    migration_state: string;
    migration_version: number;
    runtime_state: string;
    activation_version: number;
    activation_generation: number;
    global_reference_epoch: number;
    service_count: number;
    active_runtime_count: number;
    remediation_count: number;
    guardian_active: number;
  }>(`
    SELECT
      migration.state AS migration_state,
      migration.version AS migration_version,
      activation.state AS runtime_state,
      activation.version AS activation_version,
      activation.activation_generation AS activation_generation,
      activation.global_reference_epoch AS global_reference_epoch,
      (SELECT count(*) FROM services) AS service_count,
      (SELECT count(*) FROM runtime_active_services) AS active_runtime_count,
      (SELECT count(*) FROM migration_remediations) AS remediation_count,
      EXISTS (
        SELECT 1 FROM users
        WHERE id = ? AND role = 'superadmin' AND status = 'active'
      ) AS guardian_active
    FROM v1_migration_state migration
    JOIN runtime_activation activation
      ON activation.singleton = migration.singleton
    WHERE migration.singleton = 1
  `, [guard.guardianSuperadminId]);
  if (
    row === undefined
    || row.migration_state !== "pending"
    || row.migration_version !== guard.migrationStateVersion
    || row.runtime_state !== "inactive"
    || row.activation_version !== guard.activationVersion
    || row.activation_generation !== guard.activationGeneration
    || row.global_reference_epoch !== guard.globalReferenceEpoch
    || row.service_count !== 0
    || row.active_runtime_count !== 0
    || row.remediation_count !== 0
    || row.guardian_active !== 1
  ) throw new PersistenceError("identity_conflict");
}

function insertPortableRows(
  transaction: PersistenceTransaction,
  plan: V1MigrationPlan,
  records: ReadonlyMap<string, V1MigratedVaultRecord>,
  now: number,
): void {
  for (const service of plan.services) {
    const canonicalDraft = canonicalServiceDraft(service.draft);
    transaction.run(`
      INSERT INTO services (
        id, slug, name, description, documentation_url, lifecycle,
        draft_digest, published_revision_id, published_digest,
        publication_generation, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, 0, 1, ?, ?)
    `, [
      service.id,
      service.profile.slug,
      service.profile.name,
      service.profile.description ?? null,
      service.profile.documentationUrl ?? null,
      canonicalDraft.digest,
      now,
      now,
    ]);
    transaction.run(`
      INSERT INTO service_assignment_states (
        service_id, version, authorization_generation, created_at, updated_at
      ) VALUES (?, 1, 0, ?, ?)
    `, [service.id, now, now]);
    for (const destination of service.draft.destinations) {
      transaction.run(`
        INSERT INTO service_destinations (
          id, service_id, slug, base_url, schemes_json, hosts_json,
          ports_json, tls_verify, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        destination.id,
        service.id,
        destination.slug,
        destination.baseUrl,
        JSON.stringify(destination.schemes),
        JSON.stringify(destination.hosts),
        JSON.stringify(destination.ports),
        destination.tlsVerify ? 1 : 0,
        now,
        now,
      ]);
    }
    for (const credential of service.credentials) {
      const record = records.get(credential.id);
      transaction.run(`
        INSERT INTO service_credentials (
          id, service_id, name, normalized_name, description, usage_kind,
          usage_name, usage_prefix, usage_suffix, enforce_header_ownership,
          status, vault_state, vault_locator, vault_generation, last_four,
          value_updated_at, authorization_generation, version, created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'idle',
          ?, ?, NULL, ?, 0, 1, ?, ?)
      `, [
        credential.id,
        service.id,
        credential.name,
        credential.normalizedName,
        credential.placement.kind,
        credential.placement.name,
        credential.placement.prefix ?? null,
        credential.placement.suffix ?? null,
        credential.placement.enforceHeaderOwnership ? 1 : 0,
        record === undefined ? "unconfigured" : "configured",
        record?.locator ?? null,
        record?.generation ?? null,
        record === undefined ? null : now,
        now,
        now,
      ]);
    }
    transaction.run(`
      INSERT INTO policies (
        id, service_id, credential_id, name, normalized_name, description,
        operating_mode, lifecycle, evaluation_generation, version,
        created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, NULL, ?, 'active', 0, 1, ?, ?)
    `, [
      service.policy.id,
      service.id,
      service.policy.name,
      service.policy.normalizedName,
      service.policy.operatingMode,
      now,
      now,
    ]);
    for (const rule of service.policy.rules) {
      transaction.run(`
        INSERT INTO policy_rules (
          id, service_id, policy_id, name, normalized_name, reason, effect,
          priority, enabled, methods_json, hosts_json, paths_json,
          response_safeguards_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)
      `, [
        rule.id,
        service.id,
        service.policy.id,
        rule.name,
        rule.normalizedName,
        rule.reason ?? null,
        rule.effect,
        rule.priority,
        JSON.stringify(rule.matchers.methods),
        JSON.stringify(rule.matchers.hosts),
        JSON.stringify(rule.matchers.paths),
        JSON.stringify(rule.responseSafeguards),
        now,
        now,
      ]);
    }
  }
}

function insertRemediations(
  transaction: PersistenceTransaction,
  plan: V1MigrationPlan,
  migrationId: string,
  records: ReadonlyMap<string, V1MigratedVaultRecord>,
  now: number,
  uuid: () => string,
): number {
  let count = 0;
  const insert = (
    serviceId: string,
    taskKind: string,
    targetId: string | null,
  ): void => {
    transaction.run(`
      INSERT INTO migration_remediations (
        id, migration_id, service_id, target_id, task_kind, state,
        completed_by_user_id, completed_at, dismissed_by_user_id,
        dismissed_at, justification, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
    `, [uuid(), migrationId, serviceId, targetId, taskKind, now, now]);
    count += 1;
  };
  for (const service of plan.services) {
    insert(service.id, "assign_service_admin", null);
    insert(service.id, "assign_service_access", null);
    for (const credential of service.credentials) {
      if (!records.has(credential.id)) {
        insert(service.id, "supply_credential", credential.id);
      }
    }
    insert(service.id, "review_enable_policy", service.policy.id);
    insert(service.id, "validate_publish_service", null);
  }
  return count;
}

function validRecords(
  plan: V1MigrationPlan,
  records: ReadonlyMap<string, V1MigratedVaultRecord>,
): boolean {
  const credentialIds = new Set(plan.services.flatMap((service) =>
    service.credentials.map(({ id }) => id)));
  if (records.size < 1 || records.size > credentialIds.size) return false;
  for (const [credentialId, record] of records) {
    if (
      !credentialIds.has(credentialId)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.locator)
      || !Number.isSafeInteger(record.generation)
      || record.generation < 1
    ) return false;
  }
  return true;
}

function boundedOsActor(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  return [...normalized].slice(0, 128).join("") || "local-operator";
}
