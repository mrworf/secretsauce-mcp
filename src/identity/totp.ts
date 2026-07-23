import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { isUuidV7 } from "../persistence/uuidV7.js";

const PRODUCT_MARKER = "secretsauce.identity.totp";
const ENVELOPE_VERSION = 1;
const SEED_BYTES = 20;
const DEK_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const ROOT_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const encryptedValueSchema = z.object({
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  ciphertext: z.string().regex(/^[A-Za-z0-9_-]+$/),
  tag: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
}).strict();

const totpEnvelopeSchema = z.object({
  version: z.literal(ENVELOPE_VERSION),
  authenticatorId: z.string().refine(isUuidV7),
  userId: z.string().refine(isUuidV7),
  secretClass: z.literal("totp_seed"),
  rootKeyId: z.string().regex(ROOT_KEY_ID),
  generation: z.number().int().positive(),
  wrappedDek: encryptedValueSchema.extend({
    ciphertext: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }).strict(),
  encryptedSeed: encryptedValueSchema.extend({
    ciphertext: z.string().regex(/^[A-Za-z0-9_-]{27}$/),
  }).strict(),
}).strict();

export type TotpEnvelope = z.infer<typeof totpEnvelopeSchema>;

export class TotpError extends Error {
  constructor(readonly code: "totp_invalid" | "totp_key_unavailable") {
    super("TOTP authenticator data is invalid or unavailable.");
    this.name = "TotpError";
  }
}

export class IdentityKeyRing {
  readonly #activeKeyId: string;
  readonly #keys: Map<string, Buffer>;

  constructor(activeKeyId: string, keys: Readonly<Record<string, Buffer>>) {
    if (!ROOT_KEY_ID.test(activeKeyId) || !(activeKeyId in keys)) {
      throw new TotpError("totp_key_unavailable");
    }
    this.#activeKeyId = activeKeyId;
    this.#keys = new Map();
    for (const [keyId, value] of Object.entries(keys)) {
      if (!ROOT_KEY_ID.test(keyId) || value.byteLength !== DEK_BYTES) {
        this.destroy();
        throw new TotpError("totp_key_unavailable");
      }
      this.#keys.set(keyId, Buffer.from(value));
    }
  }

  static fromFiles(activeKeyId: string, files: Readonly<Record<string, string>>): IdentityKeyRing {
    const keys: Record<string, Buffer> = {};
    try {
      for (const [keyId, path] of Object.entries(files)) {
        const encoded = readFileSync(path, "utf8").trim();
        if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("invalid key");
        const key = Buffer.from(encoded, "base64url");
        if (key.byteLength !== DEK_BYTES) throw new Error("invalid key");
        keys[keyId] = key;
      }
      return new IdentityKeyRing(activeKeyId, keys);
    } catch {
      for (const key of Object.values(keys)) key.fill(0);
      throw new TotpError("totp_key_unavailable");
    } finally {
      for (const key of Object.values(keys)) key.fill(0);
    }
  }

  get activeKeyId(): string {
    return this.#activeKeyId;
  }

  key(keyId: string): Buffer {
    const key = this.#keys.get(keyId);
    if (key === undefined) throw new TotpError("totp_key_unavailable");
    return Buffer.from(key);
  }

  destroy(): void {
    for (const key of this.#keys.values()) key.fill(0);
    this.#keys.clear();
  }
}

export interface TotpEnrollment {
  envelope: TotpEnvelope;
  secret: string;
  uri: string;
}

export function beginTotpEnrollment(input: {
  authenticatorId: string;
  userId: string;
  issuer: string;
  label: string;
  keyRing: IdentityKeyRing;
  generation?: number;
  random?: (size: number) => Buffer;
}): TotpEnrollment {
  validateEnrollmentMetadata(input);
  const random = input.random ?? randomBytes;
  const seed = exactRandom(random, SEED_BYTES);
  try {
    const envelope = encryptSeed({
      seed,
      authenticatorId: input.authenticatorId,
      userId: input.userId,
      rootKeyId: input.keyRing.activeKeyId,
      generation: input.generation ?? 1,
      keyRing: input.keyRing,
      random,
    });
    const secret = encodeBase32(seed);
    const query = new URLSearchParams({
      secret,
      issuer: input.issuer,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_PERIOD_SECONDS),
    });
    return {
      envelope,
      secret,
      uri: `otpauth://totp/${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.label)}?${query.toString()}`,
    };
  } finally {
    seed.fill(0);
  }
}

export function parseTotpEnrollmentUri(uri: string): {
  issuer: string;
  label: string;
  seed: Buffer;
} {
  try {
    const parsed = new URL(uri);
    if (
      parsed.protocol !== "otpauth:" ||
      parsed.hostname !== "totp" ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.hash.length > 0
    ) throw new Error("invalid URI");
    const parameters = [...parsed.searchParams.keys()];
    if (
      parameters.length !== 5 ||
      new Set(parameters).size !== 5 ||
      !["secret", "issuer", "algorithm", "digits", "period"].every((name) => parsed.searchParams.has(name))
    ) throw new Error("invalid URI");
    const issuer = parsed.searchParams.get("issuer") ?? "";
    const pathLabel = decodeURIComponent(parsed.pathname.slice(1));
    const prefix = `${issuer}:`;
    if (
      !validEnrollmentText(issuer) ||
      !pathLabel.startsWith(prefix) ||
      parsed.searchParams.get("algorithm") !== "SHA1" ||
      parsed.searchParams.get("digits") !== String(TOTP_DIGITS) ||
      parsed.searchParams.get("period") !== String(TOTP_PERIOD_SECONDS)
    ) throw new Error("invalid URI");
    const label = pathLabel.slice(prefix.length);
    if (!validEnrollmentText(label)) throw new Error("invalid URI");
    return { issuer, label, seed: decodeBase32(parsed.searchParams.get("secret") ?? "") };
  } catch {
    throw new TotpError("totp_invalid");
  }
}

export function parseTotpEnvelope(value: unknown): TotpEnvelope {
  const result = totpEnvelopeSchema.safeParse(value);
  if (!result.success) throw new TotpError("totp_invalid");
  return result.data;
}

export function decryptTotpSeed(value: unknown, keyRing: IdentityKeyRing): Buffer {
  const envelope = parseTotpEnvelope(value);
  const associatedData = envelopeAssociatedData(envelope);
  const rootKey = keyRing.key(envelope.rootKeyId);
  let dek: Buffer | undefined;
  try {
    dek = decryptValue(envelope.wrappedDek, rootKey, associatedData);
    if (dek.byteLength !== DEK_BYTES) throw new Error("invalid DEK");
    const seed = decryptValue(envelope.encryptedSeed, dek, associatedData);
    if (seed.byteLength !== SEED_BYTES) {
      seed.fill(0);
      throw new Error("invalid seed");
    }
    return seed;
  } catch {
    throw new TotpError("totp_invalid");
  } finally {
    rootKey.fill(0);
    dek?.fill(0);
  }
}

export function rewrapTotpEnvelope(
  value: unknown,
  keyRing: IdentityKeyRing,
  random: (size: number) => Buffer = randomBytes,
): TotpEnvelope {
  const current = parseTotpEnvelope(value);
  const seed = decryptTotpSeed(current, keyRing);
  try {
    return encryptSeed({
      seed,
      authenticatorId: current.authenticatorId,
      userId: current.userId,
      rootKeyId: keyRing.activeKeyId,
      generation: current.generation + 1,
      keyRing,
      random,
    });
  } finally {
    seed.fill(0);
  }
}

export function totpCode(seed: Buffer, timestampMs: number, digits = TOTP_DIGITS): string {
  if (
    seed.byteLength !== SEED_BYTES ||
    !Number.isSafeInteger(timestampMs) ||
    timestampMs < 0 ||
    !Number.isInteger(digits) ||
    digits < 6 ||
    digits > 8
  ) throw new TotpError("totp_invalid");
  return hotpCode(seed, Math.floor(timestampMs / (TOTP_PERIOD_SECONDS * 1_000)), digits);
}

export function verifyTotpCode(seed: Buffer, candidate: string, timestampMs: number): number | undefined {
  if (!/^\d{6}$/.test(candidate) || !Number.isSafeInteger(timestampMs) || timestampMs < 0) return undefined;
  const currentStep = Math.floor(timestampMs / (TOTP_PERIOD_SECONDS * 1_000));
  const candidateBytes = Buffer.from(candidate, "ascii");
  try {
    for (const offset of [-1, 0, 1]) {
      const step = currentStep + offset;
      if (step < 0) continue;
      const expected = Buffer.from(hotpCode(seed, step, TOTP_DIGITS), "ascii");
      const matches = timingSafeEqual(candidateBytes, expected);
      expected.fill(0);
      if (matches) return step;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    candidateBytes.fill(0);
  }
}

function encryptSeed(input: {
  seed: Buffer;
  authenticatorId: string;
  userId: string;
  rootKeyId: string;
  generation: number;
  keyRing: IdentityKeyRing;
  random: (size: number) => Buffer;
}): TotpEnvelope {
  const metadata = {
    version: 1 as const,
    authenticatorId: input.authenticatorId,
    userId: input.userId,
    secretClass: "totp_seed" as const,
    rootKeyId: input.rootKeyId,
    generation: input.generation,
  };
  const associatedData = envelopeAssociatedData(metadata);
  const rootKey = input.keyRing.key(input.rootKeyId);
  const dek = exactRandom(input.random, DEK_BYTES);
  try {
    return parseTotpEnvelope({
      ...metadata,
      wrappedDek: encryptValue(dek, rootKey, associatedData, input.random),
      encryptedSeed: encryptValue(input.seed, dek, associatedData, input.random),
    });
  } finally {
    rootKey.fill(0);
    dek.fill(0);
  }
}

function envelopeAssociatedData(value: {
  version: number;
  authenticatorId: string;
  userId: string;
  secretClass: string;
  rootKeyId: string;
  generation: number;
}): Buffer {
  return Buffer.from([
    PRODUCT_MARKER,
    String(value.version),
    value.userId,
    value.authenticatorId,
    value.secretClass,
    value.rootKeyId,
    String(value.generation),
  ].join("\0"), "utf8");
}

function encryptValue(
  plaintext: Buffer,
  key: Buffer,
  associatedData: Buffer,
  random: (size: number) => Buffer,
): { nonce: string; ciphertext: string; tag: string } {
  const nonce = exactRandom(random, NONCE_BYTES);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(associatedData);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      nonce: nonce.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      tag: tag.toString("base64url"),
    };
  } finally {
    nonce.fill(0);
  }
}

function decryptValue(
  value: { nonce: string; ciphertext: string; tag: string },
  key: Buffer,
  associatedData: Buffer,
): Buffer {
  const nonce = Buffer.from(value.nonce, "base64url");
  const ciphertext = Buffer.from(value.ciphertext, "base64url");
  const tag = Buffer.from(value.tag, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(associatedData);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally {
    nonce.fill(0);
    ciphertext.fill(0);
    tag.fill(0);
  }
}

function hotpCode(seed: Buffer, counter: number, digits: number): string {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new TotpError("totp_invalid");
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", seed).update(counterBytes).digest();
  counterBytes.fill(0);
  try {
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const binary = (
      ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
      (digest[offset + 1] ?? 0) * 0x10000 +
      (digest[offset + 2] ?? 0) * 0x100 +
      (digest[offset + 3] ?? 0)
    );
    return String(binary % (10 ** digits)).padStart(digits, "0");
  } finally {
    digest.fill(0);
  }
}

function exactRandom(random: (size: number) => Buffer, size: number): Buffer {
  const value = random(size);
  if (!Buffer.isBuffer(value) || value.byteLength !== size) {
    value?.fill?.(0);
    throw new TotpError("totp_invalid");
  }
  return Buffer.from(value);
}

function validateEnrollmentMetadata(input: {
  authenticatorId: string;
  userId: string;
  issuer: string;
  label: string;
  generation?: number;
}): void {
  if (
    !isUuidV7(input.authenticatorId) ||
    !isUuidV7(input.userId) ||
    !validEnrollmentText(input.issuer) ||
    !validEnrollmentText(input.label) ||
    (input.generation !== undefined && (!Number.isInteger(input.generation) || input.generation < 1))
  ) throw new TotpError("totp_invalid");
}

function validEnrollmentText(value: string): boolean {
  return value.length >= 1 && value.length <= 254 && value.trim() === value && !/[:\0\r\n]/.test(value);
}

function encodeBase32(value: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let output = "";
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(accumulator << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  if (!/^[A-Z2-7]{32}$/.test(value)) throw new TotpError("totp_invalid");
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const character of value) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new TotpError("totp_invalid");
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const decoded = Buffer.from(output);
  if (decoded.byteLength !== SEED_BYTES || bits !== 0) {
    decoded.fill(0);
    throw new TotpError("totp_invalid");
  }
  return decoded;
}
