import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "../persistence/uuidV7.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { ControlAuthenticationContext } from "../control/authentication.js";
import { canonicalControlJson } from "../control/idempotency.js";
import type {
  ControlAuthorizationSeam,
  ControlStepUpOperation,
  ControlStepUpRule,
} from "../control/routeRegistry.js";
import type { ControlCapability, PermissionOutcome } from "../control/permissions.js";
import type { AlwaysStepUpHandle } from "./stepUp.js";
import {
  IDENTITY_ROLES,
  IDENTITY_STATUSES,
  type IdentityRole,
  type IdentityStatus,
} from "./contracts.js";
import { parseIdentityProfile } from "./validation.js";

const CURSOR_DOMAIN = "secretsauce.user-list-cursor.v1";
const CURSOR_TTL_MS = 15 * 60_000;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,2048}\.[a-f0-9]{64}$/;

export class UserAdministrationError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "forbidden"
      | "not_found"
      | "stale"
      | "conflict"
      | "unavailable",
  ) {
    super(
      code === "forbidden"
        ? "User administration is not permitted."
        : code === "not_found"
          ? "User was not found."
          : code === "stale"
            ? "The user changed. Refresh and retry."
            : code === "conflict"
              ? "The user conflicts with an existing identity."
              : code === "invalid_request"
                ? "User administration input is invalid."
                : "User administration is unavailable.",
    );
    this.name = "UserAdministrationError";
  }
}

export interface UserAdministrationView {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  role: IdentityRole;
  status: IdentityStatus;
  passwordState: "not_configured" | "temporary" | "configured" | "disabled";
  totpState: "not_configured" | "configured" | "disabled";
  version: number;
  createdAt: number;
  updatedAt: number;
}

interface UserAdministrationRow extends UserAdministrationView {
  normalizedEmail: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
}

export interface UserRelationshipResolver {
  relatedServiceIds(actorUserId: string, targetUserId?: string): Promise<readonly string[]>;
}

export const denyUserRelationships: UserRelationshipResolver = {
  relatedServiceIds: async () => [],
};

export class UserManagementAuthorization implements ControlAuthorizationSeam {
  constructor(
    private readonly delegate: ControlAuthorizationSeam,
    private readonly relationships: UserRelationshipResolver = denyUserRelationships,
  ) {}

  async authorizeScope(
    context: ControlAuthenticationContext,
    capability: ControlCapability,
    outcome: PermissionOutcome,
    request: FastifyRequest,
  ): Promise<boolean> {
    if (
      capability === "invite_ordinary_user" &&
      outcome === "all_services"
    ) return context.role === "superadmin";
    if (
      capability === "invite_ordinary_user" &&
      outcome === "assigned_services"
    ) {
      const serviceIds = await this.relationships.relatedServiceIds(context.principalId);
      return serviceIds.length > 0;
    }
    if (
      ["all_ordinary_users", "all_ordinary_users_step_up", "last_superadmin_rules"]
        .includes(outcome)
    ) return context.role === "superadmin";
    if (outcome.startsWith("related_users")) {
      const targetId = requestTargetUserId(request);
      if (
        outcome === "related_users_not_self" &&
        (targetId === undefined || targetId === context.principalId)
      ) return false;
      const serviceIds = await this.relationships.relatedServiceIds(
        context.principalId,
        targetId,
      );
      return serviceIds.length > 0;
    }
    return this.delegate.authorizeScope(context, capability, outcome, request);
  }

  verifyStepUp(
    context: ControlAuthenticationContext,
    rule: Exclude<ControlStepUpRule, "none">,
    request: FastifyRequest,
    operation: ControlStepUpOperation,
  ): Promise<boolean> {
    return this.delegate.verifyStepUp(context, rule, request, operation);
  }

  stepUpProof(request: FastifyRequest): AlwaysStepUpHandle | undefined {
    return this.delegate.stepUpProof?.(request);
  }
}

interface UserCursorPayload {
  v: 1;
  route: "users.list";
  actorId: string;
  actorRole: "superadmin" | "admin";
  scope: string;
  q: string | null;
  role: IdentityRole | null;
  status: IdentityStatus | null;
  lastEmail: string;
  lastId: string;
  issuedAt: number;
  expiresAt: number;
}

export class UserCursorCodec {
  readonly #key: Buffer;

  constructor(
    key: Buffer,
    private readonly now: () => number = Date.now,
  ) {
    if (key.byteLength !== 32) throw new UserAdministrationError("unavailable");
    this.#key = Buffer.from(key);
  }

  encode(payload: Omit<UserCursorPayload, "v" | "route" | "issuedAt" | "expiresAt">): string {
    const issuedAt = safeNow(this.now);
    const body: UserCursorPayload = {
      v: 1,
      route: "users.list",
      ...payload,
      issuedAt,
      expiresAt: issuedAt + CURSOR_TTL_MS,
    };
    const encoded = Buffer.from(canonicalControlJson(body), "utf8").toString("base64url");
    const signature = cursorSignature(this.#key, encoded);
    const cursor = `${encoded}.${signature}`;
    if (cursor.length > 2_048) throw new UserAdministrationError("unavailable");
    return cursor;
  }

  decode(cursor: unknown): UserCursorPayload {
    if (typeof cursor !== "string" || !CURSOR_PATTERN.test(cursor)) {
      throw new UserAdministrationError("invalid_request");
    }
    const separator = cursor.lastIndexOf(".");
    const encoded = cursor.slice(0, separator);
    const signature = cursor.slice(separator + 1);
    const expected = cursorSignature(this.#key, encoded);
    if (!constantTimeHex(signature, expected)) {
      throw new UserAdministrationError("invalid_request");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new UserAdministrationError("invalid_request");
    }
    const payload = parseCursorPayload(parsed);
    if (safeNow(this.now) >= payload.expiresAt) {
      throw new UserAdministrationError("invalid_request");
    }
    return payload;
  }

  close(): void {
    this.#key.fill(0);
  }
}

export class UserAdministrationRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async user(userId: string): Promise<UserAdministrationView | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<UserAdministrationRow>(userSelect("WHERE u.id = ?"), [userId]);
        return row === undefined ? undefined : projectUser(row);
      }),
    });
  }

  async list(input: {
    limit: number;
    q?: string;
    role?: IdentityRole;
    status?: IdentityStatus;
    lastEmail?: string;
    lastId?: string;
    serviceIds?: readonly string[];
  }): Promise<{ users: UserAdministrationView[]; last?: { email: string; id: string } }> {
    const clauses: string[] = [];
    const parameters: (string | number)[] = [];
    if (input.serviceIds !== undefined) {
      if (
        input.serviceIds.length < 1 ||
        input.serviceIds.length > 200 ||
        input.serviceIds.some((serviceId) => !isUuidV7(serviceId))
      ) throw new UserAdministrationError("invalid_request");
      const placeholders = input.serviceIds.map(() => "?").join(",");
      clauses.push(`u.role = 'user' AND EXISTS (
        SELECT 1
        FROM services related_service
        WHERE related_service.id IN (${placeholders})
          AND (
            EXISTS (
              SELECT 1 FROM service_principal_assignments all_assignment
              WHERE all_assignment.service_id = related_service.id
                AND all_assignment.selector_kind = 'all'
            )
            OR EXISTS (
              SELECT 1 FROM service_principal_assignments direct
              WHERE direct.service_id = related_service.id
                AND direct.selector_kind = 'user' AND direct.user_id = u.id
            )
            OR EXISTS (
              SELECT 1
              FROM service_principal_assignments selected
              JOIN service_groups g
                ON g.service_id = selected.service_id AND g.id = selected.group_id
              JOIN service_group_members gm
                ON gm.service_id = g.service_id AND gm.group_id = g.id
              WHERE selected.service_id = related_service.id
                AND selected.selector_kind = 'group'
                AND g.lifecycle = 'active' AND gm.user_id = u.id
            )
          )
      )`);
      parameters.push(...input.serviceIds);
    }
    if (input.q !== undefined) {
      clauses.push(`(
        u.normalized_email LIKE ? ESCAPE '\\'
        OR lower(u.given_name) LIKE ? ESCAPE '\\'
        OR lower(u.family_name) LIKE ? ESCAPE '\\'
      )`);
      const pattern = `%${escapeLike(input.q.toLocaleLowerCase("und"))}%`;
      parameters.push(pattern, pattern, pattern);
    }
    if (input.role !== undefined) {
      clauses.push("u.role = ?");
      parameters.push(input.role);
    }
    if (input.status !== undefined) {
      clauses.push("u.status = ?");
      parameters.push(input.status);
    }
    if (input.lastEmail !== undefined && input.lastId !== undefined) {
      clauses.push("(u.normalized_email > ? OR (u.normalized_email = ? AND u.id > ?))");
      parameters.push(input.lastEmail, input.lastEmail, input.lastId);
    }
    parameters.push(input.limit + 1);
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const rows = query.all<UserAdministrationRow>(`
          ${userSelect(clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`)}
          ORDER BY u.normalized_email ASC, u.id ASC
          LIMIT ?
        `, parameters);
        const page = rows.slice(0, input.limit);
        const hasMore = rows.length > input.limit;
        const last = hasMore ? page.at(-1) : undefined;
        return {
          users: page.map(projectUser),
          ...(last === undefined
            ? {}
            : { last: { email: last.normalizedEmail, id: last.id } }),
        };
      }),
    });
  }

  async updateProfile(input: {
    actor: ControlAuthenticationContext;
    targetUserId: string;
    expectedVersion: number;
    profile: unknown;
    correlationId: string;
    eventId: string;
    affectedServiceIds: readonly string[];
  }): Promise<UserAdministrationView> {
    if (!isUuidV7(input.targetUserId) || !isUuidV7(input.eventId)) {
      throw new UserAdministrationError("invalid_request");
    }
    const profile = parseIdentityProfile(input.profile);
    const now = safeNow(this.now);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const actor = requiredCurrentActor(transaction, input.actor);
          const target = requiredUserRow(transaction, input.targetUserId);
          if (target.version !== input.expectedVersion) {
            throw new PersistenceError("identity_stale");
          }
          requireProfileAuthority(actor, target, input.affectedServiceIds);
          const duplicate = transaction.get<{ id: string }>(`
            SELECT id FROM users WHERE normalized_email = ? AND id <> ?
          `, [profile.normalizedEmail, target.id]);
          if (duplicate !== undefined) throw new PersistenceError("identity_conflict");
          const emailChanged = profile.normalizedEmail !== target.normalizedEmail;
          const browserSessionsRevoked = emailChanged
            ? Number(transaction.run(`
                UPDATE browser_sessions SET revoked_at = ?, version = version + 1
                WHERE user_id = ? AND revoked_at IS NULL
              `, [now, target.id]).changes)
            : 0;
          const restrictedSessionsRevoked = emailChanged
            ? Number(transaction.run(`
                UPDATE identity_restricted_sessions SET revoked_at = ?, version = version + 1
                WHERE user_id = ? AND revoked_at IS NULL
              `, [now, target.id]).changes)
            : 0;
          const updated = transaction.run(`
            UPDATE users
            SET email = ?, normalized_email = ?, given_name = ?, family_name = ?,
                email_source = 'local', given_name_source = 'local',
                family_name_source = 'local',
                security_epoch = security_epoch + ?, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?
          `, [
            profile.email,
            profile.normalizedEmail,
            profile.givenName,
            profile.familyName,
            emailChanged ? 1 : 0,
            now,
            target.id,
            target.version,
          ]);
          if (updated.changes !== 1) throw new PersistenceError("identity_stale");
          if (emailChanged) {
            transaction.run(`
              INSERT INTO identity_invalidation_events (
                id, user_id, reason, browser_sessions_revoked,
                restricted_sessions_revoked, created_at, dispatched_at, attempts
              ) VALUES (?, ?, 'profile_email_change', ?, ?, ?, NULL, 0)
            `, [
              input.eventId,
              target.id,
              browserSessionsRevoked,
              restrictedSessionsRevoked,
              now,
            ]);
          }
          return {
            value: projectUser(requiredUserRow(transaction, target.id)),
            auditInput: profileAudit({
              actor,
              target,
              correlationId: input.correlationId,
              emailChanged,
              affectedServiceIds: input.affectedServiceIds,
              browserSessionsRevoked,
              restrictedSessionsRevoked,
            }),
          };
        }),
      });
    } catch (error) {
      throw mapUserAdministrationError(error);
    }
  }
}

export class UserAdministrationService {
  constructor(
    private readonly repository: UserAdministrationRepository,
    private readonly cursors: UserCursorCodec,
    private readonly relationships: UserRelationshipResolver = denyUserRelationships,
    private readonly now: () => number = Date.now,
    private readonly uuid: () => string = defaultUuid(now),
  ) {}

  async self(actor: ControlAuthenticationContext): Promise<UserAdministrationView> {
    requireBrowserActor(actor);
    const user = await this.repository.user(actor.principalId);
    if (user === undefined || user.role !== actor.role) {
      throw new UserAdministrationError("not_found");
    }
    return user;
  }

  async detail(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
  ): Promise<UserAdministrationView> {
    requireBrowserActor(actor);
    if (typeof targetUserId !== "string" || !isUuidV7(targetUserId)) {
      throw new UserAdministrationError("not_found");
    }
    const target = await this.repository.user(targetUserId);
    if (target === undefined) throw new UserAdministrationError("not_found");
    const services = await this.relationships.relatedServiceIds(actor.principalId, target.id);
    if (!canView(actor, target, services)) throw new UserAdministrationError("not_found");
    return target;
  }

  async list(
    actor: ControlAuthenticationContext,
    input: unknown,
  ): Promise<{ users: UserAdministrationView[]; nextCursor?: string }> {
    requireBrowserActor(actor);
    if (actor.role !== "superadmin" && actor.role !== "admin") {
      throw new UserAdministrationError("forbidden");
    }
    const scopeIds = await this.relationships.relatedServiceIds(actor.principalId);
    if (actor.role === "admin" && scopeIds.length === 0) {
      throw new UserAdministrationError("forbidden");
    }
    const parsed = parseListInput(input);
    const scope = actor.role === "superadmin" ? "all" : scopeFingerprint(scopeIds);
    let lastEmail: string | undefined;
    let lastId: string | undefined;
    if (parsed.cursor !== undefined) {
      const cursor = this.cursors.decode(parsed.cursor);
      if (
        cursor.actorId !== actor.principalId ||
        cursor.actorRole !== actor.role ||
        cursor.scope !== scope ||
        cursor.q !== (parsed.q ?? null) ||
        cursor.role !== (parsed.role ?? null) ||
        cursor.status !== (parsed.status ?? null)
      ) throw new UserAdministrationError("invalid_request");
      lastEmail = cursor.lastEmail;
      lastId = cursor.lastId;
    }
    const page = await this.repository.list({
      limit: parsed.limit,
      ...(actor.role === "admin" ? { serviceIds: scopeIds } : {}),
      ...(parsed.q === undefined ? {} : { q: parsed.q }),
      ...(parsed.role === undefined ? {} : { role: parsed.role }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      ...(lastEmail === undefined ? {} : { lastEmail }),
      ...(lastId === undefined ? {} : { lastId }),
    });
    return {
      users: page.users,
      ...(page.last === undefined
        ? {}
        : {
            nextCursor: this.cursors.encode({
              actorId: actor.principalId,
              actorRole: actor.role,
              scope,
              q: parsed.q ?? null,
              role: parsed.role ?? null,
              status: parsed.status ?? null,
              lastEmail: page.last.email,
              lastId: page.last.id,
            }),
          }),
    };
  }

  async updateSelf(
    actor: ControlAuthenticationContext,
    expectedVersion: unknown,
    profile: unknown,
    correlationId: string,
  ): Promise<UserAdministrationView> {
    requireBrowserActor(actor);
    return this.update(actor, actor.principalId, expectedVersion, profile, correlationId, []);
  }

  async updateOther(
    actor: ControlAuthenticationContext,
    targetUserId: unknown,
    expectedVersion: unknown,
    profile: unknown,
    correlationId: string,
  ): Promise<UserAdministrationView> {
    requireBrowserActor(actor);
    if (typeof targetUserId !== "string" || !isUuidV7(targetUserId)) {
      throw new UserAdministrationError("not_found");
    }
    const services = await this.relationships.relatedServiceIds(actor.principalId, targetUserId);
    return this.update(
      actor,
      targetUserId,
      expectedVersion,
      profile,
      correlationId,
      services,
    );
  }

  private async update(
    actor: ControlAuthenticationContext,
    targetUserId: string,
    expectedVersion: unknown,
    profile: unknown,
    correlationId: string,
    services: readonly string[],
  ): Promise<UserAdministrationView> {
    if (
      !Number.isInteger(expectedVersion) ||
      (expectedVersion as number) < 1 ||
      !validCorrelationId(correlationId)
    ) throw new UserAdministrationError("invalid_request");
    const target = await this.repository.user(targetUserId);
    if (target === undefined || !canEdit(actor, target, services)) {
      throw new UserAdministrationError("not_found");
    }
    return this.repository.updateProfile({
      actor,
      targetUserId,
      expectedVersion: expectedVersion as number,
      profile,
      correlationId,
      eventId: this.nextUuid(),
      affectedServiceIds: [...services].sort(),
    });
  }

  private nextUuid(): string {
    const value = this.uuid();
    if (!isUuidV7(value)) throw new UserAdministrationError("unavailable");
    return value;
  }

  close(): void {
    this.cursors.close();
  }
}

function userSelect(suffix: string): string {
  return `
    SELECT
      u.id, u.email, u.normalized_email AS normalizedEmail,
      u.given_name AS givenName, u.family_name AS familyName,
      u.role, u.status, u.security_epoch AS securityEpoch,
      sec.global_security_epoch AS globalSecurityEpoch,
      a.password_state AS passwordState, a.totp_state AS totpState,
      u.version, u.created_at AS createdAt, u.updated_at AS updatedAt
    FROM users u
    JOIN local_authenticator_states a ON a.user_id = u.id
    JOIN identity_security_state sec ON sec.singleton = 1
    ${suffix}
  `;
}

function requiredUserRow(
  transaction: PersistenceTransaction,
  userId: string,
): UserAdministrationRow {
  const row = transaction.get<UserAdministrationRow>(userSelect("WHERE u.id = ?"), [userId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requiredCurrentActor(
  transaction: PersistenceTransaction,
  actor: ControlAuthenticationContext,
): UserAdministrationRow {
  const current = requiredUserRow(transaction, actor.principalId);
  if (
    actor.method !== "browser_session" ||
    current.role !== actor.role ||
    current.status !== "active"
  ) throw new PersistenceError("identity_not_found");
  return current;
}

function requireProfileAuthority(
  actor: UserAdministrationRow,
  target: UserAdministrationRow,
  affectedServiceIds: readonly string[],
): void {
  if (actor.id === target.id) return;
  if (actor.role === "superadmin") return;
  if (
    actor.role === "admin" &&
    target.role === "user" &&
    affectedServiceIds.length > 0
  ) return;
  throw new PersistenceError("identity_not_found");
}

function canView(
  actor: ControlAuthenticationContext,
  target: UserAdministrationView,
  serviceIds: readonly string[],
): boolean {
  return actor.principalId === target.id ||
    actor.role === "superadmin" ||
    (actor.role === "admin" && target.role === "user" && serviceIds.length > 0);
}

function canEdit(
  actor: ControlAuthenticationContext,
  target: UserAdministrationView,
  serviceIds: readonly string[],
): boolean {
  if (actor.principalId === target.id) return true;
  if (actor.role === "superadmin") return true;
  return actor.role === "admin" &&
    target.role === "user" &&
    serviceIds.length > 0;
}

function projectUser(row: UserAdministrationRow): UserAdministrationView {
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

function profileAudit(input: {
  actor: UserAdministrationRow;
  target: UserAdministrationRow;
  correlationId: string;
  emailChanged: boolean;
  affectedServiceIds: readonly string[];
  browserSessionsRevoked: number;
  restrictedSessionsRevoked: number;
}): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.actor.id,
      label: `user:${input.actor.id}`,
      role: input.actor.role,
      authenticationMethod: "browser_session",
    },
    action: input.actor.id === input.target.id
      ? "identity.self_profile_update"
      : "identity.profile_update",
    result: "allow",
    target: {
      type: "user",
      id: input.target.id,
      label: `user:${input.target.id}`,
    },
    changes: [
      { field: "profile", before: "previous", after: "updated" },
      { field: "email_changed", after: input.emailChanged },
      ...(input.emailChanged
        ? [
            { field: "security_epoch", after: "incremented" },
            { field: "browser_sessions_revoked", after: input.browserSessionsRevoked },
            { field: "restricted_sessions_revoked", after: input.restrictedSessionsRevoked },
          ]
        : []),
      ...input.affectedServiceIds.map((serviceId) => ({
        field: "affected_service",
        after: serviceId,
      })),
    ],
    correlationId: input.correlationId,
    source: { category: "identity" },
  };
}

function parseListInput(value: unknown): {
  limit: number;
  cursor?: string;
  q?: string;
  role?: IdentityRole;
  status?: IdentityStatus;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UserAdministrationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["limit", "cursor", "q", "role", "status"].includes(key))) {
    throw new UserAdministrationError("invalid_request");
  }
  const limit = input.limit === undefined ? 50 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new UserAdministrationError("invalid_request");
  }
  const q = input.q === undefined ? undefined : parseSearch(input.q);
  const cursor = input.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 2_048)) {
    throw new UserAdministrationError("invalid_request");
  }
  const role = input.role;
  if (role !== undefined && !IDENTITY_ROLES.includes(role as IdentityRole)) {
    throw new UserAdministrationError("invalid_request");
  }
  const status = input.status;
  if (status !== undefined && !IDENTITY_STATUSES.includes(status as IdentityStatus)) {
    throw new UserAdministrationError("invalid_request");
  }
  return {
    limit,
    ...(cursor === undefined ? {} : { cursor }),
    ...(q === undefined ? {} : { q }),
    ...(role === undefined ? {} : { role: role as IdentityRole }),
    ...(status === undefined ? {} : { status: status as IdentityStatus }),
  };
}

function parseSearch(value: unknown): string {
  if (typeof value !== "string") throw new UserAdministrationError("invalid_request");
  const normalized = value.normalize("NFKC").trim();
  if (
    [...normalized].length < 1 ||
    [...normalized].length > 512 ||
    Buffer.byteLength(normalized, "utf8") > 2_048
  ) throw new UserAdministrationError("invalid_request");
  return normalized;
}

function parseCursorPayload(value: unknown): UserCursorPayload {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UserAdministrationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  const keys = [
    "v", "route", "actorId", "actorRole", "scope", "q", "role", "status",
    "lastEmail", "lastId", "issuedAt", "expiresAt",
  ];
  if (
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !(key in input)) ||
    input.v !== 1 ||
    input.route !== "users.list" ||
    typeof input.actorId !== "string" ||
    !isUuidV7(input.actorId) ||
    !["superadmin", "admin"].includes(String(input.actorRole)) ||
    typeof input.scope !== "string" ||
    input.scope.length < 1 ||
    input.scope.length > 128 ||
    (input.q !== null && typeof input.q !== "string") ||
    (input.role !== null && !IDENTITY_ROLES.includes(input.role as IdentityRole)) ||
    (input.status !== null && !IDENTITY_STATUSES.includes(input.status as IdentityStatus)) ||
    typeof input.lastEmail !== "string" ||
    typeof input.lastId !== "string" ||
    !isUuidV7(input.lastId) ||
    !Number.isSafeInteger(input.issuedAt) ||
    !Number.isSafeInteger(input.expiresAt) ||
    Number(input.expiresAt) <= Number(input.issuedAt) ||
    Number(input.expiresAt) - Number(input.issuedAt) !== CURSOR_TTL_MS
  ) throw new UserAdministrationError("invalid_request");
  return input as unknown as UserCursorPayload;
}

function requireBrowserActor(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session" ||
    !isUuidV7(actor.principalId) ||
    !["user", "admin", "superadmin"].includes(actor.role)
  ) throw new UserAdministrationError("forbidden");
}

function scopeFingerprint(serviceIds: readonly string[]): string {
  const sorted = [...new Set(serviceIds)].sort();
  if (sorted.some((id) => !isUuidV7(id))) throw new UserAdministrationError("unavailable");
  return createHmac("sha256", Buffer.alloc(32))
    .update("secretsauce.user-scope.v1\0")
    .update(sorted.join("\0"))
    .digest("hex");
}

function cursorSignature(key: Buffer, encoded: string): string {
  return createHmac("sha256", key)
    .update(CURSOR_DOMAIN)
    .update("\0")
    .update(encoded)
    .digest("hex");
}

function constantTimeHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new UserAdministrationError("unavailable");
  }
  return value;
}

function defaultUuid(now: () => number): () => string {
  const generator = new UuidV7Generator({ now });
  return () => generator.next();
}

function validCorrelationId(value: unknown): value is string {
  return typeof value === "string" &&
    /^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function requestTargetUserId(request: FastifyRequest): string | undefined {
  const params = request.params;
  if (params === null || typeof params !== "object" || Array.isArray(params)) return undefined;
  const value = (params as Record<string, unknown>).user_id;
  return typeof value === "string" && isUuidV7(value) ? value : undefined;
}

function mapUserAdministrationError(error: unknown): UserAdministrationError {
  if (error instanceof UserAdministrationError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found") return new UserAdministrationError("not_found");
    if (error.code === "identity_stale") return new UserAdministrationError("stale");
    if (error.code === "identity_conflict") return new UserAdministrationError("conflict");
  }
  return new UserAdministrationError("unavailable");
}
