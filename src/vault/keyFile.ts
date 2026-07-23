import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { vaultError } from "./errors.js";

const KEY_BYTES = 32;
const KEY_TEXT_LENGTH = 43;

export function encodeVaultKey(key: Uint8Array): string {
  if (key.byteLength !== KEY_BYTES) throw vaultError("vault_key_invalid");
  return Buffer.from(key).toString("base64url");
}

export function decodeVaultKey(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw vaultError("vault_key_invalid");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== KEY_BYTES || encodeVaultKey(decoded) !== value) {
    decoded.fill(0);
    throw vaultError("vault_key_invalid");
  }
  return decoded;
}

export function readVaultKeyFile(file: string): Buffer {
  let descriptor: number | undefined;
  try {
    if (!isAbsolute(file)) throw vaultError("vault_key_invalid");
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || (metadata.mode & 0o777) !== 0o400) {
      throw vaultError("vault_key_invalid");
    }
    const source = readFileSync(descriptor, "utf8");
    if (source.length !== KEY_TEXT_LENGTH && source.length !== KEY_TEXT_LENGTH + 1) {
      throw vaultError("vault_key_invalid");
    }
    if (source.length === KEY_TEXT_LENGTH + 1 && !source.endsWith("\n")) throw vaultError("vault_key_invalid");
    return decodeVaultKey(source.endsWith("\n") ? source.slice(0, -1) : source);
  } catch (error) {
    if (error instanceof Error && error.name === "VaultError") throw error;
    throw vaultError("vault_key_invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function createVaultKeyFile(file: string, random: (size: number) => Buffer = randomBytes): void {
  if (!isAbsolute(file)) throw vaultError("vault_key_invalid");
  const parent = dirname(file);
  const parentMetadata = safeLstat(parent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink() || (parentMetadata.mode & 0o022) !== 0) {
    throw vaultError("vault_key_invalid");
  }
  const key = random(KEY_BYTES);
  if (key.byteLength !== KEY_BYTES) throw vaultError("vault_key_invalid");
  const temporary = join(parent, `.${basename(file)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o400);
    writeFileSync(descriptor, `${encodeVaultKey(key)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    linkSync(temporary, file);
    const directoryDescriptor = openSync(parent, constants.O_RDONLY);
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
  } catch {
    throw vaultError("vault_key_invalid");
  } finally {
    key.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporary);
    } catch {
      // The temporary name may not have been created.
    }
  }
}

function safeLstat(path: string): Stats {
  try {
    return lstatSync(path);
  } catch {
    throw vaultError("vault_key_invalid");
  }
}
