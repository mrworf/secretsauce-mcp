import { randomBytes, timingSafeEqual } from "node:crypto";
import { UuidV7Generator } from "../persistence/uuidV7.js";
import type { IdentityConfig } from "../types.js";
import type {
  RestrictedLoginResult,
  ValidatedRestrictedSession,
} from "./enrollment.js";
import { hashPassword, verifyPasswordHash } from "./password.js";
import type { TotpEnvelope } from "./totp.js";
import { normalizeEmail, parseIdentityProfile } from "./validation.js";
import { createHmac } from "node:crypto";

const SESSION_DOMAIN = "secretsauce.initial-enrollment-session.v1";
const CSRF_DOMAIN = "secretsauce.initial-enrollment-csrf.v1";
const SECRET_BYTES = 24;
const OPAQUE_BYTES = 32;
const MAX_PROVISIONAL_SESSIONS = 128;

export interface ProvisionalInitialPending {
  sessionId: string;
  userId: string;
  email: string;
  normalizedEmail: string;
  givenName: string;
  familyName: string;
  authenticatorId: string;
  envelopeJson: string;
  rootKeyId: string;
  generation: number;
  passwordPolicyVersion: number;
  expiresAt: number;
}

interface ProvisionalRecord {
  session: ValidatedRestrictedSession;
  email: string;
  normalizedEmail: string;
  pending?: ProvisionalInitialPending;
}

export interface InitialEnrollmentAuthorityOptions {
  config: IdentityConfig;
  sessionHmacKey: Buffer;
  now?: () => number;
  random?: (size: number) => Buffer;
  uuid?: () => string;
}

export class InitialEnrollmentAuthority {
  readonly #config: IdentityConfig;
  readonly #key: Buffer;
  readonly #now: () => number;
  readonly #random: (size: number) => Buffer;
  readonly #uuid: () => string;
  readonly #records = new Map<string, ProvisionalRecord>();
  #encodedHash: string | undefined;
  #startupSecret: Buffer | undefined;
  #announced = false;

  private constructor(
    options: InitialEnrollmentAuthorityOptions,
    encodedHash: string,
    startupSecret: Buffer,
  ) {
    if (options.sessionHmacKey.byteLength !== 32) {
      throw new Error("Initial enrollment authority is unavailable.");
    }
    this.#config = options.config;
    this.#key = Buffer.from(options.sessionHmacKey);
    this.#now = options.now ?? Date.now;
    this.#random = options.random ?? randomBytes;
    const generator = new UuidV7Generator({ now: this.#now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.#encodedHash = encodedHash;
    this.#startupSecret = startupSecret;
  }

  static async create(
    options: InitialEnrollmentAuthorityOptions,
  ): Promise<InitialEnrollmentAuthority> {
    const secret = options.random?.(SECRET_BYTES) ?? randomBytes(SECRET_BYTES);
    if (secret.byteLength !== SECRET_BYTES) {
      secret.fill(0);
      throw new Error("Initial enrollment authority is unavailable.");
    }
    const printable = Buffer.from(secret.toString("base64url"), "utf8");
    const encodedHash = await hashPassword(printable);
    return new InitialEnrollmentAuthority(options, encodedHash, secret);
  }

  announce(write: (line: string) => void): void {
    if (this.#announced || this.#startupSecret === undefined) {
      throw new Error("Initial enrollment secret was already displayed.");
    }
    this.#announced = true;
    const printable = this.#startupSecret.toString("base64url");
    try {
      write(
        `SECRETSAUCE INITIAL ENROLLMENT SECRET: ${printable} `
          + "(invalid after successful enrollment or process restart)\n",
      );
    } finally {
      this.#startupSecret.fill(0);
      this.#startupSecret = undefined;
    }
  }

  async verify(enrollmentCode: string): Promise<boolean> {
    const encodedHash = this.#encodedHash;
    if (encodedHash === undefined) return false;
    return verifyPasswordHash(Buffer.from(enrollmentCode, "utf8"), encodedHash);
  }

  issue(email: string): RestrictedLoginResult {
    if (this.#encodedHash === undefined) throw new Error("Initial enrollment is unavailable.");
    this.#purgeExpired();
    if (this.#records.size >= MAX_PROVISIONAL_SESSIONS) {
      throw new Error("Initial enrollment is unavailable.");
    }
    const normalizedEmail = normalizeEmail(email);
    const issuedAt = this.#safeNow();
    const sessionToken = this.#opaque();
    const csrfToken = this.#opaque();
    const session: ValidatedRestrictedSession = {
      sessionId: this.#uuid(),
      userId: this.#uuid(),
      role: "superadmin",
      purpose: "initial_enrollment",
      csrfHash: this.#hash(CSRF_DOMAIN, csrfToken),
      expiresAt: issuedAt + this.#config.restrictedSessionTtlMs,
      provisional: true,
    };
    this.#records.set(this.#hash(SESSION_DOMAIN, sessionToken), {
      session,
      email,
      normalizedEmail,
    });
    return {
      userId: session.userId,
      role: session.role,
      purpose: "initial_enrollment",
      sessionToken,
      csrfToken,
      expiresAt: session.expiresAt,
    };
  }

  restrictedSession(sessionHash: string): ValidatedRestrictedSession | undefined {
    this.#purgeExpired();
    const record = this.#records.get(sessionHash);
    return record === undefined ? undefined : { ...record.session };
  }

  rotateCsrf(session: ValidatedRestrictedSession, csrfToken: string): string {
    const record = this.#record(session);
    record.session.csrfHash = this.#hash(CSRF_DOMAIN, csrfToken);
    return record.session.csrfHash;
  }

  savePending(
    session: ValidatedRestrictedSession,
    profileInput: { givenName: string; familyName: string },
    envelope: TotpEnvelope,
    passwordPolicyVersion: number,
  ): ProvisionalInitialPending {
    const record = this.#record(session);
    const profile = parseIdentityProfile({
      email: record.email,
      givenName: profileInput.givenName,
      familyName: profileInput.familyName,
    });
    const pending: ProvisionalInitialPending = {
      sessionId: session.sessionId,
      userId: session.userId,
      email: profile.email,
      normalizedEmail: profile.normalizedEmail,
      givenName: profile.givenName,
      familyName: profile.familyName,
      authenticatorId: envelope.authenticatorId,
      envelopeJson: JSON.stringify(envelope),
      rootKeyId: envelope.rootKeyId,
      generation: envelope.generation,
      passwordPolicyVersion,
      expiresAt: session.expiresAt,
    };
    record.pending = pending;
    return pending;
  }

  pending(session: ValidatedRestrictedSession): ProvisionalInitialPending | undefined {
    return this.#record(session).pending;
  }

  consume(session: ValidatedRestrictedSession): void {
    this.#record(session);
    this.close();
  }

  close(): void {
    this.#startupSecret?.fill(0);
    this.#startupSecret = undefined;
    this.#encodedHash = undefined;
    this.#records.clear();
    this.#key.fill(0);
  }

  sessionHash(token: string): string {
    return this.#hash(SESSION_DOMAIN, token);
  }

  csrfMatches(session: ValidatedRestrictedSession, proof: string): boolean {
    const actual = Buffer.from(this.#hash(CSRF_DOMAIN, proof), "hex");
    const expected = Buffer.from(session.csrfHash, "hex");
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
  }

  #record(session: ValidatedRestrictedSession): ProvisionalRecord {
    this.#purgeExpired();
    for (const record of this.#records.values()) {
      if (
        record.session.sessionId === session.sessionId
        && record.session.userId === session.userId
      ) return record;
    }
    throw new Error("Initial enrollment is unavailable.");
  }

  #purgeExpired(): void {
    const now = this.#safeNow();
    for (const [hash, record] of this.#records) {
      if (now >= record.session.expiresAt) this.#records.delete(hash);
    }
  }

  #opaque(): string {
    const value = this.#random(OPAQUE_BYTES);
    if (value.byteLength !== OPAQUE_BYTES) throw new Error("Random source failed.");
    return value.toString("base64url");
  }

  #hash(domain: string, value: string): string {
    return createHmac("sha256", this.#key)
      .update(domain)
      .update("\0")
      .update(value)
      .digest("hex");
  }

  #safeNow(): number {
    const value = this.#now();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Clock is unavailable.");
    return value;
  }
}
