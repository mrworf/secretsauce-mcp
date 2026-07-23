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
import type { PersistenceQuery, PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import {
  canonicalServiceDraft,
  normalizeServiceDestination,
  normalizeServiceProfile,
  ServiceConfigurationError,
  type ServiceDestinationInput,
  type ServiceDraftDocument,
  type ServiceProfileInput,
} from "./serviceConfiguration.js";
import type { UserRelationshipResolver } from "./identity/userAdministration.js";
import type { AlwaysStepUpHandle } from "./identity/stepUp.js";

const MAX_SERVICE_ADMINS = 200;
const MAX_SERVICE_DESTINATIONS = 64;
const MAX_SERVICE_REVISIONS = 100;
const SERVICE_REVISION_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;

export interface ServiceView {
  id: string;
  slug: string;
  name: string;
  description?: string;
  documentationUrl?: string;
  lifecycle: "draft" | "published" | "archived";
  draftMatchesPublished: boolean;
  publicationGeneration: number;
  publishedRevision?: {
    id: string;
    sequence: number;
    publishedAt: number;
  };
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

export interface ServiceDestinationView extends ServiceDestinationInput {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceDetailView extends ServiceView {
  destinations: ServiceDestinationView[];
}

export interface ServiceValidationIssue {
  code: "service_archived" | "service_admin_required" | "destination_required";
  pointer: "/lifecycle" | "/admins" | "/destinations";
}

export interface ServiceValidationWarning {
  code: "tls_verification_disabled";
  pointer: string;
}

export interface ServiceValidationView {
  valid: boolean;
  draftDigest: string;
  issues: ServiceValidationIssue[];
  warnings: ServiceValidationWarning[];
}

export interface ServiceProfilePatch {
  name?: string;
  description?: string | null;
  documentationUrl?: string | null;
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  documentation_url: string | null;
  lifecycle: ServiceView["lifecycle"];
  draft_digest: string;
  published_revision_id: string | null;
  published_digest: string | null;
  publication_generation: number;
  published_sequence: number | null;
  published_at: number | null;
  destination_count: number;
  admin_count: number;
  version: number;
  created_at: number;
  updated_at: number;
}

interface ServiceDestinationRow {
  id: string;
  service_id: string;
  slug: string;
  base_url: string;
  schemes_json: string;
  hosts_json: string;
  ports_json: string;
  tls_verify: number;
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

  async destinations(
    serviceId: string,
    actor: ControlAuthenticationContext,
  ): Promise<ServiceDestinationView[]> {
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) => {
          requiredScopedService(query, actor, serviceId);
          return destinationRows(query, serviceId).map(projectDestination);
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async updateProfile(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    expectedVersion: number;
    profile: ServiceProfilePatch;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredMutableService(
            transaction,
            input.actor,
            input.serviceId,
            input.expectedVersion,
          );
          const profile = normalizeServiceProfile({
            slug: current.slug,
            name: input.profile.name ?? current.name,
            ...(
              input.profile.description === undefined
                ? current.description === null ? {} : { description: current.description }
                : input.profile.description === null ? {} : { description: input.profile.description }
            ),
            ...(
              input.profile.documentationUrl === undefined
                ? current.documentation_url === null
                  ? {}
                  : { documentationUrl: current.documentation_url }
                : input.profile.documentationUrl === null
                  ? {}
                  : { documentationUrl: input.profile.documentationUrl }
            ),
          });
          const draft = canonicalDraft(transaction, current, profile);
          const update = transaction.optimisticUpdate(
            "services",
            current.id,
            current.version,
            {
              name: profile.name,
              description: profile.description ?? null,
              documentation_url: profile.documentationUrl ?? null,
              draft_digest: draft.digest,
            },
          );
          if (update.status !== "updated") throw new PersistenceError("identity_stale");
          const row = requiredService(transaction, current.id);
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              "service.profile_update",
              current.id,
              current.slug,
              input.correlationId,
              [{ field: "profile", before: "previous", after: "updated" }],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async createDestination(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    destinationId: string;
    expectedVersion: number;
    destination: ServiceDestinationInput;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredMutableService(
            transaction,
            input.actor,
            input.serviceId,
            input.expectedVersion,
          );
          if (current.destination_count >= MAX_SERVICE_DESTINATIONS) {
            throw new PersistenceError("identity_conflict");
          }
          const destination = normalizeServiceDestination(input.destination);
          const now = transaction.timestamp();
          transaction.run(`
            INSERT INTO service_destinations (
              id, service_id, slug, base_url, schemes_json, hosts_json,
              ports_json, tls_verify, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `, [
            input.destinationId,
            current.id,
            destination.slug,
            destination.baseUrl,
            JSON.stringify(destination.schemes),
            JSON.stringify(destination.hosts),
            JSON.stringify(destination.ports),
            destination.tlsVerify ? 1 : 0,
            now,
            now,
          ]);
          const draft = canonicalDraft(transaction, current);
          updateDraftDigest(transaction, current, draft.digest);
          const row = requiredService(transaction, current.id);
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              "service.destination_create",
              current.id,
              current.slug,
              input.correlationId,
              [
                { field: "destination", after: input.destinationId },
                { field: "tls_verify", after: destination.tlsVerify },
              ],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async updateDestination(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    destinationId: string;
    expectedVersion: number;
    destination: Omit<ServiceDestinationInput, "slug">;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredMutableService(
            transaction,
            input.actor,
            input.serviceId,
            input.expectedVersion,
          );
          const stored = transaction.get<ServiceDestinationRow>(
            "SELECT * FROM service_destinations WHERE id = ? AND service_id = ?",
            [input.destinationId, current.id],
          );
          if (stored === undefined) throw new PersistenceError("identity_not_found");
          const destination = normalizeServiceDestination({
            slug: stored.slug,
            ...input.destination,
          });
          const updated = transaction.run(`
            UPDATE service_destinations
            SET base_url = ?, schemes_json = ?, hosts_json = ?, ports_json = ?,
                tls_verify = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND service_id = ?
          `, [
            destination.baseUrl,
            JSON.stringify(destination.schemes),
            JSON.stringify(destination.hosts),
            JSON.stringify(destination.ports),
            destination.tlsVerify ? 1 : 0,
            transaction.timestamp(),
            stored.id,
            current.id,
          ]);
          if (updated.changes !== 1) throw new PersistenceError("identity_stale");
          const draft = canonicalDraft(transaction, current);
          updateDraftDigest(transaction, current, draft.digest);
          const row = requiredService(transaction, current.id);
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              "service.destination_update",
              current.id,
              current.slug,
              input.correlationId,
              [
                { field: "destination", after: stored.id },
                {
                  field: "tls_verify",
                  before: stored.tls_verify === 1,
                  after: destination.tlsVerify,
                },
              ],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async deleteDestination(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    destinationId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredMutableService(
            transaction,
            input.actor,
            input.serviceId,
            input.expectedVersion,
          );
          const removed = transaction.run(
            "DELETE FROM service_destinations WHERE id = ? AND service_id = ?",
            [input.destinationId, current.id],
          );
          if (removed.changes !== 1) throw new PersistenceError("identity_not_found");
          const draft = canonicalDraft(transaction, current);
          updateDraftDigest(transaction, current, draft.digest);
          const row = requiredService(transaction, current.id);
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              "service.destination_delete",
              current.id,
              current.slug,
              input.correlationId,
              [{ field: "destination", before: input.destinationId }],
            ),
          };
        }),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async validate(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    correlationId: string;
  }): Promise<ServiceValidationView> {
    try {
      return await this.owner.execute({
        run: (database) => {
          const preview = database.read((query) => {
            const current = requiredScopedService(query, input.actor, input.serviceId);
            return validationView(query, current);
          });
          database.appendAdministrativeAudit(validationAudit(
            input.actor,
            input.serviceId,
            input.correlationId,
            preview,
          ));
          return preview;
        },
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  async publish(input: {
    actor: ControlAuthenticationContext;
    serviceId: string;
    expectedVersion: number;
    revisionId: string;
    invalidationId: string;
    correlationId: string;
  }): Promise<ServiceView> {
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const current = requiredMutableService(
            transaction,
            input.actor,
            input.serviceId,
            input.expectedVersion,
          );
          const preview = validationView(transaction, current);
          if (!preview.valid) throw new PersistenceError("identity_conflict");
          const draft = canonicalDraft(transaction, current);
          if (
            current.published_digest !== null &&
            current.published_digest === draft.digest
          ) throw new PersistenceError("identity_conflict");
          const now = transaction.timestamp();
          pruneRevisions(transaction, current, now);
          const count = transaction.get<{ count: number }>(
            "SELECT count(*) AS count FROM service_config_versions WHERE service_id = ?",
            [current.id],
          )?.count ?? MAX_SERVICE_REVISIONS;
          if (count >= MAX_SERVICE_REVISIONS) {
            throw new PersistenceError("identity_conflict");
          }
          const sequence = (transaction.get<{ sequence: number }>(
            "SELECT max(sequence) AS sequence FROM service_config_versions WHERE service_id = ?",
            [current.id],
          )?.sequence ?? 0) + 1;
          const generation = current.publication_generation + 1;
          if (!Number.isSafeInteger(sequence) || !Number.isSafeInteger(generation)) {
            throw new PersistenceError("database_unavailable");
          }
          transaction.run(`
            INSERT INTO service_config_versions (
              id, service_id, sequence, document_json, digest, source_revision_id,
              publication_generation, actor_user_id, actor_role, published_at
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
          `, [
            input.revisionId,
            current.id,
            sequence,
            draft.json,
            draft.digest,
            generation,
            input.actor.principalId,
            input.actor.role,
            now,
          ]);
          const update = transaction.optimisticUpdate(
            "services",
            current.id,
            current.version,
            {
              lifecycle: "published",
              draft_digest: draft.digest,
              published_revision_id: input.revisionId,
              published_digest: draft.digest,
              publication_generation: generation,
            },
          );
          if (update.status !== "updated") throw new PersistenceError("identity_stale");
          transaction.run(`
            INSERT INTO service_invalidation_events (
              id, service_id, publication_generation, reason, created_at,
              dispatched_at, attempts
            ) VALUES (?, ?, ?, 'publication', ?, NULL, 0)
          `, [input.invalidationId, current.id, generation, now]);
          const row = requiredService(transaction, current.id);
          return {
            value: project(row),
            auditInput: serviceAudit(
              input.actor,
              "service.publish",
              current.id,
              current.slug,
              input.correlationId,
              [
                { field: "lifecycle", before: current.lifecycle, after: "published" },
                {
                  field: "publication_generation",
                  before: current.publication_generation,
                  after: generation,
                },
                { field: "revision", after: input.revisionId },
              ],
            ),
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
    const profile = safeProfile(body);
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

  async detail(
    actor: ControlAuthenticationContext,
    serviceId: string,
  ): Promise<ServiceDetailView> {
    const service = await this.repository.service(serviceId, actor);
    return {
      ...service,
      destinations: await this.repository.destinations(serviceId, actor),
    };
  }

  async updateProfile(
    actor: ControlAuthenticationContext,
    serviceId: string,
    expectedVersion: number,
    profile: ServiceProfilePatch,
    correlationId: string,
  ): Promise<ServiceDetailView> {
    if (!isUuidV7(serviceId) || !Number.isSafeInteger(expectedVersion)) {
      throw new ServiceManagementError("invalid_request");
    }
    if (Object.keys(profile).length < 1) {
      throw new ServiceManagementError("invalid_request");
    }
    if (profile.name !== undefined) {
      safeProfile({ slug: "service", name: profile.name });
    }
    if (profile.description !== undefined && profile.description !== null) {
      safeProfile({ slug: "service", name: "Service", description: profile.description });
    }
    if (profile.documentationUrl !== undefined && profile.documentationUrl !== null) {
      safeProfile({
        slug: "service",
        name: "Service",
        documentationUrl: profile.documentationUrl,
      });
    }
    await this.repository.updateProfile({
      actor,
      serviceId,
      expectedVersion,
      profile,
      correlationId,
    });
    return this.detail(actor, serviceId);
  }

  async createDestination(
    actor: ControlAuthenticationContext,
    serviceId: string,
    expectedVersion: number,
    destination: ServiceDestinationInput,
    correlationId: string,
  ): Promise<ServiceDetailView> {
    if (!isUuidV7(serviceId) || !Number.isSafeInteger(expectedVersion)) {
      throw new ServiceManagementError("invalid_request");
    }
    const normalized = safeDestination(destination);
    await this.repository.createDestination({
      actor,
      serviceId,
      destinationId: this.nextUuid(),
      expectedVersion,
      destination: {
        slug: normalized.slug,
        baseUrl: normalized.baseUrl,
        schemes: normalized.schemes,
        hosts: normalized.hosts,
        ports: normalized.ports,
        tlsVerify: normalized.tlsVerify,
      },
      correlationId,
    });
    return this.detail(actor, serviceId);
  }

  async updateDestination(
    actor: ControlAuthenticationContext,
    serviceId: string,
    destinationId: string,
    expectedVersion: number,
    destination: Omit<ServiceDestinationInput, "slug">,
    correlationId: string,
  ): Promise<ServiceDetailView> {
    if (
      !isUuidV7(serviceId) ||
      !isUuidV7(destinationId) ||
      !Number.isSafeInteger(expectedVersion)
    ) throw new ServiceManagementError("invalid_request");
    const normalized = safeDestination({ slug: "destination", ...destination });
    await this.repository.updateDestination({
      actor,
      serviceId,
      destinationId,
      expectedVersion,
      destination: {
        baseUrl: normalized.baseUrl,
        schemes: normalized.schemes,
        hosts: normalized.hosts,
        ports: normalized.ports,
        tlsVerify: normalized.tlsVerify,
      },
      correlationId,
    });
    return this.detail(actor, serviceId);
  }

  async deleteDestination(
    actor: ControlAuthenticationContext,
    serviceId: string,
    destinationId: string,
    expectedVersion: number,
    correlationId: string,
  ): Promise<ServiceDetailView> {
    if (
      !isUuidV7(serviceId) ||
      !isUuidV7(destinationId) ||
      !Number.isSafeInteger(expectedVersion)
    ) throw new ServiceManagementError("invalid_request");
    await this.repository.deleteDestination({
      actor,
      serviceId,
      destinationId,
      expectedVersion,
      correlationId,
    });
    return this.detail(actor, serviceId);
  }

  validate(
    actor: ControlAuthenticationContext,
    serviceId: string,
    correlationId: string,
  ): Promise<ServiceValidationView> {
    if (!isUuidV7(serviceId)) throw new ServiceManagementError("invalid_request");
    return this.repository.validate({ actor, serviceId, correlationId });
  }

  async publish(
    actor: ControlAuthenticationContext,
    serviceId: string,
    expectedVersion: number,
    correlationId: string,
  ): Promise<ServiceDetailView> {
    if (!isUuidV7(serviceId) || !Number.isSafeInteger(expectedVersion)) {
      throw new ServiceManagementError("invalid_request");
    }
    await this.repository.publish({
      actor,
      serviceId,
      expectedVersion,
      revisionId: this.nextUuid(),
      invalidationId: this.nextUuid(),
      correlationId,
    });
    return this.detail(actor, serviceId);
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

function requiredService(
  query: Pick<PersistenceQuery, "get">,
  serviceId: string,
): ServiceRow {
  const row = query.get<ServiceRow>(serviceSelect("WHERE s.id = ?"), [serviceId]);
  if (row === undefined) throw new PersistenceError("identity_not_found");
  return row;
}

function requiredScopedService(
  query: Pick<PersistenceQuery, "get">,
  actor: ControlAuthenticationContext,
  serviceId: string,
): ServiceRow {
  if (actor.method !== "browser_session") {
    throw new PersistenceError("authentication_failed");
  }
  const currentActor = query.get<{ role: string; status: string }>(
    "SELECT role, status FROM users WHERE id = ?",
    [actor.principalId],
  );
  if (
    currentActor?.status !== "active" ||
    currentActor.role !== actor.role ||
    (currentActor.role !== "admin" && currentActor.role !== "superadmin")
  ) throw new PersistenceError("identity_not_found");
  const service = requiredService(query, serviceId);
  if (currentActor.role === "superadmin") return service;
  const assigned = query.get(
    "SELECT 1 FROM service_admins WHERE service_id = ? AND user_id = ?",
    [serviceId, actor.principalId],
  );
  if (assigned === undefined) throw new PersistenceError("identity_not_found");
  return service;
}

function requiredMutableService(
  transaction: PersistenceTransaction,
  actor: ControlAuthenticationContext,
  serviceId: string,
  expectedVersion: number,
): ServiceRow {
  const service = requiredScopedService(transaction, actor, serviceId);
  if (service.version !== expectedVersion) throw new PersistenceError("identity_stale");
  if (service.lifecycle === "archived") throw new PersistenceError("identity_conflict");
  return service;
}

function destinationRows(
  query: Pick<PersistenceQuery, "all">,
  serviceId: string,
): ServiceDestinationRow[] {
  return query.all<ServiceDestinationRow>(`
    SELECT *
    FROM service_destinations
    WHERE service_id = ?
    ORDER BY slug, id
  `, [serviceId]);
}

function projectDestination(row: ServiceDestinationRow): ServiceDestinationView {
  try {
    const normalized = normalizeServiceDestination({
      slug: row.slug,
      baseUrl: row.base_url,
      schemes: JSON.parse(row.schemes_json) as ServiceDestinationInput["schemes"],
      hosts: JSON.parse(row.hosts_json) as ServiceDestinationInput["hosts"],
      ports: JSON.parse(row.ports_json) as number[],
      tlsVerify: row.tls_verify === 1,
    });
    return {
      id: row.id,
      slug: normalized.slug,
      baseUrl: normalized.baseUrl,
      schemes: normalized.schemes,
      hosts: normalized.hosts,
      ports: normalized.ports,
      tlsVerify: normalized.tlsVerify,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function canonicalDraft(
  query: Pick<PersistenceQuery, "all">,
  service: ServiceRow,
  profile: ServiceProfileInput = {
    slug: service.slug,
    name: service.name,
    ...(service.description === null ? {} : { description: service.description }),
    ...(service.documentation_url === null
      ? {}
      : { documentationUrl: service.documentation_url }),
  },
): ReturnType<typeof canonicalServiceDraft> {
  const document: ServiceDraftDocument = {
    formatVersion: 1,
    service: profile,
    destinations: destinationRows(query, service.id).map((row) => {
      const destination = projectDestination(row);
      return {
        id: destination.id,
        slug: destination.slug,
        baseUrl: destination.baseUrl,
        schemes: destination.schemes,
        hosts: destination.hosts,
        ports: destination.ports,
        tlsVerify: destination.tlsVerify,
      };
    }),
  };
  try {
    return canonicalServiceDraft(document);
  } catch {
    throw new PersistenceError("database_unavailable");
  }
}

function updateDraftDigest(
  transaction: PersistenceTransaction,
  service: ServiceRow,
  digestValue: string,
): void {
  const update = transaction.optimisticUpdate(
    "services",
    service.id,
    service.version,
    { draft_digest: digestValue },
  );
  if (update.status !== "updated") throw new PersistenceError("identity_stale");
}

function validationView(
  query: Pick<PersistenceQuery, "get" | "all">,
  service: ServiceRow,
): ServiceValidationView {
  const draft = canonicalDraft(query, service);
  const issues: ServiceValidationIssue[] = [];
  if (service.lifecycle === "archived") {
    issues.push({ code: "service_archived", pointer: "/lifecycle" });
  }
  const activeAdmins = query.get<{ count: number }>(`
    SELECT count(*) AS count
    FROM service_admins sa JOIN users u ON u.id = sa.user_id
    WHERE sa.service_id = ? AND u.role = 'admin' AND u.status = 'active'
  `, [service.id])?.count ?? 0;
  if (activeAdmins < 1) {
    issues.push({ code: "service_admin_required", pointer: "/admins" });
  }
  if (draft.document.destinations.length < 1) {
    issues.push({ code: "destination_required", pointer: "/destinations" });
  }
  const warnings: ServiceValidationWarning[] = [];
  draft.document.destinations.forEach((destination, index) => {
    if (!destination.tlsVerify) {
      warnings.push({
        code: "tls_verification_disabled",
        pointer: `/destinations/${index}/tls_verify`,
      });
    }
  });
  return {
    valid: issues.length === 0,
    draftDigest: draft.digest,
    issues,
    warnings,
  };
}

function pruneRevisions(
  transaction: PersistenceTransaction,
  service: ServiceRow,
  now: number,
): void {
  const count = transaction.get<{ count: number }>(
    "SELECT count(*) AS count FROM service_config_versions WHERE service_id = ?",
    [service.id],
  )?.count ?? MAX_SERVICE_REVISIONS;
  if (count < MAX_SERVICE_REVISIONS) return;
  const cutoff = Math.max(0, now - SERVICE_REVISION_RETENTION_MS);
  transaction.run(`
    DELETE FROM service_config_versions
    WHERE id IN (
      SELECT id
      FROM service_config_versions
      WHERE service_id = ? AND published_at < ?
        AND (? IS NULL OR id <> ?)
      ORDER BY published_at, sequence, id
      LIMIT ?
    )
  `, [
    service.id,
    cutoff,
    service.published_revision_id,
    service.published_revision_id,
    count - MAX_SERVICE_REVISIONS + 1,
  ]);
}

function validationAudit(
  actor: ControlAuthenticationContext,
  serviceId: string,
  correlationId: string,
  validation: ServiceValidationView,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: actor.principalId,
      label: `user:${actor.principalId}`,
      role: actor.role,
      authenticationMethod: actor.method,
    },
    action: "service.validate",
    result: validation.valid ? "allow" : "deny",
    target: { type: "service", id: serviceId, label: `service:${serviceId}` },
    serviceId,
    changes: [
      { field: "validation_valid", after: validation.valid },
      { field: "validation_issue_count", after: validation.issues.length },
      { field: "validation_warning_count", after: validation.warnings.length },
    ],
    correlationId,
    source: { category: "service_management" },
    ...(validation.valid ? {} : { failureCode: "draft_validation_failed" }),
  };
}

function serviceSelect(suffix: string): string {
  return `
    SELECT s.*, published.sequence AS published_sequence,
      published.published_at AS published_at,
      (SELECT count(*) FROM service_destinations d WHERE d.service_id = s.id) AS destination_count,
      (SELECT count(*) FROM service_admins a WHERE a.service_id = s.id) AS admin_count
    FROM services s
    LEFT JOIN service_config_versions published
      ON published.id = s.published_revision_id AND published.service_id = s.id
    ${suffix}
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
    ...(
      row.published_revision_id === null ||
      row.published_sequence === null ||
      row.published_at === null
        ? {}
        : {
            publishedRevision: {
              id: row.published_revision_id,
              sequence: row.published_sequence,
              publishedAt: row.published_at,
            },
          }
    ),
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
  if (error instanceof ServiceConfigurationError) {
    return new ServiceManagementError("invalid_request");
  }
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

function safeProfile(input: ServiceProfileInput): ServiceProfileInput {
  try {
    return normalizeServiceProfile(input);
  } catch {
    throw new ServiceManagementError("invalid_request");
  }
}

function safeDestination(
  input: ServiceDestinationInput,
): ReturnType<typeof normalizeServiceDestination> {
  try {
    return normalizeServiceDestination(input);
  } catch {
    throw new ServiceManagementError("invalid_request");
  }
}

function digest(values: readonly string[]): string {
  return createHash("sha256").update(values.join("\0")).digest("hex");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
