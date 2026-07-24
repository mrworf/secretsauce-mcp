import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./identity/stepUp.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import type {
  IdempotencyExecutionInput,
  IdempotencyExecutionResult,
} from "./persistence/idempotency.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceQuery, PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";

export type GlobalSecurityEventKind = "password_change" | "totp_reset";

export interface GlobalSecurityEvent {
  id: string;
  kind: GlobalSecurityEventKind;
  actorUserId: string;
  actorRole: "superadmin";
  justification: string;
  affectedUsers: number;
  resultingGlobalEpoch: number;
  resultingPasswordPolicyVersion: number;
  createdAt: number;
}

export class GlobalSecurityEventError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "stale" | "unavailable",
  ) {
    super("Global security event could not be completed.");
    this.name = "GlobalSecurityEventError";
  }
}

export class GlobalSecurityEvents {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly stepUps: Pick<StepUpRepository, "withConsumedProof">,
    now: () => number = Date.now,
    uuid?: () => string,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#uuid = uuid ?? (() => generator.next());
  }

  async stateVersion(): Promise<number> {
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{ version: number }>(
          "SELECT version FROM identity_security_state WHERE singleton = 1",
        );
        if (row === undefined) throw new PersistenceError("database_unavailable");
        return row.version;
      }),
    });
  }

  async list(limit = 100): Promise<GlobalSecurityEvent[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new GlobalSecurityEventError("invalid");
    }
    return this.owner.execute({
      run: (database) => database.read((query) => query.all<{
        id: string;
        kind: GlobalSecurityEventKind;
        actor_user_id: string;
        actor_role: "superadmin";
        justification: string;
        affected_users: number;
        resulting_global_epoch: number;
        resulting_password_policy_version: number;
        created_at: number;
      }>(`
        SELECT * FROM security_global_events
        ORDER BY created_at DESC, id DESC LIMIT ?
      `, [limit]).map((row) => ({
        id: row.id,
        kind: row.kind,
        actorUserId: row.actor_user_id,
        actorRole: row.actor_role,
        justification: row.justification,
        affectedUsers: row.affected_users,
        resultingGlobalEpoch: row.resulting_global_epoch,
        resultingPasswordPolicyVersion: row.resulting_password_policy_version,
        createdAt: row.created_at,
      }))),
    });
  }

  async execute(input: {
    kind: GlobalSecurityEventKind;
    actor: ControlAuthenticationContext;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    proof: AlwaysStepUpHandle;
    idempotency: IdempotencyExecutionInput;
  }): Promise<{ event: GlobalSecurityEvent; replayed: boolean }> {
    validate(input);
    const eventId = this.nextUuid();
    const audit: AdministrativeAuditEventInput = {
      actor: {
        type: "browser_session",
        id: input.actor.principalId,
        label: `user:${input.actor.principalId}`,
        role: "superadmin",
        authenticationMethod: "browser_session",
      },
      action: `security.global_${input.kind}`,
      result: "allow",
      target: { type: "security_event", id: eventId, label: input.kind },
      justification: input.justification,
      changes: [{ field: "global_security_epoch", after: "incremented" }],
      correlationId: input.correlationId,
      source: { category: "security" },
    };
    try {
      const result = await this.stepUps.withConsumedProof(
        input.proof,
        audit,
        (transaction) => transaction.idempotent(input.idempotency, () => ({
          value: executeEvent(transaction, input, eventId, this.#uuid),
          resultReference: eventId,
          responseStatus: 200,
        })),
      ) as IdempotencyExecutionResult<GlobalSecurityEvent>;
      const event = result.kind === "executed"
        ? result.value
        : await this.required(result.resultReference);
      return { event, replayed: result.kind === "replayed" };
    } catch (error) {
      if (error instanceof GlobalSecurityEventError) throw error;
      if (error instanceof PersistenceError) {
        if (error.code === "identity_stale") {
          throw new GlobalSecurityEventError("stale");
        }
        if (error.code === "authentication_failed") {
          throw new GlobalSecurityEventError("forbidden");
        }
      }
      throw new GlobalSecurityEventError("unavailable");
    }
  }

  private async required(id: string): Promise<GlobalSecurityEvent> {
    const event = await this.owner.execute({
      run: (database) => database.read((query) => readEvent(query, id)),
    });
    if (event === undefined) throw new GlobalSecurityEventError("unavailable");
    return event;
  }

  private nextUuid(): string {
    const value = this.#uuid();
    if (!isUuidV7(value)) throw new GlobalSecurityEventError("unavailable");
    return value;
  }
}

function executeEvent(
  transaction: PersistenceTransaction,
  input: {
    kind: GlobalSecurityEventKind;
    actor: ControlAuthenticationContext;
    expectedVersion: number;
    justification: string;
  },
  eventId: string,
  uuid: () => string,
): GlobalSecurityEvent {
  const actor = transaction.get<{
    role: string;
    status: string;
  }>("SELECT role, status FROM users WHERE id = ?", [input.actor.principalId]);
  if (
    input.actor.method !== "browser_session"
    || input.actor.role !== "superadmin"
    || actor?.role !== "superadmin"
    || actor.status !== "active"
  ) throw new PersistenceError("authentication_failed");
  const state = transaction.get<{
    global_security_epoch: number;
    password_policy_version: number;
    password_change_epoch: number;
    version: number;
  }>("SELECT * FROM identity_security_state WHERE singleton = 1");
  if (state === undefined) throw new PersistenceError("database_unavailable");
  if (state.version !== input.expectedVersion) {
    throw new PersistenceError("identity_stale");
  }
  const now = transaction.timestamp();
  const affected = input.kind === "password_change"
    ? transaction.get<{ count: number }>(
        "SELECT count(*) AS count FROM local_password_credentials",
      )?.count ?? 0
    : transaction.get<{ count: number }>(
        "SELECT count(*) AS count FROM local_totp_authenticators",
      )?.count ?? 0;
  const updated = transaction.run(`
    UPDATE identity_security_state
    SET global_security_epoch = global_security_epoch + 1,
        password_change_epoch = password_change_epoch + ?,
        version = version + 1, updated_at = ?
    WHERE singleton = 1 AND version = ?
  `, [input.kind === "password_change" ? 1 : 0, now, state.version]);
  if (updated.changes !== 1) throw new PersistenceError("identity_stale");
  transaction.run(`
    UPDATE browser_sessions SET revoked_at = ?, version = version + 1
    WHERE revoked_at IS NULL
  `, [now]);
  transaction.run(`
    UPDATE identity_restricted_sessions
    SET revoked_at = ?, version = version + 1
    WHERE revoked_at IS NULL
  `, [now]);
  if (input.kind === "totp_reset") {
    transaction.run("DELETE FROM local_totp_authenticators");
    transaction.run("DELETE FROM identity_pending_totp");
    transaction.run("DELETE FROM accepted_totp_steps");
    transaction.run(`
      UPDATE local_authenticator_states
      SET totp_state = CASE
            WHEN password_state = 'disabled' THEN 'disabled'
            ELSE 'not_configured'
          END,
          version = version + 1, updated_at = ?
      WHERE totp_state <> 'disabled'
    `, [now]);
  }
  transaction.run(`
    UPDATE runtime_activation
    SET global_reference_epoch = global_reference_epoch + 1,
        version = version + 1, updated_at = ?
    WHERE singleton = 1
  `, [now]);
  for (const row of transaction.all<{ id: string }>(
    "SELECT id FROM users ORDER BY id",
  )) {
    const invalidationId = uuid();
    if (!isUuidV7(invalidationId)) throw new PersistenceError("database_unavailable");
    transaction.run(`
      INSERT INTO identity_invalidation_events (
        id, user_id, reason, browser_sessions_revoked,
        restricted_sessions_revoked, created_at, dispatched_at, attempts
      ) VALUES (?, ?, ?, 0, 0, ?, NULL, 0)
    `, [invalidationId, row.id, input.kind, now]);
  }
  const resultingGlobalEpoch = state.global_security_epoch + 1;
  transaction.run(`
    INSERT INTO security_global_events (
      id, kind, actor_user_id, actor_role, justification,
      affected_users, resulting_global_epoch,
      resulting_password_policy_version, created_at
    ) VALUES (?, ?, ?, 'superadmin', ?, ?, ?, ?, ?)
  `, [
    eventId,
    input.kind,
    input.actor.principalId,
    input.justification,
    affected,
    resultingGlobalEpoch,
    state.password_policy_version,
    now,
  ]);
  return {
    id: eventId,
    kind: input.kind,
    actorUserId: input.actor.principalId,
    actorRole: "superadmin",
    justification: input.justification,
    affectedUsers: affected,
    resultingGlobalEpoch,
    resultingPasswordPolicyVersion: state.password_policy_version,
    createdAt: now,
  };
}

function readEvent(
  query: PersistenceQuery,
  id: string,
): GlobalSecurityEvent | undefined {
  const row = query.get<{
    id: string;
    kind: GlobalSecurityEventKind;
    actor_user_id: string;
    actor_role: "superadmin";
    justification: string;
    affected_users: number;
    resulting_global_epoch: number;
    resulting_password_policy_version: number;
    created_at: number;
  }>("SELECT * FROM security_global_events WHERE id = ?", [id]);
  return row === undefined ? undefined : {
    id: row.id,
    kind: row.kind,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    justification: row.justification,
    affectedUsers: row.affected_users,
    resultingGlobalEpoch: row.resulting_global_epoch,
    resultingPasswordPolicyVersion: row.resulting_password_policy_version,
    createdAt: row.created_at,
  };
}

function validate(input: {
  kind: GlobalSecurityEventKind;
  actor: ControlAuthenticationContext;
  expectedVersion: number;
  justification: string;
  correlationId: string;
}): void {
  if (
    !["password_change", "totp_reset"].includes(input.kind)
    || input.actor.method !== "browser_session"
    || input.actor.role !== "superadmin"
    || !Number.isInteger(input.expectedVersion)
    || input.expectedVersion < 1
    || input.justification.trim() !== input.justification
    || input.justification.length < 1
    || input.justification.length > 1_024
    || /[\r\n\0]/.test(input.justification)
    || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.correlationId)
  ) throw new GlobalSecurityEventError("invalid");
}
