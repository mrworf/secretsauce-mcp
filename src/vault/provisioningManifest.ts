import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  lstatSync,
  linkSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { canonicalJson } from "./canonicalJson.js";
import { vaultError } from "./errors.js";
import {
  VAULT_PROVISIONING_KEY_IDS,
  VAULT_PROVISIONING_REGISTRY_DEFINITION,
  aggregateProvisionedKeys,
  type VaultProvisioningAdapterId,
  type VaultProvisioningKeyId,
  type VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";

const MAX_MANIFEST_BYTES = 128 * 1024;
const uuidV4 = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const adapter = z.enum([
  "symmetric-base64url-32-v1",
  "rsa-pkcs8-pem-v1",
]);
const identity = z.enum(VAULT_PROVISIONING_KEY_IDS);
const entrySchema = z.object({
  id: identity,
  adapter,
  formatVersion: z.literal(1),
  consumers: z.array(z.enum(["application", "vault"])).min(1).max(2),
  status: z.enum(["pending", "verified"]),
  fingerprint: digest.optional(),
}).strict().superRefine((value, context) => {
  if ((value.status === "verified") !== (value.fingerprint !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["fingerprint"],
      message: "Fingerprint must exist only for verified entries.",
    });
  }
});
const manifestWithoutChecksumSchema = z.object({
  version: z.literal(1),
  installationId: uuidV4,
  state: z.enum(["provisioning", "configured"]),
  entries: z.array(entrySchema).length(VAULT_PROVISIONING_KEY_IDS.length),
  aggregate: digest.optional(),
  retry: z.object({
    attempt: z.number().int().min(0).max(6),
    retryPending: z.boolean(),
  }).strict(),
}).strict();
const manifestSchema = manifestWithoutChecksumSchema.extend({
  checksum: digest,
}).strict();

export type VaultProvisioningManifest = z.infer<typeof manifestSchema>;

export function initialProvisioningManifest(
  registry: readonly VaultProvisioningRegistryEntry[],
  installationId = randomUUID(),
): VaultProvisioningManifest {
  return finalizeManifest({
    version: 1,
    installationId,
    state: "provisioning",
    entries: registry.map((value) => ({
      id: value.id,
      adapter: value.adapter,
      formatVersion: value.formatVersion,
      consumers: [...value.consumers],
      status: "pending" as const,
    })),
    retry: { attempt: 0, retryPending: false },
  });
}

export function verifyManifestEntry(
  manifest: VaultProvisioningManifest,
  id: VaultProvisioningKeyId,
  fingerprint: string,
): VaultProvisioningManifest {
  const parsed = parseManifest(manifest);
  if (parsed.state !== "provisioning" || !digest.safeParse(fingerprint).success) {
    throw vaultError("vault_config_invalid");
  }
  const entries = parsed.entries.map((value) =>
    value.id === id
      ? { ...value, status: "verified" as const, fingerprint }
      : value
  );
  if (!entries.some((value) => value.id === id)) {
    throw vaultError("vault_config_invalid");
  }
  return finalizeManifest({
    ...withoutChecksum(parsed),
    entries,
    retry: { attempt: 0, retryPending: false },
  });
}

export function configureManifest(
  manifest: VaultProvisioningManifest,
): VaultProvisioningManifest {
  const parsed = parseManifest(manifest);
  if (
    parsed.state !== "provisioning"
    || parsed.entries.some((value) =>
      value.status !== "verified" || value.fingerprint === undefined
    )
  ) throw vaultError("vault_config_invalid");
  const aggregate = aggregateProvisionedKeys(parsed.entries.map((value) => ({
    id: value.id,
    adapter: value.adapter,
    formatVersion: value.formatVersion,
    fingerprint: value.fingerprint!,
  })));
  return finalizeManifest({
    ...withoutChecksum(parsed),
    state: "configured",
    aggregate,
    retry: { attempt: 0, retryPending: false },
  });
}

export function parseManifest(value: unknown): VaultProvisioningManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_config_invalid");
  validateCompleteEntries(parsed.data);
  const expected = checksum(withoutChecksum(parsed.data));
  if (parsed.data.checksum !== expected) throw vaultError("vault_config_invalid");
  if (
    parsed.data.state === "configured"
      ? (
        parsed.data.aggregate === undefined
        || parsed.data.entries.some((entry) => entry.status !== "verified")
        || parsed.data.aggregate !== aggregateProvisionedKeys(
          parsed.data.entries.map((entry) => ({
            id: entry.id,
            adapter: entry.adapter,
            formatVersion: entry.formatVersion,
            fingerprint: entry.fingerprint!,
          })),
        )
      )
      : parsed.data.aggregate !== undefined
  ) throw vaultError("vault_config_invalid");
  return parsed.data;
}

export function readProvisioningManifest(
  file: string,
): VaultProvisioningManifest {
  let descriptor: number | undefined;
  try {
    if (!isAbsolute(file)) throw vaultError("vault_config_invalid");
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (
      !metadata.isFile()
      || metadata.nlink !== 1
      || ![0o400, 0o600].includes(metadata.mode & 0o777)
      || metadata.size < 2
      || metadata.size > MAX_MANIFEST_BYTES
    ) throw vaultError("vault_config_invalid");
    const source = readFileSync(descriptor, "utf8");
    if (!source.endsWith("\n") || Buffer.byteLength(source) !== metadata.size) {
      throw vaultError("vault_config_invalid");
    }
    const value = JSON.parse(source.slice(0, -1));
    const parsed = parseManifest(value);
    if (`${canonicalJson(parsed)}\n` !== source) {
      throw vaultError("vault_config_invalid");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "VaultError") throw error;
    throw vaultError("vault_config_invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function createProvisioningManifest(
  file: string,
  manifest: VaultProvisioningManifest,
): void {
  writeManifest(file, manifest, true);
}

export function replaceProvisioningManifest(
  file: string,
  manifest: VaultProvisioningManifest,
): void {
  writeManifest(file, manifest, false);
}

function finalizeManifest(
  value: z.infer<typeof manifestWithoutChecksumSchema>,
): VaultProvisioningManifest {
  const parsed = manifestWithoutChecksumSchema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_config_invalid");
  validateCompleteEntries({ ...parsed.data, checksum: "0".repeat(64) });
  return { ...parsed.data, checksum: checksum(parsed.data) };
}

function validateCompleteEntries(
  manifest: VaultProvisioningManifest,
): void {
  const ids = manifest.entries.map((value) => value.id);
  if (
    new Set(ids).size !== VAULT_PROVISIONING_KEY_IDS.length
    || VAULT_PROVISIONING_KEY_IDS.some((id) => !ids.includes(id))
  ) throw vaultError("vault_config_invalid");
  for (const expected of VAULT_PROVISIONING_REGISTRY_DEFINITION) {
    const actual = manifest.entries.find((value) => value.id === expected.id);
    if (
      actual === undefined
      || actual.adapter !== expected.adapter
      || actual.formatVersion !== expected.formatVersion
      || actual.consumers.length !== expected.consumers.length
      || actual.consumers.some((value, index) =>
        value !== expected.consumers[index]
      )
    ) throw vaultError("vault_config_invalid");
  }
}

function withoutChecksum(
  value: VaultProvisioningManifest,
): z.infer<typeof manifestWithoutChecksumSchema> {
  const { checksum: _checksum, ...rest } = value;
  return rest;
}

function checksum(
  value: z.infer<typeof manifestWithoutChecksumSchema>,
): string {
  return createHash("sha256")
    .update("secretsauce:provisioning-manifest:v1\0")
    .update(canonicalJson(value))
    .digest("hex");
}

function writeManifest(
  file: string,
  manifestValue: VaultProvisioningManifest,
  noReplace: boolean,
): void {
  if (!isAbsolute(file)) throw vaultError("vault_config_invalid");
  const manifest = parseManifest(manifestValue);
  const parent = dirname(file);
  let parentMetadata;
  try {
    parentMetadata = lstatSync(parent);
  } catch {
    throw vaultError("vault_config_invalid");
  }
  const currentUid = process.getuid?.();
  if (
    !parentMetadata.isDirectory()
    || parentMetadata.isSymbolicLink()
    || (parentMetadata.mode & 0o022) !== 0
    || (
      currentUid !== undefined
      && parentMetadata.uid !== currentUid
      && parentMetadata.uid !== 0
    )
  ) throw vaultError("vault_config_invalid");
  const temporary = join(parent, `.${basename(file)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    writeFileSync(descriptor, `${canonicalJson(manifest)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    if (noReplace) {
      linkSync(temporary, file);
      unlinkSync(temporary);
    } else renameSync(temporary, file);
    const directory = openSync(parent, constants.O_RDONLY);
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } catch {
    throw vaultError("vault_config_invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporary);
    } catch {
      // Already renamed or never created.
    }
  }
}

export type { VaultProvisioningAdapterId };
