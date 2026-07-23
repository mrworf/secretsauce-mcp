import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import { ControlCursorCodec } from "./control/contracts.js";
import type { ControlIdempotencyHasher } from "./control/idempotency.js";
import type {
  ControlAuthorizationSeam,
  ControlStepUpOperation,
  ControlStepUpRule,
} from "./control/routeRegistry.js";
import type { ControlCapability, PermissionOutcome } from "./control/permissions.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type { IdempotencyExecutionInput } from "./persistence/idempotency.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import {
  canonicalServiceDraft,
  normalizeServiceProfile,
  type ServiceProfileInput,
} from "./serviceConfiguration.js";
import type { UserRelationshipResolver } from "./identity/userAdministration.js";
import type { AlwaysStepUpHandle } from "./identity/stepUp.js";

const MAX_SERVICE_ADMINS = 200;

export interface ServiceView {
  id: string;
  slug: string;
  name: string;
  description?: string;
  documentationUrl?: string;
  lifecycle: "draft" | "published" | "archived";
  draftMatchesPublished: boolean;
  publicationGeneration: number;
  destinationCount: number;
  adminCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceAdminView {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  status: string;
  createdAt: number;
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  documentation_url: string | null;
  lifecycle: ServiceView["lifecycle"];
  draft_digest: string;
  published_digest: string | null;
  publication_generation: number;
  destination_count: number;
  admin_count: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export class ServiceManagementError extends Error {
  constructor(readonly code:
    | "invalid_request"
    | "forbidden"
    | "not_found"
    | "stale"
    | "conflict"
    | "idempotency_conflict"
    | "unavailable") {
    super("Service management could not be completed.");
    this.name = "ServiceManagementError";
  }
}

export class ServiceRelationshipRepository implements UserRelationshipResolver {
  constructor(private readonly owner: PersistenceOwner) {}

  async assigned(actorUserId: string, serviceId: string): Promise<boolean> {
    if (!isUuidV7(actorUserId) || !isUuidV7(serviceId)) return false;
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => query.get(`
          SELECT 1
          FROM service_admins sa JOIN users u ON u.id = sa.user_id
          WHERE sa.service_id = ? AND sa.user_id = ?
            AND u.role = 'admin' AND u.status = 'active'
        `, [serviceId, actorUserId]) !== undefined),
      });
    } catch {
      return false;
    }
  }

  async relatedServiceIds(actorUserId: string, targetUserId?: string): Promise<readonly string[]> {
    if (!isUuidV7(actorUserId) || targetUserId !== undefined) return [];
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => query.all<{ service_id: string }>(`
          SELECT sa.service_id
          FROM service_admins sa JOIN users u ON u.id = sa.user_id
          WHERE sa.user_id = ? AND u.role = 'admin' AND u.status = 'active'
          ORDER BY sa.service_id
        `, [actorUserId]).map(({ service_id }) => service_id)),
      });
    } catch {
      return [];
    }
  }
}

export class ServiceManagementAuthorization implements ControlAuthorizationSeam {
  constructor(
    private readonly relationships: ServiceRelationshipRepository,
    private readonly delegate: ControlAuthorizationSeam,
  ) {}

  async authorizeScope(
    context: ControlAuthenticationContext,
    capability: ControlCapability,
    outcome: PermissionOutcome,
    request: FastifyRequest,
  ): Promise<boolean> {
    if (outcome === "all_services") return context.role === "superadmin";
    if (outcome === "assigned_services") {
      const serviceId = serviceIdFromRequest(request);
      if (serviceId !== undefined) {
        return this.relationships.assigned(context.principalId, serviceId);
      }
      if (request.routeOptions.url === "/api/v2/services") {
        return (await this.relationships.relatedServiceIds(context.principalId)).length > 0;
      }
      return false;
    }
    if (outcome === "service_names_only" || outcome === "scoped_service") return false;
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

export class ServiceManagementRepository {
  constructor(private readonly owner: PersistenceOwner) {}

  async create(input: {
    actor: ControlAuthenticationContext;
    id: string;
    profile: ServiceProfileInput;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
  }): Promise<{ kind: "executed" | "replayed"; serviceId: string }> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireSuperadmin(transaction, input.actor);
          const result = transaction.idempotent(input.idempotency, () => {
            const count = transaction.get<{ count: number }>(
              "SELECT count(*) AS count FROM services",
            )?.count ?? 1_000;
            if (count >= 1_000) throw new PersistenceError("identity_conflict");
            const now = transaction.timestamp();
            const digest = canonicalServiceDraft({
              formatVersion: 1,
              service: input.profile,
              destinations: [],
            }).digest;
            transaction.run(`
              INSERT INTO services (
                id, slug, name, description, documentation_url, lifecycle,
                draft_digest, published_revision_id, published_digest,
                publication_generation, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, 0, 1, ?, ?)
            `, [
              input.id,
              input.profile.slug,
              input.profile.name,
              input.profile.description ?? null,
              input.profile.documentationUrl ?? null,
              digest,
              now,
              now,
            ]);
            return { value: input.id, resultReference: input.id, responseStatus: 201 };
          });
          const serviceId = result.kind === "executed" ? result.value : result.resultReference;
          return {
            value: { kind: result.kind, serviceId },
            auditInput: serviceAudit(
              input.actor,
              "service.create",
              serviceId,
              input.profile.slug,
              input.correlationId,
              [{ field: "lifecycle", after: "draft" }],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async service(serviceId: string, actor: ControlAuthenticationContext): Promise<ServiceView> {
    if (!isUuidV7(serviceId)) throw new ServiceManagementError("invalid_request");
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          const row = query.get<ServiceRow>(serviceSelect("WHERE s.id = ?"), [serviceId]);
          if (row === undefined || !rowVisible(query, row.id, actor)) {
            throw new PersistenceError("identity_not_found");
          }
          return project(row);
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async list(input: {
    actor: ControlAuthenticationContext;
    limit: number;
    q?: string;
    lifecycle?: ServiceView["lifecycle"];
    lastSlug?: string;
    lastId?: string;
  }): Promise<{ services: ServiceView[]; last?: { slug: string; id: string } }> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          const clauses: string[] = [];
          const parameters: Array<string | number> = [];
          if (input.actor.role === "admin") {
            clauses.push(`EXISTS (
              SELECT 1
              FROM service_admins visible JOIN users actor ON actor.id = visible.user_id
              WHERE visible.service_id = s.id AND visible.user_id = ?
                AND actor.role = 'admin' AND actor.status = 'active'
            )`);
            parameters.push(input.actor.principalId);
          } else if (input.actor.role !== "superadmin") {
            throw new PersistenceError("authentication_failed");
          }
          if (input.q !== undefined) {
            clauses.push("(lower(s.slug) LIKE ? ESCAPE '\\' OR lower(s.name) LIKE ? ESCAPE '\\')");
            const pattern = `%${escapeLike(input.q.toLocaleLowerCase("und"))}%`;
            parameters.push(pattern, pattern);
          }
          if (input.lifecycle !== undefined) {
            clauses.push("s.lifecycle = ?");
            parameters.push(input.lifecycle);
          }
          if (input.lastSlug !== undefined && input.lastId !== undefined) {
            clauses.push("(s.slug > ? OR (s.slug = ? AND s.id > ?))");
            parameters.push(input.lastSlug, input.lastSlug, input.lastId);
          }
          parameters.push(input.limit + 1);
          const rows = query.all<ServiceRow>(serviceSelect(
            `${clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`}
             ORDER BY s.slug, s.id LIMIT ?`,
          ), parameters);
          const page = rows.slice(0, input.limit);
          const last = rows.length > input.limit ? page.at(-1) : undefined;
          return {
            services: page.map(project),
            ...(last === undefined ? {} : { last: { slug: last.slug, id: last.id } }),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async admins(serviceId: string): Promise<ServiceAdminView[]> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => query.all<{
          id: string; email: string; given_name: string; family_name: string;
          status: string; created_at: number;
        }>(`
          SELECT u.id, u.email, u.given_name, u.family_name, u.status, sa.created_at
          FROM service_admins sa JOIN users u ON u.id = sa.user_id
          WHERE sa.service_id = ? ORDER BY u.normalized_email, u.id
        `, [serviceId]).map((row) => ({
          id: row.id,
          email: row.email,
          givenName: row.given_name,
          familyName: row.family_name,
          status: row.status,
          createdAt: row.created_at,
        }))),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async assign(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    userId: string;
    expectedVersion: number;
    remove: boolean;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireSuperadmin(transaction, input.actor);
          const current = transaction.get<ServiceRow>(serviceSelect("WHERE s.id = ?"), [input.serviceId]);
          if (current === undefined) throw new PersistenceError("identity_not_found");
          if (current.version !== input.expectedVersion) throw new PersistenceError("identity_stale");
          if (input.remove) {
            const existing = transaction.get("SELECT 1 FROM service_admins WHERE service_id = ? AND user_id = ?", [
              input.serviceId, input.userId,
            ]);
            if (existing === undefined) throw new PersistenceError("identity_not_found");
            if (current.lifecycle !== "archived" && current.admin_count <= 1) {
              throw new PersistenceError("identity_conflict");
            }
            transaction.run("DELETE FROM service_admins WHERE service_id = ? AND user_id = ?", [
              input.serviceId, input.userId,
            ]);
          } else {
            if (current.admin_count >= MAX_SERVICE_ADMINS) {
              throw new PersistenceError("identity_conflict");
            }
            const target = transaction.get<{ role: string; status: string }>(
              "SELECT role, status FROM users WHERE id = ?",
              [input.userId],
            );
            if (target?.role !== "admin" || target.status !== "active") {
              throw new PersistenceError("identity_not_found");
            }
            transaction.run(`
              INSERT INTO service_admins (service_id, user_id, assigned_by_user_id, created_at)
              VALUES (?, ?, ?, ?)
            `, [input.serviceId, input.userId, input.actor.principalId, transaction.timestamp()]);
          }
          const update = transaction.optimisticUpdate("services", input.serviceId, input.expectedVersion, {
            draft_digest: current.draft_digest,
          });
          if (update.status !== "updated") throw new PersistenceError("identity_stale");
          const row = transaction.get<ServiceRow>(serviceSelect("WHERE s.id = ?"), [input.serviceId]);
          if (row === undefined) throw new PersistenceError("database_unavailable");
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              input.remove ? "service.admin_remove" : "service.admin_assign",
              input.serviceId,
              current.slug,
              input.correlationId,
              [{ field: "service_admin", [input.remove ? "before" : "after"]: input.userId }],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }
}

export class ServiceManagementService {
  readonly #cursor: ControlCursorCodec;
  readonly #uuid: () => string;

  constructor(
    private readonly repository: ServiceManagementRepository,
    private readonly relationships: ServiceRelationshipRepository,
    private readonly idempotency: ControlIdempotencyHasher,
    cursorKey: Buffer,
    options: { now?: () => number; uuid?: () => string } = {},
  ) {
    this.#cursor = new ControlCursorCodec(cursorKey, options.now);
    const generator = new UuidV7Generator(
      options.now === undefined ? {} : { now: options.now },
    );
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  async create(
    actor: ControlAuthenticationContext,
    body: ServiceProfileInput,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ service: ServiceView; replayed: boolean }> {
    const profile = normalizeServiceProfile(body);
    const id = this.nextUuid();
    const result = await this.repository.create({
      actor,
      id,
      profile,
      correlationId,
      idempotency: this.idempotencyInput(actor, "services.create", idempotencyKey, body),
    });
    return {
      service: await this.repository.service(result.serviceId, actor),
      replayed: result.kind === "replayed",
    };
  }

  detail(actor: ControlAuthenticationContext, serviceId: string): Promise<ServiceView> {
    return this.repository.service(serviceId, actor);
  }

  async list(actor: ControlAuthenticationContext, input: {
    limit?: number; cursor?: string; q?: string; lifecycle?: ServiceView["lifecycle"];
  }): Promise<{ services: ServiceView[]; nextCursor?: string }> {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new ServiceManagementError("invalid_request");
    }
    const q = input.q;
    if (q !== undefined && (q !== q.trim() || q.length < 1 || q.length > 512)) {
      throw new ServiceManagementError("invalid_request");
    }
    const serviceIds = actor.role === "admin"
      ? await this.relationships.relatedServiceIds(actor.principalId)
      : [];
    const binding = {
      routeId: "services.list",
      principalId: actor.principalId,
      scopeDigest: digest(actor.role === "superadmin" ? ["all"] : serviceIds),
      sort: "slug-id",
      filterDigest: digest([q ?? "", input.lifecycle ?? ""]),
    };
    let lastSlug: string | undefined;
    let lastId: string | undefined;
    if (input.cursor !== undefined) {
      const last = this.#cursor.decode(input.cursor, binding).lastKey.split(":");
      if (last.length !== 2) throw new ServiceManagementError("invalid_request");
      [lastSlug, lastId] = last;
    }
    const result = await this.repository.list({
      actor,
      limit,
      ...(q === undefined ? {} : { q }),
      ...(input.lifecycle === undefined ? {} : { lifecycle: input.lifecycle }),
      ...(lastSlug === undefined ? {} : { lastSlug, lastId: lastId! }),
    });
    return {
      services: result.services,
      ...(result.last === undefined ? {} : {
        nextCursor: this.#cursor.encode({
          ...binding,
          lastKey: `${result.last.slug}:${result.last.id}`,
        }),
      }),
    };
  }

  admins(actor: ControlAuthenticationContext, serviceId: string): Promise<ServiceAdminView[]> {
    return this.repository.service(serviceId, actor).then(() => this.repository.admins(serviceId));
  }

  assign(
    actor: ControlAuthenticationContext,
    serviceId: string,
    userId: string,
    expectedVersion: number,
    remove: boolean,
    correlationId: string,
  ): Promise<ServiceView> {
    if (!isUuidV7(serviceId) || !isUuidV7(userId) || !Number.isSafeInteger(expectedVersion)) {
      throw new ServiceManagementError("invalid_request");
    }
    return this.repository.assign({
      actor,
      serviceId,
      userId,
      expectedVersion,
      remove,
      correlationId,
    });
  }

  close(): void {
    this.#cursor.close();
  }

  private nextUuid(): string {
    const id = this.#uuid();
    if (!isUuidV7(id)) throw new ServiceManagementError("unavailable");
    return id;
  }

  private idempotencyInput(
    actor: ControlAuthenticationContext,
    routeId: string,
    key: string,
    body: unknown,
  ): IdempotencyExecutionInput {
    try {
      return {
        keyHash: this.idempotency.keyHash({ key, principalId: actor.principalId, routeId }),
        principalId: actor.principalId,
        routeId,
        requestDigest: this.idempotency.requestDigest(body),
      };
    } catch {
      throw new ServiceManagementError("invalid_request");
    }
  }
}

function serviceSelect(suffix: string): string {
  return `
    SELECT s.*,
      (SELECT count(*) FROM service_destinations d WHERE d.service_id = s.id) AS destination_count,
      (SELECT count(*) FROM service_admins a WHERE a.service_id = s.id) AS admin_count
    FROM services s ${suffix}
  `;
}

function project(row: ServiceRow): ServiceView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    ...(row.documentation_url === null ? {} : { documentationUrl: row.documentation_url }),
    lifecycle: row.lifecycle,
    draftMatchesPublished: row.published_digest !== null &&
      row.draft_digest === row.published_digest,
    publicationGeneration: row.publication_generation,
    destinationCount: row.destination_count,
    adminCount: row.admin_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowVisible(
  transaction: Pick<PersistenceTransaction, "get">,
  serviceId: string,
  actor: ControlAuthenticationContext,
): boolean {
  if (actor.role === "superadmin") return true;
  return actor.role === "admin" && transaction.get(
    `SELECT 1
     FROM service_admins sa JOIN users actor ON actor.id = sa.user_id
     WHERE sa.service_id = ? AND sa.user_id = ?
       AND actor.role = 'admin' AND actor.status = 'active'`,
    [serviceId, actor.principalId],
  ) !== undefined;
}

function requireSuperadmin(
  transaction: Pick<PersistenceTransaction, "get">,
  actor: ControlAuthenticationContext,
): void {
  if (actor.method !== "browser_session" || actor.role !== "superadmin") {
    throw new PersistenceError("authentication_failed");
  }
  const current = transaction.get<{ role: string; status: string }>(
    "SELECT role, status FROM users WHERE id = ?",
    [actor.principalId],
  );
  if (current?.role !== "superadmin" || current.status !== "active") {
    throw new PersistenceError("authentication_failed");
  }
}

function serviceAudit(
  actor: ControlAuthenticationContext,
  action: string,
  serviceId: string,
  slug: string,
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
    target: { type: "service", id: serviceId, label: `service:${slug}` },
    serviceId,
    changes,
    correlationId,
    source: { category: "service_management" },
  };
}

function serviceIdFromRequest(request: FastifyRequest): string | undefined {
  const params = request.params;
  if (params === null || typeof params !== "object") return undefined;
  const value = (params as Record<string, unknown>).service_id;
  return typeof value === "string" && isUuidV7(value) ? value : undefined;
}

function mapError(error: unknown): ServiceManagementError {
  if (error instanceof ServiceManagementError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "identity_not_found" || error.code === "authentication_failed") {
      return new ServiceManagementError("not_found");
    }
    if (error.code === "identity_stale") return new ServiceManagementError("stale");
    if (error.code === "identity_conflict") return new ServiceManagementError("conflict");
    if (error.code === "idempotency_conflict") {
      return new ServiceManagementError("idempotency_conflict");
    }
  }
  return new ServiceManagementError("conflict");
}

function digest(values: readonly string[]): string {
  return createHash("sha256").update(values.join("\0")).digest("hex");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
