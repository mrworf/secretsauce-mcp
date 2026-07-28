import {
  createPrivateKey,
  generateKeyPairSync,
} from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { vaultError } from "./errors.js";
import {
  createVaultKeyFile,
  readVaultKeyFile,
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

export function createProvisioningKeyAdapters(): ReadonlyMap<
  VaultProvisioningAdapterId,
  VaultProvisioningKeyAdapter
> {
  const adapters: VaultProvisioningKeyAdapter[] = [
    {
      id: "symmetric-base64url-32-v1",
      create: (entry) => createVaultKeyFile(entry.path),
      validate: (entry) => {
        const key = readVaultKeyFile(entry.path);
        try {
          return fingerprintProvisionedKey(entry, key);
        } finally {
          key.fill(0);
        }
      },
    },
    {
      id: "rsa-pkcs8-pem-v1",
      create: (entry) => createRsaKeyFile(entry.path),
      validate: (entry) => {
        const source = readRestrictedFile(entry.path, 16_384);
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
          return readdirSync(path).length === 0
            ? "absent_or_empty"
            : "present";
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

function readRestrictedFile(file: string, maxBytes: number): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.nlink !== 1
      || (metadata.mode & 0o777) !== 0o400
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
