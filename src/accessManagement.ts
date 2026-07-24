import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type {
  IdempotencyExecutionInput,
  IdempotencyExecutionResult,
} from "./persistence/idempotency.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { IdentityConfig } from "./types.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./identity/stepUp.js";
import type {
  ReferenceAggregateCounts,
  ReferenceAggregateSource,
} from "./tokens.js";

export type AccessViewer = {
  userId: string;
  role: "superadmin" | "admin" | "user";
};

export type AccessRecordStatus = "active" | "expired" | "revoked" | "invalid";

export interface AccessPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface SessionAccessItem {
  id: string;
  userId: string;
  userLabel: string;
  role: "superadmin" | "admin" | "user";
  current: boolean;
  issuedAt: number;
  lastUsedAt: number;
  expiresAt: number;
  status: AccessRecordStatus;
}

export interface GrantAccessItem {
  id: string;
  userId: string;
  userLabel: string;
  clientId: string;
  clientIdentifier: string;
  clientName: string;
  resource: string;
  scopes: string[];
  authenticationMethod: "local_password_totp" | "oidc";
  issuedAt: number;
  lastUsedAt: number;
  expiresAt: number;
  status: AccessRecordStatus;
  usable: boolean;
  services: string[];
}

export interface ServiceAccessItem {
  grantId: string;
  userId: string;
  userLabel: string;
  clientId: string;
  clientIdentifier: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  issuedAt: number;
  lastUsedAt: number;
  expiresAt: number;
  oauthGrantStatus: AccessRecordStatus;
  capabilityStatus: "active" | "invalid";
  credentialCount: number;
  policyCount: number;
  references: ReferenceAggregateCounts;
}

export interface AccessRevocationResult {
  targetId: string;
  revoked: boolean;
  sessionsRevoked: number;
  grantsRevoked: number;
}

export type GrantBulkTarget =
  | { kind: "user"; id: string }
  | { kind: "client"; id: string }
  | { kind: "all" };

export type CapabilityInvalidationTarget =
  | { kind: "service" }
  | { kind: "credential"; id: string }
  | { kind: "policy"; id: string }
  | { kind: "assignment"; userId: string };

export interface CapabilityInvalidationResult {
  capabilityStatus: "invalidated";
  invalidatedReferences: number;
}

export class AccessManagementError extends Error {
  constructor(readonly code: "invalid_request" | "forbidden" | "unavailable") {
    super("Access management could not be completed.");
    this.name = "AccessManagementError";
  }
}

interface SessionRow {
  id: string;
  user_id: string;
  email: string;
  given_name: string;
  family_name: string;
  role: "superadmin" | "admin" | "user";
  issued_at: number;
  last_activity_at: number;
  effective_expires_at: number;
  effective_status: AccessRecordStatus;
}

interface GrantRow {
  id: string;
  user_id: string;
  email: string;
  given_name: string;
  family_name: string;
  client_id: string;
  client_identifier: string;
  display_name: string;
  resource: string;
  scopes_json: string;
  authentication_method: "local_password_totp" | "oidc";
  issued_at: number;
  last_used_at: number;
  effective_expires_at: number;
  effective_status: AccessRecordStatus;
  has_effective_service: number;
  service_names_json: string;
}

interface ServiceAccessRow {
  grant_id: string;
  user_id: string;
  email: string;
  given_name: string;
  family_name: string;
  client_id: string;
  client_identifier: string;
  display_name: string;
  service_id: string;
  service_name: string;
  issued_at: number;
  last_used_at: number;
  effective_expires_at: number;
  effective_status: AccessRecordStatus;
  credential_count: number;
  policy_count: number;
}

type CursorKind = "grant" | "session" | "service_access";

export class AccessCursorCodec {
  readonly #key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== 32) throw new AccessManagementError("unavailable");
    this.#key = Buffer.from(key);
  }

  encode(kind: CursorKind, timestamp: number, id: string): string {
    if (!safeTimestamp(timestamp) || !isUuidV7(id)) {
      throw new AccessManagementError("unavailable");
    }
    const payload = Buffer.from(
      JSON.stringify({ version: 1, kind, timestamp, id }),
      "utf8",
    ).toString("base64url");
    const mac = createHmac("sha256", this.#key)
      .update("secretsauce.access-cursor.v1\0", "utf8")
      .update(payload, "ascii")
      .digest("base64url");
    return `${payload}.${mac}`;
  }

  decode(value: string, expectedKind: CursorKind): {
    timestamp: number;
    id: string;
  } {
    try {
      if (value.length < 80 || value.length > 512) throw new Error("invalid");
      const parts = value.split(".");
      if (parts.length !== 2) throw new Error("invalid");
      const [payload, providedMac] = parts as [string, string];
      const decodedPayload = Buffer.from(payload, "base64url");
      if (decodedPayload.toString("base64url") !== payload) {
        throw new Error("invalid");
      }
      const expectedMac = createHmac("sha256", this.#key)
        .update("secretsauce.access-cursor.v1\0", "utf8")
        .update(payload, "ascii")
        .digest();
      const actualMac = Buffer.from(providedMac, "base64url");
      if (
        actualMac.byteLength !== expectedMac.byteLength
        || actualMac.toString("base64url") !== providedMac
        || !timingSafeEqual(actualMac, expectedMac)
      ) throw new Error("invalid");
      const parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(decodedPayload),
      ) as Record<string, unknown>;
      if (
        Object.keys(parsed).sort().join(",") !== "id,kind,timestamp,version"
        || parsed.version !== 1
        || parsed.kind !== expectedKind
        || !safeTimestamp(parsed.timestamp)
        || typeof parsed.id !== "string"
        || !isUuidV7(parsed.id)
      ) throw new Error("invalid");
      return { timestamp: parsed.timestamp, id: parsed.id };
    } catch {
      throw new AccessManagementError("invalid_request");
    }
  }

  close(): void {
    this.#key.fill(0);
  }
}

export class AccessManagementRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly sessions: IdentityConfig["sessions"],
    private readonly oauth: {
      accessTokenTtlMs: number;
      refreshTokenIdleTtlMs: number;
      refreshTokenMaxTtlMs: number;
    },
    private readonly cursors: AccessCursorCodec,
    private readonly now: () => number = Date.now,
    private readonly stepUps?: StepUpRepository,
    private readonly referenceAggregates?: ReferenceAggregateSource,
  ) {}

  async sessionsPage(input: {
    viewer: AccessViewer;
    scope: "own" | "global";
    currentSessionId?: string;
    status?: AccessRecordStatus;
    cursor?: string;
    pageSize?: number;
  }): Promise<AccessPage<SessionAccessItem>> {
    validateViewerScope(input.viewer, input.scope);
    const pageSize = pageSizeValue(input.pageSize);
    const cursor = input.cursor === undefined
      ? undefined
      : this.cursors.decode(input.cursor, "session");
    const now = nowValue(this.now);
    try {
      const rows = await this.owner.execute({
        run: (database) => database.read((query) => query.all<SessionRow>(`
          WITH projected AS (
            SELECT
              session.id, session.user_id,
              user.email, user.given_name, user.family_name, user.role,
              session.issued_at, session.last_activity_at,
              min(
                session.absolute_expires_at,
                session.issued_at + CASE
                  WHEN session.role_class = 'admin' THEN ?
                  ELSE ?
                END,
                session.last_activity_at + CASE
                  WHEN session.role_class = 'admin' THEN ?
                  ELSE ?
                END
              ) AS effective_expires_at,
              CASE
                WHEN session.revoked_at IS NOT NULL THEN 'revoked'
                WHEN user.status <> 'active'
                  OR user.security_epoch <> session.issued_security_epoch
                  OR security.global_security_epoch
                    <> session.issued_global_epoch
                  OR (
                    session.role_class = 'user'
                    AND user.role <> 'user'
                  )
                  OR (
                    session.role_class = 'admin'
                    AND user.role = 'user'
                  )
                THEN 'invalid'
                WHEN min(
                  session.absolute_expires_at,
                  session.issued_at + CASE
                    WHEN session.role_class = 'admin' THEN ?
                    ELSE ?
                  END,
                  session.last_activity_at + CASE
                    WHEN session.role_class = 'admin' THEN ?
                    ELSE ?
                  END
                ) <= ? THEN 'expired'
                ELSE 'active'
              END AS effective_status
            FROM browser_sessions session
            JOIN users user ON user.id = session.user_id
            JOIN identity_security_state security ON security.singleton = 1
            WHERE (? = 'global' OR session.user_id = ?)
          )
          SELECT * FROM projected
          WHERE (? IS NULL OR effective_status = ?)
            AND (
              ? IS NULL
              OR last_activity_at < ?
              OR (last_activity_at = ? AND id > ?)
            )
          ORDER BY last_activity_at DESC, id
          LIMIT ?
        `, [
          this.sessions.adminAbsoluteMs,
          this.sessions.userAbsoluteMs,
          this.sessions.adminInactivityMs,
          this.sessions.userInactivityMs,
          this.sessions.adminAbsoluteMs,
          this.sessions.userAbsoluteMs,
          this.sessions.adminInactivityMs,
          this.sessions.userInactivityMs,
          now,
          input.scope,
          input.viewer.userId,
          input.status ?? null,
          input.status ?? null,
          cursor?.timestamp ?? null,
          cursor?.timestamp ?? null,
          cursor?.timestamp ?? null,
          cursor?.id ?? null,
          pageSize + 1,
        ])),
      });
      const pageRows = rows.slice(0, pageSize);
      return {
        items: pageRows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          userLabel: userLabel(row),
          role: row.role,
          current: row.id === input.currentSessionId,
          issuedAt: row.issued_at,
          lastUsedAt: row.last_activity_at,
          expiresAt: row.effective_expires_at,
          status: row.effective_status,
        })),
        ...(rows.length <= pageSize
          ? {}
          : {
              nextCursor: this.cursors.encode(
                "session",
                pageRows.at(-1)!.last_activity_at,
                pageRows.at(-1)!.id,
              ),
            }),
      };
    } catch (error) {
      if (error instanceof AccessManagementError) throw error;
      throw new AccessManagementError("unavailable");
    }
  }

  async grantsPage(input: {
    viewer: AccessViewer;
    scope: "own" | "global";
    status?: AccessRecordStatus;
    cursor?: string;
    pageSize?: number;
  }): Promise<AccessPage<GrantAccessItem>> {
    validateViewerScope(input.viewer, input.scope);
    const pageSize = pageSizeValue(input.pageSize);
    const cursor = input.cursor === undefined
      ? undefined
      : this.cursors.decode(input.cursor, "grant");
    const now = nowValue(this.now);
    try {
      const rows = await this.owner.execute({
        run: (database) => database.read((query) => query.all<GrantRow>(`
          WITH projected AS (
            SELECT
              grant.id, grant.user_id,
              user.email, user.given_name, user.family_name,
              client.id AS client_id, client.client_identifier,
              client.display_name,
              grant.resource, grant.scopes_json,
              grant.authentication_method,
              grant.issued_at, grant.last_used_at,
              min(
                grant.absolute_expires_at,
                grant.issued_at + ?,
                coalesce(family.absolute_expires_at, grant.absolute_expires_at),
                grant.idle_expires_at,
                coalesce(family.idle_expires_at, grant.idle_expires_at),
                grant.last_used_at + ?
              ) AS effective_expires_at,
              CASE
                WHEN grant.status = 'revoked'
                  OR family.status = 'revoked' THEN 'revoked'
                WHEN user.status <> 'active' OR user.role <> 'user'
                  OR user.security_epoch <> grant.issued_security_epoch
                  OR security.global_security_epoch <> grant.issued_global_epoch
                THEN 'invalid'
                WHEN min(
                  grant.absolute_expires_at,
                  grant.issued_at + ?,
                  coalesce(family.absolute_expires_at, grant.absolute_expires_at),
                  grant.idle_expires_at,
                  coalesce(family.idle_expires_at, grant.idle_expires_at),
                  grant.last_used_at + ?
                ) <= ? THEN 'expired'
                ELSE 'active'
              END AS effective_status,
              ${HAS_EFFECTIVE_SERVICE_SQL} AS has_effective_service,
              ${SERVICE_NAMES_SQL} AS service_names_json
            FROM oauth_grants grant
            JOIN users user ON user.id = grant.user_id
            JOIN oauth_clients client ON client.id = grant.client_id
            LEFT JOIN oauth_refresh_families family
              ON family.grant_id = grant.id
            JOIN identity_security_state security ON security.singleton = 1
            WHERE (? = 'global' OR grant.user_id = ?)
          )
          SELECT * FROM projected
          WHERE (? IS NULL OR effective_status = ?)
            AND (
              ? IS NULL
              OR last_used_at < ?
              OR (last_used_at = ? AND id > ?)
            )
          ORDER BY last_used_at DESC, id
          LIMIT ?
        `, [
          this.oauth.refreshTokenMaxTtlMs,
          this.oauth.refreshTokenIdleTtlMs,
          this.oauth.refreshTokenMaxTtlMs,
          this.oauth.refreshTokenIdleTtlMs,
          now,
          input.scope,
          input.viewer.userId,
          input.status ?? null,
          input.status ?? null,
          cursor?.timestamp ?? null,
          cursor?.timestamp ?? null,
          cursor?.timestamp ?? null,
          cursor?.id ?? null,
          pageSize + 1,
        ])),
      });
      const pageRows = rows.slice(0, pageSize);
      return {
        items: pageRows.map((row) => {
          const scopes = stringArray(row.scopes_json);
          const services = stringArray(row.service_names_json);
          return {
            id: row.id,
            userId: row.user_id,
            userLabel: userLabel(row),
            clientId: row.client_id,
            clientIdentifier: row.client_identifier,
            clientName: row.display_name,
            resource: row.resource,
            scopes,
            authenticationMethod: row.authentication_method,
            issuedAt: row.issued_at,
            lastUsedAt: row.last_used_at,
            expiresAt: row.effective_expires_at,
            status: row.effective_status,
            usable: row.effective_status === "active"
              && row.has_effective_service === 1,
            services,
          };
        }),
        ...(rows.length <= pageSize
          ? {}
          : {
              nextCursor: this.cursors.encode(
                "grant",
                pageRows.at(-1)!.last_used_at,
                pageRows.at(-1)!.id,
              ),
            }),
      };
    } catch (error) {
      if (error instanceof AccessManagementError) throw error;
      throw new AccessManagementError("unavailable");
    }
  }

  async serviceAccessPage(input: {
    viewer: AccessViewer;
    serviceId: string;
    status?: AccessRecordStatus;
    cursor?: string;
    pageSize?: number;
  }): Promise<AccessPage<ServiceAccessItem>> {
    if (
      !isUuidV7(input.viewer.userId)
      || !isUuidV7(input.serviceId)
      || input.viewer.role === "user"
      || this.referenceAggregates === undefined
    ) throw new AccessManagementError("forbidden");
    const pageSize = pageSizeValue(input.pageSize);
    const cursor = input.cursor === undefined
      ? undefined
      : this.cursors.decode(input.cursor, "service_access");
    const now = nowValue(this.now);
    try {
      const queryResult = await this.owner.execute({
        run: (database) => database.read((query) => {
          const authorized = query.get<{ id: string }>(`
            SELECT service.id
            FROM services service
            WHERE service.id = ?
              AND (
                ? = 'superadmin'
                OR EXISTS (
                  SELECT 1 FROM service_admins administrator
                  WHERE administrator.service_id = service.id
                    AND administrator.user_id = ?
                )
              )
          `, [input.serviceId, input.viewer.role, input.viewer.userId]);
          if (authorized === undefined) {
            return { authorized: false as const, rows: [] };
          }
          return {
            authorized: true as const,
            rows: query.all<ServiceAccessRow>(`
            WITH projected AS (
              SELECT
                grant.id AS grant_id, grant.user_id,
                user.email, user.given_name, user.family_name,
                client.id AS client_id, client.client_identifier,
                client.display_name,
                service.id AS service_id, service.name AS service_name,
                grant.issued_at, grant.last_used_at,
                min(
                  grant.absolute_expires_at,
                  grant.issued_at + ?,
                  coalesce(family.absolute_expires_at, grant.absolute_expires_at),
                  grant.idle_expires_at,
                  coalesce(family.idle_expires_at, grant.idle_expires_at),
                  grant.last_used_at + ?
                ) AS effective_expires_at,
                CASE
                  WHEN grant.status = 'revoked'
                    OR family.status = 'revoked' THEN 'revoked'
                  WHEN user.status <> 'active' OR user.role <> 'user'
                    OR user.security_epoch <> grant.issued_security_epoch
                    OR security.global_security_epoch <> grant.issued_global_epoch
                  THEN 'invalid'
                  WHEN min(
                    grant.absolute_expires_at,
                    grant.issued_at + ?,
                    coalesce(family.absolute_expires_at, grant.absolute_expires_at),
                    grant.idle_expires_at,
                    coalesce(family.idle_expires_at, grant.idle_expires_at),
                    grant.last_used_at + ?
                  ) <= ? THEN 'expired'
                  ELSE 'active'
                END AS effective_status,
                (
                  SELECT count(*) FROM service_credentials credential
                  WHERE credential.service_id = service.id
                    AND credential.status = 'configured'
                ) AS credential_count,
                (
                  SELECT count(*) FROM policies policy
                  WHERE policy.service_id = service.id
                    AND policy.lifecycle = 'active'
                ) AS policy_count
              FROM oauth_grants grant
              JOIN users user ON user.id = grant.user_id
              JOIN oauth_clients client ON client.id = grant.client_id
              LEFT JOIN oauth_refresh_families family
                ON family.grant_id = grant.id
              JOIN identity_security_state security ON security.singleton = 1
              JOIN services service ON service.id = ?
                AND service.lifecycle = 'published'
              JOIN runtime_active_services active
                ON active.service_id = service.id
              JOIN runtime_activation activation
                ON activation.singleton = 1 AND activation.state = 'active'
              WHERE ${SERVICE_ASSIGNMENT_PREDICATE}
            )
            SELECT * FROM projected
            WHERE (? IS NULL OR effective_status = ?)
              AND (
                ? IS NULL
                OR last_used_at < ?
                OR (last_used_at = ? AND grant_id > ?)
              )
            ORDER BY last_used_at DESC, grant_id
            LIMIT ?
            `, [
            this.oauth.refreshTokenMaxTtlMs,
            this.oauth.refreshTokenIdleTtlMs,
            this.oauth.refreshTokenMaxTtlMs,
            this.oauth.refreshTokenIdleTtlMs,
            now,
            input.serviceId,
            input.status ?? null,
            input.status ?? null,
            cursor?.timestamp ?? null,
            cursor?.timestamp ?? null,
            cursor?.timestamp ?? null,
            cursor?.id ?? null,
              pageSize + 1,
            ]),
          };
        }),
      });
      if (!queryResult.authorized) throw new AccessManagementError("forbidden");
      const rows = queryResult.rows;
      const pageRows = rows.slice(0, pageSize);
      const items = await Promise.all(pageRows.map(async (row) => ({
        grantId: row.grant_id,
        userId: row.user_id,
        userLabel: userLabel(row),
        clientId: row.client_id,
        clientIdentifier: row.client_identifier,
        clientName: row.display_name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        issuedAt: row.issued_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.effective_expires_at,
        oauthGrantStatus: row.effective_status,
        capabilityStatus: row.effective_status === "active"
          ? "active" as const
          : "invalid" as const,
        credentialCount: row.credential_count,
        policyCount: row.policy_count,
        references: await this.referenceAggregates!.referenceAggregates({
          subject: row.user_id,
          serviceId: row.service_id,
        }),
      })));
      return {
        items,
        ...(rows.length <= pageSize
          ? {}
          : {
              nextCursor: this.cursors.encode(
                "service_access",
                pageRows.at(-1)!.last_used_at,
                pageRows.at(-1)!.grant_id,
              ),
            }),
      };
    } catch (error) {
      throw mapAccessError(error);
    }
  }

  async invalidateCapabilities(input: {
    viewer: AccessViewer;
    serviceId: string;
    target: CapabilityInvalidationTarget;
    eventId: string;
    justification: string;
    correlationId: string;
  }): Promise<CapabilityInvalidationResult> {
    if (
      input.viewer.role === "user"
      || !isUuidV7(input.viewer.userId)
      || !isUuidV7(input.serviceId)
      || !isUuidV7(input.eventId)
      || !CORRELATION_ID.test(input.correlationId)
      || input.justification.trim().length < 1
      || input.justification.length > 1024
      || input.target.kind !== "service"
        && !isUuidV7(
          input.target.kind === "assignment"
            ? input.target.userId
            : input.target.id,
        )
      || this.referenceAggregates === undefined
    ) throw new AccessManagementError("invalid_request");
    const targetId = input.target.kind === "service"
      ? input.serviceId
      : input.target.kind === "assignment"
        ? input.target.userId
        : input.target.id;
    const audit = revocationAudit({
      viewer: input.viewer,
      action: "access.capability_invalidate",
      targetType: `capability_${input.target.kind}`,
      targetId,
      correlationId: input.correlationId,
      justification: input.justification,
    });
    try {
      const filter = await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          requireServiceAdministrator(
            transaction,
            input.viewer,
            input.serviceId,
          );
          const now = transaction.timestamp();
          let filter: {
            subject?: string;
            serviceId: string;
            credentialId?: string;
          } = { serviceId: input.serviceId };
          if (input.target.kind === "credential") {
            const credential = transaction.get<{
              authorization_generation: number;
            }>(`
              SELECT authorization_generation FROM service_credentials
              WHERE id = ? AND service_id = ? AND status <> 'archived'
            `, [input.target.id, input.serviceId]);
            if (credential === undefined) {
              throw new PersistenceError("authentication_failed");
            }
            transaction.run(`
              INSERT INTO credential_invalidation_events (
                id, service_id, credential_id, affected_user_id,
                authorization_generation, reason, created_at,
                dispatched_at, attempts
              ) VALUES (?, ?, ?, NULL, ?, 'selector', ?, NULL, 0)
            `, [
              input.eventId,
              input.serviceId,
              input.target.id,
              Math.max(1, credential.authorization_generation),
              now,
            ]);
            filter = {
              serviceId: input.serviceId,
              credentialId: input.target.id,
            };
          } else if (input.target.kind === "policy") {
            const policy = transaction.get<{ evaluation_generation: number }>(`
              SELECT evaluation_generation FROM policies
              WHERE id = ? AND service_id = ? AND lifecycle = 'active'
            `, [input.target.id, input.serviceId]);
            if (policy === undefined) {
              throw new PersistenceError("authentication_failed");
            }
            transaction.run(`
              INSERT INTO policy_invalidation_events (
                id, service_id, policy_id, rule_id, affected_user_id,
                evaluation_generation, reason, created_at,
                dispatched_at, attempts
              ) VALUES (?, ?, ?, NULL, NULL, ?, 'policy', ?, NULL, 0)
            `, [
              input.eventId,
              input.serviceId,
              input.target.id,
              Math.max(1, policy.evaluation_generation),
              now,
            ]);
          } else {
            const state = transaction.get<{ authorization_generation: number }>(`
              SELECT authorization_generation FROM service_assignment_states
              WHERE service_id = ?
            `, [input.serviceId]);
            if (state === undefined) {
              throw new PersistenceError("authentication_failed");
            }
            const subject = input.target.kind === "assignment"
              ? input.target.userId
              : null;
            if (
              subject !== null
              && transaction.get<{ id: string }>(`
                SELECT grant.id
                FROM oauth_grants grant
                JOIN users user ON user.id = grant.user_id
                JOIN services service ON service.id = ?
                WHERE grant.user_id = ? AND user.role = 'user'
                  AND user.status = 'active'
                  AND ${SERVICE_ASSIGNMENT_PREDICATE}
                LIMIT 1
              `, [input.serviceId, subject]) === undefined
            ) throw new PersistenceError("authentication_failed");
            transaction.run(`
              INSERT INTO assignment_invalidation_events (
                id, service_id, affected_user_id,
                authorization_generation, reason, created_at,
                dispatched_at, attempts
              ) VALUES (?, ?, ?, ?, 'service_selector', ?, NULL, 0)
            `, [
              input.eventId,
              input.serviceId,
              subject,
              Math.max(1, state.authorization_generation),
              now,
            ]);
            if (subject !== null) {
              filter = { subject, serviceId: input.serviceId };
            }
          }
          return {
            value: filter,
            auditInput: {
              ...audit,
              changes: [{
                field: "capability_status",
                before: "active",
                after: "invalidated",
              }],
            },
          };
        }),
      });
      const invalidatedReferences =
        await this.referenceAggregates.invalidate(filter);
      if (
        !Number.isSafeInteger(invalidatedReferences)
        || invalidatedReferences < 0
      ) throw new AccessManagementError("unavailable");
      return {
        capabilityStatus: "invalidated",
        invalidatedReferences,
      };
    } catch (error) {
      throw mapAccessError(error);
    }
  }

  async revokeSession(input: {
    viewer: AccessViewer;
    sessionId: string;
    correlationId: string;
  }): Promise<AccessRevocationResult> {
    validateMutationInput(input.viewer, input.sessionId, input.correlationId);
    const audit = revocationAudit({
      viewer: input.viewer,
      action: "access.session_revoke",
      targetType: "session",
      targetId: input.sessionId,
      correlationId: input.correlationId,
    });
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const now = transaction.timestamp();
          const changed = transaction.run(`
            UPDATE browser_sessions
            SET revoked_at = ?, version = version + 1
            WHERE id = ? AND revoked_at IS NULL
              AND (? = 'superadmin' OR user_id = ?)
          `, [
            now,
            input.sessionId,
            input.viewer.role,
            input.viewer.userId,
          ]).changes;
          return {
            value: {
              targetId: input.sessionId,
              revoked: changed === 1,
              sessionsRevoked: changed,
              grantsRevoked: 0,
            },
            auditInput: {
              ...audit,
              changes: [{ field: "sessions_revoked", after: changed }],
            },
          };
        }),
      });
    } catch (error) {
      throw mapAccessError(error);
    }
  }

  async revokeGrant(input: {
    viewer: AccessViewer;
    grantId: string;
    correlationId: string;
  }): Promise<AccessRevocationResult> {
    validateMutationInput(input.viewer, input.grantId, input.correlationId);
    const audit = revocationAudit({
      viewer: input.viewer,
      action: "oauth.grant_revoke",
      targetType: "oauth_grant",
      targetId: input.grantId,
      correlationId: input.correlationId,
    });
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          const result = revokeGrantSet(
            transaction,
            `grant.id = ? AND (? = 'superadmin' OR grant.user_id = ?)`,
            [input.grantId, input.viewer.role, input.viewer.userId],
          );
          return {
            value: {
              targetId: input.grantId,
              revoked: result.grantsRevoked === 1,
              sessionsRevoked: 0,
              grantsRevoked: result.grantsRevoked,
            },
            auditInput: {
              ...audit,
              changes: [
                { field: "grants_revoked", after: result.grantsRevoked },
                { field: "refresh_families_revoked", after: result.familiesRevoked },
                { field: "refresh_records_revoked", after: result.refreshTokensRevoked },
                { field: "access_records_revoked", after: result.accessTokensRevoked },
              ],
            },
          };
        }),
      });
    } catch (error) {
      throw mapAccessError(error);
    }
  }

  async revokeGrantBulk(input: {
    viewer: AccessViewer;
    target: GrantBulkTarget;
    confirmation: string;
    justification: string;
    correlationId: string;
    idempotency: IdempotencyExecutionInput;
    stepUpProof?: AlwaysStepUpHandle;
  }): Promise<IdempotencyExecutionResult<AccessRevocationResult>> {
    validateBulkInput(input);
    if (this.stepUps === undefined || input.stepUpProof === undefined) {
      throw new AccessManagementError("forbidden");
    }
    const targetId = input.target.kind === "all"
      ? input.viewer.userId
      : input.target.id;
    const action = input.target.kind === "user"
      ? "oauth.user_revoke"
      : input.target.kind === "client"
        ? "oauth.client_revoke"
        : "oauth.global_revoke";
    const audit = revocationAudit({
      viewer: input.viewer,
      action,
      targetType: input.target.kind === "all"
        ? "oauth_grants"
        : input.target.kind,
      targetId,
      correlationId: input.correlationId,
      justification: input.justification,
    });
    const execute = (transaction: PersistenceTransaction) =>
      transaction.idempotent(input.idempotency, () => {
        const predicate = input.target.kind === "user"
          ? { sql: "grant.user_id = ?", values: [input.target.id] }
          : input.target.kind === "client"
            ? { sql: "grant.client_id = ?", values: [input.target.id] }
            : { sql: "1 = 1", values: [] };
        const result = revokeGrantSet(transaction, predicate.sql, predicate.values);
        return {
          value: {
            targetId,
            revoked: result.grantsRevoked > 0,
            sessionsRevoked: 0,
            grantsRevoked: result.grantsRevoked,
          },
          resultReference: targetId,
          responseStatus: 200,
        };
      });
    try {
      return await this.stepUps.withConsumedProof(
        input.stepUpProof,
        {
          ...audit,
          changes: [{ field: "grant_scope", after: input.target.kind }],
        },
        execute,
      );
    } catch (error) {
      throw mapAccessError(error);
    }
  }
}

const EFFECTIVE_ASSIGNMENT_SQL = `
  EXISTS (
    SELECT 1
    FROM runtime_active_services active
    JOIN services service
      ON service.id = active.service_id
      AND service.lifecycle = 'published'
    JOIN runtime_activation activation
      ON activation.singleton = 1 AND activation.state = 'active'
    JOIN service_principal_assignments assignment
      ON assignment.service_id = active.service_id
    WHERE (
      assignment.selector_kind = 'all'
      OR (
        assignment.selector_kind = 'user'
        AND assignment.user_id = grant.user_id
      )
      OR (
        assignment.selector_kind = 'group'
        AND EXISTS (
          SELECT 1
          FROM service_group_members member
          JOIN service_groups service_group
            ON service_group.id = member.group_id
            AND service_group.service_id = member.service_id
          WHERE member.service_id = assignment.service_id
            AND member.group_id = assignment.group_id
            AND member.user_id = grant.user_id
            AND service_group.lifecycle = 'active'
        )
      )
    )
  )
`;

const HAS_EFFECTIVE_SERVICE_SQL = `(${EFFECTIVE_ASSIGNMENT_SQL})`;

const SERVICE_NAMES_SQL = `
  coalesce((
    SELECT json_group_array(name)
    FROM (
      SELECT DISTINCT service.name AS name
      FROM runtime_active_services active
      JOIN services service
        ON service.id = active.service_id
        AND service.lifecycle = 'published'
      JOIN runtime_activation activation
        ON activation.singleton = 1 AND activation.state = 'active'
      JOIN service_principal_assignments assignment
        ON assignment.service_id = active.service_id
      WHERE (
        assignment.selector_kind = 'all'
        OR (
          assignment.selector_kind = 'user'
          AND assignment.user_id = grant.user_id
        )
        OR (
          assignment.selector_kind = 'group'
          AND EXISTS (
            SELECT 1
            FROM service_group_members member
            JOIN service_groups service_group
              ON service_group.id = member.group_id
              AND service_group.service_id = member.service_id
            WHERE member.service_id = assignment.service_id
              AND member.group_id = assignment.group_id
              AND member.user_id = grant.user_id
              AND service_group.lifecycle = 'active'
          )
        )
      )
      ORDER BY service.name
    )
  ), '[]')
`;

const SERVICE_ASSIGNMENT_PREDICATE = `
  EXISTS (
    SELECT 1
    FROM service_principal_assignments assignment
    WHERE assignment.service_id = service.id
      AND (
        assignment.selector_kind = 'all'
        OR (
          assignment.selector_kind = 'user'
          AND assignment.user_id = grant.user_id
        )
        OR (
          assignment.selector_kind = 'group'
          AND EXISTS (
            SELECT 1
            FROM service_group_members member
            JOIN service_groups service_group
              ON service_group.id = member.group_id
              AND service_group.service_id = member.service_id
            WHERE member.service_id = assignment.service_id
              AND member.group_id = assignment.group_id
              AND member.user_id = grant.user_id
              AND service_group.lifecycle = 'active'
          )
        )
      )
  )
`;

function revokeGrantSet(
  transaction: PersistenceTransaction,
  predicate: string,
  parameters: readonly (string | number | null)[],
): {
  grantsRevoked: number;
  familiesRevoked: number;
  refreshTokensRevoked: number;
  accessTokensRevoked: number;
} {
  if (
    ![
      "grant.id = ? AND (? = 'superadmin' OR grant.user_id = ?)",
      "grant.user_id = ?",
      "grant.client_id = ?",
      "1 = 1",
    ].includes(predicate)
  ) throw new AccessManagementError("unavailable");
  const now = transaction.timestamp();
  const selected = `
    SELECT grant.id FROM oauth_grants grant
    WHERE ${predicate}
  `;
  const refreshTokensRevoked = transaction.run(`
    UPDATE oauth_refresh_tokens
    SET status = 'revoked', used_at = coalesce(used_at, ?)
    WHERE status = 'active'
      AND family_id IN (
        SELECT family.id
        FROM oauth_refresh_families family
        WHERE family.grant_id IN (${selected})
      )
  `, [now, ...parameters]).changes;
  const accessTokensRevoked = transaction.run(`
    UPDATE oauth_access_tokens
    SET status = 'revoked'
    WHERE status = 'active' AND grant_id IN (${selected})
  `, parameters).changes;
  const familiesRevoked = transaction.run(`
    UPDATE oauth_refresh_families
    SET status = 'revoked', revoked_at = ?,
      revocation_reason = 'manual', version = version + 1
    WHERE status = 'active' AND grant_id IN (${selected})
  `, [now, ...parameters]).changes;
  const grantsRevoked = transaction.run(`
    UPDATE oauth_grants AS grant
    SET status = 'revoked', revoked_at = ?,
      revocation_reason = 'manual', version = version + 1
    WHERE status = 'active' AND ${predicate}
  `, [now, ...parameters]).changes;
  return {
    grantsRevoked,
    familiesRevoked,
    refreshTokensRevoked,
    accessTokensRevoked,
  };
}

function requireServiceAdministrator(
  transaction: PersistenceTransaction,
  viewer: AccessViewer,
  serviceId: string,
): void {
  const authorized = transaction.get<{ id: string }>(`
    SELECT service.id
    FROM services service
    WHERE service.id = ?
      AND (
        ? = 'superadmin'
        OR EXISTS (
          SELECT 1 FROM service_admins administrator
          WHERE administrator.service_id = service.id
            AND administrator.user_id = ?
        )
      )
  `, [serviceId, viewer.role, viewer.userId]);
  if (authorized === undefined) {
    throw new PersistenceError("authentication_failed");
  }
}

function validateMutationInput(
  viewer: AccessViewer,
  targetId: string,
  correlationId: string,
): void {
  if (
    !isUuidV7(viewer.userId)
    || !isUuidV7(targetId)
    || !CORRELATION_ID.test(correlationId)
  ) throw new AccessManagementError("invalid_request");
}

function validateBulkInput(input: {
  viewer: AccessViewer;
  target: GrantBulkTarget;
  confirmation: string;
  justification: string;
  correlationId: string;
}): void {
  if (
    input.viewer.role !== "superadmin"
    || !isUuidV7(input.viewer.userId)
    || !CORRELATION_ID.test(input.correlationId)
    || input.justification.trim().length < 1
    || input.justification.length > 1024
    || input.target.kind !== "all" && !isUuidV7(input.target.id)
  ) throw new AccessManagementError("forbidden");
  const expected = input.target.kind === "user"
    ? `REVOKE USER ${input.target.id}`
    : input.target.kind === "client"
      ? `REVOKE CLIENT ${input.target.id}`
      : "REVOKE ALL OAUTH GRANTS";
  if (input.confirmation !== expected) {
    throw new AccessManagementError("invalid_request");
  }
}

function revocationAudit(input: {
  viewer: AccessViewer;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  justification?: string;
}): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.viewer.userId,
      label: `user:${input.viewer.userId}`,
      role: input.viewer.role,
      authenticationMethod: "browser_session",
    },
    action: input.action,
    result: "allow",
    target: {
      type: input.targetType,
      id: input.targetId,
      label: `${input.targetType}:${input.targetId}`,
    },
    ...(input.justification === undefined
      ? {}
      : { justification: input.justification }),
    changes: [],
    correlationId: input.correlationId,
    source: { category: "access_management" },
  };
}

function mapAccessError(error: unknown): AccessManagementError {
  if (error instanceof AccessManagementError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "idempotency_conflict") {
      return new AccessManagementError("invalid_request");
    }
    if (error.code === "authentication_failed") {
      return new AccessManagementError("forbidden");
    }
  }
  return new AccessManagementError("unavailable");
}

const CORRELATION_ID =
  /^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateViewerScope(
  viewer: AccessViewer,
  scope: "own" | "global",
): void {
  if (!isUuidV7(viewer.userId)) throw new AccessManagementError("forbidden");
  if (scope === "global" && viewer.role !== "superadmin") {
    throw new AccessManagementError("forbidden");
  }
}

function pageSizeValue(value: number | undefined): number {
  const pageSize = value ?? 50;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AccessManagementError("invalid_request");
  }
  return pageSize;
}

function nowValue(now: () => number): number {
  const value = Math.trunc(now());
  if (!safeTimestamp(value)) throw new AccessManagementError("unavailable");
  return value;
}

function safeTimestamp(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0;
}

function userLabel(row: {
  given_name: string;
  family_name: string;
  email: string;
}): string {
  const name = `${row.given_name} ${row.family_name}`.trim();
  return name === "" ? row.email : `${name} (${row.email})`;
}

function stringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !Array.isArray(parsed)
      || parsed.length > 256
      || parsed.some((item) =>
        typeof item !== "string"
        || item.length < 1
        || item.length > 2048)
    ) throw new Error("invalid");
    return parsed;
  } catch {
    throw new AccessManagementError("unavailable");
  }
}
