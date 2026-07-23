import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { FastifyRequest } from "fastify";
import type { AdministrativeAuditEventInput } from "../persistence/administrativeAudit.js";
import { PersistenceError } from "../persistence/errors.js";
import type { PersistenceTransaction } from "../persistence/transaction.js";
import type { PersistenceOwner } from "../persistence/worker.js";
import type { IdentityConfig } from "../types.js";
import type {
  ControlAuthenticationContext,
  ControlAuthenticator,
} from "../control/authentication.js";
import { CONTROL_SESSION_COOKIE } from "../control/security.js";

const SESSION_DOMAIN = "secretsauce.browser-session.v1";
const CSRF_DOMAIN = "secretsauce.browser-csrf.v1";
const OPAQUE_VALUE = /^[A-Za-z0-9_-]{43}$/;

interface SessionRow {
  id: string;
  user_id: string;
  role: "superadmin" | "admin" | "user";
  role_class: "admin" | "user";
  status: string;
  password_state: string;
  totp_state: string;
  has_external_identity: number;
  security_epoch: number;
  global_security_epoch: number;
  issued_security_epoch: number;
  issued_global_epoch: number;
  issued_absolute_ms: number;
  issued_inactivity_ms: number;
  issued_at: number;
  last_activity_at: number;
  absolute_expires_at: number;
  csrf_hash: string;
  revoked_at: number | null;
}

export interface ValidatedBrowserSession {
  sessionId: string;
  userId: string;
  role: "superadmin" | "admin" | "user";
  csrfHash: string;
  issuedAt: number;
  absoluteExpiresAt: number;
}

export class BrowserSessionRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async authenticate(
    sessionHash: string,
    settings: IdentityConfig["sessions"],
  ): Promise<ValidatedBrowserSession | undefined> {
    if (!/^[a-f0-9]{64}$/.test(sessionHash)) return undefined;
    const now = safeNow(this.now);
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const row = transaction.get<SessionRow>(`
          SELECT
            bs.id, bs.user_id, u.role, bs.role_class, u.status,
            a.password_state, a.totp_state,
            EXISTS (
              SELECT 1 FROM external_identities e WHERE e.user_id = u.id
            ) AS has_external_identity,
            u.security_epoch,
            sec.global_security_epoch,
            bs.issued_security_epoch, bs.issued_global_epoch,
            bs.issued_absolute_ms, bs.issued_inactivity_ms,
            bs.issued_at, bs.last_activity_at, bs.absolute_expires_at,
            bs.csrf_hash, bs.revoked_at
          FROM browser_sessions bs
          JOIN users u ON u.id = bs.user_id
          JOIN local_authenticator_states a ON a.user_id = u.id
          JOIN identity_security_state sec ON sec.singleton = 1
          WHERE bs.session_hash = ?
        `, [sessionHash]);
        if (row === undefined || !sessionIsValid(row, settings, now)) return undefined;
        const updated = transaction.run(`
          UPDATE browser_sessions
          SET last_activity_at = ?, version = version + 1
          WHERE id = ? AND revoked_at IS NULL
        `, [now, row.id]);
        if (updated.changes !== 1) return undefined;
        return {
          sessionId: row.id,
          userId: row.user_id,
          role: row.role,
          csrfHash: row.csrf_hash,
          issuedAt: row.issued_at,
          absoluteExpiresAt: effectiveAbsoluteExpiry(row, settings),
        };
      }),
    });
  }

  async rotateCsrf(sessionId: string, userId: string, csrfHash: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(csrfHash)) throw new PersistenceError("authentication_failed");
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const result = transaction.run(`
          UPDATE browser_sessions
          SET csrf_hash = ?, version = version + 1
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL
        `, [csrfHash, sessionId, userId]);
        if (result.changes !== 1) throw new PersistenceError("authentication_failed");
      }),
    });
  }

  async revoke(
    sessionId: string,
    userId: string,
    role: "superadmin" | "admin" | "user",
    correlationId: string,
  ): Promise<void> {
    const now = safeNow(this.now);
    await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
        const result = transaction.run(`
          UPDATE browser_sessions
          SET revoked_at = ?, version = version + 1
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL
        `, [now, sessionId, userId]);
        if (result.changes !== 1) throw new PersistenceError("authentication_failed");
        return {
          value: undefined,
          auditInput: {
            actor: {
              type: "browser_session",
              id: userId,
              label: `user:${userId}`,
              role,
              authenticationMethod: "browser_session",
            },
            action: "identity.logout",
            result: "allow",
            target: { type: "session", id: sessionId, label: `session:${sessionId}` },
            changes: [{ field: "session", after: "revoked" }],
            correlationId,
            source: { category: "authentication" },
          } satisfies AdministrativeAuditEventInput,
        };
      }),
    });
  }
}

interface BoundBrowserSession extends ValidatedBrowserSession {
  context: ControlAuthenticationContext;
}

export class BrowserSessionAuthenticator implements ControlAuthenticator {
  readonly #sessions = new WeakMap<FastifyRequest, BoundBrowserSession>();
  readonly #hmacKey: Buffer;

  constructor(
    private readonly repository: BrowserSessionRepository,
    private readonly sessionSettings: IdentityConfig["sessions"],
    hmacKey: Buffer,
    private readonly random: (size: number) => Buffer = randomBytes,
  ) {
    if (hmacKey.byteLength !== 32) throw new Error("Invalid browser session key.");
    this.#hmacKey = Buffer.from(hmacKey);
  }

  async authenticate(request: FastifyRequest): Promise<ControlAuthenticationContext | undefined> {
    const token = request.cookies[CONTROL_SESSION_COOKIE];
    if (typeof token !== "string" || !OPAQUE_VALUE.test(token)) return undefined;
    let session: ValidatedBrowserSession | undefined;
    try {
      session = await this.repository.authenticate(
        keyedHash(this.#hmacKey, SESSION_DOMAIN, token),
        this.sessionSettings,
      );
    } catch {
      return undefined;
    }
    if (session === undefined) return undefined;
    const context: ControlAuthenticationContext = {
      method: "browser_session",
      principalId: session.userId,
      role: session.role,
    };
    this.#sessions.set(request, { ...session, context });
    return context;
  }

  async verifyCsrf(
    context: ControlAuthenticationContext,
    proof: string,
    request: FastifyRequest,
  ): Promise<boolean> {
    const session = this.#sessions.get(request);
    if (
      session === undefined ||
      context !== session.context ||
      !OPAQUE_VALUE.test(proof)
    ) return false;
    return constantTimeHexEqual(
      keyedHash(this.#hmacKey, CSRF_DOMAIN, proof),
      session.csrfHash,
    );
  }

  session(request: FastifyRequest): BoundBrowserSession | undefined {
    return this.#sessions.get(request);
  }

  async rotateCsrf(request: FastifyRequest): Promise<string> {
    const session = this.#sessions.get(request);
    if (session === undefined) throw new PersistenceError("authentication_failed");
    const csrf = opaqueValue(this.random);
    const csrfHash = keyedHash(this.#hmacKey, CSRF_DOMAIN, csrf);
    await this.repository.rotateCsrf(session.sessionId, session.userId, csrfHash);
    session.csrfHash = csrfHash;
    return csrf;
  }

  async logout(request: FastifyRequest): Promise<void> {
    const session = this.#sessions.get(request);
    if (session === undefined) throw new PersistenceError("authentication_failed");
    await this.repository.revoke(
      session.sessionId,
      session.userId,
      session.role,
      request.id,
    );
  }

  close(): void {
    this.#hmacKey.fill(0);
  }
}

export function loadIdentitySessionHmacKey(path: string): Buffer {
  try {
    const encoded = readFileSync(path, "utf8").trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("invalid key");
    const key = Buffer.from(encoded, "base64url");
    if (key.byteLength !== 32) throw new Error("invalid key");
    return key;
  } catch {
    throw new Error("Identity session key is unavailable.");
  }
}

function sessionIsValid(
  row: SessionRow,
  settings: IdentityConfig["sessions"],
  now: number,
): boolean {
  if (
    row.revoked_at !== null ||
    row.status !== "active" ||
    !(
      (row.password_state === "configured" && row.totp_state === "configured") ||
      row.has_external_identity === 1
    ) ||
    row.security_epoch !== row.issued_security_epoch ||
    row.global_security_epoch !== row.issued_global_epoch
    || row.role_class !== (row.role === "user" ? "user" : "admin")
  ) return false;
  const currentAbsolute = row.role === "user"
    ? settings.userAbsoluteMs
    : settings.adminAbsoluteMs;
  const currentInactivity = row.role === "user"
    ? settings.userInactivityMs
    : settings.adminInactivityMs;
  const absoluteMs = Math.min(row.issued_absolute_ms, currentAbsolute);
  const inactivityMs = Math.min(row.issued_inactivity_ms, currentInactivity);
  return (
    now < row.absolute_expires_at &&
    now - row.issued_at < absoluteMs &&
    now - row.last_activity_at < inactivityMs
  );
}

function effectiveAbsoluteExpiry(
  row: SessionRow,
  settings: IdentityConfig["sessions"],
): number {
  const current = row.role === "user" ? settings.userAbsoluteMs : settings.adminAbsoluteMs;
  return Math.min(row.absolute_expires_at, row.issued_at + current);
}

function keyedHash(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain).update("\0").update(value, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function opaqueValue(random: (size: number) => Buffer): string {
  const value = random(32);
  if (!Buffer.isBuffer(value) || value.byteLength !== 32) {
    value?.fill?.(0);
    throw new Error("Random source unavailable.");
  }
  try {
    return value.toString("base64url");
  } finally {
    value.fill(0);
  }
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) throw new PersistenceError("database_unavailable");
  return value;
}
