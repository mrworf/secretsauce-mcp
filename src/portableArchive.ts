import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { isUuidV7 } from "./persistence/uuidV7.js";

const BLOCK_BYTES = 512;
const END_BYTES = BLOCK_BYTES * 2;
const MAX_YAML_BYTES = 16 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const ARCHIVE_SCHEMA_VERSION = 1;
const ARCHIVE_TYPE = "secretsauce-portable-configuration";
const YAML_ENTRY_NAMES = [
  "services.yaml",
  "credentials.yaml",
  "policies.yaml",
] as const;
const BASE_ENTRY_NAMES = ["manifest.yaml", ...YAML_ENTRY_NAMES] as const;
const SECRET_ENTRY_NAME = "secrets.enc";
const SAFE_NAME = /^[a-z][a-z0-9.-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export const PORTABLE_INCLUDED_DOMAINS = [
  "services",
  "destinations",
  "credential_definitions",
  "policies",
  "policy_rules",
] as const;

export const PORTABLE_EXCLUDED_DOMAINS = [
  "identities",
  "roles",
  "authenticators",
  "provider_links",
  "service_admins",
  "groups",
  "principal_assignments",
  "credential_assignments",
  "rule_assignments",
  "sessions",
  "oauth_state",
  "api_keys",
  "api_key_activity",
  "runtime_references",
  "audit",
  "activity",
  "remediations",
  "security_settings",
  "system_settings",
  "jobs",
  "deployment_configuration",
  "oidc_configuration",
  "vault_configuration",
  "branding_configuration",
  "local_paths",
  "key_material",
  "history",
  "runtime_generations",
] as const;

export type PortableArchiveMode = "credential-less" | "encrypted-secrets";

export interface PortableArchiveCounts {
  services: number;
  destinations: number;
  credentials: number;
  policies: number;
  rules: number;
  secrets: number;
}

export interface PortableArchiveManifest {
  archive_id: string;
  archive_type: typeof ARCHIVE_TYPE;
  schema_version: typeof ARCHIVE_SCHEMA_VERSION;
  product_version: string;
  created_at_utc_ms: number;
  mode: PortableArchiveMode;
  included_domains: string[];
  excluded_domains: string[];
  object_counts: PortableArchiveCounts;
  file_order: string[];
  files: Array<{
    name: string;
    bytes: number;
    sha256: string;
  }>;
  encryption?: {
    format: "SSVA0001";
    cipher: "AES-256-GCM";
    kdf: "Argon2id";
    memory_kib: 65_536;
    iterations: 3;
    parallelism: 1;
    salt_bytes: 16;
    nonce_bytes: 12;
    selected_count: number;
  };
}

export interface PortableArchiveResult {
  archive: Buffer;
  sha256: string;
  manifest: PortableArchiveManifest;
}

export interface ParsedPortableArchive {
  manifest: PortableArchiveManifest;
  entries: ReadonlyMap<string, Buffer>;
}

export class PortableArchiveError extends Error {
  constructor(readonly code: "invalid" | "too_large" | "corrupt") {
    super(code);
    this.name = "PortableArchiveError";
  }
}

export function createPortableArchive(input: {
  archiveId: string;
  productVersion: string;
  createdAtUtcMs: number;
  mode: PortableArchiveMode;
  counts: PortableArchiveCounts;
  documents: {
    services: Uint8Array;
    credentials: Uint8Array;
    policies: Uint8Array;
  };
  secrets?: Uint8Array;
}): PortableArchiveResult {
  validateCreationInput(input);
  const files = new Map<string, Buffer>([
    ["services.yaml", Buffer.from(input.documents.services)],
    ["credentials.yaml", Buffer.from(input.documents.credentials)],
    ["policies.yaml", Buffer.from(input.documents.policies)],
  ]);
  if (input.mode === "encrypted-secrets") {
    files.set(SECRET_ENTRY_NAME, Buffer.from(input.secrets!));
  }
  const fileOrder: string[] = [...BASE_ENTRY_NAMES];
  if (input.mode === "encrypted-secrets") fileOrder.push(SECRET_ENTRY_NAME);
  const manifest: PortableArchiveManifest = {
    archive_id: input.archiveId,
    archive_type: ARCHIVE_TYPE,
    schema_version: ARCHIVE_SCHEMA_VERSION,
    product_version: input.productVersion,
    created_at_utc_ms: input.createdAtUtcMs,
    mode: input.mode,
    included_domains: [...PORTABLE_INCLUDED_DOMAINS],
    excluded_domains: [...PORTABLE_EXCLUDED_DOMAINS],
    object_counts: { ...input.counts },
    file_order: fileOrder,
    files: [...files].map(([name, value]) => ({
      name,
      bytes: value.byteLength,
      sha256: digest(value),
    })),
    ...(input.mode === "encrypted-secrets"
      ? {
          encryption: {
            format: "SSVA0001" as const,
            cipher: "AES-256-GCM" as const,
            kdf: "Argon2id" as const,
            memory_kib: 65_536 as const,
            iterations: 3 as const,
            parallelism: 1 as const,
            salt_bytes: 16 as const,
            nonce_bytes: 12 as const,
            selected_count: input.counts.secrets,
          },
        }
      : {}),
  };
  const manifestBytes = encodeCanonicalYaml(manifest);
  if (manifestBytes.byteLength > MAX_YAML_BYTES) {
    wipeFiles(files);
    manifestBytes.fill(0);
    throw new PortableArchiveError("too_large");
  }
  const ordered = new Map<string, Buffer>([
    ["manifest.yaml", manifestBytes],
    ...files,
  ]);
  let tar: Buffer | undefined;
  try {
    tar = encodeTar(ordered);
    const archive = gzipSync(tar, {
      level: 9,
    });
    if (archive.byteLength > MAX_ARCHIVE_BYTES) {
      archive.fill(0);
      throw new PortableArchiveError("too_large");
    }
    return { archive, sha256: digest(archive), manifest };
  } catch (error) {
    if (error instanceof PortableArchiveError) throw error;
    throw new PortableArchiveError("invalid");
  } finally {
    tar?.fill(0);
    wipeFiles(ordered);
  }
}

export function parsePortableArchive(value: Uint8Array): ParsedPortableArchive {
  if (!(value instanceof Uint8Array) || value.byteLength < 1) {
    throw new PortableArchiveError("corrupt");
  }
  if (value.byteLength > MAX_ARCHIVE_BYTES) {
    throw new PortableArchiveError("too_large");
  }
  let tar: Buffer;
  try {
    tar = gunzipSync(value, { maxOutputLength: maximumTarBytes() });
  } catch {
    throw new PortableArchiveError("corrupt");
  }
  try {
    const entries = parseTar(tar);
    const manifestBytes = entries.get("manifest.yaml");
    if (manifestBytes === undefined || manifestBytes.byteLength > MAX_YAML_BYTES) {
      throw new PortableArchiveError("corrupt");
    }
    const manifest = validateManifest(parseManifest(manifestBytes));
    const canonicalManifest = encodeCanonicalYaml(manifest);
    const isCanonical = canonicalManifest.equals(manifestBytes);
    canonicalManifest.fill(0);
    if (!isCanonical) throw new PortableArchiveError("corrupt");
    const expectedOrder = manifest.mode === "encrypted-secrets"
      ? [...BASE_ENTRY_NAMES, SECRET_ENTRY_NAME]
      : [...BASE_ENTRY_NAMES];
    if (
      !sameStrings([...entries.keys()], expectedOrder)
      || !sameStrings(manifest.file_order, expectedOrder)
    ) throw new PortableArchiveError("corrupt");
    if (manifest.files.length !== expectedOrder.length - 1) {
      throw new PortableArchiveError("corrupt");
    }
    const payloadNames = expectedOrder.slice(1);
    let totalPayload = 0;
    for (let index = 0; index < payloadNames.length; index += 1) {
      const name = payloadNames[index]!;
      const bytes = entries.get(name)!;
      const declared = manifest.files[index]!;
      if (
        declared.name !== name
        || declared.bytes !== bytes.byteLength
        || declared.sha256 !== digest(bytes)
      ) throw new PortableArchiveError("corrupt");
      if (name.endsWith(".yaml") && bytes.byteLength > MAX_YAML_BYTES) {
        throw new PortableArchiveError("too_large");
      }
      totalPayload += bytes.byteLength;
    }
    if (totalPayload > MAX_PAYLOAD_BYTES) {
      throw new PortableArchiveError("too_large");
    }
    return { manifest, entries };
  } finally {
    tar.fill(0);
  }
}

function validateCreationInput(input: {
  archiveId: string;
  productVersion: string;
  createdAtUtcMs: number;
  mode: PortableArchiveMode;
  counts: PortableArchiveCounts;
  documents: {
    services: Uint8Array;
    credentials: Uint8Array;
    policies: Uint8Array;
  };
  secrets?: Uint8Array;
}): void {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.counts !== "object"
    || input.counts === null
    || Array.isArray(input.counts)
    || typeof input.documents !== "object"
    || input.documents === null
    || Array.isArray(input.documents)
  ) throw new PortableArchiveError("invalid");
  if (
    !isUuidV7(input.archiveId)
    || typeof input.productVersion !== "string"
    || input.productVersion.length < 1
    || input.productVersion.length > 128
    || /[\u0000-\u001f\u007f]/u.test(input.productVersion)
    || !Number.isSafeInteger(input.createdAtUtcMs)
    || input.createdAtUtcMs < 0
    || (input.mode !== "credential-less" && input.mode !== "encrypted-secrets")
  ) throw new PortableArchiveError("invalid");
  const counts = Object.values(input.counts);
  if (
    counts.length !== 6
    || counts.some((count) =>
      !Number.isSafeInteger(count) || count < 0 || count > 10_000)
    || counts.slice(0, 5).reduce((total, count) => total + count, 0) > 10_000
  ) throw new PortableArchiveError("invalid");
  const documents = Object.values(input.documents);
  if (
    documents.some((document) =>
      !(document instanceof Uint8Array)
      || document.byteLength < 1
      || document.byteLength > MAX_YAML_BYTES)
  ) throw new PortableArchiveError("too_large");
  if (
    input.mode === "credential-less"
      ? input.secrets !== undefined || input.counts.secrets !== 0
      : !(input.secrets instanceof Uint8Array)
        || input.secrets.byteLength < 1
        || input.counts.secrets < 1
  ) throw new PortableArchiveError("invalid");
  const total = documents.reduce(
    (sum, document) => sum + document.byteLength,
    input.secrets?.byteLength ?? 0,
  );
  if (total > MAX_PAYLOAD_BYTES) throw new PortableArchiveError("too_large");
}

function encodeTar(entries: ReadonlyMap<string, Buffer>): Buffer {
  const total = [...entries].reduce(
    (sum, [name, value]) =>
      sum + BLOCK_BYTES + paddedLength(value.byteLength),
    END_BYTES,
  );
  if (total > maximumTarBytes()) throw new PortableArchiveError("too_large");
  const tar = Buffer.alloc(total);
  let offset = 0;
  for (const [name, value] of entries) {
    const header = tar.subarray(offset, offset + BLOCK_BYTES);
    encodeHeader(header, name, value.byteLength);
    offset += BLOCK_BYTES;
    value.copy(tar, offset);
    offset += paddedLength(value.byteLength);
  }
  return tar;
}

function encodeHeader(header: Buffer, name: string, size: number): void {
  if (!SAFE_NAME.test(name) || Buffer.byteLength(name, "ascii") > 100) {
    throw new PortableArchiveError("invalid");
  }
  header.write(name, 0, 100, "ascii");
  writeOctal(header, 100, 8, 0o600);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);
  writeOctal(header, 148, 8, checksum(header));
}

function parseTar(tar: Buffer): Map<string, Buffer> {
  if (
    tar.byteLength < END_BYTES
    || tar.byteLength % BLOCK_BYTES !== 0
    || tar.byteLength > maximumTarBytes()
  ) throw new PortableArchiveError("corrupt");
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + END_BYTES <= tar.byteLength) {
    const header = tar.subarray(offset, offset + BLOCK_BYTES);
    if (header.every((byte) => byte === 0)) {
      if (
        offset + END_BYTES !== tar.byteLength
        || !tar.subarray(offset + BLOCK_BYTES).every((byte) => byte === 0)
      ) throw new PortableArchiveError("corrupt");
      return entries;
    }
    validateHeader(header);
    const name = readText(header, 0, 100);
    const size = readOctal(header, 124, 12);
    if (!SAFE_NAME.test(name) || entries.has(name)) {
      throw new PortableArchiveError("corrupt");
    }
    const dataStart = offset + BLOCK_BYTES;
    const next = dataStart + paddedLength(size);
    if (next + END_BYTES > tar.byteLength) {
      throw new PortableArchiveError("corrupt");
    }
    if (!tar.subarray(dataStart + size, next).every((byte) => byte === 0)) {
      throw new PortableArchiveError("corrupt");
    }
    entries.set(name, Buffer.from(tar.subarray(dataStart, dataStart + size)));
    offset = next;
  }
  throw new PortableArchiveError("corrupt");
}

function validateHeader(header: Buffer): void {
  const declaredChecksum = readOctal(header, 148, 8);
  const copy = Buffer.from(header);
  copy.fill(0x20, 148, 156);
  const actualChecksum = checksum(copy);
  copy.fill(0);
  if (
    declaredChecksum !== actualChecksum
    || readOctal(header, 100, 8) !== 0o600
    || readOctal(header, 108, 8) !== 0
    || readOctal(header, 116, 8) !== 0
    || readOctal(header, 136, 12) !== 0
    || header[156] !== 0x30
    || readText(header, 157, 100) !== ""
    || header.subarray(257, 263).toString("ascii") !== "ustar\0"
    || header.subarray(263, 265).toString("ascii") !== "00"
    || readText(header, 265, 32) !== ""
    || readText(header, 297, 32) !== ""
    || readOctal(header, 329, 8) !== 0
    || readOctal(header, 337, 8) !== 0
    || readText(header, 345, 155) !== ""
    || !header.subarray(500).every((byte) => byte === 0)
  ) throw new PortableArchiveError("corrupt");
}

function validateManifest(value: unknown): PortableArchiveManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PortableArchiveError("corrupt");
  }
  const manifest = value as Record<string, unknown>;
  const expectedKeys = [
    "archive_id",
    "archive_type",
    "created_at_utc_ms",
    "excluded_domains",
    "file_order",
    "files",
    "included_domains",
    "mode",
    "object_counts",
    "product_version",
    "schema_version",
    ...(manifest.mode === "encrypted-secrets" ? ["encryption"] : []),
  ];
  if (
    !sameStrings(Object.keys(manifest).sort(), expectedKeys.sort())
    || typeof manifest.archive_id !== "string"
    || !isUuidV7(manifest.archive_id)
    || manifest.archive_type !== ARCHIVE_TYPE
    || manifest.schema_version !== ARCHIVE_SCHEMA_VERSION
    || typeof manifest.product_version !== "string"
    || manifest.product_version.length < 1
    || manifest.product_version.length > 128
    || /[\u0000-\u001f\u007f]/u.test(manifest.product_version)
    || !Number.isSafeInteger(manifest.created_at_utc_ms)
    || (manifest.created_at_utc_ms as number) < 0
    || (manifest.mode !== "credential-less"
      && manifest.mode !== "encrypted-secrets")
    || !sameStrings(
      manifest.included_domains,
      [...PORTABLE_INCLUDED_DOMAINS],
    )
    || !sameStrings(
      manifest.excluded_domains,
      [...PORTABLE_EXCLUDED_DOMAINS],
    )
    || !Array.isArray(manifest.file_order)
    || !manifest.file_order.every((entry) => typeof entry === "string")
    || !Array.isArray(manifest.files)
  ) throw new PortableArchiveError("corrupt");
  validateCounts(manifest.object_counts);
  for (const entry of manifest.files) {
    if (
      typeof entry !== "object"
      || entry === null
      || Array.isArray(entry)
      || !sameStrings(Object.keys(entry).sort(), ["bytes", "name", "sha256"])
    ) throw new PortableArchiveError("corrupt");
    const file = entry as Record<string, unknown>;
    if (
      typeof file.name !== "string"
      || !SAFE_NAME.test(file.name)
      || !Number.isSafeInteger(file.bytes)
      || (file.bytes as number) < 1
      || !SHA256.test(String(file.sha256))
    ) throw new PortableArchiveError("corrupt");
  }
  validateEncryption(manifest.mode, manifest.encryption, manifest.object_counts);
  return manifest as unknown as PortableArchiveManifest;
}

function validateCounts(value: unknown): asserts value is PortableArchiveCounts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PortableArchiveError("corrupt");
  }
  const counts = value as Record<string, unknown>;
  if (
    !sameStrings(Object.keys(counts).sort(), [
      "credentials",
      "destinations",
      "policies",
      "rules",
      "secrets",
      "services",
    ])
    || Object.values(counts).some((count) =>
      !Number.isSafeInteger(count) || (count as number) < 0
      || (count as number) > 10_000)
    || (counts.services as number)
      + (counts.destinations as number)
      + (counts.credentials as number)
      + (counts.policies as number)
      + (counts.rules as number) > 10_000
  ) throw new PortableArchiveError("corrupt");
}

function validateEncryption(
  mode: unknown,
  value: unknown,
  counts: unknown,
): void {
  if (mode === "credential-less") {
    if (value !== undefined || (counts as PortableArchiveCounts).secrets !== 0) {
      throw new PortableArchiveError("corrupt");
    }
    return;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PortableArchiveError("corrupt");
  }
  const encryption = value as Record<string, unknown>;
  if (
    !sameStrings(Object.keys(encryption).sort(), [
      "cipher",
      "format",
      "iterations",
      "kdf",
      "memory_kib",
      "nonce_bytes",
      "parallelism",
      "salt_bytes",
      "selected_count",
    ])
    || encryption.format !== "SSVA0001"
    || encryption.cipher !== "AES-256-GCM"
    || encryption.kdf !== "Argon2id"
    || encryption.memory_kib !== 65_536
    || encryption.iterations !== 3
    || encryption.parallelism !== 1
    || encryption.salt_bytes !== 16
    || encryption.nonce_bytes !== 12
    || encryption.selected_count !== (counts as PortableArchiveCounts).secrets
    || !Number.isSafeInteger(encryption.selected_count)
    || (encryption.selected_count as number) < 1
  ) throw new PortableArchiveError("corrupt");
}

function parseManifest(value: Buffer): unknown {
  try {
    return parseYaml(value.toString("utf8"), {
      maxAliasCount: 0,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
  } catch {
    throw new PortableArchiveError("corrupt");
  }
}

function encodeCanonicalYaml(value: unknown): Buffer {
  try {
    const source = stringifyYaml(sortValue(value), {
      aliasDuplicateObjects: false,
      lineWidth: 0,
    });
    return Buffer.from(source.endsWith("\n") ? source : `${source}\n`, "utf8");
  } catch {
    throw new PortableArchiveError("invalid");
  }
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}

function writeOctal(
  target: Buffer,
  offset: number,
  width: number,
  value: number,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PortableArchiveError("invalid");
  }
  const octal = value.toString(8);
  if (octal.length > width - 1) throw new PortableArchiveError("too_large");
  target.fill(0x30, offset, offset + width - 1);
  target.write(octal, offset + width - 1 - octal.length, "ascii");
  target[offset + width - 1] = 0;
}

function readOctal(source: Buffer, offset: number, width: number): number {
  const field = source.subarray(offset, offset + width);
  if (
    field[field.byteLength - 1] !== 0
    || !field.subarray(0, -1).every((byte) => byte >= 0x30 && byte <= 0x37)
  ) throw new PortableArchiveError("corrupt");
  const value = Number.parseInt(field.subarray(0, -1).toString("ascii"), 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PortableArchiveError("corrupt");
  }
  return value;
}

function readText(source: Buffer, offset: number, width: number): string {
  const field = source.subarray(offset, offset + width);
  const zero = field.indexOf(0);
  const end = zero < 0 ? field.byteLength : zero;
  if (!field.subarray(end).every((byte) => byte === 0)) {
    throw new PortableArchiveError("corrupt");
  }
  return field.subarray(0, end).toString("ascii");
}

function checksum(header: Buffer): number {
  let total = 0;
  for (const byte of header) total += byte;
  return total;
}

function paddedLength(length: number): number {
  return Math.ceil(length / BLOCK_BYTES) * BLOCK_BYTES;
}

function maximumTarBytes(): number {
  return MAX_PAYLOAD_BYTES + MAX_YAML_BYTES + (6 * BLOCK_BYTES) + END_BYTES;
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameStrings(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function wipeFiles(files: ReadonlyMap<string, Buffer>): void {
  for (const value of files.values()) value.fill(0);
}
