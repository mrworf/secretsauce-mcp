import { createHmac, timingSafeEqual } from "node:crypto";
import type { PersistenceOwner } from "./persistence/worker.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { IdentityConfig } from "./types.js";

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

type CursorKind = "grant" | "session";

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
