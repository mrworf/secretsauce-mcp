import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { isUuidV7 } from "../persistence/uuidV7.js";
import { vaultError } from "./errors.js";

const MAGIC = Buffer.from("SSVR", "ascii");
const FORMAT_VERSION = 1;
const FIXED_HEADER_BYTES = 52;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const DEK_BYTES = 32;
const BINDING_BYTES = 48;
const SECRET_LENGTH_BYTES = 4;
const MAX_RECORD_BYTES = 128 * 1024;
const RECORD_DOMAIN = Buffer.from("SecretSauce/vault-record", "ascii");
const LOCATOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROOT_KEY_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const RECORD_NAME_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.ssvr$/;
const TEMP_NAME_PATTERN = /^\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/;

const SIZE_CLASSES = [
  { code: 1, bytes: 32, name: "up_to_32_bytes" },
  { code: 2, bytes: 128, name: "up_to_128_bytes" },
  { code: 3, bytes: 512, name: "up_to_512_bytes" },
  { code: 4, bytes: 2_048, name: "up_to_2_kib" },
  { code: 5, bytes: 8_192, name: "up_to_8_kib" },
  { code: 6, bytes: 32_768, name: "up_to_32_kib" },
  { code: 7, bytes: 65_536, name: "up_to_64_kib" },
] as const;
export type VaultSizeClass = typeof SIZE_CLASSES[number]["name"];
export type VaultReadinessStatus = "ready" | "locked" | "degraded";

export interface VaultCredentialBinding {
  serviceId: string;
  destinationId: string;
  credentialId: string;
}

export interface VaultRecordMetadata {
  status: "configured";
  generation: number;
  sizeClass: VaultSizeClass;
  lastFour?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface VaultRecordCreateResult {
  locator: string;
  metadata: VaultRecordMetadata;
}

export interface VaultBackupRecord extends VaultCredentialBinding {
  locator: string;
  generation: number;
  createdAt: number;
  updatedAt: number;
  captureLastFour: boolean;
  secret: Buffer;
}

export interface VaultRestoreTransaction {
  append(record: VaultBackupRecord): void;
  commit(): void;
  abort(): void;
}

export interface VaultRecordStoreOptions {
  directory: string;
  activeRootKey: string;
  rootKeys: ReadonlyMap<string, Uint8Array>;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
  randomUuid?: () => string;
  failureInjector?: (stage:
    | "after_file_sync_before_commit"
    | "before_restore_swap"
    | "after_restore_old_moved"
  ) => void;
}

export interface VaultWriteOptions {
  captureLastFour?: boolean;
  locator?: string;
}

interface ParsedRecord {
  locator: string;
  generation: number;
  rootKeyId: string;
  createdAt: number;
  updatedAt: number;
  sizeClass: typeof SIZE_CLASSES[number];
  lastFour?: string;
  binding: VaultCredentialBinding;
  secret: Buffer;
}

export class VaultRecordStore {
  readonly #directory: string;
  readonly #activeRootKey: string;
  readonly #rootKeys: ReadonlyMap<string, Buffer>;
  readonly #now: () => number;
  readonly #randomBytes: (size: number) => Buffer;
  readonly #randomUuid: () => string;
  readonly #failureInjector?: VaultRecordStoreOptions["failureInjector"];
  #status: VaultReadinessStatus = "ready";
  #recordCount = 0;
  #closed = false;
  #restoreInProgress = false;

  constructor(options: VaultRecordStoreOptions) {
    if (!ROOT_KEY_ID_PATTERN.test(options.activeRootKey) || !options.rootKeys.has(options.activeRootKey)) {
      throw vaultError("vault_store_unavailable");
    }
    this.#directory = options.directory;
    this.#activeRootKey = options.activeRootKey;
    this.#rootKeys = new Map([...options.rootKeys].map(([id, key]) => {
      if (!ROOT_KEY_ID_PATTERN.test(id) || key.byteLength !== DEK_BYTES) throw vaultError("vault_store_unavailable");
      return [id, Buffer.from(key)];
    }));
    this.#now = options.now ?? Date.now;
    this.#randomBytes = options.randomBytes ?? randomBytes;
    this.#randomUuid = options.randomUuid ?? randomUUID;
    if (options.failureInjector !== undefined) this.#failureInjector = options.failureInjector;
    this.#initialize();
  }

  readiness(): { status: VaultReadinessStatus; recordCount: number } {
    if (this.#closed) return { status: "degraded", recordCount: 0 };
    return { status: this.#status, recordCount: this.#recordCount };
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const key of this.#rootKeys.values()) key.fill(0);
    this.#recordCount = 0;
    this.#status = "degraded";
  }

  forEachBackupRecord(visitor: (record: VaultBackupRecord) => void): number {
    this.#assertReady();
    const locators = readdirSync(this.#directory)
      .map((name) => RECORD_NAME_PATTERN.exec(name)?.[1])
      .filter((value): value is string => value !== undefined)
      .sort();
    if (locators.length !== this.#recordCount) throw vaultError("vault_store_unavailable");
    for (const locator of locators) {
      const parsed = this.#readAndDecrypt(locator);
      try {
        visitor({
          locator: parsed.locator,
          generation: parsed.generation,
          createdAt: parsed.createdAt,
          updatedAt: parsed.updatedAt,
          captureLastFour: parsed.lastFour !== undefined,
          ...parsed.binding,
          secret: parsed.secret,
        });
      } finally {
        parsed.secret.fill(0);
      }
    }
    return locators.length;
  }

  beginRestore(): VaultRestoreTransaction {
    this.#assertReady();
    this.#restoreInProgress = true;
    const parent = dirname(this.#directory);
    const stagingDirectory = join(parent, `.${basename(this.#directory)}.restore.${randomUUID()}`);
    let staging: VaultRecordStore;
    try {
      mkdirSync(stagingDirectory, { mode: 0o700 });
      staging = new VaultRecordStore({
        directory: stagingDirectory,
        activeRootKey: this.#activeRootKey,
        rootKeys: this.#rootKeys,
        now: this.#now,
        randomBytes: this.#randomBytes,
        randomUuid: this.#randomUuid,
      });
    } catch {
      this.#restoreInProgress = false;
      try {
        rmSync(stagingDirectory, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup of a failed staging initialization.
      }
      throw vaultError("vault_store_unavailable");
    }
    let count = 0;
    let finished = false;
    const finish = (): void => {
      this.#restoreInProgress = false;
      finished = true;
    };
    return {
      append: (record) => {
        if (finished) throw vaultError("vault_store_unavailable");
        staging.#importBackupRecord(record);
        count += 1;
      },
      commit: () => {
        if (finished) throw vaultError("vault_store_unavailable");
        const previousDirectory = join(parent, `.${basename(this.#directory)}.previous.${randomUUID()}`);
        let oldMoved = false;
        let newMoved = false;
        staging.close();
        try {
          this.#failureInjector?.("before_restore_swap");
          renameSync(this.#directory, previousDirectory);
          oldMoved = true;
          this.#failureInjector?.("after_restore_old_moved");
          renameSync(stagingDirectory, this.#directory);
          newMoved = true;
          fsyncDirectory(parent);
          this.#recordCount = count;
          this.#status = "ready";
          finish();
          try {
            rmSync(previousDirectory, { recursive: true, force: true });
            fsyncDirectory(parent);
          } catch {
            // A stale, root-encrypted previous directory is recoverable operator cleanup.
          }
        } catch {
          try {
            if (newMoved) rmSync(this.#directory, { recursive: true, force: true });
            if (oldMoved) renameSync(previousDirectory, this.#directory);
            rmSync(stagingDirectory, { recursive: true, force: true });
            fsyncDirectory(parent);
          } catch {
            // Best-effort cleanup after a failed swap.
          }
          finish();
          throw vaultError("vault_store_unavailable");
        }
      },
      abort: () => {
        if (finished) return;
        staging.close();
        try {
          rmSync(stagingDirectory, { recursive: true, force: true });
          fsyncDirectory(parent);
        } finally {
          finish();
        }
      },
    };
  }

  create(binding: VaultCredentialBinding, secretValue: Uint8Array, options: VaultWriteOptions = {}): VaultRecordCreateResult {
    this.#assertReady();
    validateBinding(binding);
    const secret = validateSecret(secretValue);
    const locator = options.locator ?? this.#randomUuid();
    if (!LOCATOR_PATTERN.test(locator)) throw vaultError("vault_record_invalid");
    const timestamp = this.#timestamp();
    try {
      const encoded = this.#encodeRecord({
        locator,
        generation: 1,
        rootKeyId: this.#activeRootKey,
        createdAt: timestamp,
        updatedAt: timestamp,
        binding,
        secret,
        captureLastFour: options.captureLastFour === true,
      });
      this.#commit(locator, encoded, false);
      this.#recordCount += 1;
      const parsed = this.#readAndDecrypt(locator, binding, 1);
      try {
        return { locator, metadata: metadataOf(parsed) };
      } finally {
        parsed.secret.fill(0);
      }
    } finally {
      secret.fill(0);
    }
  }

  replace(
    locator: string,
    expectedGeneration: number,
    binding: VaultCredentialBinding,
    secretValue: Uint8Array,
    options: VaultWriteOptions = {},
  ): VaultRecordMetadata {
    this.#assertReady();
    validateLocator(locator);
    validateBinding(binding);
    const existing = this.#readAndDecrypt(locator, binding, expectedGeneration);
    const replacement = validateSecret(secretValue);
    try {
      const encoded = this.#encodeRecord({
        locator,
        generation: existing.generation + 1,
        rootKeyId: this.#activeRootKey,
        createdAt: existing.createdAt,
        updatedAt: this.#timestamp(),
        binding,
        secret: replacement,
        captureLastFour: options.captureLastFour === true,
      });
      this.#commit(locator, encoded, true);
      const parsed = this.#readAndDecrypt(locator, binding, existing.generation + 1);
      try {
        return metadataOf(parsed);
      } finally {
        parsed.secret.fill(0);
      }
    } finally {
      existing.secret.fill(0);
      replacement.fill(0);
    }
  }

  metadata(locator: string, binding: VaultCredentialBinding): VaultRecordMetadata {
    this.#assertReady();
    const parsed = this.#readAndDecrypt(locator, binding);
    try {
      return metadataOf(parsed);
    } finally {
      parsed.secret.fill(0);
    }
  }

  resolve(locator: string, generation: number, binding: VaultCredentialBinding): Buffer {
    this.#assertReady();
    const parsed = this.#readAndDecrypt(locator, binding, generation);
    return parsed.secret;
  }

  delete(locator: string, expectedGeneration: number, binding: VaultCredentialBinding): void {
    this.#assertReady();
    const parsed = this.#readAndDecrypt(locator, binding, expectedGeneration);
    parsed.secret.fill(0);
    try {
      unlinkSync(this.#recordPath(locator));
      fsyncDirectory(this.#directory);
      this.#recordCount -= 1;
    } catch {
      throw vaultError("vault_store_unavailable");
    }
  }

  #initialize(): void {
    try {
      ensureStoreDirectory(this.#directory);
      const names = readdirSync(this.#directory);
      for (const name of names) {
        const temporary = TEMP_NAME_PATTERN.exec(name);
        if (temporary !== null) {
          const path = join(this.#directory, name);
          validateRecordFileMetadata(path);
          unlinkSync(path);
          continue;
        }
        const match = RECORD_NAME_PATTERN.exec(name);
        if (match === null) {
          this.#status = "degraded";
          continue;
        }
        try {
          const parsed = this.#readAndDecrypt(match[1]!);
          parsed.secret.fill(0);
          this.#recordCount += 1;
        } catch (error) {
          if (isMissingRootKey(error)) this.#status = "locked";
          else if (this.#status !== "locked") this.#status = "degraded";
        }
      }
      fsyncDirectory(this.#directory);
    } catch {
      this.#status = "degraded";
    }
  }

  #encodeRecord(input: {
    locator: string;
    generation: number;
    rootKeyId: string;
    createdAt: number;
    updatedAt: number;
    binding: VaultCredentialBinding;
    secret: Buffer;
    captureLastFour: boolean;
  }): Buffer {
    const sizeClass = classForSecret(input.secret.byteLength);
    const lastFour = captureLastFour(input.secret, input.captureLastFour);
    const rootId = Buffer.from(input.rootKeyId, "ascii");
    const lastFourBytes = lastFour === undefined ? Buffer.alloc(0) : Buffer.from(lastFour, "ascii");
    const header = Buffer.alloc(FIXED_HEADER_BYTES + rootId.byteLength + lastFourBytes.byteLength);
    MAGIC.copy(header, 0);
    header[4] = FORMAT_VERSION;
    header[5] = 0;
    header[6] = rootId.byteLength;
    header[7] = lastFourBytes.byteLength;
    uuidToBytes(input.locator).copy(header, 8);
    header.writeBigUInt64BE(BigInt(input.generation), 24);
    header.writeBigUInt64BE(BigInt(input.createdAt), 32);
    header.writeBigUInt64BE(BigInt(input.updatedAt), 40);
    header[48] = sizeClass.code;
    header.fill(0, 49, 52);
    rootId.copy(header, FIXED_HEADER_BYTES);
    lastFourBytes.copy(header, FIXED_HEADER_BYTES + rootId.byteLength);

    const plaintext = Buffer.alloc(BINDING_BYTES + SECRET_LENGTH_BYTES + sizeClass.bytes);
    uuidToBytes(input.binding.serviceId, true).copy(plaintext, 0);
    uuidToBytes(input.binding.destinationId, true).copy(plaintext, 16);
    uuidToBytes(input.binding.credentialId, true).copy(plaintext, 32);
    plaintext.writeUInt32BE(input.secret.byteLength, BINDING_BYTES);
    input.secret.copy(plaintext, BINDING_BYTES + SECRET_LENGTH_BYTES);
    const paddingLength = sizeClass.bytes - input.secret.byteLength;
    if (paddingLength > 0) this.#random(paddingLength).copy(plaintext, BINDING_BYTES + SECRET_LENGTH_BYTES + input.secret.byteLength);

    const dek = this.#random(DEK_BYTES);
    const wrappedNonce = this.#random(NONCE_BYTES);
    const valueNonce = this.#random(NONCE_BYTES);
    try {
      const wrapped = encrypt(dek, this.#rootKeys.get(input.rootKeyId)!, wrappedNonce, aad(header, "dek"));
      const value = encrypt(plaintext, dek, valueNonce, aad(header, "value"));
      return Buffer.concat([
        header,
        wrappedNonce,
        wrapped.ciphertext,
        wrapped.tag,
        valueNonce,
        value.ciphertext,
        value.tag,
      ]);
    } finally {
      dek.fill(0);
      plaintext.fill(0);
    }
  }

  #importBackupRecord(record: VaultBackupRecord): void {
    this.#assertReady();
    validateLocator(record.locator);
    validateBinding(record);
    if (
      !Number.isSafeInteger(record.generation)
      || record.generation < 1
      || !Number.isSafeInteger(record.createdAt)
      || !Number.isSafeInteger(record.updatedAt)
      || record.createdAt < 0
      || record.updatedAt < record.createdAt
    ) {
      throw vaultError("vault_record_invalid");
    }
    const secret = validateSecret(record.secret);
    try {
      const encoded = this.#encodeRecord({
        locator: record.locator,
        generation: record.generation,
        rootKeyId: this.#activeRootKey,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        binding: record,
        secret,
        captureLastFour: record.captureLastFour,
      });
      this.#commit(record.locator, encoded, false);
      this.#recordCount += 1;
    } finally {
      secret.fill(0);
    }
  }

  #readAndDecrypt(locator: string, expectedBinding?: VaultCredentialBinding, expectedGeneration?: number): ParsedRecord {
    validateLocator(locator);
    let bytes: Buffer;
    try {
      const path = this.#recordPath(locator);
      validateRecordFileMetadata(path);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        const metadata = fstatSync(descriptor);
        if (
          !metadata.isFile()
          || metadata.nlink !== 1
          || (metadata.mode & 0o777) !== 0o600
          || metadata.size > MAX_RECORD_BYTES
          || !isAllowedOwner(metadata.uid)
        ) {
          throw vaultError("vault_record_invalid");
        }
        bytes = readFileSync(descriptor);
      } finally {
        if (descriptor !== undefined) closeSync(descriptor);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "VaultError") throw error;
      throw vaultError("vault_record_not_found");
    }
    try {
      return this.#decodeRecord(bytes, locator, expectedBinding, expectedGeneration);
    } finally {
      bytes.fill(0);
    }
  }

  #decodeRecord(
    bytes: Buffer,
    expectedLocator: string,
    expectedBinding?: VaultCredentialBinding,
    expectedGeneration?: number,
  ): ParsedRecord {
    if (bytes.byteLength < FIXED_HEADER_BYTES + NONCE_BYTES * 2 + DEK_BYTES + TAG_BYTES * 2) {
      throw vaultError("vault_record_invalid");
    }
    if (!bytes.subarray(0, 4).equals(MAGIC) || bytes[4] !== FORMAT_VERSION || bytes[5] !== 0) {
      throw vaultError("vault_record_invalid");
    }
    const rootIdLength = bytes[6]!;
    const lastFourLength = bytes[7]!;
    if (rootIdLength < 1 || rootIdLength > 63 || (lastFourLength !== 0 && lastFourLength !== 4) || bytes.subarray(49, 52).some((value) => value !== 0)) {
      throw vaultError("vault_record_invalid");
    }
    const headerLength = FIXED_HEADER_BYTES + rootIdLength + lastFourLength;
    const sizeClass = SIZE_CLASSES.find((item) => item.code === bytes[48]);
    const expectedLength = headerLength + NONCE_BYTES + DEK_BYTES + TAG_BYTES + NONCE_BYTES
      + BINDING_BYTES + SECRET_LENGTH_BYTES + (sizeClass?.bytes ?? 0) + TAG_BYTES;
    if (sizeClass === undefined || bytes.byteLength !== expectedLength) throw vaultError("vault_record_invalid");
    const header = bytes.subarray(0, headerLength);
    const locator = bytesToUuid(header.subarray(8, 24));
    if (locator !== expectedLocator) throw vaultError("vault_record_invalid");
    const generation = safeNumber(header.readBigUInt64BE(24));
    const createdAt = safeNumber(header.readBigUInt64BE(32));
    const updatedAt = safeNumber(header.readBigUInt64BE(40));
    if (generation < 1 || createdAt > updatedAt) throw vaultError("vault_record_invalid");
    if (expectedGeneration !== undefined && generation !== expectedGeneration) throw vaultError("vault_record_conflict");
    const rootKeyId = header.subarray(FIXED_HEADER_BYTES, FIXED_HEADER_BYTES + rootIdLength).toString("ascii");
    if (!ROOT_KEY_ID_PATTERN.test(rootKeyId)) throw vaultError("vault_record_invalid");
    const rootKey = this.#rootKeys.get(rootKeyId);
    if (rootKey === undefined) throw new MissingRootKeyError();
    const lastFourBytes = header.subarray(FIXED_HEADER_BYTES + rootIdLength);
    if (lastFourBytes.some((value) => value < 0x20 || value > 0x7e)) throw vaultError("vault_record_invalid");
    const lastFour = lastFourLength === 4 ? lastFourBytes.toString("ascii") : undefined;

    let offset = headerLength;
    const wrappedNonce = bytes.subarray(offset, offset += NONCE_BYTES);
    const wrappedCiphertext = bytes.subarray(offset, offset += DEK_BYTES);
    const wrappedTag = bytes.subarray(offset, offset += TAG_BYTES);
    const valueNonce = bytes.subarray(offset, offset += NONCE_BYTES);
    const valueCiphertext = bytes.subarray(offset, bytes.byteLength - TAG_BYTES);
    const valueTag = bytes.subarray(bytes.byteLength - TAG_BYTES);
    let dek: Buffer | undefined;
    let plaintext: Buffer | undefined;
    try {
      dek = decrypt(wrappedCiphertext, wrappedTag, rootKey, wrappedNonce, aad(header, "dek"));
      plaintext = decrypt(valueCiphertext, valueTag, dek, valueNonce, aad(header, "value"));
      const binding = {
        serviceId: bytesToUuid(plaintext.subarray(0, 16)),
        destinationId: bytesToUuid(plaintext.subarray(16, 32)),
        credentialId: bytesToUuid(plaintext.subarray(32, 48)),
      };
      if (!isUuidV7(binding.serviceId) || !isUuidV7(binding.destinationId) || !isUuidV7(binding.credentialId)) {
        throw vaultError("vault_record_invalid");
      }
      if (expectedBinding !== undefined && !sameBinding(binding, expectedBinding)) throw vaultError("vault_record_invalid");
      const secretLength = plaintext.readUInt32BE(BINDING_BYTES);
      if (secretLength < 1 || secretLength > sizeClass.bytes || classForSecret(secretLength).code !== sizeClass.code) {
        throw vaultError("vault_record_invalid");
      }
      const secret = Buffer.from(plaintext.subarray(BINDING_BYTES + SECRET_LENGTH_BYTES, BINDING_BYTES + SECRET_LENGTH_BYTES + secretLength));
      return {
        locator,
        generation,
        rootKeyId,
        createdAt,
        updatedAt,
        sizeClass,
        ...(lastFour === undefined ? {} : { lastFour }),
        binding,
        secret,
      };
    } catch (error) {
      if (error instanceof MissingRootKeyError) throw error;
      if (error instanceof Error && error.name === "VaultError") throw error;
      throw vaultError("vault_record_invalid");
    } finally {
      dek?.fill(0);
      plaintext?.fill(0);
    }
  }

  #commit(locator: string, encoded: Buffer, replace: boolean): void {
    const target = this.#recordPath(locator);
    const temporary = join(this.#directory, `.${locator}.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      writeFileSync(descriptor, encoded);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      this.#failureInjector?.("after_file_sync_before_commit");
      if (replace) renameSync(temporary, target);
      else linkSync(temporary, target);
      fsyncDirectory(this.#directory);
    } catch (error) {
      if (error instanceof Error && error.name === "VaultError") throw error;
      if (!replace && existsSync(target)) throw vaultError("vault_record_conflict");
      throw vaultError("vault_store_unavailable");
    } finally {
      encoded.fill(0);
      if (descriptor !== undefined) closeSync(descriptor);
      try {
        unlinkSync(temporary);
      } catch {
        // The temporary record may already have been renamed or removed.
      }
    }
  }

  #recordPath(locator: string): string {
    return join(this.#directory, `${locator}.ssvr`);
  }

  #random(size: number): Buffer {
    const value = this.#randomBytes(size);
    if (value.byteLength !== size) throw vaultError("vault_store_unavailable");
    return value;
  }

  #timestamp(): number {
    const value = this.#now();
    if (!Number.isSafeInteger(value) || value < 0) throw vaultError("vault_store_unavailable");
    return value;
  }

  #assertReady(): void {
    if (this.#closed || this.#restoreInProgress || this.#status !== "ready") throw vaultError("vault_store_unavailable");
  }
}

class MissingRootKeyError extends Error {}

function isMissingRootKey(error: unknown): boolean {
  return error instanceof MissingRootKeyError;
}

function ensureStoreDirectory(directory: string): void {
  if (!existsSync(directory)) {
    const parent = lstatSync(dirname(directory));
    if (
      !parent.isDirectory()
      || parent.isSymbolicLink()
      || (parent.mode & 0o022) !== 0
      || !isAllowedOwner(parent.uid)
    ) {
      throw vaultError("vault_store_unavailable");
    }
    mkdirSync(directory, { mode: 0o700 });
  }
  const metadata = lstatSync(directory);
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || (metadata.mode & 0o777) !== 0o700
    || !isAllowedOwner(metadata.uid)
  ) {
    throw vaultError("vault_store_unavailable");
  }
  chmodSync(directory, 0o700);
}

function validateRecordFileMetadata(path: string): void {
  const metadata = lstatSync(path);
  if (
    !metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.nlink !== 1
    || (metadata.mode & 0o777) !== 0o600
    || metadata.size > MAX_RECORD_BYTES
    || !isAllowedOwner(metadata.uid)
  ) {
    throw vaultError("vault_record_invalid");
  }
}

function validateBinding(binding: VaultCredentialBinding): void {
  if (!isUuidV7(binding.serviceId) || !isUuidV7(binding.destinationId) || !isUuidV7(binding.credentialId)) {
    throw vaultError("vault_record_invalid");
  }
}

function validateLocator(locator: string): void {
  if (!LOCATOR_PATTERN.test(locator)) throw vaultError("vault_record_invalid");
}

function validateSecret(value: Uint8Array): Buffer {
  if (value.byteLength < 1 || value.byteLength > 65_536) throw vaultError("vault_record_invalid");
  return Buffer.from(value);
}

function classForSecret(length: number): typeof SIZE_CLASSES[number] {
  const match = SIZE_CLASSES.find((item) => length <= item.bytes);
  if (match === undefined) throw vaultError("vault_record_invalid");
  return match;
}

function captureLastFour(secret: Buffer, enabled: boolean): string | undefined {
  if (!enabled || secret.byteLength < 4 || secret.some((value) => value < 0x20 || value > 0x7e)) return undefined;
  return secret.subarray(secret.byteLength - 4).toString("ascii");
}

function metadataOf(record: ParsedRecord): VaultRecordMetadata {
  return {
    status: "configured",
    generation: record.generation,
    sizeClass: record.sizeClass.name,
    ...(record.lastFour === undefined ? {} : { lastFour: record.lastFour }),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function encrypt(plaintext: Buffer, key: Buffer, nonce: Buffer, associatedData: Buffer): { ciphertext: Buffer; tag: Buffer } {
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(associatedData);
  return { ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]), tag: cipher.getAuthTag() };
}

function decrypt(ciphertext: Buffer, tag: Buffer, key: Buffer, nonce: Buffer, associatedData: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(associatedData);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function aad(header: Uint8Array, purpose: "dek" | "value"): Buffer {
  return Buffer.concat([RECORD_DOMAIN, Buffer.from([0]), Buffer.from(purpose, "ascii"), Buffer.from([0]), header]);
}

function uuidToBytes(value: string, requireV7 = false): Buffer {
  if ((requireV7 && !isUuidV7(value)) || (!requireV7 && !LOCATOR_PATTERN.test(value))) {
    throw vaultError("vault_record_invalid");
  }
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function bytesToUuid(value: Uint8Array): string {
  const hex = Buffer.from(value).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw vaultError("vault_record_invalid");
  return Number(value);
}

function sameBinding(left: VaultCredentialBinding, right: VaultCredentialBinding): boolean {
  return left.serviceId === right.serviceId
    && left.destinationId === right.destinationId
    && left.credentialId === right.credentialId;
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function isAllowedOwner(uid: number): boolean {
  const current = process.getuid?.();
  return current === undefined || uid === current || uid === 0;
}
