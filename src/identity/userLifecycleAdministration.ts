import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type {
  IdempotencyExecutionInput,
  IdempotencyExecutionResult,
} from "../persistence/idempotency.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import type { ControlAuthenticationContext } from "../control/authentication.js";
import type { ControlIdempotencyHasher } from "../control/idempotency.js";
import { generateTemporaryPassword } from "./credentialLifecycle.js";
import type { IdentityRole, IdentityStatus } from "./contracts.js";
import { hashPassword, isSupportedPasswordHash } from "./password.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./stepUp.js";
import {
  denyUserRelationships,
  type UserAdministrationView,
  type UserRelationshipResolver,
} from "./userAdministration.js";
import { parseIdentityProfile } from "./validation.js";

export class UserLifecycleAdministrationError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "forbidden"
      | "not_found"
      | "stale"
      | "conflict"
      | "last_superadmin"
      | "idempotency_conflict"
      | "unavailable",
  ) {
    super("User lifecycle administration could not be completed.");
    this.name = "UserLifecycleAdministrationError";
  }
}

export interface OneTimeUserResult {
  user: UserAdministrationView;
  oneTimeValueDisplayed: boolean;
  temporaryPassword?: string;
  expiresAt?: number;
}

export type UserLifecycleTransition =
  | "suspend"
  | "reactivate"
  | "deactivate";

interface UserLifecycleRow extends UserAdministrationView {
  normalizedEmail: string;
  securityEpoch: number;
}

interface MutationContext {
  actor: ControlAuthenticationContext;
  targetUserId: string;
  expectedVersion: number;
  justification: string;
  correlationId: string;
  affectedServiceIds: readonly string[];
  stepUpProof?: AlwaysStepUpHandle;
}

export class UserLifecycleAdministrationRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly stepUps?: StepUpRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async user(userId: string): Promise<UserAdministrationView | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<UserLifecycleRow>(userSelect("WHERE u.id = ?"), [userId]);
        return row === undefined ? undefined : projectUser(row);
      }),
    });
  }

  async invite(input: {
    actor: ControlAuthenticationContext;
    userId: string;
    role: "admin" | "user";
    profile: ReturnType<typeof parseIdentityProfile>;
    encodedHash: string;
    expiresAt: number;
    correlationId: string;
    affectedServiceIds: readonly string[];
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<UserAdministrationView>> {
    if (
      !isUuidV7(input.userId) ||
      !isSupportedPasswordHash(input.encodedHash) ||
      !Number.isSafeInteger(input.expiresAt)
    ) throw new UserLifecycleAdministrationError("invalid_request");
    const audit = lifecycleAudit({
      actor: input.actor,
      action: "identity.invite",
      targetUserId: input.userId,
      correlationId: input.correlationId,
      affectedServiceIds: input.affectedServiceIds,
      changes: [
        { field: "role", after: input.role },
        { field: "status", after: "invited" },
        { field: "enrollment", after: "temporary_access_issued" },
      ],
    });
    try {
      return await this.owner.execute({
        run: (database) => database.withIdempotentAdministrativeAudit(
          input.idempotency,
          audit,
          (transaction) => {
            const actor = requiredActor(transaction, input.actor);
            requireInviteAuthority(actor, input.role, input.affectedServiceIds);
            const now = transaction.timestamp();
            if (input.expiresAt <= now) throw new PersistenceError("database_unavailable");
            if (transaction.get<{ id: string }>(
              "SELECT id FROM users WHERE normalized_email = ?",
              [input.profile.normalizedEmail],
            ) !== undefined) {
              throw new PersistenceError("identity_conflict");
            }
            transaction.run(`
              INSERT INTO users (
                id, email, normalized_email, given_name, family_name, role, status,
                security_epoch, password_policy_version, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'invited', 1, 1, 1, ?, ?)
            `, [
              input.userId,
              input.profile.email,
              input.profile.normalizedEmail,
              input.profile.givenName,
              input.profile.familyName,
              input.role,
              now,
              now,
            ]);
            transaction.run(`
              INSERT INTO local_authenticator_states (
                user_id, password_state, totp_state, version, created_at, updated_at
              ) VALUES (?, 'temporary', 'not_configured', 1, ?, ?)
            `, [input.userId, now, now]);
            transaction.run(`
              INSERT INTO identity_temporary_passwords (
                user_id, encoded_hash, purpose, issued_at, expires_at,
                consumed_at, revoked_at, version
              ) VALUES (?, ?, 'initial_enrollment', ?, ?, NULL, NULL, 1)
            `, [input.userId, input.encodedHash, now, input.expiresAt]);
            return {
              value: projectUser(requiredUser(transaction, input.userId)),
              resultReference: input.userId,
              responseStatus: 201,
            };
          },
        ),
      });
    } catch (error) {
      throw mapLifecycleError(error);
    }
  }

  async resetPassword(input: MutationContext & {
    encodedHash: string;
    expiresAt: number;
    eventId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<UserAdministrationView>> {
    if (!isSupportedPasswordHash(input.encodedHash)) {
      throw new UserLifecycleAdministrationError("invalid_request");
    }
    return this.idempotentMutation(
      input,
      "identity.password_reset",
      input.idempotency,
      (transaction, actor, target) => {
        requireLifecycleAuthority(actor, target, input.affectedServiceIds, false);
        requireActiveTarget(target);
        const now = transaction.timestamp();
        if (input.expiresAt <= now) throw new PersistenceError("database_unavailable");
        const counts = revokeSessions(transaction, target.id, now);
        transaction.run(`
          INSERT INTO identity_temporary_passwords (
            user_id, encoded_hash, purpose, issued_at, expires_at,
            consumed_at, revoked_at, version
          ) VALUES (?, ?, 'password_reset', ?, ?, NULL, NULL, 1)
          ON CONFLICT(user_id) DO UPDATE SET
            encoded_hash = excluded.encoded_hash,
            purpose = excluded.purpose,
            issued_at = excluded.issued_at,
            expires_at = excluded.expires_at,
            consumed_at = NULL,
            revoked_at = NULL,
            version = identity_temporary_passwords.version + 1
        `, [target.id, input.encodedHash, now, input.expiresAt]);
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'temporary', version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [now, target.id]);
        updateUserSecurity(transaction, target, target.status, target.role, now);
        insertInvalidation(transaction, input.eventId, target.id, "password_reset", counts, now);
        return projectUser(requiredUser(transaction, target.id));
      },
    );
  }

  async resetTotp(input: MutationContext & {
    eventId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<UserAdministrationView>> {
    return this.idempotentMutation(
      input,
      "identity.totp_reset",
      input.idempotency,
      (transaction, actor, target) => {
        requireLifecycleAuthority(actor, target, input.affectedServiceIds, false);
        requireActiveTarget(target);
        const now = transaction.timestamp();
        const counts = revokeSessions(transaction, target.id, now);
        transaction.run("DELETE FROM local_totp_authenticators WHERE user_id = ?", [target.id]);
        transaction.run("DELETE FROM identity_pending_totp WHERE user_id = ?", [target.id]);
        transaction.run(`
          UPDATE local_authenticator_states
          SET totp_state = 'not_configured', version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [now, target.id]);
        updateUserSecurity(transaction, target, target.status, target.role, now);
        insertInvalidation(transaction, input.eventId, target.id, "totp_reset", counts, now);
        return projectUser(requiredUser(transaction, target.id));
      },
    );
  }

  async transition(
    input: MutationContext & {
      transition: UserLifecycleTransition;
      eventId: string;
    },
  ): Promise<UserAdministrationView> {
    const nextStatus: IdentityStatus = input.transition === "reactivate"
      ? "active"
      : input.transition === "suspend"
        ? "suspended"
        : "deactivated";
    return this.auditedMutation(
      input,
      `identity.${input.transition}`,
      (transaction, actor, target) => {
        requireLifecycleAuthority(actor, target, input.affectedServiceIds, false);
        requireStatusTransition(target.status, nextStatus);
        requireNotLastActiveSuperadmin(transaction, target, target.role, nextStatus);
        const now = transaction.timestamp();
        const counts = revokeSessions(transaction, target.id, now);
        if (input.transition === "deactivate") {
          transaction.run("DELETE FROM local_password_credentials WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM local_totp_authenticators WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM identity_temporary_passwords WHERE user_id = ?", [target.id]);
          transaction.run("DELETE FROM identity_pending_totp WHERE user_id = ?", [target.id]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'disabled', totp_state = 'disabled',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, target.id]);
        }
        updateUserSecurity(transaction, target, nextStatus, target.role, now);
        insertInvalidation(
          transaction,
          input.eventId,
          target.id,
          input.transition === "suspend"
            ? "suspension"
            : input.transition === "reactivate"
              ? "reactivation"
              : "deactivation",
          counts,
          now,
        );
        return projectUser(requiredUser(transaction, target.id));
      },
      [{ field: "status", after: nextStatus }],
    );
  }

  async restoreEnrollment(input: MutationContext & {
    encodedHash: string;
    expiresAt: number;
    eventId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<UserAdministrationView>> {
    if (!isSupportedPasswordHash(input.encodedHash)) {
      throw new UserLifecycleAdministrationError("invalid_request");
    }
    return this.idempotentMutation(
      input,
      "identity.enrollment_restore",
      input.idempotency,
      (transaction, actor, target) => {
        requireLifecycleAuthority(actor, target, input.affectedServiceIds, false);
        if (target.status !== "deactivated") throw new PersistenceError("invalid_identity_transition");
        const now = transaction.timestamp();
        if (input.expiresAt <= now) throw new PersistenceError("database_unavailable");
        const counts = revokeSessions(transaction, target.id, now);
        transaction.run(`
          INSERT INTO identity_temporary_passwords (
            user_id, encoded_hash, purpose, issued_at, expires_at,
            consumed_at, revoked_at, version
          ) VALUES (?, ?, 'initial_enrollment', ?, ?, NULL, NULL, 1)
          ON CONFLICT(user_id) DO UPDATE SET
            encoded_hash = excluded.encoded_hash,
            purpose = excluded.purpose,
            issued_at = excluded.issued_at,
            expires_at = excluded.expires_at,
            consumed_at = NULL,
            revoked_at = NULL,
            version = identity_temporary_passwords.version + 1
        `, [target.id, input.encodedHash, now, input.expiresAt]);
        transaction.run(`
          UPDATE local_authenticator_states
          SET password_state = 'temporary', totp_state = 'not_configured',
              version = version + 1, updated_at = ?
          WHERE user_id = ?
        `, [now, target.id]);
        updateUserSecurity(transaction, target, "enrollment_required", target.role, now);
        insertInvalidation(
          transaction,
          input.eventId,
          target.id,
          "enrollment_restore",
          counts,
          now,
        );
        return projectUser(requiredUser(transaction, target.id));
      },
    );
  }

  async changeRole(input: MutationContext & {
    role: IdentityRole;
    eventId: string;
  }): Promise<UserAdministrationView> {
    return this.auditedMutation(
      input,
      "identity.role_change",
      (transaction, actor, target) => {
        if (actor.role !== "superadmin" || input.role === target.role) {
          throw new PersistenceError("identity_not_found");
        }
        requireNotLastActiveSuperadmin(transaction, target, input.role, target.status);
        const now = transaction.timestamp();
        const counts = revokeSessions(transaction, target.id, now);
        updateUserSecurity(transaction, target, target.status, input.role, now);
        insertInvalidation(transaction, input.eventId, target.id, "role_change", counts, now);
        return projectUser(requiredUser(transaction, target.id));
      },
      [{ field: "role", after: input.role }],
    );
  }

  private async idempotentMutation(
    input: MutationContext & { eventId: string },
    action: string,
    idempotency: IdempotencyExecutionInput,
    mutation: (
      transaction: PersistenceTransaction,
      actor: UserLifecycleRow,
      target: UserLifecycleRow,
    ) => UserAdministrationView,
  ): Promise<IdempotencyExecutionResult<UserAdministrationView>> {
    const audit = lifecycleAudit({
      actor: input.actor,
      action,
      targetUserId: input.targetUserId,
      correlationId: input.correlationId,
      justification: input.justification,
      affectedServiceIds: input.affectedServiceIds,
      changes: [{ field: "security_epoch", after: "incremented" }],
    });
    const execute = (transaction: PersistenceTransaction) =>
      transaction.idempotent(idempotency, () => {
        const { actor, target } = currentMutationRows(transaction, input);
        return {
          value: mutation(transaction, actor, target),
          resultReference: target.id,
          responseStatus: 200,
        };
      });
    try {
      if (input.stepUpProof !== undefined) {
        if (this.stepUps === undefined) throw new PersistenceError("authentication_failed");
        return await this.stepUps.withConsumedProof(input.stepUpProof, audit, execute);
      }
      return await this.owner.execute({
        run: (database) =>
          database.withIdempotentAdministrativeAudit(
            idempotency,
            audit,
            (transaction) => {
              const { actor, target } = currentMutationRows(transaction, input);
              return {
                value: mutation(transaction, actor, target),
                resultReference: target.id,
                responseStatus: 200,
              };
            },
          ),
      });
    } catch (error) {
      throw mapLifecycleError(error);
    }
  }

  private async auditedMutation(
    input: MutationContext & { eventId: string },
    action: string,
    mutation: (
      transaction: PersistenceTransaction,
      actor: UserLifecycleRow,
      target: UserLifecycleRow,
    ) => UserAdministrationView,
    changes: NonNullable<AdministrativeAuditEventInput["changes"]> = [],
  ): Promise<UserAdministrationView> {
    const audit = lifecycleAudit({
      actor: input.actor,
      action,
      targetUserId: input.targetUserId,
      correlationId: input.correlationId,
      justification: input.justification,
      affectedServiceIds: input.affectedServiceIds,
      changes,
    });
    const execute = (transaction: PersistenceTransaction) => {
      const { actor, target } = currentMutationRows(transaction, input);
      return mutation(transaction, actor, target);
    };
    try {
      if (input.stepUpProof !== undefined) {
        if (this.stepUps === undefined) throw new PersistenceError("authentication_failed");
        return await this.stepUps.withConsumedProof(input.stepUpProof, audit, execute);
      }
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => ({
          value: execute(transaction),
          auditInput: audit,
        })),
      });
    } catch (error) {
      throw mapLifecycleError(error);
    }
  }
}

export class UserLifecycleAdministrationService {
  constructor(
    private readonly repository: UserLifecycleAdministrationRepository,
    private readonly idempotency: ControlIdempotencyHasher,
    private readonly config: Pick<IdentityConfig, "password" | "temporaryPasswordTtlMs">,
    private readonly relationships: UserRelationshipResolver = denyUserRelationships,
    private readonly now: () => number = Date.now,
    private readonly uuid: () => string = defaultUuid(now),
  ) {}

  async invite(
    actor: ControlAuthenticationContext,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<OneTimeUserResult> {
    requireActor(actor);
    const parsed = parseInvitation(body);
    const affectedServiceIds = await this.relationships.relatedServiceIds(actor.principalId);
    const material = await this.temporaryMaterial();
    const userId = this.nextUuid();
    const result = await this.repository.invite({
      actor,
      userId,
      role: parsed.role,
      profile: parsed.profile,
      encodedHash: material.encodedHash,
      expiresAt: material.expiresAt,
      correlationId: requireCorrelationId(correlationId),
      affectedServiceIds,
      idempotency: this.idempotencyInput(
        actor,
        "users.invite",
        idempotencyKey,
        body,
      ),
    });
    const user = result.kind === "executed"
      ? result.value
      : await this.requiredUser(result.resultReference);
    return result.kind === "executed"
      ? {
          user,
          oneTimeValueDisplayed: true,
          temporaryPassword: material.temporaryPassword,
          expiresAt: material.expiresAt,
        }
      : { user, oneTimeValueDisplayed: false };
  }

  async resetPassword(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
  ): Promise<OneTimeUserResult> {
    const common = await this.commonMutation(
      actor,
      targetUserId,
      expectedVersion,
      body,
      correlationId,
      stepUpProof,
    );
    const material = await this.temporaryMaterial();
    const eventId = this.nextUuid();
    const idempotency = this.idempotencyInput(
      actor,
      "users.password_reset",
      idempotencyKey,
      {
        target_user_id: common.targetUserId,
        expected_version: common.expectedVersion,
        body,
      },
    );
    const result = await this.repository.resetPassword({
      ...common,
      encodedHash: material.encodedHash,
      expiresAt: material.expiresAt,
      eventId,
      idempotency,
    });
    const user = result.kind === "executed"
      ? result.value
      : await this.requiredUser(result.resultReference);
    return result.kind === "executed"
      ? {
          user,
          oneTimeValueDisplayed: true,
          temporaryPassword: material.temporaryPassword,
          expiresAt: material.expiresAt,
        }
      : { user, oneTimeValueDisplayed: false };
  }

  async resetTotp(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
  ): Promise<UserAdministrationView> {
    const common = await this.commonMutation(
      actor,
      targetUserId,
      expectedVersion,
      body,
      correlationId,
      stepUpProof,
    );
    const result = await this.repository.resetTotp({
      ...common,
      eventId: this.nextUuid(),
      idempotency: this.idempotencyInput(
        actor,
        "users.totp_reset",
        idempotencyKey,
        {
          target_user_id: common.targetUserId,
          expected_version: common.expectedVersion,
          body,
        },
      ),
    });
    return result.kind === "executed"
      ? result.value
      : this.requiredUser(result.resultReference);
  }

  async transition(
    transition: UserLifecycleTransition,
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
  ): Promise<UserAdministrationView> {
    const common = await this.commonMutation(
      actor,
      targetUserId,
      expectedVersion,
      body,
      correlationId,
      stepUpProof,
    );
    return this.repository.transition({
      ...common,
      transition,
      eventId: this.nextUuid(),
    });
  }

  async restoreEnrollment(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
  ): Promise<OneTimeUserResult> {
    const common = await this.commonMutation(
      actor,
      targetUserId,
      expectedVersion,
      body,
      correlationId,
      stepUpProof,
    );
    const material = await this.temporaryMaterial();
    const result = await this.repository.restoreEnrollment({
      ...common,
      encodedHash: material.encodedHash,
      expiresAt: material.expiresAt,
      eventId: this.nextUuid(),
      idempotency: this.idempotencyInput(
        actor,
        "users.enrollment_restore",
        idempotencyKey,
        {
          target_user_id: common.targetUserId,
          expected_version: common.expectedVersion,
          body,
        },
      ),
    });
    const user = result.kind === "executed"
      ? result.value
      : await this.requiredUser(result.resultReference);
    return result.kind === "executed"
      ? {
          user,
          oneTimeValueDisplayed: true,
          temporaryPassword: material.temporaryPassword,
          expiresAt: material.expiresAt,
        }
      : { user, oneTimeValueDisplayed: false };
  }

  async changeRole(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
  ): Promise<UserAdministrationView> {
    const common = await this.commonMutation(
      actor,
      targetUserId,
      expectedVersion,
      body,
      correlationId,
      stepUpProof,
      ["role"],
    );
    const role = parseRoleChange(body);
    return this.repository.changeRole({
      ...common,
      role,
      eventId: this.nextUuid(),
    });
  }

  private async commonMutation(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    body: unknown,
    correlationId: string,
    stepUpProof?: AlwaysStepUpHandle,
    extraBodyKeys: readonly string[] = [],
  ): Promise<MutationContext> {
    requireActor(actor);
    const id = requireUserId(targetUserId);
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      throw new UserLifecycleAdministrationError("invalid_request");
    }
    const justification = parseJustification(body, extraBodyKeys);
    const affectedServiceIds = await this.relationships.relatedServiceIds(
      actor.principalId,
      id,
    );
    return {
      actor,
      targetUserId: id,
      expectedVersion: Number(expectedVersion),
      justification,
      correlationId: requireCorrelationId(correlationId),
      affectedServiceIds: [...new Set(affectedServiceIds)].sort(),
      ...(stepUpProof === undefined ? {} : { stepUpProof }),
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
      throw new UserLifecycleAdministrationError("invalid_request");
    }
  }

  private async temporaryMaterial(): Promise<{
    temporaryPassword: string;
    encodedHash: string;
    expiresAt: number;
  }> {
    const temporaryPassword = generateTemporaryPassword(this.config.password.minimumLength);
    const bytes = Buffer.from(temporaryPassword, "utf8");
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(bytes);
    } catch {
      throw new UserLifecycleAdministrationError("unavailable");
    } finally {
      bytes.fill(0);
    }
    const expiresAt = safeNow(this.now) + this.config.temporaryPasswordTtlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new UserLifecycleAdministrationError("unavailable");
    }
    return { temporaryPassword, encodedHash, expiresAt };
  }

  private async requiredUser(userId: string): Promise<UserAdministrationView> {
    const user = await this.repository.user(userId);
    if (user === undefined) throw new UserLifecycleAdministrationError("not_found");
    return user;
  }

  private nextUuid(): string {
    const id = this.uuid();
    if (!isUuidV7(id)) throw new UserLifecycleAdministrationError("unavailable");
    return id;
  }
}

function currentMutationRows(
  transaction: PersistenceTransaction,
  input: MutationContext,
): { actor: UserLifecycleRow; target: UserLifecycleRow } {
  const actor = requiredActor(transaction, input.actor);
  const target = requiredUser(transaction, input.targetUserId);
  if (target.version !== input.expectedVersion) throw new PersistenceError("identity_stale");
  return { actor, target };
}

function requiredActor(
  transaction: PersistenceTransaction,
  actor: ControlAuthenticationContext,
): UserLifecycleRow {
  const current = requiredUser(transaction, actor.principalId);
  if (
    actor.method !== "browser_session" ||
    current.role !== actor.role ||
    current.status !== "active"
  ) throw new PersistenceError("identity_not_found");
  return current;
}

function requiredUser(
  transaction: PersistenceTransaction,
  userId: string,
): UserLifecycleRow {
  const row = transaction.get<UserLifecycleRow>(userSelect("WHERE u.id = ?"), [userId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requireInviteAuthority(
  actor: UserLifecycleRow,
  invitedRole: "admin" | "user",
  affectedServiceIds: readonly string[],
): void {
  if (actor.role === "superadmin") return;
  if (
    actor.role === "admin" &&
    invitedRole === "user" &&
    affectedServiceIds.length > 0
  ) return;
  throw new PersistenceError("identity_not_found");
}

function requireLifecycleAuthority(
  actor: UserLifecycleRow,
  target: UserLifecycleRow,
  affectedServiceIds: readonly string[],
  allowSelf: boolean,
): void {
  if (allowSelf && actor.id === target.id) return;
  if (actor.role === "superadmin") return;
  if (
    actor.role === "admin" &&
    actor.id !== target.id &&
    target.role === "user" &&
    affectedServiceIds.length > 0
  ) return;
  throw new PersistenceError("identity_not_found");
}

function requireActiveTarget(target: UserLifecycleRow): void {
  if (target.status !== "active") throw new PersistenceError("invalid_identity_transition");
}

function requireStatusTransition(current: IdentityStatus, next: IdentityStatus): void {
  const allowed =
    (current === "active" && (next === "suspended" || next === "deactivated")) ||
    (current === "suspended" && (next === "active" || next === "deactivated"));
  if (!allowed) throw new PersistenceError("invalid_identity_transition");
}

function requireNotLastActiveSuperadmin(
  transaction: PersistenceTransaction,
  target: UserLifecycleRow,
  nextRole: IdentityRole,
  nextStatus: IdentityStatus,
): void {
  if (
    target.role !== "superadmin" ||
    target.status !== "active" ||
    (nextRole === "superadmin" && nextStatus === "active")
  ) return;
  const count = transaction.get<{ count: number }>(`
    SELECT count(*) AS count FROM users
    WHERE role = 'superadmin' AND status = 'active'
  `)?.count;
  if (count === undefined || count <= 1) {
    throw new PersistenceError("last_active_superadmin");
  }
}

function revokeSessions(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): { browser: number; restricted: number } {
  const browser = Number(transaction.run(`
    UPDATE browser_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  const restricted = Number(transaction.run(`
    UPDATE identity_restricted_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  return { browser, restricted };
}

function updateUserSecurity(
  transaction: PersistenceTransaction,
  target: UserLifecycleRow,
  status: IdentityStatus,
  role: IdentityRole,
  now: number,
): void {
  const updated = transaction.run(`
    UPDATE users
    SET status = ?, role = ?, security_epoch = security_epoch + 1,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `, [status, role, now, target.id, target.version]);
  if (updated.changes !== 1) throw new PersistenceError("identity_stale");
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  eventId: string,
  userId: string,
  reason: string,
  counts: { browser: number; restricted: number },
  now: number,
): void {
  if (!isUuidV7(eventId)) throw new PersistenceError("database_unavailable");
  transaction.run(`
    INSERT INTO identity_invalidation_events (
      id, user_id, reason, browser_sessions_revoked,
      restricted_sessions_revoked, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
  `, [eventId, userId, reason, counts.browser, counts.restricted, now]);
}

function userSelect(suffix: string): string {
  return `
    SELECT
      u.id, u.email, u.normalized_email AS normalizedEmail,
      u.given_name AS givenName, u.family_name AS familyName,
      u.role, u.status, u.security_epoch AS securityEpoch,
      a.password_state AS passwordState, a.totp_state AS totpState,
      u.version, u.created_at AS createdAt, u.updated_at AS updatedAt
    FROM users u
    JOIN local_authenticator_states a ON a.user_id = u.id
    ${suffix}
  `;
}

function projectUser(row: UserLifecycleRow): UserAdministrationView {
  return {
    id: row.id,
    email: row.email,
    givenName: row.givenName,
    familyName: row.familyName,
    role: row.role,
    status: row.status,
    passwordState: row.passwordState,
    totpState: row.totpState,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function lifecycleAudit(input: {
  actor: ControlAuthenticationContext;
  action: string;
  targetUserId: string;
  correlationId: string;
  justification?: string;
  affectedServiceIds: readonly string[];
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>;
}): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.actor.principalId,
      label: `user:${input.actor.principalId}`,
      role: input.actor.role,
      authenticationMethod: "browser_session",
    },
    action: input.action,
    result: "allow",
    target: {
      type: "user",
      id: input.targetUserId,
      label: `user:${input.targetUserId}`,
    },
    ...(input.justification === undefined ? {} : { justification: input.justification }),
    changes: [
      ...input.changes,
      ...input.affectedServiceIds.map((serviceId) => ({
        field: "affected_service",
        after: serviceId,
      })),
    ],
    correlationId: input.correlationId,
    source: { category: "identity" },
  };
}

function parseInvitation(value: unknown): {
  role: "admin" | "user";
  profile: ReturnType<typeof parseIdentityProfile>;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UserLifecycleAdministrationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) =>
      !["email", "given_name", "family_name", "role"].includes(key)
    ) ||
    !["admin", "user"].includes(String(input.role))
  ) throw new UserLifecycleAdministrationError("invalid_request");
  try {
    return {
      role: input.role as "admin" | "user",
      profile: parseIdentityProfile({
        email: input.email,
        givenName: input.given_name,
        familyName: input.family_name,
      }),
    };
  } catch {
    throw new UserLifecycleAdministrationError("invalid_request");
  }
}

function parseJustification(
  value: unknown,
  extraKeys: readonly string[] = [],
): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UserLifecycleAdministrationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => key !== "justification" && !extraKeys.includes(key)) ||
    typeof input.justification !== "string"
  ) throw new UserLifecycleAdministrationError("invalid_request");
  const justification = input.justification.normalize("NFKC").trim();
  if (
    [...justification].length < 1 ||
    [...justification].length > 1_024 ||
    Buffer.byteLength(justification, "utf8") > 4_096
  ) throw new UserLifecycleAdministrationError("invalid_request");
  return justification;
}

function parseRoleChange(value: unknown): IdentityRole {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UserLifecycleAdministrationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !["role", "justification"].includes(key)) ||
    !["superadmin", "admin", "user"].includes(String(input.role))
  ) throw new UserLifecycleAdministrationError("invalid_request");
  return input.role as IdentityRole;
}

function requireActor(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session" ||
    !isUuidV7(actor.principalId) ||
    !["superadmin", "admin", "user"].includes(actor.role)
  ) throw new UserLifecycleAdministrationError("forbidden");
}

function requireUserId(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) {
    throw new UserLifecycleAdministrationError("not_found");
  }
  return value;
}

function requireCorrelationId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  ) throw new UserLifecycleAdministrationError("invalid_request");
  return value;
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new UserLifecycleAdministrationError("unavailable");
  }
  return value;
}

function defaultUuid(now: () => number): () => string {
  const generator = new UuidV7Generator({ now });
  return () => generator.next();
}

function mapLifecycleError(error: unknown): UserLifecycleAdministrationError {
  if (error instanceof UserLifecycleAdministrationError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found") {
      return new UserLifecycleAdministrationError("not_found");
    }
    if (error.code === "identity_stale") {
      return new UserLifecycleAdministrationError("stale");
    }
    if (error.code === "identity_conflict") {
      return new UserLifecycleAdministrationError("conflict");
    }
    if (error.code === "last_active_superadmin") {
      return new UserLifecycleAdministrationError("last_superadmin");
    }
    if (error.code === "idempotency_conflict") {
      return new UserLifecycleAdministrationError("idempotency_conflict");
    }
    if (
      error.code === "invalid_identity_transition" ||
      error.code === "authentication_failed"
    ) return new UserLifecycleAdministrationError("forbidden");
  }
  return new UserLifecycleAdministrationError("unavailable");
}
