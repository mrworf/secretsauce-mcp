import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type RecoveryKind = "migration" | "restore";
export type RecoveryTaskState = "open" | "completed" | "dismissed";

export interface RecoveryTask {
  kind: RecoveryKind;
  operationId: string;
  id: string;
  serviceId: string;
  serviceSlug: string;
  targetId?: string;
  taskKind:
    | "assign_service_admin"
    | "assign_service_access"
    | "supply_credential"
    | "review_enable_policy"
    | "assign_enable_policy"
    | "validate_publish_service"
    | "missing_archive_secret";
  state: RecoveryTaskState;
  derivedFromCurrentState: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecoveryRemediationSnapshot {
  migration: {
    state: "pending" | "completed";
    migrationId?: string;
    resolutionMode?: "definitions_only" | "resolved_credentials";
    services: number;
    credentials: number;
    configuredCredentials: number;
    discardedAclEntries: number;
    completedAt?: number;
  };
  latestRestore?: {
    restoreId: string;
    state: "completed" | "failed";
    outcomeCode: string;
    services: number;
    credentials: number;
    availableSecrets: number;
    unavailableSecrets: number;
    completedAt: number;
  };
  counts: {
    total: number;
    open: number;
    completed: number;
    dismissed: number;
  };
  tasks: RecoveryTask[];
  nextCursor?: string;
}

export class RecoveryRemediationError extends Error {
  constructor(
    readonly code: "forbidden" | "invalid_input" | "unavailable",
  ) {
    super("Recovery remediation state is unavailable.");
    this.name = "RecoveryRemediationError";
  }
}

interface TaskRow {
  kind: RecoveryKind;
  operation_id: string;
  id: string;
  service_id: string;
  service_slug: string;
  target_id: string | null;
  task_kind: RecoveryTask["taskKind"];
  stored_state: RecoveryTaskState;
  effective_state: RecoveryTaskState;
  created_at: number;
  updated_at: number;
}

export class RecoveryRemediationService {
  constructor(private readonly owner: PersistenceOwner) {}

  async snapshot(
    actor: ControlAuthenticationContext,
    input: { limit?: number; cursor?: string } = {},
  ): Promise<RecoveryRemediationSnapshot> {
    if (actor.role !== "superadmin" || actor.method !== "browser_session") {
      throw new RecoveryRemediationError("forbidden");
    }
    const limit = input.limit ?? 100;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new RecoveryRemediationError("invalid_input");
    }
    const cursor = parseCursor(input.cursor);
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) =>
          readSnapshot(query, limit, cursor)),
      });
    } catch (error) {
      if (error instanceof RecoveryRemediationError) throw error;
      throw new RecoveryRemediationError("unavailable");
    }
  }
}

function readSnapshot(
  query: PersistenceQuery,
  limit: number,
  cursor: { kind: RecoveryKind; id: string } | undefined,
): RecoveryRemediationSnapshot {
  const rows = query.all<TaskRow>(`
    WITH recovery_tasks AS (
      SELECT
        'migration' AS kind,
        remediation.migration_id AS operation_id,
        remediation.id,
        remediation.service_id,
        services.slug AS service_slug,
        remediation.target_id,
        remediation.task_kind,
        remediation.state AS stored_state,
        ${effectiveStateSql("remediation")} AS effective_state,
        remediation.created_at,
        remediation.updated_at
      FROM migration_remediations AS remediation
      JOIN services ON services.id = remediation.service_id
      UNION ALL
      SELECT
        'restore' AS kind,
        remediation.restore_id AS operation_id,
        remediation.id,
        remediation.service_id,
        services.slug AS service_slug,
        remediation.target_id,
        remediation.task_kind,
        remediation.state AS stored_state,
        ${effectiveStateSql("remediation")} AS effective_state,
        remediation.created_at,
        remediation.updated_at
      FROM restore_remediations AS remediation
      JOIN services ON services.id = remediation.service_id
    )
    SELECT * FROM recovery_tasks
    WHERE ? IS NULL
      OR id > ?
      OR (id = ? AND kind > ?)
    ORDER BY id, kind
    LIMIT ?
  `, [
    cursor?.id ?? null,
    cursor?.id ?? "",
    cursor?.id ?? "",
    cursor?.kind ?? "migration",
    limit + 1,
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const all = query.all<{
    stored_state: RecoveryTaskState;
    effective_state: RecoveryTaskState;
  }>(`
    SELECT remediation.state AS stored_state,
      ${effectiveStateSql("remediation")} AS effective_state
    FROM migration_remediations AS remediation
    JOIN services ON services.id = remediation.service_id
    UNION ALL
    SELECT remediation.state AS stored_state,
      ${effectiveStateSql("remediation")} AS effective_state
    FROM restore_remediations AS remediation
    JOIN services ON services.id = remediation.service_id
  `);
  const effective = all.map((row) => row.effective_state);
  const migration = query.get<{
    state: "pending" | "completed";
    migration_id: string | null;
    resolution_mode: "definitions_only" | "resolved_credentials" | null;
    service_count: number;
    credential_count: number;
    configured_credential_count: number;
    discarded_acl_count: number;
    completed_at: number | null;
  }>(`
    SELECT state, migration_id, resolution_mode, service_count,
      credential_count, configured_credential_count, discarded_acl_count,
      completed_at
    FROM v1_migration_state WHERE singleton = 1
  `)!;
  const latestRestore = query.get<{
    id: string;
    state: "completed" | "failed";
    outcome_code: string;
    service_count: number;
    credential_count: number;
    available_secret_count: number;
    unavailable_secret_count: number;
    completed_at: number;
  }>(`
    SELECT id, state, outcome_code, service_count, credential_count,
      available_secret_count, unavailable_secret_count, completed_at
    FROM restore_previews
    WHERE state IN ('completed', 'failed')
    ORDER BY completed_at DESC, id DESC
    LIMIT 1
  `);
  const last = page.at(-1);
  return {
    migration: {
      state: migration.state,
      ...(migration.migration_id === null
        ? {}
        : { migrationId: migration.migration_id }),
      ...(migration.resolution_mode === null
        ? {}
        : { resolutionMode: migration.resolution_mode }),
      services: migration.service_count,
      credentials: migration.credential_count,
      configuredCredentials: migration.configured_credential_count,
      discardedAclEntries: migration.discarded_acl_count,
      ...(migration.completed_at === null
        ? {}
        : { completedAt: migration.completed_at }),
    },
    ...(latestRestore === undefined
      ? {}
      : {
          latestRestore: {
            restoreId: latestRestore.id,
            state: latestRestore.state,
            outcomeCode: latestRestore.outcome_code,
            services: latestRestore.service_count,
            credentials: latestRestore.credential_count,
            availableSecrets: latestRestore.available_secret_count,
            unavailableSecrets: latestRestore.unavailable_secret_count,
            completedAt: latestRestore.completed_at,
          },
        }),
    counts: {
      total: effective.length,
      open: effective.filter((state) => state === "open").length,
      completed: effective.filter((state) => state === "completed").length,
      dismissed: effective.filter((state) => state === "dismissed").length,
    },
    tasks: page.map(wireTask),
    ...(hasMore && last !== undefined
      ? { nextCursor: `${last.kind}:${last.id}` }
      : {}),
  };
}

function effectiveStateSql(alias: string): string {
  return `CASE
    WHEN ${alias}.state <> 'open' THEN ${alias}.state
    WHEN ${alias}.task_kind = 'assign_service_admin'
      AND EXISTS (
        SELECT 1 FROM service_admins
        WHERE service_id = ${alias}.service_id
      ) THEN 'completed'
    WHEN ${alias}.task_kind = 'assign_service_access'
      AND EXISTS (
        SELECT 1 FROM service_principal_assignments
        WHERE service_id = ${alias}.service_id
      ) THEN 'completed'
    WHEN ${alias}.task_kind = 'supply_credential'
      AND EXISTS (
        SELECT 1 FROM service_credentials
        WHERE id = ${alias}.target_id
          AND service_id = ${alias}.service_id
          AND status = 'configured'
      ) THEN 'completed'
    WHEN ${alias}.task_kind IN ('review_enable_policy', 'assign_enable_policy')
      AND EXISTS (
        SELECT 1
        FROM policy_rules
        JOIN policy_rule_principal_assignments AS assignments
          ON assignments.rule_id = policy_rules.id
          AND assignments.policy_id = policy_rules.policy_id
          AND assignments.service_id = policy_rules.service_id
        WHERE policy_rules.policy_id = ${alias}.target_id
          AND policy_rules.service_id = ${alias}.service_id
          AND policy_rules.enabled = 1
      ) THEN 'completed'
    WHEN ${alias}.task_kind = 'validate_publish_service'
      AND EXISTS (
        SELECT 1 FROM services
        WHERE id = ${alias}.service_id AND lifecycle = 'published'
      ) THEN 'completed'
    WHEN ${alias}.task_kind = 'missing_archive_secret'
      AND NOT EXISTS (
        SELECT 1 FROM service_credentials
        WHERE service_id = ${alias}.service_id
          AND status = 'unconfigured'
      ) THEN 'completed'
    ELSE 'open'
  END`;
}

function parseCursor(
  value: string | undefined,
): { kind: RecoveryKind; id: string } | undefined {
  if (value === undefined) return undefined;
  const match = /^(migration|restore):([0-9a-f-]{36})$/.exec(value);
  if (match === null || !UUID_V7.test(match[2]!)) {
    throw new RecoveryRemediationError("invalid_input");
  }
  return { kind: match[1] as RecoveryKind, id: match[2]! };
}

function wireTask(row: TaskRow): RecoveryTask {
  return {
    kind: row.kind,
    operationId: row.operation_id,
    id: row.id,
    serviceId: row.service_id,
    serviceSlug: row.service_slug,
    ...(row.target_id === null ? {} : { targetId: row.target_id }),
    taskKind: row.task_kind,
    state: row.effective_state,
    derivedFromCurrentState:
      row.stored_state === "open" && row.effective_state === "completed",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
