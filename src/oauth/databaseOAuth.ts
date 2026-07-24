import { createHmac } from "node:crypto";
import type { PersistenceOwner } from "../persistence/worker.js";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { normalizeEmail } from "../identity/validation.js";

const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type OAuthHashDomain = "access" | "authorization_code" | "intent" | "refresh";

export interface DatabaseOAuthEligibility {
  userId: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  securityEpoch: number;
  globalSecurityEpoch: number;
  passwordState: string;
  totpState: string;
  hasEffectiveService: boolean;
  localEligible: boolean;
}

interface EligibilityRow {
  user_id: string;
  role: "superadmin" | "admin" | "user";
  status: string;
  security_epoch: number;
  global_security_epoch: number;
  password_state: string;
  totp_state: string;
  has_effective_service: number;
}

export class DatabaseOAuthTokenHasher {
  readonly #key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Invalid OAuth token HMAC key.");
    this.#key = Buffer.from(key);
  }

  hash(domain: OAuthHashDomain, value: string): string {
    if (!isCanonicalOpaqueOAuthValue(value)) {
      throw new Error("Invalid opaque OAuth value.");
    }
    return createHmac("sha256", this.#key)
      .update(`secretsauce:oauth:${domain}:v1\0`, "utf8")
      .update(value, "utf8")
      .digest("hex");
  }

  close(): void {
    this.#key.fill(0);
  }
}

export class DatabaseOAuthEligibilityRepository {
  constructor(private readonly owner: PersistenceOwner) {}

  async byEmail(email: string): Promise<DatabaseOAuthEligibility | undefined> {
    let normalized: string;
    try {
      normalized = normalizeEmail(email);
    } catch {
      return undefined;
    }
    return this.read("u.normalized_email = ?", normalized);
  }

  async byUserId(userId: string): Promise<DatabaseOAuthEligibility | undefined> {
    if (!isUuidV7(userId)) return undefined;
    return this.read("u.id = ?", userId);
  }

  async byExternalIdentity(
    providerId: string,
    issuer: string,
    subject: string,
  ): Promise<DatabaseOAuthEligibility | undefined> {
    if (
      providerId.length < 1
      || providerId.length > 64
      || issuer.length < 1
      || issuer.length > 2048
      || subject.length < 1
      || subject.length > 1024
    ) return undefined;
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<EligibilityRow>(`
          ${ELIGIBILITY_SELECT}
          JOIN external_identities external ON external.user_id = u.id
          WHERE external.provider_id = ?
            AND external.issuer = ?
            AND external.subject = ?
        `, [providerId, issuer, subject]);
        return row === undefined ? undefined : eligibility(row);
      }),
    });
  }

  private async read(
    predicate: "u.id = ?" | "u.normalized_email = ?",
    value: string,
  ): Promise<DatabaseOAuthEligibility | undefined> {
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<EligibilityRow>(`
          ${ELIGIBILITY_SELECT}
          WHERE ${predicate}
        `, [value]);
        return row === undefined ? undefined : eligibility(row);
      }),
    });
  }
}

export function isCanonicalOpaqueOAuthValue(value: string): boolean {
  if (!OPAQUE_VALUE_PATTERN.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength === 32 && decoded.toString("base64url") === value;
}

const ELIGIBILITY_SELECT = `
  SELECT
    u.id AS user_id,
    u.role,
    u.status,
    u.security_epoch,
    security.global_security_epoch,
    authenticators.password_state,
    authenticators.totp_state,
    EXISTS (
      SELECT 1
      FROM runtime_active_services active
      JOIN services service
        ON service.id = active.service_id
        AND service.lifecycle = 'published'
      JOIN service_principal_assignments assignment
        ON assignment.service_id = active.service_id
      JOIN runtime_activation activation
        ON activation.singleton = 1 AND activation.state = 'active'
      WHERE (
        assignment.selector_kind = 'all'
        OR (
            assignment.selector_kind = 'user'
            AND assignment.user_id = u.id
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
                AND member.user_id = u.id
                AND service_group.lifecycle = 'active'
            )
          )
      )
    ) AS has_effective_service
  FROM users u
  JOIN identity_security_state security ON security.singleton = 1
  JOIN local_authenticator_states authenticators
    ON authenticators.user_id = u.id
`;

function eligibility(row: EligibilityRow): DatabaseOAuthEligibility {
  const hasEffectiveService = row.has_effective_service === 1;
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status,
    securityEpoch: row.security_epoch,
    globalSecurityEpoch: row.global_security_epoch,
    passwordState: row.password_state,
    totpState: row.totp_state,
    hasEffectiveService,
    localEligible: row.role === "user"
      && row.status === "active"
      && row.password_state === "configured"
      && row.totp_state === "configured"
      && hasEffectiveService,
  };
}
