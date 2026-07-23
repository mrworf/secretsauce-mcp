import { z } from "zod";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import {
  IDENTITY_ROLES,
  IDENTITY_STATUSES,
  type IdentityProfile,
  type IdentityReadModel,
  type IdentityRole,
  type IdentityStatus,
  type LocalAuthenticatorStateReadModel,
  type ProviderIdentity,
  type ProviderLinkReadModel,
} from "./contracts.js";
import { IdentityError } from "./errors.js";
import { requireIdentityStatusTransition } from "./lifecycle.js";
import { removeActiveSuperadminError } from "./repositoryLifecycle.js";
import { parseIdentityProfile, parseProviderIdentity } from "./validation.js";

const uuidSchema = z.string().refine(isUuidV7);
const expectedVersionSchema = z.number().int().positive();
const roleSchema = z.enum(IDENTITY_ROLES);
const statusSchema = z.enum(IDENTITY_STATUSES);

export interface IdentityAuditContext {
  actor: AdministrativeAuditEventInput["actor"];
  correlationId: string;
  source?: AdministrativeAuditEventInput["source"];
  justification?: string;
}

export interface IdentityRepositoryOptions {
  now?: () => number;
  uuid?: () => string;
}

interface UserRow {
  id: string;
  email: string;
  normalized_email: string;
  given_name: string;
  family_name: string;
  role: IdentityRole;
  status: IdentityStatus;
  security_epoch: number;
  password_policy_version: number;
  version: number;
  created_at: number;
  updated_at: number;
}

interface AuthenticatorRow {
  user_id: string;
  password_state: LocalAuthenticatorStateReadModel["passwordState"];
  totp_state: LocalAuthenticatorStateReadModel["totpState"];
  version: number;
  created_at: number;
  updated_at: number;
}

interface ProviderRow {
  id: string;
  user_id: string;
  provider_id: string;
  issuer: string;
  subject: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export class IdentityRepository {
  readonly #owner: PersistenceOwner;
  readonly #now: () => number;
  readonly #uuid: () => string;

  constructor(owner: PersistenceOwner, options: IdentityRepositoryOptions = {}) {
    this.#owner = owner;
    this.#now = options.now ?? Date.now;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  async createLocalIdentity(
    input: {
      profile: unknown;
      role: IdentityRole;
      status: IdentityStatus;
    },
    audit: IdentityAuditContext,
  ): Promise<IdentityReadModel> {
    const profile = parseIdentityProfile(input.profile);
    const role = parseRole(input.role);
    const status = parseStatus(input.status);
    const id = this.nextUuid();
    const now = this.safeNow();
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireEmailAvailable(transaction, profile.normalizedEmail);
          transaction.run(`
            INSERT INTO users (
              id, email, normalized_email, given_name, family_name, role, status,
              security_epoch, password_policy_version, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, ?)
          `, [
            id,
            profile.email,
            profile.normalizedEmail,
            profile.givenName,
            profile.familyName,
            role,
            status,
            now,
            now,
          ]);
          transaction.run(`
            INSERT INTO local_authenticator_states (
              user_id, password_state, totp_state, version, created_at, updated_at
            ) VALUES (?, 'not_configured', 'not_configured', 1, ?, ?)
          `, [id, now, now]);
          return {
            value: requiredUser(transaction, id),
            auditInput: identityAudit(audit, {
              action: "identity.create",
              targetId: id,
              changes: [
                { field: "role", after: role },
                { field: "status", after: status },
              ],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async bootstrapInitialSuperadmin(
    profileInput: unknown,
    audit: IdentityAuditContext,
  ): Promise<IdentityReadModel> {
    const profile = parseIdentityProfile(profileInput);
    if (
      audit.actor.type !== "local_cli" ||
      audit.actor.authenticationMethod !== "host_terminal" ||
      audit.source?.category !== "break_glass"
    ) {
      throw new IdentityError("bootstrap_unavailable");
    }
    const id = this.nextUuid();
    const now = this.safeNow();
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const users = transaction.get<{ count: number }>(
            "SELECT count(*) AS count FROM users",
          )?.count;
          const marker = transaction.get<{ present: number }>(
            "SELECT 1 AS present FROM identity_bootstrap WHERE singleton = 1",
          );
          if (users !== 0 || marker !== undefined) {
            throw new PersistenceError("bootstrap_unavailable");
          }
          transaction.run(`
            INSERT INTO users (
              id, email, normalized_email, given_name, family_name, role, status,
              security_epoch, password_policy_version, version, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, 'superadmin', 'enrollment_required', 1, 1, 1, ?, ?
            )
          `, [
            id,
            profile.email,
            profile.normalizedEmail,
            profile.givenName,
            profile.familyName,
            now,
            now,
          ]);
          transaction.run(`
            INSERT INTO local_authenticator_states (
              user_id, password_state, totp_state, version, created_at, updated_at
            ) VALUES (?, 'not_configured', 'not_configured', 1, ?, ?)
          `, [id, now, now]);
          transaction.run(`
            INSERT INTO identity_bootstrap (singleton, user_id, created_at)
            VALUES (1, ?, ?)
          `, [id, now]);
          return {
            value: requiredUser(transaction, id),
            auditInput: identityAudit(audit, {
              action: "identity.bootstrap",
              targetId: id,
              changes: [
                { field: "role", after: "superadmin" },
                { field: "status", after: "enrollment_required" },
                { field: "enrollment", after: "pending" },
              ],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async identity(userId: string): Promise<IdentityReadModel | undefined> {
    const id = parseUuid(userId);
    return this.#owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<UserRow>(userSelect("WHERE id = ?"), [id]);
        return row === undefined ? undefined : userReadModel(row);
      }),
    });
  }

  async localAuthenticatorState(userId: string): Promise<LocalAuthenticatorStateReadModel | undefined> {
    const id = parseUuid(userId);
    return this.#owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<AuthenticatorRow>(`
          SELECT user_id, password_state, totp_state, version, created_at, updated_at
          FROM local_authenticator_states
          WHERE user_id = ?
        `, [id]);
        return row === undefined ? undefined : authenticatorReadModel(row);
      }),
    });
  }

  async updateProfile(
    userId: string,
    expectedVersion: number,
    input: unknown,
    audit: IdentityAuditContext,
  ): Promise<IdentityReadModel> {
    const id = parseUuid(userId);
    const version = parseExpectedVersion(expectedVersion);
    const profile = parseIdentityProfile(input);
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredUserRow(transaction, id);
          if (current.version !== version) throw new PersistenceError("identity_stale");
          requireEmailAvailable(transaction, profile.normalizedEmail, id);
          const updatedAt = transaction.timestamp();
          const result = transaction.run(`
            UPDATE users
            SET email = ?, normalized_email = ?, given_name = ?, family_name = ?,
                security_epoch = security_epoch + 1,
                version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?
          `, [
            profile.email,
            profile.normalizedEmail,
            profile.givenName,
            profile.familyName,
            updatedAt,
            id,
            version,
          ]);
          if (result.changes !== 1) throw new PersistenceError("identity_stale");
          return {
            value: requiredUser(transaction, id),
            auditInput: identityAudit(audit, {
              action: "identity.profile_update",
              targetId: id,
              changes: [{ field: "profile", before: "previous", after: "updated" }],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async changeRole(
    userId: string,
    expectedVersion: number,
    nextRoleInput: IdentityRole,
    audit: IdentityAuditContext,
  ): Promise<IdentityReadModel> {
    const id = parseUuid(userId);
    const version = parseExpectedVersion(expectedVersion);
    const nextRole = parseRole(nextRoleInput);
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredUserRow(transaction, id);
          if (current.version !== version) throw new PersistenceError("identity_stale");
          if (current.role === nextRole) throw new PersistenceError("invalid_identity_transition");
          removeActiveSuperadminError(transaction, current, nextRole, current.status);
          updateRoleOrStatus(transaction, current, nextRole, current.status);
          return {
            value: requiredUser(transaction, id),
            auditInput: identityAudit(audit, {
              action: "identity.role_change",
              targetId: id,
              changes: [{ field: "role", before: current.role, after: nextRole }],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async changeStatus(
    userId: string,
    expectedVersion: number,
    nextStatusInput: IdentityStatus,
    audit: IdentityAuditContext,
  ): Promise<IdentityReadModel> {
    const id = parseUuid(userId);
    const version = parseExpectedVersion(expectedVersion);
    const nextStatus = parseStatus(nextStatusInput);
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredUserRow(transaction, id);
          if (current.version !== version) throw new PersistenceError("identity_stale");
          try {
            requireIdentityStatusTransition(current.status, nextStatus);
          } catch {
            throw new PersistenceError("invalid_identity_transition");
          }
          removeActiveSuperadminError(transaction, current, current.role, nextStatus);
          updateRoleOrStatus(transaction, current, current.role, nextStatus);
          return {
            value: requiredUser(transaction, id),
            auditInput: identityAudit(audit, {
              action: "identity.status_change",
              targetId: id,
              changes: [{ field: "status", before: current.status, after: nextStatus }],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async linkProvider(
    userId: string,
    input: unknown,
    audit: IdentityAuditContext,
  ): Promise<ProviderLinkReadModel> {
    const id = parseUuid(userId);
    const provider = parseProviderIdentity(input);
    const linkId = this.nextUuid();
    const now = this.safeNow();
    try {
      return await this.#owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requiredUserRow(transaction, id);
          const duplicate = transaction.get<{ id: string }>(`
            SELECT id FROM external_identities
            WHERE provider_id = ? AND issuer = ? AND subject = ?
          `, [provider.providerId, provider.issuer, provider.subject]);
          if (duplicate !== undefined) throw new PersistenceError("identity_conflict");
          transaction.run(`
            INSERT INTO external_identities (
              id, user_id, provider_id, issuer, subject, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          `, [
            linkId,
            id,
            provider.providerId,
            provider.issuer,
            provider.subject,
            now,
            now,
          ]);
          return {
            value: requiredProviderLink(transaction, linkId),
            auditInput: identityAudit(audit, {
              action: "identity.provider_link",
              targetId: id,
              changes: [{ field: "provider_id", after: provider.providerId }],
            }),
          };
        }),
      });
    } catch (error) {
      throw mapIdentityPersistenceError(error);
    }
  }

  async findByProvider(input: unknown): Promise<IdentityReadModel | undefined> {
    const provider = parseProviderIdentity(input);
    return this.#owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<UserRow>(`
          ${userSelect("JOIN external_identities e ON e.user_id = users.id")}
          WHERE e.provider_id = ? AND e.issuer = ? AND e.subject = ?
        `, [provider.providerId, provider.issuer, provider.subject]);
        return row === undefined ? undefined : userReadModel(row);
      }),
    });
  }

  private nextUuid(): string {
    const id = this.#uuid();
    if (!isUuidV7(id)) throw new IdentityError("invalid_identity_profile");
    return id;
  }

  private safeNow(): number {
    const value = Math.trunc(this.#now());
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new IdentityError("invalid_identity_profile");
    }
    return value;
  }
}

function userSelect(suffix: string): string {
  return `
    SELECT
      users.id, users.email, users.normalized_email, users.given_name,
      users.family_name, users.role, users.status, users.security_epoch,
      users.password_policy_version, users.version, users.created_at, users.updated_at
    FROM users
    ${suffix}
  `;
}

function requiredUserRow(transaction: PersistenceTransaction, id: string): UserRow {
  const row = transaction.get<UserRow>(userSelect("WHERE id = ?"), [id]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requiredUser(transaction: PersistenceTransaction, id: string): IdentityReadModel {
  return userReadModel(requiredUserRow(transaction, id));
}

function requiredProviderLink(
  transaction: PersistenceTransaction,
  id: string,
): ProviderLinkReadModel {
  const row = transaction.get<ProviderRow>(`
    SELECT id, user_id, provider_id, issuer, subject, version, created_at, updated_at
    FROM external_identities
    WHERE id = ?
  `, [id]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return {
    id: row.id,
    userId: row.user_id,
    providerId: row.provider_id,
    issuer: row.issuer,
    subject: row.subject,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireEmailAvailable(
  transaction: PersistenceTransaction,
  normalizedEmail: string,
  excludedUserId?: string,
): void {
  const row = transaction.get<{ id: string }>(`
    SELECT id FROM users
    WHERE normalized_email = ?
    ${excludedUserId === undefined ? "" : "AND id <> ?"}
  `, excludedUserId === undefined ? [normalizedEmail] : [normalizedEmail, excludedUserId]);
  if (row !== undefined) throw new PersistenceError("identity_conflict");
}

function updateRoleOrStatus(
  transaction: PersistenceTransaction,
  current: UserRow,
  role: IdentityRole,
  status: IdentityStatus,
): void {
  const result = transaction.run(`
    UPDATE users
    SET role = ?, status = ?, security_epoch = security_epoch + 1,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `, [role, status, transaction.timestamp(), current.id, current.version]);
  if (result.changes !== 1) throw new PersistenceError("identity_stale");
}

function identityAudit(
  context: IdentityAuditContext,
  operation: {
    action: string;
    targetId: string;
    changes: NonNullable<AdministrativeAuditEventInput["changes"]>;
  },
): AdministrativeAuditEventInput {
  return {
    actor: context.actor,
    action: operation.action,
    result: "allow",
    target: {
      type: "user",
      id: operation.targetId,
      label: `user:${operation.targetId}`,
    },
    ...(context.justification === undefined ? {} : { justification: context.justification }),
    changes: operation.changes,
    correlationId: context.correlationId,
    source: context.source ?? { category: "identity" },
  };
}

function userReadModel(row: UserRow): IdentityReadModel {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    givenName: row.given_name,
    familyName: row.family_name,
    role: row.role,
    status: row.status,
    securityEpoch: row.security_epoch,
    passwordPolicyVersion: row.password_policy_version,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mcpEligible: false,
  };
}

function authenticatorReadModel(row: AuthenticatorRow): LocalAuthenticatorStateReadModel {
  return {
    userId: row.user_id,
    passwordState: row.password_state,
    totpState: row.totp_state,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseUuid(value: unknown): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new IdentityError("identity_not_found");
  return parsed.data;
}

function parseExpectedVersion(value: unknown): number {
  const parsed = expectedVersionSchema.safeParse(value);
  if (!parsed.success) throw new IdentityError("identity_stale");
  return parsed.data;
}

function parseRole(value: unknown): IdentityRole {
  const parsed = roleSchema.safeParse(value);
  if (!parsed.success) throw new IdentityError("invalid_identity_transition");
  return parsed.data;
}

function parseStatus(value: unknown): IdentityStatus {
  const parsed = statusSchema.safeParse(value);
  if (!parsed.success) throw new IdentityError("invalid_identity_transition");
  return parsed.data;
}

function mapIdentityPersistenceError(error: unknown): Error {
  if (error instanceof PersistenceError) {
    const identityCodes = [
      "identity_not_found",
      "identity_conflict",
      "identity_stale",
      "invalid_identity_transition",
      "last_active_superadmin",
      "bootstrap_unavailable",
    ] as const;
    if (identityCodes.includes(error.code as (typeof identityCodes)[number])) {
      return new IdentityError(error.code as (typeof identityCodes)[number]);
    }
  }
  return error instanceof Error ? error : new PersistenceError("database_unavailable");
}

export type { UserRow };
