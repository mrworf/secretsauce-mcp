import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { ControlIdempotencyHasher } from "./control/idempotency.js";
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
  type NormalizedPrincipalSelector,
  normalizePrincipalSelector,
  selectorContributions,
} from "./principalSelectors.js";

const MAX_GROUPS_PER_SERVICE = 200;
const MAX_GROUP_MEMBERS = 1_000;
const MAX_SERVICE_SELECTORS = 1_000;

export interface ServiceGroupView {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  lifecycle: "active" | "archived";
  memberCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceAssignmentView {
  serviceId: string;
  selector?: NormalizedPrincipalSelector;
  version: number;
  authorizationGeneration: number;
}

export interface EffectiveServiceAccess {
  serviceId: string;
  userId: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  contributions: Array<
    | { kind: "all" }
    | { kind: "direct" }
    | { kind: "group"; groupId: string; groupName: string }
  >;
}

export interface GroupMemberView {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  status: string;
}

export interface OwnServiceView {
  id: string;
  slug: string;
  name: string;
}

interface GroupRow {
  id: string;
  service_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  lifecycle: "active" | "archived";
  version: number;
  created_at: number;
  updated_at: number;
  member_count: number;
}

interface AssignmentStateRow {
  service_id: string;
  version: number;
  authorization_generation: number;
}

interface UserRow {
  id: string;
  role: string;
  status: string;
}

export class GroupAssignmentError extends Error {
  constructor(readonly code:
    | "invalid_request"
    | "not_found"
    | "stale"
    | "conflict"
    | "idempotency_conflict"
    | "unavailable") {
    super("Group and assignment management could not be completed.");
    this.name = "GroupAssignmentError";
  }
}

export class GroupAssignmentRepository {
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    now: () => number = Date.now,
    uuid: () => string = defaultUuid(now),
  ) {
    this.#uuid = uuid;
  }

  async createGroup(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    groupId: string;
    name: string;
    description?: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    const profile = normalizeGroupProfile(input.name, input.description);
    return this.audited((transaction) => {
      const service = requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        const count = transaction.get<{ count: number }>(
          "SELECT count(*) AS count FROM service_groups WHERE service_id = ?",
          [service.id],
        )?.count ?? MAX_GROUPS_PER_SERVICE;
        if (count >= MAX_GROUPS_PER_SERVICE) throw new PersistenceError("identity_conflict");
        const now = transaction.timestamp();
        transaction.run(`
          INSERT INTO service_groups (
            id, service_id, name, normalized_name, description, lifecycle,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
        `, [
          input.groupId,
          service.id,
          profile.name,
          profile.normalizedName,
          profile.description ?? null,
          now,
          now,
        ]);
        return {
          value: input.groupId,
          resultReference: input.groupId,
          responseStatus: 201,
        };
      });
      return {
        value: result,
        auditInput: groupAudit(
          input.actor,
          "group.create",
          service.id,
          result.kind === "executed" ? result.value : result.resultReference,
          input.correlationId,
          [{ field: "lifecycle", after: "active" }],
        ),
      };
    });
  }

  async groups(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<ServiceGroupView[]> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return query.all<GroupRow>(groupSelect(`
        WHERE g.service_id = ?
        ORDER BY g.normalized_name, g.id
        LIMIT ?
      `), [serviceId, MAX_GROUPS_PER_SERVICE]).map(projectGroup);
    });
  }

  async group(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
  ): Promise<ServiceGroupView> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return projectGroup(requiredGroup(query, serviceId, groupId));
    });
  }

  async members(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
  ): Promise<GroupMemberView[]> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      requiredGroup(query, serviceId, groupId);
      return query.all<{
        id: string;
        email: string;
        given_name: string;
        family_name: string;
        status: string;
      }>(`
        SELECT u.id, u.email, u.given_name, u.family_name, u.status
        FROM service_group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.service_id = ? AND gm.group_id = ? AND u.role = 'user'
        ORDER BY u.normalized_email, u.id
        LIMIT ?
      `, [serviceId, groupId, MAX_GROUP_MEMBERS]).map((row) => ({
        id: row.id,
        email: row.email,
        givenName: row.given_name,
        familyName: row.family_name,
        status: row.status,
      }));
    });
  }

  async updateGroup(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    groupId: string;
    expectedVersion: number;
    name: string;
    description?: string;
    correlationId: string;
  }): Promise<ServiceGroupView> {
    const profile = normalizeGroupProfile(input.name, input.description);
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredGroup(transaction, input.serviceId, input.groupId);
      requireActiveGroup(current);
      const updated = transaction.optimisticUpdate(
        "service_groups",
        current.id,
        input.expectedVersion,
        {
          name: profile.name,
          normalized_name: profile.normalizedName,
          description: profile.description ?? null,
        },
      );
      if (updated.status !== "updated") throw new PersistenceError("identity_stale");
      return {
        value: projectGroup(requiredGroup(transaction, input.serviceId, input.groupId)),
        auditInput: groupAudit(
          input.actor,
          "group.update",
          input.serviceId,
          input.groupId,
          input.correlationId,
          [{ field: "profile", before: "previous", after: "updated" }],
        ),
      };
    });
  }

  async archiveGroup(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    groupId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    const justification = normalizeJustification(input.justification);
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredGroup(transaction, input.serviceId, input.groupId);
      const result = transaction.idempotent(input.idempotency, () => {
        requireActiveGroup(current);
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        const selected = groupIsSelected(transaction, input.serviceId, input.groupId);
        const affected = selected
          ? effectiveSelectedGroupUsers(transaction, input.serviceId, input.groupId)
          : [];
        transaction.run(`
          DELETE FROM service_principal_assignments
          WHERE service_id = ? AND selector_kind = 'group' AND group_id = ?
        `, [input.serviceId, input.groupId]);
        const updated = transaction.optimisticUpdate(
          "service_groups",
          current.id,
          current.version,
          { lifecycle: "archived" },
        );
        if (updated.status !== "updated") throw new PersistenceError("identity_stale");
        invalidate(
          transaction,
          this.#uuid,
          input.serviceId,
          affected,
          "group_archive",
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
          ...groupAudit(
            input.actor,
            "group.archive",
            input.serviceId,
            input.groupId,
            input.correlationId,
            [{ field: "lifecycle", before: "active", after: "archived" }],
          ),
          justification,
        },
      };
    });
  }

  async deleteGroup(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    groupId: string;
    expectedVersion: number;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    const justification = normalizeJustification(input.justification);
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const result = transaction.idempotent(input.idempotency, () => {
        const current = requiredGroup(transaction, input.serviceId, input.groupId);
        if (current.lifecycle !== "archived") {
          throw new PersistenceError("identity_conflict");
        }
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        const deleted = transaction.run(
          "DELETE FROM service_groups WHERE service_id = ? AND id = ? AND version = ?",
          [input.serviceId, input.groupId, input.expectedVersion],
        );
        if (deleted.changes !== 1) throw new PersistenceError("identity_stale");
        invalidate(transaction, this.#uuid, input.serviceId, [], "group_delete");
        return {
          value: current.id,
          resultReference: current.id,
          responseStatus: 200,
        };
      });
      return {
        value: result,
        auditInput: {
          ...groupAudit(
            input.actor,
            "group.delete",
            input.serviceId,
            input.groupId,
            input.correlationId,
            [{ field: "group", before: "archived", after: "permanently_deleted" }],
          ),
          justification,
        },
      };
    });
  }

  async replaceMembers(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    groupId: string;
    expectedVersion: number;
    userIds: readonly string[];
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    const userIds = uniqueUuidList(input.userIds, MAX_GROUP_MEMBERS);
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const current = requiredGroup(transaction, input.serviceId, input.groupId);
      requireActiveGroup(current);
      const result = transaction.idempotent(input.idempotency, () => {
        if (current.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        requireActiveOrdinaryUsers(transaction, userIds);
        const before = memberIds(transaction, input.serviceId, input.groupId);
        const added = difference(userIds, before);
        const removed = difference(before, userIds);
        const now = transaction.timestamp();
        transaction.run(
          "DELETE FROM service_group_members WHERE service_id = ? AND group_id = ?",
          [input.serviceId, input.groupId],
        );
        for (const userId of userIds) {
          transaction.run(`
            INSERT INTO service_group_members (
              service_id, group_id, user_id, assigned_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?)
          `, [input.serviceId, input.groupId, userId, input.actor.principalId, now]);
        }
        const updated = transaction.optimisticUpdate(
          "service_groups",
          current.id,
          current.version,
          { lifecycle: "active" },
        );
        if (updated.status !== "updated") throw new PersistenceError("identity_stale");
        if (
          (added.length > 0 || removed.length > 0) &&
          groupIsSelected(transaction, input.serviceId, input.groupId)
        ) {
          invalidate(
            transaction,
            this.#uuid,
            input.serviceId,
            [...added, ...removed],
            "group_membership",
          );
        }
        return {
          value: current.id,
          resultReference: current.id,
          responseStatus: 200,
        };
      });
      const before = memberIds(transaction, input.serviceId, input.groupId);
      return {
        value: result,
        auditInput: groupAudit(
          input.actor,
          "group.members.replace",
          input.serviceId,
          input.groupId,
          input.correlationId,
          [
            { field: "member_count", after: before.length },
            ...chunkAuditIds("member_ids", before),
          ],
        ),
      };
    });
  }

  async assignments(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<ServiceAssignmentView> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return assignmentView(query, serviceId);
    });
  }

  async replaceAssignments(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    expectedVersion: number;
    selector: NormalizedPrincipalSelector;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<IdempotencyExecutionResult<string>> {
    const selector = validateNormalizedSelector(input.selector);
    return this.audited((transaction) => {
      requireScopedService(transaction, input.actor, input.serviceId, true);
      const state = requiredAssignmentState(transaction, input.serviceId);
      const result = transaction.idempotent(input.idempotency, () => {
        if (state.version !== input.expectedVersion) {
          throw new PersistenceError("identity_stale");
        }
        validateSelectorTargets(transaction, input.serviceId, selector);
        const beforeUsers = effectiveUserIds(transaction, input.serviceId);
        transaction.run(
          "DELETE FROM service_principal_assignments WHERE service_id = ?",
          [input.serviceId],
        );
        const now = transaction.timestamp();
        if (selector.kind === "all") {
          insertAssignment(
            transaction,
            this.#uuid(),
            input.serviceId,
            "all",
            undefined,
            input.actor.principalId,
            now,
          );
        } else {
          for (const groupId of selector.groupIds) {
            insertAssignment(
              transaction,
              this.#uuid(),
              input.serviceId,
              "group",
              groupId,
              input.actor.principalId,
              now,
            );
          }
          for (const userId of selector.userIds) {
            insertAssignment(
              transaction,
              this.#uuid(),
              input.serviceId,
              "user",
              userId,
              input.actor.principalId,
              now,
            );
          }
        }
        const afterUsers = effectiveUserIds(transaction, input.serviceId);
        invalidate(
          transaction,
          this.#uuid,
          input.serviceId,
          symmetricDifference(beforeUsers, afterUsers),
          "service_selector",
        );
        return {
          value: input.serviceId,
          resultReference: input.serviceId,
          responseStatus: 200,
        };
      });
      const storedSelector = assignmentView(transaction, input.serviceId).selector;
      return {
        value: result,
        auditInput: groupAudit(
          input.actor,
          "service.assignments.replace",
          input.serviceId,
          input.serviceId,
          input.correlationId,
          [
            { field: "selector_kind", after: storedSelector?.kind ?? "none" },
            { field: "group_count", after: storedSelector?.groupIds.length ?? 0 },
            { field: "direct_user_count", after: storedSelector?.userIds.length ?? 0 },
          ],
        ),
      };
    });
  }

  async effectiveAccess(
    actor: ControlAuthenticationContext,
    serviceId: string,
    userId: string,
  ): Promise<EffectiveServiceAccess> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      const user = query.get<UserRow>(
        "SELECT id, role, status FROM users WHERE id = ?",
        [userId],
      );
      if (user === undefined) throw new PersistenceError("identity_not_found");
      const view = assignmentView(query, serviceId);
      if (view.selector === undefined) {
        return { serviceId, userId, contributions: [] };
      }
      const memberships = query.all<{ id: string; name: string }>(`
        SELECT g.id, g.name
        FROM service_groups g
        JOIN service_group_members gm
          ON gm.service_id = g.service_id AND gm.group_id = g.id
        WHERE g.service_id = ? AND gm.user_id = ? AND g.lifecycle = 'active'
        ORDER BY g.id
      `, [serviceId, userId]);
      const names = new Map(memberships.map((group) => [group.id, group.name]));
      const contributions = selectorContributions({
        selector: view.selector,
        userId,
        role: user.role,
        status: user.status,
        activeGroupIds: memberships.map(({ id }) => id),
      }).map((contribution) => contribution.kind === "group"
        ? {
            ...contribution,
            groupName: names.get(contribution.groupId) ?? contribution.groupId,
          }
        : contribution);
      return { serviceId, userId, contributions };
    });
  }

  async effectiveAccessList(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<EffectiveServiceAccess[]> {
    return this.read((query) => {
      requireScopedService(query, actor, serviceId, false);
      return effectiveUserIds(query, serviceId).map((userId) => {
        const user = query.get<{
          email: string;
          given_name: string;
          family_name: string;
        }>(
          "SELECT email, given_name, family_name FROM users WHERE id = ?",
          [userId],
        );
        if (user === undefined) throw new PersistenceError("database_unavailable");
        const memberships = query.all<{ id: string; name: string }>(`
          SELECT g.id, g.name
          FROM service_groups g
          JOIN service_group_members gm
            ON gm.service_id = g.service_id AND gm.group_id = g.id
          WHERE g.service_id = ? AND gm.user_id = ? AND g.lifecycle = 'active'
          ORDER BY g.id
        `, [serviceId, userId]);
        const selector = assignmentView(query, serviceId).selector;
        if (selector === undefined) throw new PersistenceError("database_unavailable");
        const names = new Map(memberships.map((group) => [group.id, group.name]));
        return {
          serviceId,
          userId,
          email: user.email,
          givenName: user.given_name,
          familyName: user.family_name,
          contributions: selectorContributions({
            selector,
            userId,
            role: "user",
            status: "active",
            activeGroupIds: memberships.map(({ id }) => id),
          }).map((contribution) => contribution.kind === "group"
            ? {
                ...contribution,
                groupName: names.get(contribution.groupId) ?? contribution.groupId,
              }
            : contribution),
        };
      });
    });
  }

  async ownServices(actor: ControlAuthenticationContext): Promise<OwnServiceView[]> {
    if (actor.method !== "browser_session" || actor.role !== "user") {
      throw new GroupAssignmentError("not_found");
    }
    return this.read((query) => {
      const user = query.get<UserRow>(
        "SELECT id, role, status FROM users WHERE id = ?",
        [actor.principalId],
      );
      if (user?.role !== "user" || user.status !== "active") {
        throw new PersistenceError("identity_not_found");
      }
      return query.all<OwnServiceView>(`
        SELECT s.id, s.slug, s.name
        FROM services s
        WHERE s.lifecycle <> 'archived' AND (
          EXISTS (
            SELECT 1 FROM service_principal_assignments all_assignment
            WHERE all_assignment.service_id = s.id
              AND all_assignment.selector_kind = 'all'
          )
          OR EXISTS (
            SELECT 1 FROM service_principal_assignments direct
            WHERE direct.service_id = s.id
              AND direct.selector_kind = 'user'
              AND direct.user_id = ?
          )
          OR EXISTS (
            SELECT 1
            FROM service_principal_assignments selected
            JOIN service_groups g
              ON g.service_id = selected.service_id AND g.id = selected.group_id
            JOIN service_group_members gm
              ON gm.service_id = g.service_id AND gm.group_id = g.id
            WHERE selected.service_id = s.id
              AND selected.selector_kind = 'group'
              AND g.lifecycle = 'active'
              AND gm.user_id = ?
          )
        )
        ORDER BY s.slug, s.id
        LIMIT 500
      `, [actor.principalId, actor.principalId]);
    });
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

export class GroupAssignmentService {
  readonly #uuid: () => string;

  constructor(
    private readonly repository: GroupAssignmentRepository,
    private readonly idempotency: ControlIdempotencyHasher,
    now: () => number = Date.now,
  ) {
    this.#uuid = defaultUuid(now);
  }

  groups(actor: ControlAuthenticationContext, serviceId: string): Promise<ServiceGroupView[]> {
    return this.repository.groups(actor, requiredUuid(serviceId));
  }

  group(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
  ): Promise<ServiceGroupView> {
    return this.repository.group(actor, requiredUuid(serviceId), requiredUuid(groupId));
  }

  members(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
  ): Promise<GroupMemberView[]> {
    return this.repository.members(actor, requiredUuid(serviceId), requiredUuid(groupId));
  }

  async createGroup(
    actor: ControlAuthenticationContext,
    serviceId: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ group: ServiceGroupView; replayed: boolean }> {
    const parsed = groupBody(body);
    const id = this.#uuid();
    const normalizedServiceId = requiredUuid(serviceId);
    const result = await this.repository.createGroup({
      actor,
      serviceId: normalizedServiceId,
      groupId: id,
      ...parsed,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "groups.create",
        idempotencyKey,
        { serviceId: normalizedServiceId, ...parsed },
      ),
    });
    const groupId = result.kind === "executed" ? result.value : result.resultReference;
    return {
      group: await this.repository.group(actor, normalizedServiceId, groupId),
      replayed: result.kind === "replayed",
    };
  }

  updateGroup(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
    expectedVersion: number,
    body: unknown,
    correlationId: string,
  ): Promise<ServiceGroupView> {
    return this.repository.updateGroup({
      actor,
      serviceId: requiredUuid(serviceId),
      groupId: requiredUuid(groupId),
      expectedVersion: requiredVersion(expectedVersion),
      ...groupBody(body),
      correlationId: requiredCorrelation(correlationId),
    });
  }

  async replaceMembers(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ group: ServiceGroupView; replayed: boolean }> {
    const userIds = memberBody(body);
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedGroupId = requiredUuid(groupId);
    const result = await this.repository.replaceMembers({
      actor,
      serviceId: normalizedServiceId,
      groupId: normalizedGroupId,
      expectedVersion: requiredVersion(expectedVersion),
      userIds,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "groups.members.replace",
        idempotencyKey,
        { serviceId: normalizedServiceId, groupId: normalizedGroupId, userIds },
      ),
    });
    return {
      group: await this.repository.group(actor, normalizedServiceId, normalizedGroupId),
      replayed: result.kind === "replayed",
    };
  }

  async archiveGroup(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ group: ServiceGroupView; replayed: boolean }> {
    const justification = justificationBody(body);
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedGroupId = requiredUuid(groupId);
    const result = await this.repository.archiveGroup({
      actor,
      serviceId: normalizedServiceId,
      groupId: normalizedGroupId,
      expectedVersion: requiredVersion(expectedVersion),
      justification,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "groups.archive",
        idempotencyKey,
        { serviceId: normalizedServiceId, groupId: normalizedGroupId, justification },
      ),
    });
    return {
      group: await this.repository.group(actor, normalizedServiceId, normalizedGroupId),
      replayed: result.kind === "replayed",
    };
  }

  async deleteGroup(
    actor: ControlAuthenticationContext,
    serviceId: string,
    groupId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ groupId: string; deleted: true; replayed: boolean }> {
    const justification = justificationBody(body);
    const normalizedServiceId = requiredUuid(serviceId);
    const normalizedGroupId = requiredUuid(groupId);
    const result = await this.repository.deleteGroup({
      actor,
      serviceId: normalizedServiceId,
      groupId: normalizedGroupId,
      expectedVersion: requiredVersion(expectedVersion),
      justification,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "groups.delete",
        idempotencyKey,
        { serviceId: normalizedServiceId, groupId: normalizedGroupId, justification },
      ),
    });
    return { groupId: normalizedGroupId, deleted: true, replayed: result.kind === "replayed" };
  }

  assignments(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<ServiceAssignmentView> {
    return this.repository.assignments(actor, requiredUuid(serviceId));
  }

  async replaceAssignments(
    actor: ControlAuthenticationContext,
    serviceId: string,
    expectedVersion: number,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ assignments: ServiceAssignmentView; replayed: boolean }> {
    const selector = normalizePrincipalSelector(body);
    const normalizedServiceId = requiredUuid(serviceId);
    const result = await this.repository.replaceAssignments({
      actor,
      serviceId: normalizedServiceId,
      expectedVersion: requiredVersion(expectedVersion),
      selector,
      correlationId: requiredCorrelation(correlationId),
      idempotency: this.idempotencyInput(
        actor,
        "services.assignments.replace",
        idempotencyKey,
        { serviceId: normalizedServiceId, selector },
      ),
    });
    return {
      assignments: await this.repository.assignments(actor, normalizedServiceId),
      replayed: result.kind === "replayed",
    };
  }

  access(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<EffectiveServiceAccess[]> {
    return this.repository.effectiveAccessList(actor, requiredUuid(serviceId));
  }

  ownServices(actor: ControlAuthenticationContext): Promise<OwnServiceView[]> {
    return this.repository.ownServices(actor);
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
      throw new GroupAssignmentError("invalid_request");
    }
  }
}

function requireScopedService(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
  mutable: boolean,
): { id: string; lifecycle: string } {
  if (!isUuidV7(serviceId) || actor.method !== "browser_session") {
    throw new PersistenceError("identity_not_found");
  }
  const service = query.get<{ id: string; lifecycle: string }>(
    "SELECT id, lifecycle FROM services WHERE id = ?",
    [serviceId],
  );
  if (service === undefined || (mutable && service.lifecycle === "archived")) {
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

function requiredGroup(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  groupId: string,
): GroupRow {
  if (!isUuidV7(groupId)) throw new PersistenceError("identity_not_found");
  const group = query.get<GroupRow>(
    groupSelect("WHERE g.service_id = ? AND g.id = ?"),
    [serviceId, groupId],
  );
  if (group === undefined) throw new PersistenceError("identity_not_found");
  return group;
}

function requireActiveGroup(group: GroupRow): void {
  if (group.lifecycle !== "active") throw new PersistenceError("identity_conflict");
}

function requiredAssignmentState(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
): AssignmentStateRow {
  const row = query.get<AssignmentStateRow>(`
    SELECT service_id, version, authorization_generation
    FROM service_assignment_states WHERE service_id = ?
  `, [serviceId]);
  if (row === undefined) throw new PersistenceError("database_unavailable");
  return row;
}

function assignmentView(
  query: Pick<PersistenceQuery, "get" | "all">,
  serviceId: string,
): ServiceAssignmentView {
  const state = requiredAssignmentState(query, serviceId);
  const rows = query.all<{ selector_kind: "all" | "group" | "user"; target_id: string | null }>(`
    SELECT selector_kind, coalesce(group_id, user_id) AS target_id
    FROM service_principal_assignments
    WHERE service_id = ?
    ORDER BY selector_kind, target_id
  `, [serviceId]);
  let selector: NormalizedPrincipalSelector | undefined;
  if (rows.some(({ selector_kind }) => selector_kind === "all")) {
    selector = { kind: "all", groupIds: [], userIds: [] };
  } else if (rows.length > 0) {
    selector = {
      kind: "explicit",
      groupIds: rows.filter(({ selector_kind }) => selector_kind === "group")
        .map(({ target_id }) => target_id!),
      userIds: rows.filter(({ selector_kind }) => selector_kind === "user")
        .map(({ target_id }) => target_id!),
    };
  }
  return {
    serviceId,
    ...(selector === undefined ? {} : { selector }),
    version: state.version,
    authorizationGeneration: state.authorization_generation,
  };
}

function validateSelectorTargets(
  query: Pick<PersistenceQuery, "get" | "all">,
  serviceId: string,
  selector: NormalizedPrincipalSelector,
): void {
  if (selector.kind === "all") return;
  if (selector.groupIds.length > 0) {
    const placeholders = selector.groupIds.map(() => "?").join(",");
    const count = query.get<{ count: number }>(`
      SELECT count(*) AS count FROM service_groups
      WHERE service_id = ? AND lifecycle = 'active' AND id IN (${placeholders})
    `, [serviceId, ...selector.groupIds])?.count ?? -1;
    if (count !== selector.groupIds.length) throw new PersistenceError("identity_not_found");
  }
  requireActiveOrdinaryUsers(query, selector.userIds);
}

function requireActiveOrdinaryUsers(
  query: Pick<PersistenceQuery, "get">,
  userIds: readonly string[],
): void {
  if (userIds.length === 0) return;
  const placeholders = userIds.map(() => "?").join(",");
  const count = query.get<{ count: number }>(`
    SELECT count(*) AS count FROM users
    WHERE id IN (${placeholders}) AND role = 'user' AND status = 'active'
  `, userIds)?.count ?? -1;
  if (count !== userIds.length) throw new PersistenceError("identity_not_found");
}

function memberIds(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
  groupId: string,
): string[] {
  return query.all<{ user_id: string }>(`
    SELECT user_id FROM service_group_members
    WHERE service_id = ? AND group_id = ? ORDER BY user_id
  `, [serviceId, groupId]).map(({ user_id }) => user_id);
}

function groupIsSelected(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
  groupId: string,
): boolean {
  return query.get(`
    SELECT 1 FROM service_principal_assignments
    WHERE service_id = ? AND selector_kind = 'group' AND group_id = ?
  `, [serviceId, groupId]) !== undefined;
}

function effectiveUserIds(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
): string[] {
  return query.all<{ id: string }>(`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.role = 'user' AND u.status = 'active' AND (
      EXISTS (
        SELECT 1 FROM service_principal_assignments all_assignment
        WHERE all_assignment.service_id = ? AND all_assignment.selector_kind = 'all'
      )
      OR EXISTS (
        SELECT 1 FROM service_principal_assignments direct
        WHERE direct.service_id = ? AND direct.selector_kind = 'user'
          AND direct.user_id = u.id
      )
      OR EXISTS (
        SELECT 1
        FROM service_principal_assignments selected
        JOIN service_groups g
          ON g.service_id = selected.service_id AND g.id = selected.group_id
        JOIN service_group_members gm
          ON gm.service_id = g.service_id AND gm.group_id = g.id
        WHERE selected.service_id = ? AND selected.selector_kind = 'group'
          AND g.lifecycle = 'active' AND gm.user_id = u.id
      )
    )
    ORDER BY u.id
  `, [serviceId, serviceId, serviceId]).map(({ id }) => id);
}

function effectiveSelectedGroupUsers(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
  groupId: string,
): string[] {
  return query.all<{ id: string }>(`
    SELECT u.id
    FROM service_group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.service_id = ? AND gm.group_id = ?
      AND u.role = 'user' AND u.status = 'active'
    ORDER BY u.id
  `, [serviceId, groupId]).map(({ id }) => id);
}

function invalidate(
  transaction: PersistenceTransaction,
  uuid: () => string,
  serviceId: string,
  affectedUserIds: readonly string[],
  reason: "service_selector" | "group_membership" | "group_archive" | "group_delete",
): number {
  const now = transaction.timestamp();
  const state = requiredAssignmentState(transaction, serviceId);
  const generation = state.authorization_generation + 1;
  const updated = transaction.get<{ version: number }>(`
    UPDATE service_assignment_states
    SET authorization_generation = ?, version = version + 1, updated_at = ?
    WHERE service_id = ? AND version = ?
    RETURNING version
  `, [generation, now, serviceId, state.version]);
  if (updated === undefined) throw new PersistenceError("identity_stale");
  insertInvalidation(transaction, uuid(), serviceId, null, generation, reason, now);
  for (const userId of [...new Set(affectedUserIds)].sort()) {
    insertInvalidation(transaction, uuid(), serviceId, userId, generation, reason, now);
  }
  return generation;
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  id: string,
  serviceId: string,
  affectedUserId: string | null,
  generation: number,
  reason: string,
  now: number,
): void {
  transaction.run(`
    INSERT INTO assignment_invalidation_events (
      id, service_id, affected_user_id, authorization_generation, reason,
      created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
  `, [id, serviceId, affectedUserId, generation, reason, now]);
}

function insertAssignment(
  transaction: PersistenceTransaction,
  id: string,
  serviceId: string,
  kind: "all" | "group" | "user",
  targetId: string | undefined,
  actorId: string,
  now: number,
): void {
  transaction.run(`
    INSERT INTO service_principal_assignments (
      id, service_id, selector_kind, group_id, user_id,
      assigned_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    serviceId,
    kind,
    kind === "group" ? targetId! : null,
    kind === "user" ? targetId! : null,
    actorId,
    now,
  ]);
}

function groupSelect(suffix: string): string {
  return `
    SELECT g.*,
      (SELECT count(*) FROM service_group_members gm
       WHERE gm.service_id = g.service_id AND gm.group_id = g.id) AS member_count
    FROM service_groups g
    ${suffix}
  `;
}

function projectGroup(row: GroupRow): ServiceGroupView {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    lifecycle: row.lifecycle,
    memberCount: row.member_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeGroupProfile(
  nameValue: unknown,
  descriptionValue: unknown,
): { name: string; normalizedName: string; description?: string } {
  if (typeof nameValue !== "string") throw new GroupAssignmentError("invalid_request");
  const name = nameValue.normalize("NFKC").trim();
  const normalizedName = name.toLocaleLowerCase("und");
  if (
    name.length < 1 ||
    name.length > 120 ||
    normalizedName.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) throw new GroupAssignmentError("invalid_request");
  if (descriptionValue === undefined) return { name, normalizedName };
  if (typeof descriptionValue !== "string") {
    throw new GroupAssignmentError("invalid_request");
  }
  const description = descriptionValue.normalize("NFKC").trim();
  if (
    description.length < 1 ||
    description.length > 1_024 ||
    description.includes("\0")
  ) throw new GroupAssignmentError("invalid_request");
  return { name, normalizedName, description };
}

function normalizeJustification(value: unknown): string {
  if (typeof value !== "string") throw new GroupAssignmentError("invalid_request");
  const justification = value.trim();
  if (
    justification.length < 1 ||
    justification.length > 1_024 ||
    justification.includes("\0")
  ) throw new GroupAssignmentError("invalid_request");
  return justification;
}

function uniqueUuidList(values: readonly string[], maximum: number): string[] {
  if (!Array.isArray(values) || values.length > maximum) {
    throw new GroupAssignmentError("invalid_request");
  }
  const result = values.map((value) => {
    if (!isUuidV7(value)) throw new GroupAssignmentError("invalid_request");
    return value;
  });
  if (new Set(result).size !== result.length) {
    throw new GroupAssignmentError("invalid_request");
  }
  return result.sort();
}

function validateNormalizedSelector(
  selector: NormalizedPrincipalSelector,
): NormalizedPrincipalSelector {
  if (selector === null || typeof selector !== "object") {
    throw new GroupAssignmentError("invalid_request");
  }
  if (selector.kind === "all") {
    if (selector.groupIds.length !== 0 || selector.userIds.length !== 0) {
      throw new GroupAssignmentError("invalid_request");
    }
    return { kind: "all", groupIds: [], userIds: [] };
  }
  if (selector.kind !== "explicit") throw new GroupAssignmentError("invalid_request");
  const groupIds = uniqueUuidList(selector.groupIds, MAX_SERVICE_SELECTORS);
  const userIds = uniqueUuidList(selector.userIds, MAX_SERVICE_SELECTORS);
  if (
    groupIds.length + userIds.length === 0 ||
    groupIds.length + userIds.length > MAX_SERVICE_SELECTORS
  ) throw new GroupAssignmentError("invalid_request");
  return { kind: "explicit", groupIds, userIds };
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function symmetricDifference(left: readonly string[], right: readonly string[]): string[] {
  return [...difference(left, right), ...difference(right, left)].sort();
}

function chunkAuditIds(
  field: string,
  ids: readonly string[],
): NonNullable<AdministrativeAuditEventInput["changes"]> {
  const chunks: NonNullable<AdministrativeAuditEventInput["changes"]> = [];
  for (let index = 0; index < ids.length; index += 20) {
    chunks.push({
      field: `${field}_${Math.floor(index / 20) + 1}`,
      after: JSON.stringify(ids.slice(index, index + 20)),
    });
  }
  return chunks;
}

function groupAudit(
  actor: ControlAuthenticationContext,
  action: string,
  serviceId: string,
  targetId: string,
  correlationId: string,
  changes: NonNullable<AdministrativeAuditEventInput["changes"]>,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: actor.principalId,
      label: `user:${actor.principalId}`,
      role: actor.role,
      authenticationMethod: actor.method,
    },
    action,
    result: "allow",
    target: { type: "service_group", id: targetId, label: `group:${targetId}` },
    serviceId,
    changes,
    correlationId,
    source: { category: "group_assignments" },
  };
}

function mapError(error: unknown): GroupAssignmentError {
  if (error instanceof GroupAssignmentError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found" || error.code === "authentication_failed") {
      return new GroupAssignmentError("not_found");
    }
    if (error.code === "identity_stale") return new GroupAssignmentError("stale");
    if (error.code === "identity_conflict") return new GroupAssignmentError("conflict");
    if (error.code === "idempotency_conflict") {
      return new GroupAssignmentError("idempotency_conflict");
    }
    if (error.code === "database_unavailable") {
      return new GroupAssignmentError("conflict");
    }
  }
  return new GroupAssignmentError("unavailable");
}

function defaultUuid(now: () => number): () => string {
  const generator = new UuidV7Generator({ now });
  return () => generator.next();
}

function groupBody(value: unknown): { name: string; description?: string } {
  if (!isPlainObject(value)) throw new GroupAssignmentError("invalid_request");
  const allowed = new Set(["name", "description"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new GroupAssignmentError("invalid_request");
  }
  const profile = normalizeGroupProfile(value.name, value.description);
  return {
    name: profile.name,
    ...(profile.description === undefined ? {} : { description: profile.description }),
  };
}

function memberBody(value: unknown): string[] {
  if (
    !isPlainObject(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "user_ids") ||
    !Array.isArray(value.user_ids) ||
    value.user_ids.length > 200
  ) throw new GroupAssignmentError("invalid_request");
  return uniqueUuidList(value.user_ids, 200);
}

function justificationBody(value: unknown): string {
  if (
    !isPlainObject(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "justification")
  ) throw new GroupAssignmentError("invalid_request");
  return normalizeJustification(value.justification);
}

function requiredUuid(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) {
    throw new GroupAssignmentError("invalid_request");
  }
  return value;
}

function requiredVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new GroupAssignmentError("invalid_request");
  }
  return Number(value);
}

function requiredCorrelation(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^(?:req_)?[0-9a-f-]{36}$/u.test(value)
  ) throw new GroupAssignmentError("invalid_request");
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
