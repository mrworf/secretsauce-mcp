import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const DOMAIN = "secretsauce.oauth.intent-state.v1";

export class OAuthIntentStateCodec {
  readonly #key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Invalid OAuth intent state key.");
    this.#key = createHmac("sha256", key)
      .update(DOMAIN, "utf8")
      .digest();
  }

  encrypt(
    state: string | undefined,
    providerId: string,
    random: (size: number) => Buffer = randomBytes,
  ): string | undefined {
    if (state === undefined) return undefined;
    if (
      state.length < 1
      || Buffer.byteLength(state, "utf8") > 4096
      || !/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)
    ) throw new Error("Invalid OAuth client state.");
    const iv = random(12);
    if (iv.byteLength !== 12) throw new Error("Invalid OAuth client state.");
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    cipher.setAAD(Buffer.from(`${DOMAIN}\0${providerId}`, "utf8"));
    const plaintext = Buffer.from(state, "utf8");
    try {
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return JSON.stringify({
        version: 1,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
      });
    } finally {
      plaintext.fill(0);
    }
  }

  decrypt(envelopeJson: string | undefined, providerId: string): string | undefined {
    if (envelopeJson === undefined) return undefined;
    let plaintext: Buffer | undefined;
    try {
      const value = JSON.parse(envelopeJson) as Record<string, unknown>;
      if (
        value === null
        || Array.isArray(value)
        || Object.keys(value).sort().join(",") !== "ciphertext,iv,tag,version"
        || value.version !== 1
        || typeof value.iv !== "string"
        || !/^[A-Za-z0-9_-]{16}$/.test(value.iv)
        || typeof value.tag !== "string"
        || !/^[A-Za-z0-9_-]{22}$/.test(value.tag)
        || typeof value.ciphertext !== "string"
        || value.ciphertext.length < 2
        || value.ciphertext.length > 5462
        || !/^[A-Za-z0-9_-]+$/.test(value.ciphertext)
        || !/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)
      ) throw new Error("invalid");
      const iv = exact(value.iv, 12);
      const tag = exact(value.tag, 16);
      const ciphertext = Buffer.from(value.ciphertext, "base64url");
      if (ciphertext.toString("base64url") !== value.ciphertext) {
        throw new Error("invalid");
      }
      const decipher = createDecipheriv("aes-256-gcm", this.#key, iv);
      decipher.setAAD(Buffer.from(`${DOMAIN}\0${providerId}`, "utf8"));
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
    } catch {
      throw new Error("Invalid OAuth client state.");
    } finally {
      plaintext?.fill(0);
    }
  }

  close(): void {
    this.#key.fill(0);
  }
}

function exact(value: string, bytes: number): Buffer {
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.byteLength !== bytes
    || decoded.toString("base64url") !== value
  ) throw new Error("invalid");
  return decoded;
}
