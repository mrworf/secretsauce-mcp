import type { PersistenceQuery, PersistenceTransaction } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import { PersistenceError } from "./persistence/errors.js";

const STAGE_TTL_MS = 60 * 60_000;
const RECOVERY_TTL_MS = 24 * 60 * 60_000;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ACTIVE_STAGES = 4;
const MAX_ACTIVE_STAGE_BYTES = 512 * 1024 * 1024;
const MAX_OBJECTS = 10_000;
const MAX_SUMMARY_COUNT = 100_000;

export type RestoreStageState =
  | "validated"
  | "previewed"
  | "committing"
  | "completed"
  | "failed"
  | "expired";
export type RestorePreviewState =
  | "ready"
  | "claimed"
  | "completed"
  | "failed"
  | "expired";
export type RestoreSecretDisposition =
  | "configuration_only"
  | "encrypted_secrets";
export type RestorePhase =
  | "inactive"
  | "maintenance"
  | "snapshot_ready"
  | "vault_applied"
  | "database_committed"
  | "health_passed"
  | "rolled_back";

export interface RestoreCounts {
  services: number;
  destinations: number;
  credentials: number;
  policies: number;
  rules: number;
  availableSecrets: number;
  unavailableSecrets: number;
  replacements: number;
  removals: number;
  revokedApiKeys: number;
  revokedSessions: number;
  revokedOauthGrants: number;
  remediations: number;
}

export interface RestoreStage {
  id: string;
  subjectUserId: string;
  archiveId: string;
  storageKey: string;
  archiveSha256: string;
  archiveBytes: number;
  state: RestoreStageState;
  expiresAt: number;
  completedAt?: number;
  failureCode?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface RestorePreview {
  id: string;
  stageId: string;
  subjectUserId: string;
  archiveSha256: string;
  planDigest: string;
  secretDisposition: RestoreSecretDisposition;
  counts: RestoreCounts;
  confirmationPhrase: string;
  state: RestorePreviewState;
  expiresAt: number;
  claimedAt?: number;
  completedAt?: number;
  outcomeCode?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface RestoreState {
  phase: RestorePhase;
  operationId?: string;
  startedAt?: number;
  recoveryExpiresAt?: number;
  version: number;
  updatedAt: number;
}

export class RestoreStateError extends PersistenceError {
  readonly restoreCode: "invalid" | "not_found" | "conflict" | "expired";

  constructor(
    code: "invalid" | "not_found" | "conflict" | "expired",
  ) {
    super(`restore_${code}` as const);
    this.restoreCode = code;
    this.name = "RestoreStateError";
  }
}

interface StageRow {
  id: string;
  subject_user_id: string;
  archive_id: string;
  storage_key: string;
  archive_sha256: string;
  archive_bytes: number;
  state: RestoreStageState;
  expires_at: number;
  completed_at: number | null;
  failure_code: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}

interface PreviewRow {
  id: string;
  stage_id: string;
  subject_user_id: string;
  archive_sha256: string;
  plan_digest: string;
  secret_disposition: RestoreSecretDisposition;
  service_count: number;
  destination_count: number;
  credential_count: number;
  policy_count: number;
  rule_count: number;
  available_secret_count: number;
  unavailable_secret_count: number;
  replacement_count: number;
  removal_count: number;
  revoked_api_key_count: number;
  revoked_session_count: number;
  revoked_oauth_grant_count: number;
  remediation_count: number;
  confirmation_phrase: string;
  state: RestorePreviewState;
  expires_at: number;
  claimed_at: number | null;
  completed_at: number | null;
  outcome_code: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}

interface StateRow {
  phase: RestorePhase;
  operation_id: string | null;
  started_at: number | null;
  recovery_expires_at: number | null;
  version: number;
  updated_at: number;
}

export class RestoreStateRepository {
  readonly #uuid: UuidV7Generator;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {
    this.#uuid = new UuidV7Generator({ now });
  }

  async createStage(input: {
    subjectUserId: string;
    archiveId: string;
    archiveSha256: string;
    archiveBytes: number;
    storageKey?: string;
  }): Promise<RestoreStage> {
    validateStageInput(input);
    const id = this.#uuid.next();
    const storageKey = input.storageKey ?? this.#uuid.next();
    validateUuid(storageKey);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        expireRows(transaction, now, 100);
        const active = transaction.get<{
          stage_count: number;
          total_bytes: number;
          actor_count: number;
        }>(`
          SELECT count(*) AS stage_count,
            coalesce(sum(archive_bytes), 0) AS total_bytes,
            coalesce(sum(CASE WHEN subject_user_id = ? THEN 1 ELSE 0 END), 0)
              AS actor_count
          FROM restore_stages
          WHERE state IN ('validated', 'previewed', 'committing')
            AND expires_at > ?
        `, [input.subjectUserId, now]);
        if (
          active === undefined
          || active.actor_count !== 0
          || active.stage_count >= MAX_ACTIVE_STAGES
          || active.total_bytes + input.archiveBytes > MAX_ACTIVE_STAGE_BYTES
        ) throw new RestoreStateError("conflict");
        const expiresAt = now + STAGE_TTL_MS;
        transaction.run(`
          INSERT INTO restore_stages (
            id, subject_user_id, archive_id, archive_type, schema_version,
            storage_key, archive_sha256, archive_bytes, state, expires_at,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, 'secretsauce-portable-configuration', 1, ?, ?, ?,
            'validated', ?, 1, ?, ?)
        `, [
          id,
          input.subjectUserId,
          input.archiveId,
          storageKey,
          input.archiveSha256,
          input.archiveBytes,
          expiresAt,
          now,
          now,
        ]);
        return stageById(transaction, id)!;
      }),
    }).then(wireStage);
  }

  async failStage(
    stageId: string,
    subjectUserId: string,
    failureCode: string,
  ): Promise<void> {
    validateUuid(stageId);
    validateUuid(subjectUserId);
    validateCode(failureCode);
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const result = transaction.run(`
          UPDATE restore_stages
          SET state = 'failed', failure_code = ?, completed_at = ?,
            version = version + 1, updated_at = ?
          WHERE id = ? AND subject_user_id = ?
            AND state IN ('validated', 'previewed')
        `, [failureCode, now, now, stageId, subjectUserId]);
        if (result.changes !== 1) throw new RestoreStateError("conflict");
      }),
    });
  }

  async expiredStageStorageKeys(limit = 100): Promise<string[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RestoreStateError("invalid");
    }
    return this.owner.execute({
      run: (database) => database.read((query) =>
        query.all<{ storage_key: string }>(`
          SELECT storage_key FROM restore_stages
          WHERE state = 'expired'
          ORDER BY expires_at, id LIMIT ?
        `, [limit]).map((row) => row.storage_key)),
    });
  }

  async deleteExpiredStages(storageKeys: readonly string[]): Promise<number> {
    if (
      !Array.isArray(storageKeys)
      || storageKeys.length < 1
      || storageKeys.length > 1_000
    ) throw new RestoreStateError("invalid");
    for (const key of storageKeys) validateUuid(key);
    if (new Set(storageKeys).size !== storageKeys.length) {
      throw new RestoreStateError("invalid");
    }
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) =>
        transaction.run(`
          DELETE FROM restore_stages
          WHERE state = 'expired'
            AND storage_key IN (${storageKeys.map(() => "?").join(", ")})
        `, [...storageKeys]).changes),
    });
  }

  async stageForActor(
    stageId: string,
    subjectUserId: string,
  ): Promise<RestoreStage> {
    validateUuid(stageId);
    validateUuid(subjectUserId);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        expireRows(transaction, transaction.timestamp(), 100);
        const row = transaction.get<StageRow>(`
          SELECT * FROM restore_stages
          WHERE id = ? AND subject_user_id = ?
        `, [stageId, subjectUserId]);
        if (row === undefined) throw new RestoreStateError("not_found");
        if (row.state === "expired") throw new RestoreStateError("expired");
        return wireStage(row);
      }),
    });
  }

  async createPreview(input: {
    stageId: string;
    subjectUserId: string;
    archiveSha256: string;
    planDigest: string;
    secretDisposition: RestoreSecretDisposition;
    counts: RestoreCounts;
  }): Promise<RestorePreview> {
    validatePreviewInput(input);
    const id = this.#uuid.next();
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        expireRows(transaction, now, 100);
        const stage = transaction.get<StageRow>(`
          SELECT * FROM restore_stages
          WHERE id = ? AND subject_user_id = ?
        `, [input.stageId, input.subjectUserId]);
        if (stage === undefined) throw new RestoreStateError("not_found");
        if (stage.state === "expired" || stage.expires_at <= now) {
          throw new RestoreStateError("expired");
        }
        if (
          !["validated", "previewed"].includes(stage.state)
          || stage.archive_sha256 !== input.archiveSha256
        ) throw new RestoreStateError("conflict");
        const expiresAt = Math.min(stage.expires_at, now + STAGE_TTL_MS);
        const confirmationPhrase = `RESTORE ${stage.archive_id}`;
        const counts = input.counts;
        transaction.run(`
          INSERT INTO restore_previews (
            id, stage_id, subject_user_id, archive_sha256, plan_digest,
            secret_disposition, service_count, destination_count,
            credential_count, policy_count, rule_count, available_secret_count,
            unavailable_secret_count, replacement_count, removal_count,
            revoked_api_key_count, revoked_session_count,
            revoked_oauth_grant_count, remediation_count, confirmation_phrase,
            state, expires_at, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, 'ready', ?, 1, ?, ?)
        `, [
          id,
          input.stageId,
          input.subjectUserId,
          input.archiveSha256,
          input.planDigest,
          input.secretDisposition,
          counts.services,
          counts.destinations,
          counts.credentials,
          counts.policies,
          counts.rules,
          counts.availableSecrets,
          counts.unavailableSecrets,
          counts.replacements,
          counts.removals,
          counts.revokedApiKeys,
          counts.revokedSessions,
          counts.revokedOauthGrants,
          counts.remediations,
          confirmationPhrase,
          expiresAt,
          now,
          now,
        ]);
        transaction.run(`
          UPDATE restore_stages
          SET state = 'previewed', version = version + 1, updated_at = ?
          WHERE id = ?
        `, [now, input.stageId]);
        return previewById(transaction, id)!;
      }),
    }).then(wirePreview);
  }

  async previewForActor(
    previewId: string,
    stageId: string,
    subjectUserId: string,
  ): Promise<RestorePreview> {
    validateUuid(previewId);
    validateUuid(stageId);
    validateUuid(subjectUserId);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        expireRows(transaction, now, 100);
        const row = transaction.get<PreviewRow>(`
          SELECT * FROM restore_previews
          WHERE id = ? AND stage_id = ? AND subject_user_id = ?
        `, [previewId, stageId, subjectUserId]);
        if (row === undefined) throw new RestoreStateError("not_found");
        if (row.state === "expired" || row.expires_at <= now) {
          throw new RestoreStateError("expired");
        }
        return wirePreview(row);
      }),
    });
  }

  async claimPreview(input: {
    previewId: string;
    stageId: string;
    subjectUserId: string;
    archiveSha256: string;
    planDigest: string;
  }): Promise<RestorePreview> {
    validateClaimInput(input);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        return this.claimPreviewInTransaction(transaction, input);
      }),
    });
  }

  claimPreviewInTransaction(
    transaction: PersistenceTransaction,
    input: {
      previewId: string;
      stageId: string;
      subjectUserId: string;
      archiveSha256: string;
      planDigest: string;
    },
  ): RestorePreview {
    validateClaimInput(input);
    const now = transaction.timestamp();
    expireRows(transaction, now, 100);
    const result = transaction.run(`
      UPDATE restore_previews
      SET state = 'claimed', claimed_at = ?, version = version + 1,
        updated_at = ?
      WHERE id = ? AND stage_id = ? AND subject_user_id = ?
        AND archive_sha256 = ? AND plan_digest = ? AND state = 'ready'
        AND expires_at > ?
    `, [
      now,
      now,
      input.previewId,
      input.stageId,
      input.subjectUserId,
      input.archiveSha256,
      input.planDigest,
      now,
    ]);
    if (result.changes !== 1) throw new RestoreStateError("conflict");
    const stage = transaction.run(`
      UPDATE restore_stages
      SET state = 'committing', version = version + 1, updated_at = ?
      WHERE id = ? AND subject_user_id = ? AND state = 'previewed'
        AND expires_at > ?
    `, [now, input.stageId, input.subjectUserId, now]);
    if (stage.changes !== 1) throw new RestoreStateError("conflict");
    return wirePreview(previewById(transaction, input.previewId)!);
  }

  async finalizePreview(
    previewId: string,
    outcome: "completed" | "failed",
    outcomeCode: string,
  ): Promise<void> {
    validateUuid(previewId);
    validateCode(outcomeCode);
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const preview = previewById(transaction, previewId);
        if (preview === undefined || preview.state !== "claimed") {
          throw new RestoreStateError("conflict");
        }
        transaction.run(`
          UPDATE restore_previews
          SET state = ?, completed_at = ?, outcome_code = ?,
            version = version + 1, updated_at = ?
          WHERE id = ?
        `, [outcome, now, outcomeCode, now, previewId]);
        transaction.run(`
          UPDATE restore_stages
          SET state = ?, completed_at = ?, failure_code = ?,
            version = version + 1, updated_at = ?
          WHERE id = ? AND state = 'committing'
        `, [
          outcome,
          now,
          outcome === "failed" ? outcomeCode : null,
          now,
          preview.stage_id,
        ]);
      }),
    });
  }

  async cleanupExpired(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RestoreStateError("invalid");
    }
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) =>
        expireRows(transaction, transaction.timestamp(), limit)),
    });
  }

  async state(): Promise<RestoreState> {
    return this.owner.execute({
      run: (database) => database.read((query) => wireState(stateRow(query))),
    });
  }

  async enterMaintenance(operationId: string): Promise<RestoreState> {
    validateUuid(operationId);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const result = transaction.run(`
          UPDATE restore_state
          SET phase = 'maintenance', operation_id = ?, started_at = ?,
            recovery_expires_at = NULL, version = version + 1, updated_at = ?
          WHERE singleton = 1 AND phase = 'inactive'
        `, [operationId, now, now]);
        if (result.changes !== 1) throw new RestoreStateError("conflict");
        return wireState(stateRow(transaction));
      }),
    });
  }

  async advanceState(
    operationId: string,
    expected: Exclude<RestorePhase, "inactive">,
    next: Exclude<RestorePhase, "inactive" | "maintenance">,
  ): Promise<RestoreState> {
    validateUuid(operationId);
    if (!validTransition(expected, next)) throw new RestoreStateError("invalid");
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const expiresAt = now + RECOVERY_TTL_MS;
        const result = transaction.run(`
          UPDATE restore_state
          SET phase = ?, recovery_expires_at = coalesce(recovery_expires_at, ?),
            version = version + 1, updated_at = ?
          WHERE singleton = 1 AND operation_id = ? AND phase = ?
        `, [next, expiresAt, now, operationId, expected]);
        if (result.changes !== 1) throw new RestoreStateError("conflict");
        return wireState(stateRow(transaction));
      }),
    });
  }

  async clearState(operationId: string): Promise<RestoreState> {
    validateUuid(operationId);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const result = transaction.run(`
          UPDATE restore_state
          SET phase = 'inactive', operation_id = NULL, started_at = NULL,
            recovery_expires_at = NULL, version = version + 1, updated_at = ?
          WHERE singleton = 1 AND operation_id = ?
            AND phase IN ('maintenance', 'health_passed', 'rolled_back')
        `, [now, operationId]);
        if (result.changes !== 1) throw new RestoreStateError("conflict");
        return wireState(stateRow(transaction));
      }),
    });
  }

  async markRolledBack(operationId: string): Promise<RestoreState> {
    validateUuid(operationId);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const now = transaction.timestamp();
        const result = transaction.run(`
          UPDATE restore_state
          SET phase = 'rolled_back', version = version + 1, updated_at = ?
          WHERE singleton = 1 AND operation_id = ?
            AND phase IN (
              'maintenance', 'snapshot_ready', 'vault_applied',
              'database_committed'
            )
        `, [now, operationId]);
        if (result.changes !== 1) throw new RestoreStateError("conflict");
        return wireState(stateRow(transaction));
      }),
    });
  }
}

function stageById(query: PersistenceQuery, id: string): StageRow | undefined {
  return query.get<StageRow>("SELECT * FROM restore_stages WHERE id = ?", [id]);
}

function previewById(query: PersistenceQuery, id: string): PreviewRow | undefined {
  return query.get<PreviewRow>("SELECT * FROM restore_previews WHERE id = ?", [id]);
}

function stateRow(query: PersistenceQuery): StateRow {
  const row = query.get<StateRow>("SELECT * FROM restore_state WHERE singleton = 1");
  if (row === undefined) throw new RestoreStateError("conflict");
  return row;
}

function expireRows(
  transaction: PersistenceTransaction,
  now: number,
  limit: number,
): number {
  const previews = transaction.run(`
    UPDATE restore_previews
    SET state = 'expired', version = version + 1, updated_at = ?
    WHERE id IN (
      SELECT id FROM restore_previews
      WHERE state = 'ready' AND expires_at <= ?
      ORDER BY expires_at, id LIMIT ?
    )
  `, [now, now, limit]).changes;
  const stages = transaction.run(`
    UPDATE restore_stages
    SET state = 'expired', version = version + 1, updated_at = ?
    WHERE id IN (
      SELECT id FROM restore_stages
      WHERE state IN ('validated', 'previewed') AND expires_at <= ?
      ORDER BY expires_at, id LIMIT ?
    )
  `, [now, now, limit]).changes;
  return previews + stages;
}

function wireStage(row: StageRow): RestoreStage {
  return {
    id: row.id,
    subjectUserId: row.subject_user_id,
    archiveId: row.archive_id,
    storageKey: row.storage_key,
    archiveSha256: row.archive_sha256,
    archiveBytes: row.archive_bytes,
    state: row.state,
    expiresAt: row.expires_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    ...(row.failure_code === null ? {} : { failureCode: row.failure_code }),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function wirePreview(row: PreviewRow): RestorePreview {
  return {
    id: row.id,
    stageId: row.stage_id,
    subjectUserId: row.subject_user_id,
    archiveSha256: row.archive_sha256,
    planDigest: row.plan_digest,
    secretDisposition: row.secret_disposition,
    counts: {
      services: row.service_count,
      destinations: row.destination_count,
      credentials: row.credential_count,
      policies: row.policy_count,
      rules: row.rule_count,
      availableSecrets: row.available_secret_count,
      unavailableSecrets: row.unavailable_secret_count,
      replacements: row.replacement_count,
      removals: row.removal_count,
      revokedApiKeys: row.revoked_api_key_count,
      revokedSessions: row.revoked_session_count,
      revokedOauthGrants: row.revoked_oauth_grant_count,
      remediations: row.remediation_count,
    },
    confirmationPhrase: row.confirmation_phrase,
    state: row.state,
    expiresAt: row.expires_at,
    ...(row.claimed_at === null ? {} : { claimedAt: row.claimed_at }),
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    ...(row.outcome_code === null ? {} : { outcomeCode: row.outcome_code }),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function wireState(row: StateRow): RestoreState {
  return {
    phase: row.phase,
    ...(row.operation_id === null ? {} : { operationId: row.operation_id }),
    ...(row.started_at === null ? {} : { startedAt: row.started_at }),
    ...(row.recovery_expires_at === null
      ? {}
      : { recoveryExpiresAt: row.recovery_expires_at }),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function validateStageInput(input: {
  subjectUserId: string;
  archiveId: string;
  archiveSha256: string;
  archiveBytes: number;
  storageKey?: string;
}): void {
  validateUuid(input.subjectUserId);
  validateUuid(input.archiveId);
  validateDigest(input.archiveSha256);
  if (
    !Number.isSafeInteger(input.archiveBytes)
    || input.archiveBytes < 1
    || input.archiveBytes > MAX_ARCHIVE_BYTES
  ) throw new RestoreStateError("invalid");
}

function validatePreviewInput(input: {
  stageId: string;
  subjectUserId: string;
  archiveSha256: string;
  planDigest: string;
  secretDisposition: RestoreSecretDisposition;
  counts: RestoreCounts;
}): void {
  validateUuid(input.stageId);
  validateUuid(input.subjectUserId);
  validateDigest(input.archiveSha256);
  validateDigest(input.planDigest);
  if (!["configuration_only", "encrypted_secrets"].includes(
    input.secretDisposition,
  )) throw new RestoreStateError("invalid");
  const counts = input.counts;
  for (const value of [
    counts.services,
    counts.destinations,
    counts.credentials,
    counts.policies,
    counts.rules,
  ]) count(value, MAX_OBJECTS);
  for (const value of [
    counts.availableSecrets,
    counts.unavailableSecrets,
    counts.replacements,
    counts.removals,
    counts.revokedApiKeys,
    counts.revokedSessions,
    counts.revokedOauthGrants,
    counts.remediations,
  ]) count(value, MAX_SUMMARY_COUNT);
  if (
    counts.availableSecrets > counts.credentials
    || counts.unavailableSecrets > counts.credentials
    || (
      input.secretDisposition === "configuration_only"
      && counts.availableSecrets !== 0
    )
  ) throw new RestoreStateError("invalid");
}

function validateClaimInput(input: {
  previewId: string;
  stageId: string;
  subjectUserId: string;
  archiveSha256: string;
  planDigest: string;
}): void {
  validateUuid(input.previewId);
  validateUuid(input.stageId);
  validateUuid(input.subjectUserId);
  validateDigest(input.archiveSha256);
  validateDigest(input.planDigest);
}

function validateUuid(value: string): void {
  if (!isUuidV7(value)) throw new RestoreStateError("invalid");
}

function validateDigest(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new RestoreStateError("invalid");
}

function validateCode(value: string): void {
  if (!/^[a-z0-9_.-]{1,64}$/.test(value)) {
    throw new RestoreStateError("invalid");
  }
}

function count(value: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RestoreStateError("invalid");
  }
}

function validTransition(
  expected: Exclude<RestorePhase, "inactive">,
  next: Exclude<RestorePhase, "inactive" | "maintenance">,
): boolean {
  return (
    (expected === "maintenance" && next === "snapshot_ready")
    || (expected === "snapshot_ready"
      && (next === "vault_applied" || next === "rolled_back"))
    || (expected === "vault_applied"
      && (next === "database_committed" || next === "rolled_back"))
    || (expected === "database_committed"
      && (next === "health_passed" || next === "rolled_back"))
  );
}
