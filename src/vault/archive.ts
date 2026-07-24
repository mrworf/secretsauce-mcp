import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { argon2id, hash as argon2Hash } from "argon2";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { vaultError } from "./errors.js";
import {
  VaultRecordStore,
  type VaultBackupRecord,
  type VaultRestoreTransaction,
} from "./recordStore.js";
import {
  canonicalizeVaultBackupSelection,
  type VaultBackupSelection,
} from "./backupSelection.js";

const MAGIC = Buffer.from("SSVA0001", "ascii");
const VERSION = 1;
const HEADER_BYTES = 64;
const CHUNK_HEADER_BYTES = 24;
const TAG_BYTES = 16;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const MEMORY_COST_KIB = 65_536;
const TIME_COST = 3;
const PARALLELISM = 1;
const CHUNK_BYTES = 65_536;
const FINAL_MANIFEST_BYTES = 44;
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_RECORDS = 100_000;
const MAX_PASSPHRASE_BYTES = 1_024;
const MIN_PASSPHRASE_BYTES = 12;
const LOCATOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface VaultArchiveOptions {
  randomBytes?: (size: number) => Buffer;
  randomUuid?: () => string;
}

export async function exportEncryptedVaultArchive(
  store: VaultRecordStore,
  passphraseValue: Uint8Array,
  options: VaultArchiveOptions = {},
  selection?: readonly VaultBackupSelection[],
): Promise<Buffer> {
  const selected = selection === undefined
    ? undefined
    : canonicalizeVaultBackupSelection(selection);
  const passphrase = validatePassphrase(passphraseValue);
  const random = options.randomBytes ?? randomBytes;
  const archiveId = (options.randomUuid ?? randomUUID)();
  if (!LOCATOR_PATTERN.test(archiveId)) {
    passphrase.fill(0);
    throw vaultError("vault_archive_invalid");
  }
  const salt = exactRandom(random, SALT_BYTES);
  const recordCount = selected?.length ?? store.readiness().recordCount;
  if (recordCount > MAX_RECORDS) {
    passphrase.fill(0);
    salt.fill(0);
    throw vaultError("vault_archive_invalid");
  }
  const header = buildHeader(recordCount, archiveId, salt);
  let key: Buffer | undefined;
  try {
    key = await deriveKey(passphrase, salt);
    const chunks: Buffer[] = [];
    const digest = createHash("sha256");
    let pending: Buffer = Buffer.alloc(0);
    let totalPlaintext = 0;
    let sequence = 0;
    let seen = 0;

    const emitData = (plaintext: Buffer): void => {
      digest.update(plaintext);
      totalPlaintext += plaintext.byteLength;
      if (!Number.isSafeInteger(totalPlaintext) || totalPlaintext > MAX_ARCHIVE_BYTES) throw vaultError("vault_archive_invalid");
      const combined = Buffer.concat([pending, plaintext]);
      pending.fill(0);
      let offset = 0;
      while (combined.byteLength - offset >= CHUNK_BYTES) {
        const block = Buffer.from(combined.subarray(offset, offset + CHUNK_BYTES));
        try {
          chunks.push(encryptChunk(header, key!, sequence, 0, block, random));
        } finally {
          block.fill(0);
        }
        sequence += 1;
        offset += CHUNK_BYTES;
      }
      pending = Buffer.from(combined.subarray(offset));
      combined.fill(0);
    };

    const exportedCount = store.forEachBackupRecord((record) => {
      const serialized = serializeRecord(record);
      try {
        emitData(serialized);
        seen += 1;
      } finally {
        serialized.fill(0);
      }
    }, selected);
    if (exportedCount !== recordCount || seen !== recordCount) throw vaultError("vault_archive_invalid");
    if (pending.byteLength > 0) {
      chunks.push(encryptChunk(header, key!, sequence, 0, pending, random));
      sequence += 1;
      pending.fill(0);
    }
    const manifest = Buffer.alloc(FINAL_MANIFEST_BYTES);
    manifest.writeUInt32BE(recordCount, 0);
    manifest.writeBigUInt64BE(BigInt(totalPlaintext), 4);
    digest.digest().copy(manifest, 12);
    try {
      chunks.push(encryptChunk(header, key, sequence, 1, manifest, random));
    } finally {
      manifest.fill(0);
    }
    const totalBytes = header.byteLength + chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    if (totalBytes > MAX_ARCHIVE_BYTES) throw vaultError("vault_archive_invalid");
    const archive = Buffer.concat([header, ...chunks], totalBytes);
    for (const chunk of chunks) chunk.fill(0);
    return archive;
  } finally {
    passphrase.fill(0);
    salt.fill(0);
    key?.fill(0);
    header.fill(0);
  }
}

export async function importEncryptedVaultArchive(
  store: VaultRecordStore,
  passphraseValue: Uint8Array,
  archiveValue: Uint8Array,
): Promise<void> {
  const passphrase = validatePassphrase(passphraseValue);
  const archive = Buffer.from(archiveValue.buffer, archiveValue.byteOffset, archiveValue.byteLength);
  if (archive.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES + TAG_BYTES || archive.byteLength > MAX_ARCHIVE_BYTES) {
    passphrase.fill(0);
    throw vaultError("vault_archive_invalid");
  }
  const header = Buffer.from(archive.subarray(0, HEADER_BYTES));
  let parsedHeader: { recordCount: number; salt: Buffer } | undefined;
  let key: Buffer | undefined;
  let transaction: VaultRestoreTransaction | undefined;
  try {
    parsedHeader = parseHeader(header);
    key = await deriveKey(passphrase, parsedHeader.salt);
    transaction = store.beginRestore();
    const digest = createHash("sha256");
    const nonces = new Set<string>();
    let offset = HEADER_BYTES;
    let sequence = 0;
    let recordCount = 0;
    let totalPlaintext = 0;
    let pending: Buffer = Buffer.alloc(0);
    let finalSeen = false;

    while (offset < archive.byteLength) {
      if (archive.byteLength - offset < CHUNK_HEADER_BYTES + TAG_BYTES) throw authenticationFailure();
      const chunkHeader = archive.subarray(offset, offset + CHUNK_HEADER_BYTES);
      const chunkSequence = chunkHeader.readUInt32BE(0);
      const flags = chunkHeader[4]!;
      const plaintextLength = chunkHeader.readUInt32BE(8);
      const nonce = chunkHeader.subarray(12, 24);
      if (
        chunkSequence !== sequence
        || (flags !== 0 && flags !== 1)
        || chunkHeader.subarray(5, 8).some((value) => value !== 0)
        || plaintextLength > CHUNK_BYTES
        || (flags === 1 && plaintextLength !== FINAL_MANIFEST_BYTES)
      ) {
        throw authenticationFailure();
      }
      const nonceId = nonce.toString("hex");
      if (nonces.has(nonceId)) throw authenticationFailure();
      nonces.add(nonceId);
      const chunkBytes = CHUNK_HEADER_BYTES + plaintextLength + TAG_BYTES;
      if (archive.byteLength - offset < chunkBytes) throw authenticationFailure();
      const ciphertext = archive.subarray(offset + CHUNK_HEADER_BYTES, offset + CHUNK_HEADER_BYTES + plaintextLength);
      const tag = archive.subarray(offset + chunkBytes - TAG_BYTES, offset + chunkBytes);
      const plaintext = decryptChunk(header, key, chunkHeader, ciphertext, tag);
      try {
        if (flags === 1) {
          if (finalSeen || offset + chunkBytes !== archive.byteLength || pending.byteLength !== 0) throw authenticationFailure();
          finalSeen = true;
          const declaredCount = plaintext.readUInt32BE(0);
          const declaredTotal = safeNumber(plaintext.readBigUInt64BE(4));
          const declaredDigest = plaintext.subarray(12, 44);
          const actualDigest = digest.digest();
          if (
            declaredCount !== parsedHeader.recordCount
            || declaredCount !== recordCount
            || declaredTotal !== totalPlaintext
            || !timingSafeEqual(declaredDigest, actualDigest)
          ) {
            throw authenticationFailure();
          }
        } else {
          if (finalSeen || plaintextLength < 1) throw authenticationFailure();
          digest.update(plaintext);
          totalPlaintext += plaintext.byteLength;
          if (!Number.isSafeInteger(totalPlaintext) || totalPlaintext > MAX_ARCHIVE_BYTES) throw authenticationFailure();
          const combined = Buffer.concat([pending, plaintext]);
          pending.fill(0);
          pending = parseRecords(combined, transaction, (count) => { recordCount += count; });
          combined.fill(0);
          if (recordCount > parsedHeader.recordCount || recordCount > MAX_RECORDS) throw authenticationFailure();
        }
      } finally {
        plaintext.fill(0);
      }
      offset += chunkBytes;
      sequence += 1;
    }
    if (!finalSeen) throw authenticationFailure();
    transaction.commit();
    transaction = undefined;
  } catch (error) {
    transaction?.abort();
    if (error instanceof Error && error.name === "VaultError" && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (code === "vault_archive_invalid") throw error;
    }
    throw authenticationFailure();
  } finally {
    passphrase.fill(0);
    parsedHeader?.salt.fill(0);
    key?.fill(0);
    header.fill(0);
  }
}

function buildHeader(recordCount: number, archiveId: string, salt: Buffer): Buffer {
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header[8] = VERSION;
  header[9] = 0;
  header.writeUInt16BE(HEADER_BYTES, 10);
  header.writeUInt32BE(MEMORY_COST_KIB, 12);
  header.writeUInt32BE(TIME_COST, 16);
  header[20] = PARALLELISM;
  header[21] = SALT_BYTES;
  header.fill(0, 22, 24);
  header.writeUInt32BE(CHUNK_BYTES, 24);
  header.writeUInt32BE(recordCount, 28);
  uuidToBytes(archiveId, false).copy(header, 32);
  salt.copy(header, 48);
  return header;
}

function parseHeader(header: Buffer): { recordCount: number; salt: Buffer } {
  if (
    !header.subarray(0, 8).equals(MAGIC)
    || header[8] !== VERSION
    || header[9] !== 0
    || header.readUInt16BE(10) !== HEADER_BYTES
    || header.readUInt32BE(12) !== MEMORY_COST_KIB
    || header.readUInt32BE(16) !== TIME_COST
    || header[20] !== PARALLELISM
    || header[21] !== SALT_BYTES
    || header.subarray(22, 24).some((value) => value !== 0)
    || header.readUInt32BE(24) !== CHUNK_BYTES
    || header.readUInt32BE(28) > MAX_RECORDS
    || !LOCATOR_PATTERN.test(bytesToUuid(header.subarray(32, 48)))
  ) {
    throw vaultError("vault_archive_invalid");
  }
  return { recordCount: header.readUInt32BE(28), salt: Buffer.from(header.subarray(48, 64)) };
}

async function deriveKey(passphrase: Buffer, salt: Buffer): Promise<Buffer> {
  try {
    const value = await argon2Hash(passphrase, {
      type: argon2id,
      memoryCost: MEMORY_COST_KIB,
      timeCost: TIME_COST,
      parallelism: PARALLELISM,
      hashLength: KEY_BYTES,
      raw: true,
      salt,
    });
    const key = Buffer.from(value);
    if (key.byteLength !== KEY_BYTES) throw new Error("wrong key length");
    return key;
  } catch {
    throw vaultError("vault_archive_authentication_failed");
  }
}

function encryptChunk(
  archiveHeader: Buffer,
  key: Buffer,
  sequence: number,
  flags: 0 | 1,
  plaintext: Buffer,
  random: (size: number) => Buffer,
): Buffer {
  const nonce = exactRandom(random, NONCE_BYTES);
  const chunkHeader = Buffer.alloc(CHUNK_HEADER_BYTES);
  chunkHeader.writeUInt32BE(sequence, 0);
  chunkHeader[4] = flags;
  chunkHeader.fill(0, 5, 8);
  chunkHeader.writeUInt32BE(plaintext.byteLength, 8);
  nonce.copy(chunkHeader, 12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.concat([archiveHeader, chunkHeader]));
  try {
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([chunkHeader, ciphertext, cipher.getAuthTag()]);
  } finally {
    nonce.fill(0);
  }
}

function decryptChunk(
  archiveHeader: Buffer,
  key: Buffer,
  chunkHeader: Buffer,
  ciphertext: Buffer,
  tag: Buffer,
): Buffer {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, chunkHeader.subarray(12, 24));
    decipher.setAAD(Buffer.concat([archiveHeader, chunkHeader]));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw authenticationFailure();
  }
}

function serializeRecord(record: VaultBackupRecord): Buffer {
  if (
    !LOCATOR_PATTERN.test(record.locator)
    || !isUuidV7(record.serviceId)
    || !isUuidV7(record.destinationId)
    || !isUuidV7(record.credentialId)
    || record.secret.byteLength < 1
    || record.secret.byteLength > 65_536
  ) {
    throw vaultError("vault_archive_invalid");
  }
  const payloadLength = 96 + record.secret.byteLength;
  const result = Buffer.alloc(4 + payloadLength);
  result.writeUInt32BE(payloadLength, 0);
  uuidToBytes(record.locator, false).copy(result, 4);
  result.writeBigUInt64BE(BigInt(record.generation), 20);
  result.writeBigUInt64BE(BigInt(record.createdAt), 28);
  result.writeBigUInt64BE(BigInt(record.updatedAt), 36);
  result[44] = record.captureLastFour ? 1 : 0;
  result.fill(0, 45, 48);
  uuidToBytes(record.serviceId, true).copy(result, 48);
  uuidToBytes(record.destinationId, true).copy(result, 64);
  uuidToBytes(record.credentialId, true).copy(result, 80);
  result.writeUInt32BE(record.secret.byteLength, 96);
  record.secret.copy(result, 100);
  return result;
}

function parseRecords(
  plaintext: Buffer,
  transaction: VaultRestoreTransaction,
  increment: (count: number) => void,
): Buffer {
  let offset = 0;
  let count = 0;
  while (plaintext.byteLength - offset >= 4) {
    const payloadLength = plaintext.readUInt32BE(offset);
    if (payloadLength < 97 || payloadLength > 65_632) throw authenticationFailure();
    if (plaintext.byteLength - offset < payloadLength + 4) break;
    const entry = plaintext.subarray(offset + 4, offset + 4 + payloadLength);
    const generation = safeNumber(entry.readBigUInt64BE(16));
    const createdAt = safeNumber(entry.readBigUInt64BE(24));
    const updatedAt = safeNumber(entry.readBigUInt64BE(32));
    const capture = entry[40]!;
    const secretLength = entry.readUInt32BE(92);
    if (
      (capture !== 0 && capture !== 1)
      || entry.subarray(41, 44).some((value) => value !== 0)
      || secretLength < 1
      || secretLength > 65_536
      || payloadLength !== 96 + secretLength
    ) {
      throw authenticationFailure();
    }
    const secret = Buffer.from(entry.subarray(96, 96 + secretLength));
    try {
      transaction.append({
        locator: bytesToUuid(entry.subarray(0, 16)),
        generation,
        createdAt,
        updatedAt,
        captureLastFour: capture === 1,
        serviceId: bytesToUuid(entry.subarray(44, 60)),
        destinationId: bytesToUuid(entry.subarray(60, 76)),
        credentialId: bytesToUuid(entry.subarray(76, 92)),
        secret,
      });
    } catch {
      throw authenticationFailure();
    } finally {
      secret.fill(0);
    }
    count += 1;
    offset += payloadLength + 4;
  }
  increment(count);
  const remainder = Buffer.from(plaintext.subarray(offset));
  if (remainder.byteLength > 65_636) {
    remainder.fill(0);
    throw authenticationFailure();
  }
  return remainder;
}

function validatePassphrase(value: Uint8Array): Buffer {
  if (value.byteLength < MIN_PASSPHRASE_BYTES || value.byteLength > MAX_PASSPHRASE_BYTES) {
    throw vaultError("vault_archive_invalid");
  }
  return Buffer.from(value);
}

function exactRandom(random: (size: number) => Buffer, size: number): Buffer {
  const value = random(size);
  if (value.byteLength !== size) throw vaultError("vault_archive_invalid");
  return Buffer.from(value);
}

function authenticationFailure(): Error {
  return vaultError("vault_archive_authentication_failed");
}

function uuidToBytes(value: string, requireV7: boolean): Buffer {
  if ((requireV7 && !isUuidV7(value)) || (!requireV7 && !LOCATOR_PATTERN.test(value))) {
    throw vaultError("vault_archive_invalid");
  }
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function bytesToUuid(value: Uint8Array): string {
  const hex = Buffer.from(value).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw authenticationFailure();
  return Number(value);
}
