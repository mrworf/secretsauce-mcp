import type { ControlAuthenticationContext } from "./control/authentication.js";
import {
  administrativeActorSnapshot,
  requireServiceApiKeyAuthority,
} from "./apiKeyAuthority.js";
import type { ControlIdempotencyHasher } from "./control/idempotency.js";
import {
  CredentialPlacementError,
  normalizeCredentialPlacement,
  type CredentialPlacement,
} from "./credentialPlacement.js";
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

const MAX_CREDENTIALS_PER_SERVICE = 1_000;
const MAX_CREDENTIALS_TOTAL = 5_000;
const MAX_SELECTORS = 1_000;

export type CredentialStatus =
  | "configured"
  | "unconfigured"
  | "disabled"
  | "archived";

export interface CredentialView {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  placement: CredentialPlacement;
  selector?: NormalizedPrincipalSelector;
  status: CredentialStatus;
  lastFour?: string;
  valueUpdatedAt?: number;
  authorizationGeneration: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PrivateCredentialView extends CredentialView {
  vaultState:
    | "idle"
    | "pending_create"
    | "pending_replace"
    | "pending_delete"
    | "pending_archive"
    | "reconcile";
  vaultLocator?: string;
  vaultGeneration?: number;
}

export interface CredentialCopyDocument {
  format_version: 1;
  credential: {
    name: string;
    description?: string;
    placement: {
      kind: "header" | "query" | "body";
      name: string;
      prefix?: string;
      suffix?: string;
      enforce_header_ownership: boolean;
    };
    selector:
      | { kind: "all" }
      | {
          kind: "principals";
          group_ids: string[];
          user_ids: string[];
          direct_assignment_confirmed: boolean;
        };
  };
}

interface CredentialRow {
  id: string;
  service_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  usage_kind: "header" | "query" | "body";
  usage_name: string;
  usage_prefix: string | null;
  usage_suffix: string | null;
  enforce_header_ownership: 0 | 1;
  status: CredentialStatus;
  vault_state: PrivateCredentialView["vaultState"];
  vault_locator: string | null;
  vault_generation: number | null;
  last_four: string | null;
  value_updated_at: number | null;
  authorization_generation: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export class CredentialManagementError extends Error {
  constructor(readonly code:
    | "invalid_request"
    | "not_found"
    | "stale"
    | "conflict"
    | "idempotency_conflict"
    | "unavailable") {
    super("Credential management could not be completed.");
    this.name = "CredentialManagementError";
  }
}

export class CredentialManagementRepository {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
    uuid: () => string = defaultUuid(now),
  ) {
    this.#uuid = uuid;
  }

  async credentials(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<CredentialView[]> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return query.all<CredentialRow>(`
        SELECT * FROM service_credentials
        WHERE service_id = ?
        ORDER BY normalized_name, id
        LIMIT ?
      `, [serviceId, MAX_CREDENTIALS_PER_SERVICE]).map((row) =>
        projectCredential(query, row)
      );
    });
  }

  async credential(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ): Promise<CredentialView> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return projectCredential(query, requiredCredential(query, serviceId, credentialId));
    });
  }

  async privateCredential(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ): Promise<PrivateCredentialView> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return projectPrivateCredential(
        query,
        requiredCredential(query, serviceId, credentialId),
      );
    });
  }

  async create(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    profile: CredentialProfile;
    placement: CredentialPlacement;
    selector: NormalizedPrincipalSelector;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        requireCredentialCapacity(transaction, input.serviceId);
        validateSelectorTargets(transaction, input.serviceId, input.selector);
        const now = transaction.timestamp();
        insertCredential(
          transaction,
          input.credentialId,
          input.serviceId,
          input.profile,
          input.placement,
          now,
        );
        replaceSelectorRows(
          transaction,
          this.#uuid,
          input.actor.principalId,
          input.serviceId,
          input.credentialId,
          input.selector,
          now,
        );
        return {
          value: input.credentialId,
          resultReference: input.credentialId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: credentialAudit(
          input.actor,
          "credential.create",
          input.serviceId,
          result.kind === "executed" ? result.value : result.resultReference,
          input.correlationId,
          [
            { field: "status", after: "unconfigured" },
            { field: "selector_kind", after: input.selector.kind },
            { field: "placement_kind", after: input.placement.kind },
          ],
        ),
      };
    });
  }

  async update(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    profile: CredentialProfile;
    placement: CredentialPlacement;
    correlationId: string;
  }): Promise<CredentialView> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredCredential(
        transaction,
        input.serviceId,
        input.credentialId,
      );
      requireMutable(current);
      const updated = transaction.optimisticUpdate(
        "service_credentials",
        current.id,
        input.expectedVersion,
        {
          name: input.profile.name,
          normalized_name: input.profile.normalizedName,
          description: input.profile.description ?? null,
          usage_kind: input.placement.kind,
          usage_name: input.placement.name,
          usage_prefix: input.placement.prefix ?? null,
          usage_suffix: input.placement.suffix ?? null,
          enforce_header_ownership: input.placement.enforceHeaderOwnership ? 1 : 0,
        },
      );
      if (updated.status !== "updated") throw new PersistenceError("identity_stale");
      return {
        value: projectCredential(
          transaction,
          requiredCredential(transaction, input.serviceId, input.credentialId),
        ),
        auditInput: credentialAudit(
          input.actor,
          "credential.update",
          input.serviceId,
          input.credentialId,
          input.correlationId,
          [
            { field: "profile", after: "updated" },
            { field: "placement_kind", after: input.placement.kind },
            {
              field: "header_ownership",
              after: input.placement.enforceHeaderOwnership,
            },
          ],
        ),
      };
    });
  }

  async replaceAssignments(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    selector: NormalizedPrincipalSelector;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredCredential(
        transaction,
        input.serviceId,
        input.credentialId,
      );
      requireMutable(current);
      const result = transaction.idempotent(input.idempotency, () => {
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        validateSelectorTargets(transaction, input.serviceId, input.selector);
        const before = effectiveCredentialUsers(
          transaction,
          input.serviceId,
          input.credentialId,
        );
        const now = transaction.timestamp();
        replaceSelectorRows(
          transaction,
          this.#uuid,
          input.actor.principalId,
          input.serviceId,
          input.credentialId,
          input.selector,
          now,
        );
        const after = effectiveCredentialUsers(
          transaction,
          input.serviceId,
          input.credentialId,
        );
        invalidateCredential(
          transaction,
          this.#uuid,
          current,
          symmetricDifference(before, after),
          "selector",
        );
        return {
          value: current.id,
          resultReference: current.id,
          responseStatus: 200,
        };
      });
      return {
        value: result,
        auditInput: credentialAudit(
          input.actor,
          "credential.assignments.replace",
          input.serviceId,
          input.credentialId,
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

  async disable(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredCredential(
        transaction,
        input.serviceId,
        input.credentialId,
      );
      const result = transaction.idempotent(input.idempotency, () => {
        if (
          current.status !== "configured" ||
          current.vault_state !== "idle"
        ) throw new PersistenceError("identity_conflict");
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        invalidateCredential(transaction, this.#uuid, current, [], "disable", {
          status: "disabled",
        });
        return {
          value: current.id,
          resultReference: current.id,
          responseStatus: 200,
        };
      });
      return {
        value: result,
        auditInput: {
          ...credentialAudit(
            input.actor,
            "credential.disable",
            input.serviceId,
            input.credentialId,
            input.correlationId,
            [{ field: "status", before: "configured", after: "disabled" }],
          ),
          justification: input.justification,
        },
      };
    });
  }

  async archiveUnconfigured(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredCredential(
        transaction,
        input.serviceId,
        input.credentialId,
      );
      const result = transaction.idempotent(input.idempotency, () => {
        if (
          current.status !== "unconfigured" ||
          current.vault_state !== "idle"
        ) throw new PersistenceError("identity_conflict");
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        const affected = effectiveCredentialUsers(
          transaction,
          input.serviceId,
          input.credentialId,
        );
        transaction.run(
          "DELETE FROM credential_principal_assignments WHERE credential_id = ?",
          [current.id],
        );
        invalidateCredential(
          transaction,
          this.#uuid,
          current,
          affected,
          "archive",
          { status: "archived" },
        );
        return {
          value: current.id,
          resultReference: current.id,
          responseStatus: 200,
        };
      });
      return {
        value: result,
        auditInput: {
          ...credentialAudit(
            input.actor,
            "credential.archive",
            input.serviceId,
            input.credentialId,
            input.correlationId,
            [{ field: "status", before: "unconfigured", after: "archived" }],
          ),
          justification: input.justification,
        },
      };
    });
  }

  async deleteArchived(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    credentialId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        const current = requiredCredential(
          transaction,
          input.serviceId,
          input.credentialId,
        );
        if (
          current.status !== "archived" ||
          current.vault_state !== "idle"
        ) throw new PersistenceError("identity_conflict");
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        const now = transaction.timestamp();
        const generation = current.authorization_generation + 1;
        insertInvalidation(
          transaction,
          this.#uuid(),
          current.service_id,
          current.id,
          null,
          generation,
          "delete",
          now,
        );
        const deleted = transaction.run(
          "DELETE FROM service_credentials WHERE service_id = ? AND id = ? AND version = ?",
          [input.serviceId, input.credentialId, input.expectedVersion],
        );
        if (deleted.changes !== 1) throw new PersistenceError("identity_stale");
        return {
          value: input.credentialId,
          resultReference: input.credentialId,
          responseStatus: 200,
        };
      });
      return {
        value: result,
        auditInput: {
          ...credentialAudit(
            input.actor,
            "credential.delete",
            input.serviceId,
            input.credentialId,
            input.correlationId,
            [{ field: "status", before: "archived", after: "deleted" }],
          ),
          justification: input.justification,
        },
      };
    });
  }

  async clone(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    sourceCredentialId: string;
    credentialId: string;
    name: string;
    normalizedName: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const source = requiredCredential(
        transaction,
        input.serviceId,
        input.sourceCredentialId,
      );
      requireMutable(source);
      const result = transaction.idempotent(input.idempotency, () => {
        requireCredentialCapacity(transaction, input.serviceId);
        const now = transaction.timestamp();
        insertCredential(
          transaction,
          input.credentialId,
          input.serviceId,
          {
            name: input.name,
            normalizedName: input.normalizedName,
            ...(source.description === null ? {} : { description: source.description }),
          },
          placementOf(source),
          now,
        );
        replaceSelectorRows(
          transaction,
          this.#uuid,
          input.actor.principalId,
          input.serviceId,
          input.credentialId,
          requiredSelector(transaction, source.id),
          now,
        );
        return {
          value: input.credentialId,
          resultReference: input.credentialId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: credentialAudit(
          input.actor,
          "credential.clone",
          input.serviceId,
          result.kind === "executed" ? result.value : result.resultReference,
          input.correlationId,
          [
            { field: "source_credential_id", after: source.id },
            { field: "status", after: "unconfigured" },
          ],
        ),
      };
    });
  }

  async copy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ): Promise<CredentialCopyDocument> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      const credential = projectCredential(
        query,
        requiredCredential(query, serviceId, credentialId),
      );
      return copyDocument(credential);
    });
  }

  async authorizes(
    userId: string,
    serviceId: string,
    credentialIds: readonly string[],
  ): Promise<boolean> {
    if (
      !isUuidV7(userId) ||
      !isUuidV7(serviceId) ||
      credentialIds.length < 1 ||
      credentialIds.length > 1_000 ||
      credentialIds.some((id) => !isUuidV7(id)) ||
      new Set(credentialIds).size !== credentialIds.length
    ) return false;
    return this.read((query) => {
      if (!serviceAuthorizes(query, serviceId, userId)) return false;
      return credentialIds.every((credentialId) => {
        const row = query.get<CredentialRow>(`
          SELECT * FROM service_credentials
          WHERE service_id = ? AND id = ?
            AND status = 'configured' AND vault_state = 'idle'
        `, [serviceId, credentialId]);
        return row !== undefined &&
          credentialSelectorAuthorizes(query, serviceId, credentialId, userId);
      });
    }).catch(() => false);
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

export class CredentialManagementService {
  readonly #uuid: () => string;

  constructor(
    private readonly repository: CredentialManagementRepository,
    private readonly idempotency: ControlIdempotencyHasher,
    now: () => number = Date.now,
  ) {
    this.#uuid = defaultUuid(now);
  }

  credentials(actor: ControlAuthenticationContext, serviceId: string) {
    return this.repository.credentials(actor, requiredUuid(serviceId));
  }

  credential(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ) {
    return this.repository.credential(
      actor,
      requiredUuid(serviceId),
      requiredUuid(credentialId),
    );
  }

  async create(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ credential: CredentialView; replayed: boolean }> {
    const input = credentialBody(body, true);
    const normalizedServiceId = requiredUuid(serviceId);
    const credentialId = this.#uuid();
    const result = await this.repository.create({
      actor,
      serviceId: normalizedServiceId,
      credentialId,
      profile: input.profile,
      placement: input.placement,
      selector: input.selector,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "credentials.create",
        idempotencyKey,
        { serviceId: normalizedServiceId, input },
      ),
    });
    const id = result.kind === "executed" ? result.value : result.resultReference;
    return {
      credential: await this.repository.credential(actor, normalizedServiceId, id),
      replayed: result.kind === "replayed",
    };
  }

  update(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    correlationId: string,
  ) {
    const input = credentialBody(body, false);
    return this.repository.update({
      actor,
      serviceId: requiredUuid(serviceId),
      credentialId: requiredUuid(credentialId),
      expectedVersion: requiredVersion(expectedVersion),
      profile: input.profile,
      placement: input.placement,
      correlationId: requiredCorrelation(correlationId),
    });
  }

  async replaceAssignments(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedCredentialId = requiredUuid(credentialId);
    const selector = normalizeSelector(body);
    const result = await this.repository.replaceAssignments({
      actor,
      serviceId: normalizedServiceId,
      credentialId: normalizedCredentialId,
      expectedVersion: requiredVersion(expectedVersion),
      selector,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "credentials.assignments.replace",
        idempotencyKey,
        { serviceId: normalizedServiceId, credentialId: normalizedCredentialId, selector },
      ),
    });
    return {
      credential: await this.repository.credential(
        actor,
        normalizedServiceId,
        normalizedCredentialId,
      ),
      replayed: result.kind === "replayed",
    };
  }

  async disable(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.lifecycle(
      "disable",
      actor,
      serviceId,
      credentialId,
      expectedVersion,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  async archiveUnconfigured(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.lifecycle(
      "archive",
      actor,
      serviceId,
      credentialId,
      expectedVersion,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  async deleteArchived(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedCredentialId = requiredUuid(credentialId);
    const justification = justificationBody(body);
    const result = await this.repository.deleteArchived({
      actor,
      serviceId: normalizedServiceId,
      credentialId: normalizedCredentialId,
      expectedVersion: requiredVersion(expectedVersion),
      justification,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "credentials.delete",
        idempotencyKey,
        {
          serviceId: normalizedServiceId,
          credentialId: normalizedCredentialId,
          justification,
        },
      ),
    });
    return {
      credentialId: normalizedCredentialId,
      deleted: true as const,
      replayed: result.kind === "replayed",
    };
  }

  async clone(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const profile = cloneBody(body);
    const normalizedServiceId = requiredUuid(serviceId);
    const sourceCredentialId = requiredUuid(credentialId);
    const id = this.#uuid();
    const result = await this.repository.clone({
      actor,
      serviceId: normalizedServiceId,
      sourceCredentialId,
      credentialId: id,
      name: profile.name,
      normalizedName: profile.normalizedName,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "credentials.clone",
        idempotencyKey,
        { serviceId: normalizedServiceId, sourceCredentialId, name: profile.name },
      ),
    });
    const resultId = result.kind === "executed" ? result.value : result.resultReference;
    return {
      credential: await this.repository.credential(actor, normalizedServiceId, resultId),
      replayed: result.kind === "replayed",
    };
  }

  copy(
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
  ) {
    return this.repository.copy(
      actor,
      requiredUuid(serviceId),
      requiredUuid(credentialId),
    );
  }

  async import(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const document = copyBody(body);
    return this.create(
      actor,
      serviceId,
      document.credential,
      idempotencyKey,
      correlationId,
    );
  }

  authorizes(userId: string, serviceId: string, credentialIds: readonly string[]) {
    return this.repository.authorizes(userId, serviceId, credentialIds);
  }

  private async lifecycle(
    action: "disable" | "archive",
    actor: ControlAuthenticationContext,
    serviceId: string,
    credentialId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedCredentialId = requiredUuid(credentialId);
    const justification = justificationBody(body);
    const input = {
      actor,
      serviceId: normalizedServiceId,
      credentialId: normalizedCredentialId,
      expectedVersion: requiredVersion(expectedVersion),
      justification,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        `credentials.${action}`,
        idempotencyKey,
        {
          serviceId: normalizedServiceId,
          credentialId: normalizedCredentialId,
          justification,
        },
      ),
    };
    const result = action === "disable"
      ? await this.repository.disable(input)
      : await this.repository.archiveUnconfigured(input);
    return {
      credential: await this.repository.credential(
        actor,
        normalizedServiceId,
        normalizedCredentialId,
      ),
      replayed: result.kind === "replayed",
    };
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
      throw new CredentialManagementError("invalid_request");
    }
  }
}

interface CredentialProfile {
  name: string;
  normalizedName: string;
  description?: string;
}

function requireScopedService(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
  mutable: boolean,
): { id: string; lifecycle: string } {
  if (!isUuidV7(serviceId)) {
    throw new PersistenceError("identity_not_found");
  }
  const service = query.get<{ id: string; lifecycle: string }>(
    "SELECT id, lifecycle FROM services WHERE id = ?",
    [serviceId],
  );
  if (service === undefined || (mutable && service.lifecycle === "archived")) {
    throw new PersistenceError("identity_not_found");
  }
  if (requireServiceApiKeyAuthority(query, actor, serviceId)) return service;
  if (actor.method !== "browser_session") {
    throw new PersistenceError("identity_not_found");
  }
  if (actor.role === "superadmin") {
    const live = query.get<{ role: string; status: string }>(
      "SELECT role, status FROM users WHERE id = ?",
      [actor.principalId],
    );
    if (live?.role === "superadmin" && live.status === "active") return service;
  }
  if (actor.role === "admin") {
    const live = query.get(`
      SELECT 1 FROM service_admins sa
      JOIN users u ON u.id = sa.user_id
      WHERE sa.service_id = ? AND sa.user_id = ?
        AND u.role = 'admin' AND u.status = 'active'
    `, [serviceId, actor.principalId]);
    if (live !== undefined) return service;
  }
  throw new PersistenceError("identity_not_found");
}

function requiredCredential(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  credentialId: string,
): CredentialRow {
  if (!isUuidV7(credentialId)) throw new PersistenceError("identity_not_found");
  const row = query.get<CredentialRow>(
    "SELECT * FROM service_credentials WHERE service_id = ? AND id = ?",
    [serviceId, credentialId],
  );
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requireMutable(row: CredentialRow): void {
  if (row.status === "archived" || row.vault_state !== "idle") {
    throw new PersistenceError("identity_conflict");
  }
}

function projectCredential(
  query: Pick<PersistenceQuery, "all">,
  row: CredentialRow,
): CredentialView {
  const selector = selectorView(query, row.id);
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    placement: placementOf(row),
    ...(selector === undefined ? {} : { selector }),
    status: row.status,
    ...(row.last_four === null ? {} : { lastFour: row.last_four }),
    ...(row.value_updated_at === null ? {} : { valueUpdatedAt: row.value_updated_at }),
    authorizationGeneration: row.authorization_generation,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectPrivateCredential(
  query: Pick<PersistenceQuery, "all">,
  row: CredentialRow,
): PrivateCredentialView {
  return {
    ...projectCredential(query, row),
    vaultState: row.vault_state,
    ...(row.vault_locator === null ? {} : { vaultLocator: row.vault_locator }),
    ...(row.vault_generation === null ? {} : { vaultGeneration: row.vault_generation }),
  };
}

function placementOf(row: CredentialRow): CredentialPlacement {
  return {
    kind: row.usage_kind,
    name: row.usage_name,
    ...(row.usage_prefix === null ? {} : { prefix: row.usage_prefix }),
    ...(row.usage_suffix === null ? {} : { suffix: row.usage_suffix }),
    enforceHeaderOwnership: row.enforce_header_ownership === 1,
  };
}

function selectorView(
  query: Pick<PersistenceQuery, "all">,
  credentialId: string,
): NormalizedPrincipalSelector | undefined {
  const rows = query.all<{
    selector_kind: "all" | "group" | "user";
    target_id: string | null;
  }>(`
    SELECT selector_kind, coalesce(group_id, user_id) AS target_id
    FROM credential_principal_assignments
    WHERE credential_id = ?
    ORDER BY selector_kind, target_id
  `, [credentialId]);
  if (rows.some(({ selector_kind }) => selector_kind === "all")) {
    return { kind: "all", groupIds: [], userIds: [] };
  }
  const groupIds = rows.filter(({ selector_kind }) => selector_kind === "group")
    .map(({ target_id }) => target_id!);
  const userIds = rows.filter(({ selector_kind }) => selector_kind === "user")
    .map(({ target_id }) => target_id!);
  if (groupIds.length + userIds.length === 0) return undefined;
  return { kind: "explicit", groupIds, userIds };
}

function requiredSelector(
  query: Pick<PersistenceQuery, "all">,
  credentialId: string,
): NormalizedPrincipalSelector {
  const selector = selectorView(query, credentialId);
  if (selector === undefined) throw new PersistenceError("database_unavailable");
  return selector;
}

function insertCredential(
  transaction: PersistenceTransaction,
  credentialId: string,
  serviceId: string,
  profile: CredentialProfile,
  placement: CredentialPlacement,
  now: number,
): void {
  transaction.run(`
    INSERT INTO service_credentials (
      id, service_id, name, normalized_name, description,
      usage_kind, usage_name, usage_prefix, usage_suffix,
      enforce_header_ownership, status, vault_state, vault_locator,
      vault_generation, last_four, value_updated_at,
      authorization_generation, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unconfigured', 'idle',
      NULL, NULL, NULL, NULL, 0, 1, ?, ?)
  `, [
    credentialId,
    serviceId,
    profile.name,
    profile.normalizedName,
    profile.description ?? null,
    placement.kind,
    placement.name,
    placement.prefix ?? null,
    placement.suffix ?? null,
    placement.enforceHeaderOwnership ? 1 : 0,
    now,
    now,
  ]);
}

function replaceSelectorRows(
  transaction: PersistenceTransaction,
  uuid: () => string,
  actorId: string,
  serviceId: string,
  credentialId: string,
  selector: NormalizedPrincipalSelector,
  now: number,
): void {
  transaction.run(
    "DELETE FROM credential_principal_assignments WHERE credential_id = ?",
    [credentialId],
  );
  if (selector.kind === "all") {
    insertSelectorRow(
      transaction,
      uuid(),
      serviceId,
      credentialId,
      "all",
      undefined,
      actorId,
      now,
    );
    return;
  }
  for (const groupId of selector.groupIds) {
    insertSelectorRow(
      transaction,
      uuid(),
      serviceId,
      credentialId,
      "group",
      groupId,
      actorId,
      now,
    );
  }
  for (const userId of selector.userIds) {
    insertSelectorRow(
      transaction,
      uuid(),
      serviceId,
      credentialId,
      "user",
      userId,
      actorId,
      now,
    );
  }
}

function insertSelectorRow(
  transaction: PersistenceTransaction,
  id: string,
  serviceId: string,
  credentialId: string,
  kind: "all" | "group" | "user",
  targetId: string | undefined,
  actorId: string,
  now: number,
): void {
  transaction.run(`
    INSERT INTO credential_principal_assignments (
      id, service_id, credential_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    serviceId,
    credentialId,
    kind,
    kind === "group" ? targetId! : null,
    kind === "user" ? targetId! : null,
    actorId,
    now,
  ]);
}

function validateSelectorTargets(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  selector: NormalizedPrincipalSelector,
): void {
  if (
    selector.groupIds.length + selector.userIds.length > MAX_SELECTORS
  ) throw new PersistenceError("identity_conflict");
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

function requireCredentialCapacity(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
): void {
  const total = query.get<{ count: number }>(
    "SELECT count(*) AS count FROM service_credentials",
  )?.count ?? MAX_CREDENTIALS_TOTAL;
  const service = query.get<{ count: number }>(
    "SELECT count(*) AS count FROM service_credentials WHERE service_id = ?",
    [serviceId],
  )?.count ?? MAX_CREDENTIALS_PER_SERVICE;
  if (total >= MAX_CREDENTIALS_TOTAL || service >= MAX_CREDENTIALS_PER_SERVICE) {
    throw new PersistenceError("identity_conflict");
  }
}

function invalidateCredential(
  transaction: PersistenceTransaction,
  uuid: () => string,
  current: CredentialRow,
  affectedUserIds: readonly string[],
  reason:
    | "selector"
    | "disable"
    | "enable"
    | "value_replace"
    | "value_delete"
    | "archive",
  fields: Record<string, string | number | null> = {},
): number {
  const now = transaction.timestamp();
  const generation = current.authorization_generation + 1;
  const updated = transaction.get<{ version: number }>(`
    UPDATE service_credentials
    SET authorization_generation = ?, version = version + 1, updated_at = ?,
      ${Object.keys(fields).length === 0
        ? "status = status"
        : Object.keys(fields).map((field) => `${field} = ?`).join(", ")}
    WHERE id = ? AND version = ?
    RETURNING version
  `, [
    generation,
    now,
    ...Object.values(fields),
    current.id,
    current.version,
  ]);
  if (updated === undefined) throw new PersistenceError("identity_stale");
  insertInvalidation(
    transaction,
    uuid(),
    current.service_id,
    current.id,
    null,
    generation,
    reason,
    now,
  );
  for (const userId of [...new Set(affectedUserIds)].sort()) {
    insertInvalidation(
      transaction,
      uuid(),
      current.service_id,
      current.id,
      userId,
      generation,
      reason,
      now,
    );
  }
  return generation;
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  id: string,
  serviceId: string,
  credentialId: string,
  affectedUserId: string | null,
  generation: number,
  reason: string,
  now: number,
): void {
  transaction.run(`
    INSERT INTO credential_invalidation_events (
      id, service_id, credential_id, affected_user_id,
      authorization_generation, reason, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)
  `, [
    id,
    serviceId,
    credentialId,
    affectedUserId,
    generation,
    reason,
    now,
  ]);
}

function effectiveCredentialUsers(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
  credentialId: string,
): string[] {
  return query.all<{ id: string }>(`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.role = 'user' AND u.status = 'active'
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
      AND (
        EXISTS (
          SELECT 1 FROM credential_principal_assignments a
          WHERE a.credential_id = ? AND a.selector_kind = 'all'
        )
        OR EXISTS (
          SELECT 1 FROM credential_principal_assignments d
          WHERE d.credential_id = ? AND d.selector_kind = 'user'
            AND d.user_id = u.id
        )
        OR EXISTS (
          SELECT 1 FROM credential_principal_assignments s
          JOIN service_groups g
            ON g.service_id = s.service_id AND g.id = s.group_id
          JOIN service_group_members gm
            ON gm.service_id = g.service_id AND gm.group_id = g.id
          WHERE s.credential_id = ? AND s.selector_kind = 'group'
            AND g.lifecycle = 'active' AND gm.user_id = u.id
        )
      )
    ORDER BY u.id
  `, [
    serviceId,
    serviceId,
    serviceId,
    credentialId,
    credentialId,
    credentialId,
  ]).map(({ id }) => id);
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

function credentialSelectorAuthorizes(
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

function copyDocument(credential: CredentialView): CredentialCopyDocument {
  if (credential.selector === undefined) {
    throw new PersistenceError("identity_conflict");
  }
  return {
    format_version: 1,
    credential: {
      name: credential.name,
      ...(credential.description === undefined
        ? {}
        : { description: credential.description }),
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
      selector: credential.selector.kind === "all"
        ? { kind: "all" }
        : {
            kind: "principals",
            group_ids: [...credential.selector.groupIds],
            user_ids: [...credential.selector.userIds],
            direct_assignment_confirmed: credential.selector.userIds.length > 0,
          },
    },
  };
}

function credentialBody(
  value: unknown,
  withSelector: boolean,
): {
  profile: CredentialProfile;
  placement: CredentialPlacement;
  selector: NormalizedPrincipalSelector;
} {
  if (!plainObject(value)) throw new CredentialManagementError("invalid_request");
  const allowed = new Set([
    "name",
    "description",
    "placement",
    ...(withSelector ? ["selector"] : []),
  ]);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    !Object.hasOwn(value, "name") ||
    !Object.hasOwn(value, "placement")
  ) throw new CredentialManagementError("invalid_request");
  const profile = normalizeProfile(value.name, value.description);
  let placement: CredentialPlacement;
  try {
    placement = normalizeCredentialPlacement(value.placement);
  } catch (error) {
    if (error instanceof CredentialPlacementError) {
      throw new CredentialManagementError("invalid_request");
    }
    throw error;
  }
  const selector = withSelector
    ? normalizeSelector(value.selector)
    : { kind: "all" as const, groupIds: [] as const, userIds: [] as const };
  return { profile, placement, selector };
}

function cloneBody(value: unknown): CredentialProfile {
  if (
    !plainObject(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "name")
  ) throw new CredentialManagementError("invalid_request");
  return normalizeProfile(value.name, undefined);
}

function copyBody(value: unknown): CredentialCopyDocument {
  if (
    !plainObject(value) ||
    Object.keys(value).length !== 2 ||
    value.format_version !== 1 ||
    !Object.hasOwn(value, "credential") ||
    !plainObject(value.credential)
  ) throw new CredentialManagementError("invalid_request");
  const input = credentialBody(value.credential, true);
  return {
    format_version: 1,
    credential: {
      name: input.profile.name,
      ...(input.profile.description === undefined
        ? {}
        : { description: input.profile.description }),
      placement: {
        kind: input.placement.kind,
        name: input.placement.name,
        ...(input.placement.prefix === undefined
          ? {}
          : { prefix: input.placement.prefix }),
        ...(input.placement.suffix === undefined
          ? {}
          : { suffix: input.placement.suffix }),
        enforce_header_ownership: input.placement.enforceHeaderOwnership,
      },
      selector: input.selector.kind === "all"
        ? { kind: "all" }
        : {
            kind: "principals",
            group_ids: [...input.selector.groupIds],
            user_ids: [...input.selector.userIds],
            direct_assignment_confirmed: input.selector.userIds.length > 0,
          },
    },
  };
}

function normalizeSelector(value: unknown): NormalizedPrincipalSelector {
  try {
    return normalizePrincipalSelector(value);
  } catch (error) {
    if (error instanceof PrincipalSelectorError) {
      throw new CredentialManagementError("invalid_request");
    }
    throw error;
  }
}

function normalizeProfile(nameValue: unknown, descriptionValue: unknown): CredentialProfile {
  if (typeof nameValue !== "string") {
    throw new CredentialManagementError("invalid_request");
  }
  const name = nameValue.normalize("NFKC").trim();
  const normalizedName = name.toLocaleLowerCase("und");
  if (
    name.length < 1 ||
    name.length > 120 ||
    normalizedName.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) throw new CredentialManagementError("invalid_request");
  if (descriptionValue === undefined) return { name, normalizedName };
  if (typeof descriptionValue !== "string") {
    throw new CredentialManagementError("invalid_request");
  }
  const description = descriptionValue.normalize("NFKC").trim();
  if (
    description.length < 1 ||
    description.length > 1_024 ||
    description.includes("\0")
  ) throw new CredentialManagementError("invalid_request");
  return { name, normalizedName, description };
}

function justificationBody(value: unknown): string {
  if (
    !plainObject(value) ||
    Object.keys(value).length !== 1 ||
    typeof value.justification !== "string"
  ) throw new CredentialManagementError("invalid_request");
  const justification = value.justification.trim();
  if (
    justification.length < 1 ||
    justification.length > 1_024 ||
    justification.includes("\0")
  ) throw new CredentialManagementError("invalid_request");
  return justification;
}

function credentialAudit(
  actor: ControlAuthenticationContext,
  action: string,
  serviceId: string,
  credentialId: string,
  correlationId: string,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: administrativeActorSnapshot(actor),
    action,
    result: "allow",
    target: {
      type: "service_credential",
      id: credentialId,
      label: `credential:${credentialId}`,
    },
    serviceId,
    changes,
    correlationId,
    source: { category: "credential_management" },
  };
}

function mapError(error: unknown): CredentialManagementError {
  if (error instanceof CredentialManagementError) return error;
  if (error instanceof PersistenceError) {
    if (
      error.code === "identity_not_found" ||
      error.code === "authentication_failed"
    ) return new CredentialManagementError("not_found");
    if (error.code === "identity_stale") {
      return new CredentialManagementError("stale");
    }
    if (error.code === "identity_conflict") {
      return new CredentialManagementError("conflict");
    }
    if (error.code === "idempotency_conflict") {
      return new CredentialManagementError("idempotency_conflict");
    }
    if (error.code === "database_unavailable") {
      return new CredentialManagementError("conflict");
    }
  }
  return new CredentialManagementError("unavailable");
}

function defaultUuid(now: () => number): () => string {
  const generator = new UuidV7Generator({ now });
  return () => generator.next();
}

function requiredUuid(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) {
    throw new CredentialManagementError("invalid_request");
  }
  return value;
}

function requiredVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new CredentialManagementError("invalid_request");
  }
  return value as number;
}

function requiredCorrelation(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  ) throw new CredentialManagementError("invalid_request");
  return value;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function symmetricDifference(left: readonly string[], right: readonly string[]): string[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [
    ...left.filter((value) => !rightSet.has(value)),
    ...right.filter((value) => !leftSet.has(value)),
  ].sort();
}
