import {
  createPrivateKey,
  generateKeyPairSync,
} from "node:crypto";
import {
  closeSync,
  chownSync,
  chmodSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { vaultError } from "./errors.js";
import {
  createVaultKeyFile,
  decodeVaultKey,
} from "./keyFile.js";
import {
  fingerprintProvisionedKey,
  type VaultProvisioningAdapterId,
  type VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";

export type RetainedStateClassification =
  | "absent_or_empty"
  | "present"
  | "indeterminate";

export interface RetainedStateInventoryAdapter {
  id: string;
  classify(): RetainedStateClassification;
}

export interface VaultProvisioningKeyAdapter {
  id: VaultProvisioningAdapterId;
  create(entry: VaultProvisioningRegistryEntry): void;
  validate(entry: VaultProvisioningRegistryEntry): string;
}

export interface ProvisionedKeyOwnership {
  uid: number;
  gid: number;
  mode: 0o400 | 0o440;
}

export function createProvisioningKeyAdapters(
  ownership: (
    entry: VaultProvisioningRegistryEntry,
  ) => ProvisionedKeyOwnership = () => ({
    uid: process.getuid?.() ?? 0,
    gid: process.getgid?.() ?? 0,
    mode: 0o400,
  }),
): ReadonlyMap<
  VaultProvisioningAdapterId,
  VaultProvisioningKeyAdapter
> {
  const adapters: VaultProvisioningKeyAdapter[] = [
    {
      id: "symmetric-base64url-32-v1",
      create: (entry) => {
        ensureKeyParent(entry.path);
        createVaultKeyFile(entry.path);
        applyOwnership(entry.path, ownership(entry));
      },
      validate: (entry) => {
        const expected = ownership(entry);
        const source = readRestrictedFile(entry.path, 64, expected);
        try {
          const text = source.toString("utf8");
          const canonical = text.endsWith("\n") ? text.slice(0, -1) : text;
          const key = decodeVaultKey(canonical);
          try {
            return fingerprintProvisionedKey(entry, key);
          } finally {
            key.fill(0);
          }
        } finally {
          source.fill(0);
        }
      },
    },
    {
      id: "rsa-pkcs8-pem-v1",
      create: (entry) => {
        ensureKeyParent(entry.path);
        createRsaKeyFile(entry.path);
        applyOwnership(entry.path, ownership(entry));
      },
      validate: (entry) => {
        const source = readRestrictedFile(
          entry.path,
          16_384,
          ownership(entry),
        );
        try {
          const key = createPrivateKey(source);
          if (
            key.asymmetricKeyType !== "rsa"
            || key.asymmetricKeyDetails?.modulusLength !== 2048
          ) throw new Error("wrong type");
          const canonical = key.export({ type: "pkcs8", format: "pem" });
          const bytes = Buffer.isBuffer(canonical)
            ? canonical
            : Buffer.from(canonical, "utf8");
          try {
            if (!source.equals(bytes)) throw new Error("noncanonical");
            return fingerprintProvisionedKey(entry, bytes);
          } finally {
            bytes.fill(0);
          }
        } catch {
          throw vaultError("vault_key_invalid");
        } finally {
          source.fill(0);
        }
      },
    },
  ];
  return new Map(adapters.map((adapter) => [adapter.id, adapter]));
}

export function readProvisionedSymmetricKey(
  entry: VaultProvisioningRegistryEntry,
  ownership: ProvisionedKeyOwnership,
): Buffer {
  if (entry.adapter !== "symmetric-base64url-32-v1") {
    throw vaultError("vault_key_invalid");
  }
  const source = readRestrictedFile(entry.path, 64, ownership);
  try {
    const text = source.toString("utf8");
    const canonical = text.endsWith("\n") ? text.slice(0, -1) : text;
    return decodeVaultKey(canonical);
  } finally {
    source.fill(0);
  }
}

function ensureKeyParent(file: string): void {
  const parent = dirname(file);
  try {
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const metadata = lstatSync(parent);
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || (metadata.mode & 0o022) !== 0
    ) throw new Error("unsafe");
  } catch {
    throw vaultError("vault_key_invalid");
  }
}

function applyOwnership(
  file: string,
  ownership: ProvisionedKeyOwnership,
): void {
  chownSync(file, ownership.uid, ownership.gid);
  chmodSync(file, ownership.mode);
}

export function pathInventoryAdapter(
  id: string,
  path: string,
): RetainedStateInventoryAdapter {
  return {
    id,
    classify: () => {
      try {
        const metadata = lstatSync(path);
        if (metadata.isFile()) {
          return metadata.size === 0 ? "absent_or_empty" : "present";
        }
        if (metadata.isDirectory()) {
          const directory = opendirSync(path);
          try {
            return directory.readSync() === null
              ? "absent_or_empty"
              : "present";
          } finally {
            directory.closeSync();
          }
        }
        return "indeterminate";
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "absent_or_empty"
          : "indeterminate";
      }
    },
  };
}

function createRsaKeyFile(file: string): void {
  let privateKey: Buffer | undefined;
  try {
    const generated = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 0x10001,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    privateKey = Buffer.from(generated.privateKey, "utf8");
    writeNoReplace(file, privateKey);
  } catch {
    throw vaultError("vault_key_invalid");
  } finally {
    privateKey?.fill(0);
  }
}

function writeNoReplace(file: string, value: Uint8Array): void {
  const parent = dirname(file);
  const metadata = lstatSync(parent);
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || (metadata.mode & 0o022) !== 0
  ) throw vaultError("vault_key_invalid");
  const temporary = join(parent, `.${basename(file)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o400,
    );
    writeFileSync(descriptor, value);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    linkSync(temporary, file);
    const directory = openSync(parent, constants.O_RDONLY);
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporary);
    } catch {
      // Already removed or never created.
    }
  }
}

function readRestrictedFile(
  file: string,
  maxBytes: number,
  expected: ProvisionedKeyOwnership,
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.nlink !== 1
      || (metadata.mode & 0o777) !== expected.mode
      || metadata.uid !== expected.uid
      || metadata.gid !== expected.gid
      || metadata.size < 1
      || metadata.size > maxBytes
    ) throw new Error("invalid");
    return readFileSync(descriptor);
  } catch {
    throw vaultError("vault_key_invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
