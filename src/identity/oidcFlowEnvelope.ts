import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { IdentityKeyRing } from "./totp.js";

const envelopeSchema = z.object({
  version: z.literal(1),
  flowId: z.string().uuid(),
  providerId: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  purpose: z.enum(["login", "restricted_link", "superadmin_link", "mcp_oauth"]),
  rootKeyId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  tag: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  ciphertext: z.string().min(1).max(4096).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export type OidcFlowPurpose =
  | "login"
  | "restricted_link"
  | "superadmin_link"
  | "mcp_oauth";

export interface OidcFlowSecrets {
  nonce: string;
  verifier: string;
}

export class OidcFlowEnvelopeError extends Error {
  constructor() {
    super("OIDC flow material is unavailable.");
    this.name = "OidcFlowEnvelopeError";
  }
}

export function encryptOidcFlowSecrets(input: {
  flowId: string;
  providerId: string;
  purpose: OidcFlowPurpose;
  secrets: OidcFlowSecrets;
  keyRing: IdentityKeyRing;
  random?: (size: number) => Buffer;
}): string {
  let key: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    validateSecret(input.secrets.nonce);
    validateSecret(input.secrets.verifier);
    const random = input.random ?? randomBytes;
    const iv = exactBytes(random(12), 12);
    key = input.keyRing.key(input.keyRing.activeKeyId);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(associatedData(input.flowId, input.providerId, input.purpose));
    plaintext = Buffer.from(JSON.stringify(input.secrets), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = envelopeSchema.parse({
      version: 1,
      flowId: input.flowId,
      providerId: input.providerId,
      purpose: input.purpose,
      rootKeyId: input.keyRing.activeKeyId,
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    });
    return JSON.stringify(envelope);
  } catch {
    throw new OidcFlowEnvelopeError();
  } finally {
    plaintext?.fill(0);
    key?.fill(0);
  }
}

export function decryptOidcFlowSecrets(
  value: unknown,
  keyRing: IdentityKeyRing,
  expected: {
    flowId: string;
    providerId: string;
    purpose: OidcFlowPurpose;
  },
): OidcFlowSecrets {
  let key: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const envelope = envelopeSchema.parse(parsed);
    if (
      envelope.flowId !== expected.flowId ||
      envelope.providerId !== expected.providerId ||
      envelope.purpose !== expected.purpose
    ) throw new Error("flow envelope binding mismatch");
    key = keyRing.key(envelope.rootKeyId);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAAD(associatedData(envelope.flowId, envelope.providerId, envelope.purpose));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]);
    const secrets = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext)) as unknown;
    if (
      secrets === null ||
      typeof secrets !== "object" ||
      Array.isArray(secrets) ||
      Object.keys(secrets).sort().join(",") !== "nonce,verifier"
    ) throw new Error("invalid secrets");
    const record = secrets as Record<string, unknown>;
    validateSecret(record.nonce);
    validateSecret(record.verifier);
    return { nonce: record.nonce as string, verifier: record.verifier as string };
  } catch {
    throw new OidcFlowEnvelopeError();
  } finally {
    plaintext?.fill(0);
    key?.fill(0);
  }
}

export function classifyOidcFlowEnvelopePhysicalRoot(
  value: unknown,
  expected: {
    flowId: string;
    providerId: string;
    purpose: OidcFlowPurpose;
  },
  logicalRootKeyId: string,
  oldRoot: Uint8Array,
  newRoot: Uint8Array,
): "old" | "new" {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(logicalRootKeyId)
    || oldRoot.byteLength !== 32
    || newRoot.byteLength !== 32
    || oldRoot.every((byte, index) => byte === newRoot[index])
  ) throw new OidcFlowEnvelopeError();
  const oldValid = canDecryptOidcFlowWithRoot(
    value,
    expected,
    logicalRootKeyId,
    oldRoot,
  );
  const newValid = canDecryptOidcFlowWithRoot(
    value,
    expected,
    logicalRootKeyId,
    newRoot,
  );
  if (oldValid === newValid) throw new OidcFlowEnvelopeError();
  return oldValid ? "old" : "new";
}

export function rewrapOidcFlowEnvelopePhysicalRoot(
  value: unknown,
  expected: {
    flowId: string;
    providerId: string;
    purpose: OidcFlowPurpose;
  },
  logicalRootKeyId: string,
  oldRoot: Uint8Array,
  newRoot: Uint8Array,
  random: (size: number) => Buffer = randomBytes,
): string {
  if (
    classifyOidcFlowEnvelopePhysicalRoot(
      value,
      expected,
      logicalRootKeyId,
      oldRoot,
      newRoot,
    ) !== "old"
  ) throw new OidcFlowEnvelopeError();
  const secrets = decryptOidcFlowSecretsWithRoot(
    value,
    expected,
    logicalRootKeyId,
    oldRoot,
  );
  const newRootCopy = Buffer.from(newRoot);
  let keyRing: IdentityKeyRing | undefined;
  try {
    keyRing = new IdentityKeyRing(logicalRootKeyId, {
      [logicalRootKeyId]: newRootCopy,
    });
    return encryptOidcFlowSecrets({
      ...expected,
      secrets,
      keyRing,
      random,
    });
  } finally {
    newRootCopy.fill(0);
    keyRing?.destroy();
  }
}

function associatedData(
  flowId: string,
  providerId: string,
  purpose: OidcFlowPurpose,
): Buffer {
  return Buffer.from(`secretsauce.identity.oidc-flow.v1\0${flowId}\0${providerId}\0${purpose}`, "utf8");
}

function decryptOidcFlowSecretsWithRoot(
  value: unknown,
  expected: {
    flowId: string;
    providerId: string;
    purpose: OidcFlowPurpose;
  },
  logicalRootKeyId: string,
  root: Uint8Array,
): OidcFlowSecrets {
  let key: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const envelope = envelopeSchema.parse(parsed);
    if (
      envelope.flowId !== expected.flowId
      || envelope.providerId !== expected.providerId
      || envelope.purpose !== expected.purpose
      || envelope.rootKeyId !== logicalRootKeyId
      || root.byteLength !== 32
    ) throw new Error("flow envelope binding mismatch");
    key = Buffer.from(root);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAAD(associatedData(
      envelope.flowId,
      envelope.providerId,
      envelope.purpose,
    ));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]);
    const secrets = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
    ) as unknown;
    if (
      secrets === null
      || typeof secrets !== "object"
      || Array.isArray(secrets)
      || Object.keys(secrets).sort().join(",") !== "nonce,verifier"
    ) throw new Error("invalid secrets");
    const record = secrets as Record<string, unknown>;
    validateSecret(record.nonce);
    validateSecret(record.verifier);
    return {
      nonce: record.nonce as string,
      verifier: record.verifier as string,
    };
  } catch {
    throw new OidcFlowEnvelopeError();
  } finally {
    plaintext?.fill(0);
    key?.fill(0);
  }
}

function canDecryptOidcFlowWithRoot(
  value: unknown,
  expected: {
    flowId: string;
    providerId: string;
    purpose: OidcFlowPurpose;
  },
  logicalRootKeyId: string,
  root: Uint8Array,
): boolean {
  try {
    decryptOidcFlowSecretsWithRoot(
      value,
      expected,
      logicalRootKeyId,
      root,
    );
    return true;
  } catch {
    return false;
  }
}

function validateSecret(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("invalid flow secret");
  }
}

function exactBytes(value: Buffer, length: number): Buffer {
  if (value.byteLength !== length) throw new Error("invalid random source");
  return value;
}
