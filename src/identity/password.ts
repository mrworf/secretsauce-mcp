import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { argon2id, hash as argon2Hash, verify as argon2Verify } from "argon2";

const MAX_PASSWORD_CODE_POINTS = 1_024;
const MAX_PASSWORD_BYTES = 4_096;
const OPERATOR_BLOCKLIST_MAX_BYTES = 16 * 1024 * 1024;
const OPERATOR_BLOCKLIST_MAX_ENTRIES = 250_000;
const ARGON2_MEMORY_KIB = 65_536;
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_BYTES = 32;
const ARGON2_SALT_BYTES = 16;
const ARGON2_ENCODING = /^\$argon2id\$v=19\$m=65536,p=1,t=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

export const PASSWORD_BLOCKLIST_VERSION = 1;

const BUNDLED_BLOCKLIST = new Set([
  "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
  "494a715f7e9b4071aca61bac42ca858a309524e5864f0920030862a4ae7589be",
  "544b9218c110325b61a91ad0cd60cd1bf9227ce789acb5b93b8debbd512684f4",
  "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "9b0eb22aef89516d6fb4b31ccf008a68abe0d10a3fc606316389613eccf96854",
  "a68349561396ec264a350847024a4521d00beaa3358660c2709a80f31c7acdd0",
  "daaad6e5604e8e17bd9f108d91e26afe6281dac8fda0091040a7a6d7bd9b43b5",
  "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f",
  "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
]);

export type PasswordPolicyErrorCode =
  | "password_invalid"
  | "password_too_short"
  | "password_too_long"
  | "password_blocked"
  | "password_blocklist_invalid";

export class PasswordPolicyError extends Error {
  constructor(readonly code: PasswordPolicyErrorCode) {
    super("Password does not satisfy local authentication policy.");
    this.name = "PasswordPolicyError";
  }
}

export interface PasswordContext {
  email: string;
  givenName?: string;
  familyName?: string;
  productName?: string;
}

export interface PasswordPolicyOptions {
  minimumLength?: number;
  operatorBlocklistFile?: string;
}

export class PasswordPolicy {
  readonly #minimumLength: number;
  readonly #operatorBlocklist: ReadonlySet<string>;

  constructor(options: PasswordPolicyOptions = {}) {
    this.#minimumLength = options.minimumLength ?? 12;
    if (!Number.isInteger(this.#minimumLength) || this.#minimumLength < 8 || this.#minimumLength > 128) {
      throw new PasswordPolicyError("password_invalid");
    }
    this.#operatorBlocklist = options.operatorBlocklistFile === undefined
      ? new Set()
      : loadOperatorBlocklist(options.operatorBlocklistFile);
  }

  validate(candidate: unknown, context: PasswordContext): Buffer {
    if (typeof candidate !== "string" || typeof context.email !== "string") {
      throw new PasswordPolicyError("password_invalid");
    }
    const normalized = candidate.normalize("NFKC");
    const codePoints = [...normalized].length;
    const encoded = Buffer.from(normalized, "utf8");
    if (codePoints < this.#minimumLength) {
      encoded.fill(0);
      throw new PasswordPolicyError("password_too_short");
    }
    if (codePoints > MAX_PASSWORD_CODE_POINTS || encoded.byteLength > MAX_PASSWORD_BYTES) {
      encoded.fill(0);
      throw new PasswordPolicyError("password_too_long");
    }
    const digest = passwordDigest(encoded);
    if (
      BUNDLED_BLOCKLIST.has(digest) ||
      this.#operatorBlocklist.has(digest) ||
      contextCandidates(context).has(normalized.toLocaleLowerCase("en-US"))
    ) {
      encoded.fill(0);
      throw new PasswordPolicyError("password_blocked");
    }
    return encoded;
  }
}

export async function hashPassword(normalizedPassword: Buffer): Promise<string> {
  try {
    return await argon2Hash(normalizedPassword, {
      type: argon2id,
      memoryCost: ARGON2_MEMORY_KIB,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_BYTES,
      salt: randomBytes(ARGON2_SALT_BYTES),
    });
  } finally {
    normalizedPassword.fill(0);
  }
}

export function isSupportedPasswordHash(encoded: string): boolean {
  return ARGON2_ENCODING.test(encoded);
}

export async function verifyPasswordHash(candidate: Buffer, encoded: string): Promise<boolean> {
  try {
    if (!isSupportedPasswordHash(encoded)) return false;
    return await argon2Verify(encoded, candidate);
  } catch {
    return false;
  } finally {
    candidate.fill(0);
  }
}

function passwordDigest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function contextCandidates(context: PasswordContext): Set<string> {
  const email = context.email.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  const at = email.lastIndexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  const domain = at > 0 ? email.slice(at + 1) : "";
  const given = (context.givenName ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  const family = (context.familyName ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  const product = (context.productName ?? "SecretSauce").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  return new Set(
    [email, local, domain, given, family, product, `${given}${family}`, `${family}${given}`]
      .filter((value) => value.length > 0),
  );
}

function loadOperatorBlocklist(path: string): ReadonlySet<string> {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink() || !stats.isFile() || stats.size > OPERATOR_BLOCKLIST_MAX_BYTES) {
      throw new Error("invalid blocklist");
    }
    const text = readFileSync(path, "utf8");
    if (Buffer.byteLength(text, "utf8") > OPERATOR_BLOCKLIST_MAX_BYTES || text.includes("\r") || text.includes("\0")) {
      throw new Error("invalid blocklist");
    }
    const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
    if (lines.length === 0 || lines.length > OPERATOR_BLOCKLIST_MAX_ENTRIES) {
      throw new Error("invalid blocklist");
    }
    let previous = "";
    const values = new Set<string>();
    for (const line of lines) {
      if (!/^[a-f0-9]{64}$/.test(line) || line <= previous) throw new Error("invalid blocklist");
      previous = line;
      values.add(line);
    }
    return values;
  } catch {
    throw new PasswordPolicyError("password_blocklist_invalid");
  }
}
