import { createHash } from "node:crypto";
import type {
  DecodedRestoreArchive,
  RestoreCredential,
} from "./restoreArchive.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { canonicalJson } from "./vault/canonicalJson.js";

export class RestoreReplacementError extends Error {
  constructor(readonly code: "invalid" | "conflict" | "unavailable") {
    super(code);
    this.name = "RestoreReplacementError";
  }
}

export interface RestoreReplacementResult {
  services: number;
  destinations: number;
  credentials: number;
  policies: number;
  rules: number;
  remediations: number;
  revokedApiKeys: number;
  revokedSessions: number;
  revokedOauthGrants: number;
}

export class RestoreReplacementRepository {
  readonly #uuid: UuidV7Generator;
  readonly #now: () => number;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
  ) {
    this.#uuid = new UuidV7Generator({ now });
    this.#now = now;
  }

  async replace(input: {
    operationId: string;
    previewId: string;
    stageId: string;
    actorId: string;
    archiveSha256: string;
    planDigest: string;
    decoded: DecodedRestoreArchive;
    availableSecretCredentialIds: readonly string[];
  }): Promise<RestoreReplacementResult> {
    validateInput(input);
    const available = new Set(input.availableSecretCredentialIds);
    if (
      available.size !== input.availableSecretCredentialIds.length
      || [...available].some((id) =>
        !input.decoded.secretSelection.some((entry) =>
          entry.credentialId === id))
    ) throw new RestoreReplacementError("invalid");
    const claimReady = await this.owner.execute({
      run: (database) => database.read((query) => {
        const now = this.#now();
        return query.get<{ id: string }>(`
          SELECT p.id
          FROM restore_previews p
          JOIN restore_stages s ON s.id = p.stage_id
          JOIN restore_state rs ON rs.singleton = 1
          WHERE p.id = ? AND p.stage_id = ? AND p.subject_user_id = ?
            AND p.archive_sha256 = ? AND p.plan_digest = ?
            AND p.state = 'claimed' AND p.expires_at > ?
            AND s.state = 'committing' AND s.expires_at > ?
            AND rs.operation_id = ? AND rs.phase = 'vault_applied'
        `, [
          input.previewId,
          input.stageId,
          input.actorId,
          input.archiveSha256,
          input.planDigest,
          now,
          now,
          input.operationId,
        ]) !== undefined;
      }),
    });
    if (!claimReady) throw new RestoreReplacementError("conflict");
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => {
            const now = transaction.timestamp();
            verifyClaim(transaction, input, now);
            const revokedApiKeys = transaction.run(`
              UPDATE api_keys
              SET status = 'revoked', revoked_at = ?, version = version + 1,
                updated_at = ?
              WHERE status = 'active'
            `, [now, now]).changes;
            const revokedSessions = transaction.run(`
              UPDATE browser_sessions
              SET revoked_at = ?, version = version + 1
              WHERE revoked_at IS NULL
            `, [now]).changes;
            transaction.run(`
              UPDATE identity_restricted_sessions
              SET revoked_at = ?, version = version + 1
              WHERE revoked_at IS NULL
            `, [now]);
            const revokedOauthGrants = transaction.run(`
              UPDATE oauth_grants
              SET status = 'revoked', revoked_at = ?,
                revocation_reason = 'global_security', version = version + 1
              WHERE status = 'active'
            `, [now]).changes;
            transaction.run(`
              UPDATE identity_security_state
              SET global_security_epoch = global_security_epoch + 1,
                version = version + 1, updated_at = ?
              WHERE singleton = 1
            `, [now]);
            transaction.run(`
              UPDATE runtime_activation
              SET state = 'inactive', activation_generation =
                activation_generation + 1,
                global_reference_epoch = global_reference_epoch + 1,
                activated_at = NULL, version = version + 1, updated_at = ?
              WHERE singleton = 1
            `, [now]);

            transaction.run("DELETE FROM services");
            insertPortable(
              transaction,
              input.decoded,
              available,
              now,
            );
            const remediations = insertRemediations(
              transaction,
              input.previewId,
              input.decoded,
              available,
              now,
              this.#uuid,
            );
            transaction.run(`
              UPDATE restore_previews
              SET state = 'completed', completed_at = ?, outcome_code = 'ok',
                version = version + 1, updated_at = ?
              WHERE id = ? AND state = 'claimed'
            `, [now, now, input.previewId]);
            transaction.run(`
              UPDATE restore_stages
              SET state = 'completed', completed_at = ?,
                version = version + 1, updated_at = ?
              WHERE id = ? AND state = 'committing'
            `, [now, now, input.stageId]);
            const advanced = transaction.run(`
              UPDATE restore_state
              SET phase = 'database_committed', version = version + 1,
                updated_at = ?
              WHERE singleton = 1 AND operation_id = ?
                AND phase = 'vault_applied'
            `, [now, input.operationId]);
            if (advanced.changes !== 1) {
              throw new RestoreReplacementError("conflict");
            }
            const value: RestoreReplacementResult = {
              services: input.decoded.counts.services,
              destinations: input.decoded.counts.destinations,
              credentials: input.decoded.counts.credentials,
              policies: input.decoded.counts.policies,
              rules: input.decoded.counts.rules,
              remediations,
              revokedApiKeys,
              revokedSessions,
              revokedOauthGrants,
            };
            return {
              value,
              auditInput: {
                actor: {
                  type: "browser_session",
                  id: input.actorId,
                  label: "restore-superadmin",
                  role: "superadmin",
                  authenticationMethod: "browser_session",
                },
                action: "restore.commit",
                category: "system",
                result: "allow",
                target: {
                  type: "portable_restore",
                  id: input.previewId,
                  label: `portable-restore:${input.previewId}`,
                },
                changes: [
                  { field: "archive_sha256", after: input.archiveSha256 },
                  { field: "plan_digest", after: input.planDigest },
                  ...Object.entries(value).map(([field, count]) => ({
                    field: field === "revokedApiKeys"
                      ? "revoked_system_keys"
                      : field.replace(
                          /[A-Z]/g,
                          (letter) => `_${letter.toLowerCase()}`,
                        ),
                    after: String(count),
                  })),
                ],
                correlationId: input.operationId,
                source: { category: "restore" },
              },
            };
          },
        ),
      });
    } catch (error) {
      if (error instanceof RestoreReplacementError) throw error;
      throw new RestoreReplacementError("unavailable");
    }
  }
}

function verifyClaim(
  transaction: PersistenceTransaction,
  input: {
    operationId: string;
    previewId: string;
    stageId: string;
    actorId: string;
    archiveSha256: string;
    planDigest: string;
  },
  now: number,
): void {
  const active = transaction.get<{ total: number }>(`
    SELECT count(*) AS total FROM users
    WHERE role = 'superadmin' AND status = 'active'
  `)?.total ?? 0;
  const preview = transaction.get<{ id: string }>(`
    SELECT p.id
    FROM restore_previews p
    JOIN restore_stages s ON s.id = p.stage_id
    JOIN restore_state rs ON rs.singleton = 1
    WHERE p.id = ? AND p.stage_id = ? AND p.subject_user_id = ?
      AND p.archive_sha256 = ? AND p.plan_digest = ?
      AND p.state = 'claimed' AND p.expires_at > ?
      AND s.subject_user_id = ? AND s.archive_sha256 = ?
      AND s.state = 'committing' AND s.expires_at > ?
      AND rs.operation_id = ? AND rs.phase = 'vault_applied'
  `, [
    input.previewId,
    input.stageId,
    input.actorId,
    input.archiveSha256,
    input.planDigest,
    now,
    input.actorId,
    input.archiveSha256,
    now,
    input.operationId,
  ]);
  if (active < 1 || preview === undefined) {
    throw new RestoreReplacementError("conflict");
  }
}

function insertPortable(
  transaction: PersistenceTransaction,
  decoded: DecodedRestoreArchive,
  available: ReadonlySet<string>,
  now: number,
): void {
  for (const service of decoded.services) {
    const digest = createHash("sha256")
      .update("secretsauce:restored-service-draft:v1:")
      .update(canonicalJson(service))
      .digest("hex");
    transaction.run(`
      INSERT INTO services (
        id, slug, name, description, documentation_url, lifecycle,
        draft_digest, published_revision_id, published_digest,
        publication_generation, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, 0, 1, ?, ?)
    `, [
      service.id,
      service.slug,
      service.name,
      service.description ?? null,
      service.documentation_url ?? null,
      digest,
      now,
      now,
    ]);
    transaction.run(`
      INSERT INTO service_assignment_states (
        service_id, version, authorization_generation, created_at, updated_at
      ) VALUES (?, 1, 0, ?, ?)
    `, [service.id, now, now]);
    for (const destination of service.destinations) {
      transaction.run(`
        INSERT INTO service_destinations (
          id, service_id, slug, base_url, schemes_json, hosts_json,
          ports_json, tls_verify, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        destination.id,
        service.id,
        destination.slug,
        destination.base_url,
        JSON.stringify(destination.schemes),
        JSON.stringify(destination.hosts),
        JSON.stringify(destination.ports),
        Number(destination.tls.verify),
        now,
        now,
      ]);
    }
  }
  for (const credential of decoded.credentials) {
    insertCredential(transaction, credential, available.has(credential.id), now);
  }
  for (const policy of decoded.policies) {
    transaction.run(`
      INSERT INTO policies (
        id, service_id, credential_id, name, normalized_name, description,
        operating_mode, lifecycle, evaluation_generation, version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
    `, [
      policy.id,
      policy.service_id,
      policy.credential_id ?? null,
      normalizedName(policy.name).name,
      normalizedName(policy.name).normalized,
      policy.description ?? null,
      policy.operating_mode,
      policy.lifecycle,
      now,
      now,
    ]);
    for (const rule of policy.rules) {
      const name = normalizedName(rule.name);
      transaction.run(`
        INSERT INTO policy_rules (
          id, service_id, policy_id, name, normalized_name, reason, effect,
          priority, enabled, methods_json, hosts_json, paths_json,
          response_safeguards_json, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)
      `, [
        rule.id,
        policy.service_id,
        policy.id,
        name.name,
        name.normalized,
        rule.reason ?? null,
        rule.effect,
        rule.priority,
        JSON.stringify(rule.methods),
        JSON.stringify(rule.hosts),
        JSON.stringify(rule.paths),
        JSON.stringify(rule.response_safeguards),
        now,
        now,
      ]);
    }
  }
}

function insertCredential(
  transaction: PersistenceTransaction,
  credential: RestoreCredential,
  available: boolean,
  now: number,
): void {
  const name = normalizedName(credential.name);
  const imported = available && credential.secret_record !== undefined;
  const archived = credential.status === "archived";
  const status = archived
    ? "archived"
    : imported
      ? credential.status
      : "unconfigured";
  transaction.run(`
    INSERT INTO service_credentials (
      id, service_id, name, normalized_name, description, usage_kind,
      usage_name, usage_prefix, usage_suffix, enforce_header_ownership,
      status, vault_state, vault_locator, vault_generation, last_four,
      value_updated_at, authorization_generation, version, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, NULL, ?,
      0, 1, ?, ?)
  `, [
    credential.id,
    credential.service_id,
    name.name,
    name.normalized,
    credential.description ?? null,
    credential.usage.kind,
    credential.usage.name,
    credential.usage.prefix ?? null,
    credential.usage.suffix ?? null,
    Number(credential.usage.enforce_header_ownership),
    status,
    imported ? credential.secret_record!.locator : null,
    imported ? credential.secret_record!.generation : null,
    imported ? now : null,
    now,
    now,
  ]);
}

function insertRemediations(
  transaction: PersistenceTransaction,
  previewId: string,
  decoded: DecodedRestoreArchive,
  available: ReadonlySet<string>,
  now: number,
  uuid: UuidV7Generator,
): number {
  let count = 0;
  const insert = (
    serviceId: string,
    taskKind: string,
    targetId?: string,
  ): void => {
    transaction.run(`
      INSERT INTO restore_remediations (
        id, restore_id, service_id, target_id, task_kind, state, version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', 1, ?, ?)
    `, [
      uuid.next(),
      previewId,
      serviceId,
      targetId ?? null,
      taskKind,
      now,
      now,
    ]);
    count += 1;
  };
  for (const service of decoded.services) {
    insert(service.id, "assign_service_admin");
    insert(service.id, "assign_service_access");
    insert(service.id, "validate_publish_service");
  }
  for (const policy of decoded.policies) {
    insert(policy.service_id, "assign_enable_policy", policy.id);
  }
  const unavailableByService = new Set<string>();
  for (const credential of decoded.credentials) {
    if (
      credential.secret_record !== undefined
      && !available.has(credential.id)
    ) {
      insert(credential.service_id, "supply_credential", credential.id);
      unavailableByService.add(credential.service_id);
    }
  }
  for (const serviceId of unavailableByService) {
    insert(serviceId, "missing_archive_secret");
  }
  return count;
}

function normalizedName(value: string): {
  name: string;
  normalized: string;
} {
  const name = value.normalize("NFKC").trim();
  return { name, normalized: name.toLocaleLowerCase("und") };
}

function validateInput(input: {
  operationId: string;
  previewId: string;
  stageId: string;
  actorId: string;
  archiveSha256: string;
  planDigest: string;
  decoded: DecodedRestoreArchive;
  availableSecretCredentialIds: readonly string[];
}): void {
  if (
    !isUuidV7(input.operationId)
    || !isUuidV7(input.previewId)
    || !isUuidV7(input.stageId)
    || !isUuidV7(input.actorId)
    || !/^[0-9a-f]{64}$/.test(input.archiveSha256)
    || !/^[0-9a-f]{64}$/.test(input.planDigest)
    || !Array.isArray(input.availableSecretCredentialIds)
    || input.availableSecretCredentialIds.some((id) => !isUuidV7(id))
  ) throw new RestoreReplacementError("invalid");
}
