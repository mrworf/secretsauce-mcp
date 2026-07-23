import { randomUUID } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { ControlIdempotencyHasher } from "./control/idempotency.js";
import {
  CredentialManagementError,
  type CredentialStatus,
  type CredentialView,
  CredentialManagementRepository,
} from "./credentialManagement.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type { IdempotencyExecutionInput } from "./persistence/idempotency.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type { VaultCredentialBinding, VaultRecordMetadata } from "./vault/recordStore.js";
import { VaultError } from "./vault/errors.js";

export interface CredentialControlVault {
  create(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    captureLastFour?: boolean;
  }): Promise<{ locator: string; metadata: VaultRecordMetadata }>;
  replace(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    generation: number;
    captureLastFour?: boolean;
  }): Promise<VaultRecordMetadata>;
  delete(
    locator: string,
    generation: number,
    binding: VaultCredentialBinding,
  ): Promise<{ deleted: true }>;
  metadata(
    locator: string,
    binding: VaultCredentialBinding,
  ): Promise<VaultRecordMetadata>;
}

type VaultOperation = "create" | "replace" | "delete_value" | "archive";

interface VaultIntent {
  credential_id: string;
  service_id: string;
  operation: VaultOperation;
  locator: string;
  expected_generation: number | null;
  target_generation: number | null;
  prior_status: Exclude<CredentialStatus, "archived">;
  phase: "prepared" | "vault_applied" | "reconcile";
}

interface CredentialState {
  id: string;
  service_id: string;
  status: CredentialStatus;
  vault_state:
    | "idle"
    | "pending_create"
    | "pending_replace"
    | "pending_delete"
    | "pending_archive"
    | "reconcile";
  vault_locator: string | null;
  vault_generation: number | null;
  authorization_generation: number;
  version: number;
}

interface PreparedVaultOperation {
  intent?: VaultIntent;
  replayed: boolean;
  keyHash?: string;
}

export class CredentialVaultCoordinator {
  readonly #eventUuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly credentials: CredentialManagementRepository,
    private readonly vault: CredentialControlVault,
    now: () => number = Date.now,
    private readonly locatorUuid: () => string = randomUUID,
    private readonly idempotency?: ControlIdempotencyHasher,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#eventUuid = () => generator.next();
  }

  async setValue(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    value: Uint8Array;
    captureLastFour?: boolean;
    idempotencyKey?: string;
    correlationId: string;
  }): Promise<CredentialView> {
    validateOperationInput(input);
    if (
      input.value.byteLength < 1 ||
      input.value.byteLength > 65_536 ||
      typeof input.captureLastFour !== "undefined" &&
        typeof input.captureLastFour !== "boolean"
    ) throw new CredentialManagementError("invalid_request");
    const secret = Buffer.from(input.value);
    let prepared: PreparedVaultOperation | undefined;
    let intent: VaultIntent;
    try {
      prepared = await this.prepareSet(input);
      if (prepared.intent === undefined) {
        return this.credentials.credential(
          input.actor,
          input.serviceId,
          input.credentialId,
        );
      }
      intent = prepared.intent;
      const binding = serviceBinding(intent);
      let metadata: VaultRecordMetadata;
      if (intent.operation === "create") {
        const created = await this.vault.create({
          binding,
          secret,
          locator: intent.locator,
          ...(input.captureLastFour === undefined
            ? {}
            : { captureLastFour: input.captureLastFour }),
        });
        if (created.locator !== intent.locator) {
          await this.markReconcile(intent, "locator_mismatch");
          throw new CredentialManagementError("unavailable");
        }
        metadata = created.metadata;
      } else {
        metadata = await this.vault.replace({
          binding,
          secret,
          locator: intent.locator,
          generation: intent.expected_generation!,
          ...(input.captureLastFour === undefined
            ? {}
            : { captureLastFour: input.captureLastFour }),
        });
      }
      await this.finalizeSet(intent, metadata);
    } catch (error) {
      if (intent! !== undefined && !(error instanceof CredentialManagementError)) {
        const reconciled = await this.tryReconcile(intent);
        if (reconciled) {
          const view = await this.credentials.credential(
            input.actor,
            input.serviceId,
            input.credentialId,
          );
          if (view.status === "configured" || view.status === "disabled") {
            return view;
          }
          await this.removeIdempotency(prepared?.keyHash);
        }
        throw mapCoordinatorError(error);
      } else {
        throw mapCoordinatorError(error);
      }
    } finally {
      secret.fill(0);
    }
    return this.credentials.credential(
      input.actor,
      input.serviceId,
      input.credentialId,
    );
  }

  async deleteValue(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    archive: boolean;
    idempotencyKey?: string;
    correlationId: string;
  }): Promise<CredentialView> {
    validateOperationInput(input);
    if (typeof input.archive !== "boolean") {
      throw new CredentialManagementError("invalid_request");
    }
    const prepared = await this.prepareDelete(input);
    if (prepared.intent === undefined) {
      return this.credentials.credential(
        input.actor,
        input.serviceId,
        input.credentialId,
      );
    }
    const intent = prepared.intent;
    try {
      await this.vault.delete(
        intent.locator,
        intent.expected_generation!,
        serviceBinding(intent),
      );
      await this.finalizeDelete(intent);
    } catch (error) {
      const reconciled = await this.tryReconcile(intent);
      if (!reconciled) throw mapCoordinatorError(error);
    }
    return this.credentials.credential(
      input.actor,
      input.serviceId,
      input.credentialId,
    );
  }

  async enable(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<CredentialView> {
    validateOperationInput(input);
    const state = await this.privateState(
      input.actor,
      input.serviceId,
      input.credentialId,
    );
    if (
      state.status !== "disabled" ||
      state.vault_state !== "idle" ||
      state.version !== input.expectedVersion ||
      state.vault_locator === null ||
      state.vault_generation === null
    ) throw new CredentialManagementError(
      state.version === input.expectedVersion ? "conflict" : "stale",
    );
    let metadata: VaultRecordMetadata;
    try {
      metadata = await this.vault.metadata(
        state.vault_locator,
        serviceBinding(state),
      );
    } catch (error) {
      throw mapCoordinatorError(error);
    }
    if (metadata.generation !== state.vault_generation) {
      throw new CredentialManagementError("conflict");
    }
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        requireScopedService(transaction, input.actor, input.serviceId);
        const current = requiredState(transaction, input.serviceId, input.credentialId);
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        const now = transaction.timestamp();
        const generation = current.authorization_generation + 1;
        const changed = transaction.run(`
          UPDATE service_credentials
          SET status = 'configured', authorization_generation = ?,
            version = version + 1, updated_at = ?
          WHERE id = ? AND version = ? AND status = 'disabled'
            AND vault_state = 'idle' AND vault_generation = ?
        `, [
          generation,
          now,
          current.id,
          current.version,
          metadata.generation,
        ]);
        if (changed.changes !== 1) throw new PersistenceError("identity_stale");
        insertInvalidation(transaction, this.#eventUuid(), current, generation, "enable", now);
        return {
          value: undefined,
          auditInput: vaultAudit(input, "credential.enable", [
            { field: "status", before: "disabled", after: "configured" },
          ]),
        };
      }),
    }).catch((error) => {
      throw mapCoordinatorError(error);
    });
    return this.credentials.credential(
      input.actor,
      input.serviceId,
      input.credentialId,
    );
  }

  async reconcilePending(): Promise<{ reconciled: number; unresolved: number }> {
    const intents = await this.owner.execute({
      run: (database) => database.read((query) => query.all<VaultIntent>(`
        SELECT * FROM credential_vault_operations
        ORDER BY started_at, credential_id
        LIMIT 1000
      `)),
    }).catch((error) => {
      throw mapCoordinatorError(error);
    });
    let reconciled = 0;
    for (const intent of intents) {
      if (await this.tryReconcile(intent)) reconciled += 1;
    }
    return { reconciled, unresolved: intents.length - reconciled };
  }

  private async prepareSet(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    value: Uint8Array;
    captureLastFour?: boolean;
    idempotencyKey?: string;
    correlationId: string;
  }): Promise<PreparedVaultOperation> {
    const idempotency = this.valueIdempotency(
      input,
      "credentials.value.replace",
      {
        serviceId: input.serviceId,
        credentialId: input.credentialId,
        expectedVersion: input.expectedVersion,
        captureLastFour: input.captureLastFour ?? false,
        value: Buffer.from(input.value).toString("base64url"),
      },
    );
    return this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        requireScopedService(transaction, input.actor, input.serviceId);
        let prepared: PreparedVaultOperation;
        if (idempotency === undefined) {
          prepared = {
            intent: this.prepareSetMutation(transaction, input),
            replayed: false,
          };
        } else {
          let executedIntent: VaultIntent | undefined;
          const result = transaction.idempotent(idempotency, () => {
            executedIntent = this.prepareSetMutation(transaction, input);
            return {
              value: executedIntent.credential_id,
              resultReference: executedIntent.credential_id,
              responseStatus: 200,
            };
          });
          const credentialId = result.kind === "executed"
            ? result.value
            : result.resultReference;
          const intent = executedIntent ?? optionalIntent(transaction, credentialId);
          prepared = {
            ...(intent === undefined ? {} : { intent }),
            replayed: result.kind === "replayed",
            keyHash: idempotency.keyHash,
          };
        }
        return {
          value: prepared,
          auditInput: vaultAudit(input, "credential.value.prepare", [
            {
              field: "operation",
              after: prepared.intent?.operation ?? "completed_replay",
            },
            { field: "outcome", after: prepared.replayed ? "replayed" : "prepared" },
          ]),
        };
      }),
    }).catch((error) => {
      throw mapCoordinatorError(error);
    });
  }

  private async prepareDelete(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    archive: boolean;
    idempotencyKey?: string;
    correlationId: string;
  }): Promise<PreparedVaultOperation> {
    const idempotency = this.valueIdempotency(
      input,
      input.archive ? "credentials.archive" : "credentials.value.delete",
      {
        serviceId: input.serviceId,
        credentialId: input.credentialId,
        expectedVersion: input.expectedVersion,
        archive: input.archive,
      },
    );
    return this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        requireScopedService(transaction, input.actor, input.serviceId);
        let prepared: PreparedVaultOperation;
        if (idempotency === undefined) {
          prepared = {
            intent: this.prepareDeleteMutation(transaction, input),
            replayed: false,
          };
        } else {
          let executedIntent: VaultIntent | undefined;
          const result = transaction.idempotent(idempotency, () => {
            executedIntent = this.prepareDeleteMutation(transaction, input);
            return {
              value: executedIntent.credential_id,
              resultReference: executedIntent.credential_id,
              responseStatus: 200,
            };
          });
          const credentialId = result.kind === "executed"
            ? result.value
            : result.resultReference;
          const intent = executedIntent ?? optionalIntent(transaction, credentialId);
          prepared = {
            ...(intent === undefined ? {} : { intent }),
            replayed: result.kind === "replayed",
            keyHash: idempotency.keyHash,
          };
        }
        return {
          value: prepared,
          auditInput: vaultAudit(
            input,
            input.archive ? "credential.archive.prepare" : "credential.value.delete.prepare",
            [
              {
                field: "operation",
                after: prepared.intent?.operation ?? "completed_replay",
              },
              { field: "outcome", after: prepared.replayed ? "replayed" : "prepared" },
            ],
          ),
        };
      }),
    }).catch((error) => {
      throw mapCoordinatorError(error);
    });
  }

  private prepareSetMutation(
    transaction: PersistenceTransaction,
    input: {
      serviceId: string;
      credentialId: string;
      expectedVersion: number;
    },
  ): VaultIntent {
    const current = requiredState(transaction, input.serviceId, input.credentialId);
    if (current.version !== input.expectedVersion) {
      throw new PersistenceError("identity_stale");
    }
    if (
      current.vault_state !== "idle" ||
      !["unconfigured", "configured", "disabled"].includes(current.status)
    ) throw new PersistenceError("identity_conflict");
    const create = current.status === "unconfigured";
    if (
      create && (current.vault_locator !== null || current.vault_generation !== null) ||
      !create && (current.vault_locator === null || current.vault_generation === null)
    ) throw new PersistenceError("database_unavailable");
    const locator = create ? this.locatorUuid() : current.vault_locator!;
    if (!isUuidV4(locator)) throw new PersistenceError("database_unavailable");
    const target = create ? 1 : current.vault_generation! + 1;
    if (!Number.isSafeInteger(target)) throw new PersistenceError("identity_conflict");
    const intent: VaultIntent = {
      credential_id: current.id,
      service_id: current.service_id,
      operation: create ? "create" : "replace",
      locator,
      expected_generation: create ? null : current.vault_generation,
      target_generation: target,
      prior_status: current.status as Exclude<CredentialStatus, "archived">,
      phase: "prepared",
    };
    const now = transaction.timestamp();
    insertIntent(transaction, intent, now);
    const generation = current.authorization_generation + 1;
    const changed = transaction.run(`
      UPDATE service_credentials
      SET vault_state = ?, authorization_generation = ?,
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `, [
      create ? "pending_create" : "pending_replace",
      generation,
      now,
      current.id,
      current.version,
    ]);
    if (changed.changes !== 1) throw new PersistenceError("identity_stale");
    insertInvalidation(
      transaction,
      this.#eventUuid(),
      current,
      generation,
      "value_replace",
      now,
    );
    return intent;
  }

  private prepareDeleteMutation(
    transaction: PersistenceTransaction,
    input: {
      serviceId: string;
      credentialId: string;
      expectedVersion: number;
      archive: boolean;
    },
  ): VaultIntent {
    const current = requiredState(transaction, input.serviceId, input.credentialId);
    if (current.version !== input.expectedVersion) {
      throw new PersistenceError("identity_stale");
    }
    if (
      current.vault_state !== "idle" ||
      !["configured", "disabled"].includes(current.status) ||
      current.vault_locator === null ||
      current.vault_generation === null
    ) throw new PersistenceError("identity_conflict");
    const intent: VaultIntent = {
      credential_id: current.id,
      service_id: current.service_id,
      operation: input.archive ? "archive" : "delete_value",
      locator: current.vault_locator,
      expected_generation: current.vault_generation,
      target_generation: null,
      prior_status: current.status as "configured" | "disabled",
      phase: "prepared",
    };
    const now = transaction.timestamp();
    insertIntent(transaction, intent, now);
    const generation = current.authorization_generation + 1;
    const changed = transaction.run(`
      UPDATE service_credentials
      SET vault_state = ?, authorization_generation = ?,
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `, [
      input.archive ? "pending_archive" : "pending_delete",
      generation,
      now,
      current.id,
      current.version,
    ]);
    if (changed.changes !== 1) throw new PersistenceError("identity_stale");
    insertInvalidation(
      transaction,
      this.#eventUuid(),
      current,
      generation,
      input.archive ? "archive" : "value_delete",
      now,
    );
    return intent;
  }

  private valueIdempotency(
    input: {
      actor: ControlAuthenticationContext;
      idempotencyKey?: string;
    },
    routeId: string,
    body: unknown,
  ): IdempotencyExecutionInput | undefined {
    if (input.idempotencyKey === undefined) return undefined;
    if (this.idempotency === undefined) {
      throw new CredentialManagementError("unavailable");
    }
    try {
      return {
        keyHash: this.idempotency.keyHash({
          key: input.idempotencyKey,
          principalId: input.actor.principalId,
          routeId,
        }),
        principalId: input.actor.principalId,
        routeId,
        requestDigest: this.idempotency.protectedRequestDigest(body),
      };
    } catch {
      throw new CredentialManagementError("invalid_request");
    }
  }

  private async removeIdempotency(keyHash: string | undefined): Promise<void> {
    if (keyHash === undefined) return;
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        transaction.run(
          "DELETE FROM control_idempotency_records WHERE key_hash = ?",
          [keyHash],
        );
      }),
    }).catch(() => undefined);
  }

  private async finalizeSet(
    intent: VaultIntent,
    metadata: VaultRecordMetadata,
  ): Promise<void> {
    if (metadata.generation !== intent.target_generation) {
      await this.markReconcile(intent, "generation_mismatch");
      throw new CredentialManagementError("unavailable");
    }
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const now = transaction.timestamp();
        const status = intent.prior_status === "disabled" ? "disabled" : "configured";
        const changed = transaction.run(`
          UPDATE service_credentials
          SET status = ?, vault_state = 'idle', vault_locator = ?,
            vault_generation = ?, last_four = ?, value_updated_at = ?,
            version = version + 1, updated_at = ?
          WHERE id = ? AND vault_state IN ('pending_create', 'pending_replace', 'reconcile')
        `, [
          status,
          intent.locator,
          metadata.generation,
          metadata.lastFour ?? null,
          metadata.updatedAt,
          now,
          intent.credential_id,
        ]);
        if (changed.changes !== 1) throw new PersistenceError("identity_stale");
        transaction.run(
          "DELETE FROM credential_vault_operations WHERE credential_id = ?",
          [intent.credential_id],
        );
        return {
          value: undefined,
          auditInput: vaultSystemAudit(
            intent,
            "credential.value.finalize",
            "applied",
          ),
        };
      }),
    });
  }

  private async finalizeDelete(intent: VaultIntent): Promise<void> {
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const now = transaction.timestamp();
        if (intent.operation === "archive") {
          transaction.run(
            "DELETE FROM credential_principal_assignments WHERE credential_id = ?",
            [intent.credential_id],
          );
        }
        const changed = transaction.run(`
          UPDATE service_credentials
          SET status = ?, vault_state = 'idle', vault_locator = NULL,
            vault_generation = NULL, last_four = NULL, value_updated_at = NULL,
            version = version + 1, updated_at = ?
          WHERE id = ? AND vault_state IN ('pending_delete', 'pending_archive', 'reconcile')
        `, [
          intent.operation === "archive" ? "archived" : "unconfigured",
          now,
          intent.credential_id,
        ]);
        if (changed.changes !== 1) throw new PersistenceError("identity_stale");
        transaction.run(
          "DELETE FROM credential_vault_operations WHERE credential_id = ?",
          [intent.credential_id],
        );
        return {
          value: undefined,
          auditInput: vaultSystemAudit(
            intent,
            intent.operation === "archive"
              ? "credential.archive.finalize"
              : "credential.value.delete.finalize",
            "applied",
          ),
        };
      }),
    });
  }

  private async rollback(intent: VaultIntent, category: string): Promise<void> {
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const now = transaction.timestamp();
        const changed = transaction.run(`
          UPDATE service_credentials
          SET status = ?, vault_state = 'idle', version = version + 1, updated_at = ?
          WHERE id = ? AND vault_state <> 'idle'
        `, [intent.prior_status, now, intent.credential_id]);
        if (changed.changes !== 1) throw new PersistenceError("identity_stale");
        transaction.run(`
          UPDATE credential_vault_operations
          SET result_category = ?, updated_at = ?
          WHERE credential_id = ?
        `, [category, now, intent.credential_id]);
        transaction.run(
          "DELETE FROM credential_vault_operations WHERE credential_id = ?",
          [intent.credential_id],
        );
        return {
          value: undefined,
          auditInput: vaultSystemAudit(
            intent,
            "credential.value.rollback",
            category,
          ),
        };
      }),
    });
  }

  private async markReconcile(intent: VaultIntent, category: string): Promise<void> {
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const now = transaction.timestamp();
        transaction.run(`
          UPDATE credential_vault_operations
          SET phase = 'reconcile', result_category = ?, updated_at = ?
          WHERE credential_id = ?
        `, [category, now, intent.credential_id]);
        transaction.run(`
          UPDATE service_credentials
          SET vault_state = 'reconcile', version = version + 1, updated_at = ?
          WHERE id = ? AND vault_state <> 'idle'
        `, [now, intent.credential_id]);
        return {
          value: undefined,
          auditInput: vaultSystemAudit(
            intent,
            "credential.value.reconcile",
            category,
          ),
        };
      }),
    }).catch(() => undefined);
  }

  private async tryReconcile(intent: VaultIntent): Promise<boolean> {
    try {
      const metadata = await this.vault.metadata(intent.locator, serviceBinding(intent));
      if (intent.operation === "create" || intent.operation === "replace") {
        if (metadata.generation === intent.target_generation) {
          await this.finalizeSet(intent, metadata);
          return true;
        }
        if (
          intent.operation === "replace" &&
          metadata.generation === intent.expected_generation
        ) {
          await this.rollback(intent, "vault_unchanged");
          return true;
        }
      } else if (metadata.generation === intent.expected_generation) {
        try {
          await this.vault.delete(
            intent.locator,
            intent.expected_generation!,
            serviceBinding(intent),
          );
          await this.finalizeDelete(intent);
          return true;
        } catch {
          // Preserve the intent for a later bounded reconciliation pass.
        }
      }
      await this.markReconcile(intent, "generation_unresolved");
      return false;
    } catch (error) {
      if (error instanceof VaultError && error.code === "vault_record_not_found") {
        if (intent.operation === "create") {
          await this.rollback(intent, "vault_absent");
        } else if (intent.operation === "replace") {
          await this.markReconcile(intent, "prior_record_absent");
          return false;
        } else {
          await this.finalizeDelete(intent);
        }
        return true;
      }
      await this.markReconcile(intent, "vault_unavailable");
      return false;
    }
  }

  private async privateState(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ): Promise<CredentialState> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          requireScopedService(query, actor, serviceId);
          return requiredState(query, serviceId, credentialId);
        }),
      });
    } catch (error) {
      throw mapCoordinatorError(error);
    }
  }
}

function validateOperationInput(input: {
  actor: ControlAuthenticationContext;
  serviceId: string;
  credentialId: string;
  expectedVersion: number;
  correlationId: string;
}): void {
  if (
    !isUuidV7(input.serviceId) ||
    !isUuidV7(input.credentialId) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(input.correlationId)
  ) throw new CredentialManagementError("invalid_request");
}

function requireScopedService(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
): void {
  if (actor.method !== "browser_session") throw new PersistenceError("identity_not_found");
  if (actor.role === "superadmin") {
    const active = query.get(`
      SELECT 1 FROM users WHERE id = ? AND role = 'superadmin' AND status = 'active'
    `, [actor.principalId]);
    if (active !== undefined) return;
  }
  if (actor.role === "admin") {
    const active = query.get(`
      SELECT 1 FROM service_admins sa
      JOIN users u ON u.id = sa.user_id
      JOIN services s ON s.id = sa.service_id
      WHERE sa.service_id = ? AND sa.user_id = ?
        AND u.role = 'admin' AND u.status = 'active'
        AND s.lifecycle <> 'archived'
    `, [serviceId, actor.principalId]);
    if (active !== undefined) return;
  }
  throw new PersistenceError("identity_not_found");
}

function requiredState(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  credentialId: string,
): CredentialState {
  const state = query.get<CredentialState>(`
    SELECT id, service_id, status, vault_state, vault_locator,
      vault_generation, authorization_generation, version
    FROM service_credentials WHERE service_id = ? AND id = ?
  `, [serviceId, credentialId]);
  if (state === undefined) throw new PersistenceError("identity_not_found");
  return state;
}

function optionalIntent(
  query: Pick<PersistenceQuery, "get">,
  credentialId: string,
): VaultIntent | undefined {
  return query.get<VaultIntent>(
    "SELECT * FROM credential_vault_operations WHERE credential_id = ?",
    [credentialId],
  );
}

function insertIntent(
  transaction: PersistenceTransaction,
  intent: VaultIntent,
  now: number,
): void {
  transaction.run(`
    INSERT INTO credential_vault_operations (
      credential_id, service_id, operation, locator,
      expected_generation, target_generation, prior_status,
      phase, result_category, started_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', NULL, ?, ?)
  `, [
    intent.credential_id,
    intent.service_id,
    intent.operation,
    intent.locator,
    intent.expected_generation,
    intent.target_generation,
    intent.prior_status,
    now,
    now,
  ]);
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  id: string,
  state: CredentialState,
  generation: number,
  reason: "enable" | "value_replace" | "value_delete" | "archive",
  now: number,
): void {
  transaction.run(`
    INSERT INTO credential_invalidation_events (
      id, service_id, credential_id, affected_user_id,
      authorization_generation, reason, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, 0)
  `, [id, state.service_id, state.id, generation, reason, now]);
}

function serviceBinding(input: {
  service_id?: string;
  serviceId?: string;
  credential_id?: string;
  id?: string;
}): VaultCredentialBinding {
  const serviceId = input.service_id ?? input.serviceId!;
  return {
    serviceId,
    destinationId: serviceId,
    credentialId: input.credential_id ?? input.id!,
  };
}

function vaultAudit(
  input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    correlationId: string;
  },
  action: string,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.actor.principalId,
      label: `user:${input.actor.principalId}`,
      role: input.actor.role,
      authenticationMethod: input.actor.method,
    },
    action,
    result: "allow",
    target: {
      type: "service_credential",
      id: input.credentialId,
      label: `credential:${input.credentialId}`,
    },
    serviceId: input.serviceId,
    changes,
    correlationId: input.correlationId,
    source: { category: "credential_management" },
  };
}

function vaultSystemAudit(
  intent: VaultIntent,
  action: string,
  outcome: string,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "system",
      label: "credential vault coordinator",
      authenticationMethod: "internal_vault_protocol",
    },
    action,
    result: "allow",
    target: {
      type: "service_credential",
      id: intent.credential_id,
      label: `credential:${intent.credential_id}`,
    },
    serviceId: intent.service_id,
    changes: [
      { field: "operation", after: intent.operation },
      { field: "outcome", after: outcome },
    ],
    correlationId: `req_${randomUUID()}`,
    source: { category: "credential_management" },
  };
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    .test(value);
}

function mapCoordinatorError(error: unknown): CredentialManagementError {
  if (error instanceof CredentialManagementError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found") {
      return new CredentialManagementError("not_found");
    }
    if (error.code === "identity_stale") return new CredentialManagementError("stale");
    if (error.code === "identity_conflict") return new CredentialManagementError("conflict");
    if (error.code === "idempotency_conflict") {
      return new CredentialManagementError("idempotency_conflict");
    }
  }
  return new CredentialManagementError("unavailable");
}
