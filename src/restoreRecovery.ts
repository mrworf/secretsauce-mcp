import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  closeSync,
  chmodSync,
  constants,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  readFileSync,
  renameSync,
  statfsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import { canonicalJson } from "./vault/canonicalJson.js";
import type { VaultBackupCapabilityIssuer } from "./vault/capabilities.js";
import type { BackupVaultClient } from "./vault/client.js";
import { readVaultKeyFile } from "./vault/keyFile.js";

const MAX_RECOVERY_BYTES = 2 * 1024 * 1024 * 1024;
const RECOVERY_TTL_MS = 24 * 60 * 60_000;
const CHUNK_BYTES = 1024 * 1024;
const MAGIC = Buffer.from("SSRCV001", "ascii");
const JOURNAL_NAME = "restore-recovery.journal";
const DATABASE_NAME = "restore-database.enc";
const VAULT_NAME = "restore-vault.enc";

export type RestoreRecoveryPhase =
  | "snapshot_ready"
  | "vault_applied"
  | "database_committed"
  | "health_passed"
  | "rolled_back";

interface RecoveryJournalPayload {
  version: 1;
  operationId: string;
  actorId: string;
  archiveSha256: string;
  planDigest: string;
  phase: RestoreRecoveryPhase;
  createdAt: number;
  expiresAt: number;
  databaseBytes: number;
  databaseSha256: string;
  vaultBytes: number;
  vaultSha256: string;
  wrappedDek: {
    nonce: string;
    ciphertext: string;
    tag: string;
  };
}

interface RecoveryJournal extends RecoveryJournalPayload {
  mac: string;
}

export class RestoreRecoveryError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "conflict"
      | "too_large"
      | "unavailable"
      | "authentication_failed",
  ) {
    super(code);
    this.name = "RestoreRecoveryError";
  }
}

export interface RestoreRecoveryVault {
  exportRecovery(capability: string, passphrase: Uint8Array): Promise<Buffer>;
  importRecovery(
    capability: string,
    passphrase: Uint8Array,
    archive: Uint8Array,
  ): Promise<void>;
}

export class RestoreRecoveryManager {
  readonly #key: Buffer;
  readonly #uuid: UuidV7Generator;

  constructor(
    private readonly directory: string,
    recoveryKeyFile: string,
    private readonly vault: RestoreRecoveryVault,
    private readonly issuer: Pick<VaultBackupCapabilityIssuer, "issueBackup">,
    private readonly now: () => number = Date.now,
  ) {
    validateDirectory(directory);
    this.#key = readVaultKeyFile(recoveryKeyFile);
    this.#uuid = new UuidV7Generator({ now });
  }

  close(): void {
    this.#key.fill(0);
  }

  async prepare(input: {
    operationId: string;
    actorId: string;
    archiveSha256: string;
    planDigest: string;
    databaseFile: string;
  }): Promise<RecoveryJournalPayload> {
    validatePrepare(input);
    if (this.exists()) throw new RestoreRecoveryError("conflict");
    const metadata = lstatSync(input.databaseFile);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.size > MAX_RECOVERY_BYTES
    ) throw new RestoreRecoveryError("too_large");
    const free = statfsSync(this.directory).bavail
      * statfsSync(this.directory).bsize;
    if (free < Math.max(1, metadata.size) * 3) {
      throw new RestoreRecoveryError("too_large");
    }

    const plain = join(this.directory, `${input.operationId}.sqlite.tmp`);
    const encryptedDatabase = join(
      this.directory,
      `${input.operationId}.database.tmp`,
    );
    const encryptedVault = join(
      this.directory,
      `${input.operationId}.vault.tmp`,
    );
    const dek = randomBytes(32);
    let vaultArchive: Buffer | undefined;
    let databasePublished = false;
    let vaultPublished = false;
    try {
      const source = new Database(input.databaseFile, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        await source.backup(plain);
      } finally {
        source.close();
      }
      chmodSync(plain, 0o600);
      const plainMetadata = lstatSync(plain);
      if (plainMetadata.size > MAX_RECOVERY_BYTES) {
        throw new RestoreRecoveryError("too_large");
      }
      encryptFile(
        plain,
        encryptedDatabase,
        dek,
        `${input.operationId}:database`,
      );
      const binding = operationBinding(input.operationId, input.planDigest);
      vaultArchive = await this.vault.exportRecovery(
        this.issuer.issueBackup({
          operation: "export_recovery",
          authorizationId: this.#uuid.next(),
          subjectId: input.actorId,
          operationDigest: binding,
          restorePlanId: input.operationId,
          archiveSha256: input.archiveSha256,
          planDigest: input.planDigest,
        }),
        dek,
      );
      if (vaultArchive.byteLength > MAX_RECOVERY_BYTES) {
        throw new RestoreRecoveryError("too_large");
      }
      writePrivateFile(encryptedVault, vaultArchive);
      const wrappedDek = wrapDek(
        this.#key,
        dek,
        input.operationId,
      );
      const createdAt = this.now();
      const payload: RecoveryJournalPayload = {
        version: 1,
        operationId: input.operationId,
        actorId: input.actorId,
        archiveSha256: input.archiveSha256,
        planDigest: input.planDigest,
        phase: "snapshot_ready",
        createdAt,
        expiresAt: createdAt + RECOVERY_TTL_MS,
        databaseBytes: lstatSync(encryptedDatabase).size,
        databaseSha256: fileSha256(encryptedDatabase),
        vaultBytes: lstatSync(encryptedVault).size,
        vaultSha256: fileSha256(encryptedVault),
        wrappedDek,
      };
      publish(encryptedDatabase, this.path(DATABASE_NAME));
      databasePublished = true;
      publish(encryptedVault, this.path(VAULT_NAME));
      vaultPublished = true;
      this.writeJournal(payload);
      return payload;
    } catch (error) {
      this.removePath(encryptedDatabase);
      this.removePath(encryptedVault);
      if (databasePublished) this.removePath(this.path(DATABASE_NAME));
      if (vaultPublished) this.removePath(this.path(VAULT_NAME));
      if (error instanceof RestoreRecoveryError) throw error;
      throw new RestoreRecoveryError("unavailable");
    } finally {
      dek.fill(0);
      vaultArchive?.fill(0);
      this.removePath(plain);
    }
  }

  journal(): RecoveryJournalPayload | undefined {
    if (!this.exists()) return undefined;
    const journal = this.readJournal();
    if (journal.expiresAt <= this.now()) {
      throw new RestoreRecoveryError("invalid");
    }
    return withoutMac(journal);
  }

  advance(
    operationId: string,
    phase: RestoreRecoveryPhase,
  ): RecoveryJournalPayload {
    if (!isUuidV7(operationId)) throw new RestoreRecoveryError("invalid");
    const journal = this.readJournal();
    if (
      journal.operationId !== operationId
      || !validPhaseTransition(journal.phase, phase)
    ) throw new RestoreRecoveryError("conflict");
    const next = { ...withoutMac(journal), phase };
    this.writeJournal(next);
    return next;
  }

  async rollback(input: {
    operationId: string;
    databaseFile: string;
  }): Promise<void> {
    if (!isUuidV7(input.operationId) || !isAbsolute(input.databaseFile)) {
      throw new RestoreRecoveryError("invalid");
    }
    const journal = this.readJournal();
    if (
      journal.operationId !== input.operationId
      || !["vault_applied", "database_committed"].includes(journal.phase)
      || journal.expiresAt <= this.now()
    ) throw new RestoreRecoveryError("conflict");
    this.verifyArtifacts(journal);
    const dek = unwrapDek(this.#key, journal.wrappedDek, input.operationId);
    const vaultArchive = readFileSync(this.path(VAULT_NAME));
    const databaseTemporary = `${input.databaseFile}.${input.operationId}.restore`;
    try {
      await this.vault.importRecovery(
        this.issuer.issueBackup({
          operation: "import_recovery",
          authorizationId: this.#uuid.next(),
          subjectId: journal.actorId,
          operationDigest: operationBinding(
            input.operationId,
            journal.planDigest,
          ),
          restorePlanId: input.operationId,
          archiveSha256: journal.archiveSha256,
          planDigest: journal.planDigest,
        }),
        dek,
        vaultArchive,
      );
      decryptFile(
        this.path(DATABASE_NAME),
        databaseTemporary,
        dek,
        `${input.operationId}:database`,
      );
      const check = new Database(databaseTemporary, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        if (check.pragma("quick_check", { simple: true }) !== "ok") {
          throw new RestoreRecoveryError("invalid");
        }
      } finally {
        check.close();
      }
      this.removePath(`${input.databaseFile}-wal`);
      this.removePath(`${input.databaseFile}-shm`);
      renameSync(databaseTemporary, input.databaseFile);
      fsyncDirectory(dirname(input.databaseFile));
      this.advance(input.operationId, "rolled_back");
    } catch (error) {
      this.removePath(databaseTemporary);
      if (error instanceof RestoreRecoveryError) throw error;
      throw new RestoreRecoveryError("unavailable");
    } finally {
      dek.fill(0);
      vaultArchive.fill(0);
    }
  }

  async resume(input: {
    databaseFile: string;
  }): Promise<"none" | "discarded" | "rolled_back"> {
    const journal = this.journal();
    if (journal === undefined) return "none";
    if (journal.phase === "snapshot_ready") {
      this.remove();
      return "discarded";
    }
    if (journal.phase === "health_passed" || journal.phase === "rolled_back") {
      this.remove();
      return "discarded";
    }
    await this.rollback({
      operationId: journal.operationId,
      databaseFile: input.databaseFile,
    });
    return "rolled_back";
  }

  remove(): void {
    this.removePath(this.path(JOURNAL_NAME));
    this.removePath(this.path(DATABASE_NAME));
    this.removePath(this.path(VAULT_NAME));
    fsyncDirectory(this.directory);
  }

  private exists(): boolean {
    for (const name of [JOURNAL_NAME, DATABASE_NAME, VAULT_NAME]) {
      try {
        if (lstatSync(this.path(name)).isFile()) return true;
      } catch {
        // Continue checking for orphaned recovery artifacts.
      }
    }
    return false;
  }

  private verifyArtifacts(journal: RecoveryJournalPayload): void {
    for (const [name, bytes, digest] of [
      [DATABASE_NAME, journal.databaseBytes, journal.databaseSha256],
      [VAULT_NAME, journal.vaultBytes, journal.vaultSha256],
    ] as const) {
      const path = this.path(name);
      const metadata = lstatSync(path);
      if (
        !metadata.isFile()
        || metadata.isSymbolicLink()
        || metadata.size !== bytes
        || metadata.size > MAX_RECOVERY_BYTES
        || fileSha256(path) !== digest
      ) throw new RestoreRecoveryError("authentication_failed");
    }
  }

  private readJournal(): RecoveryJournal {
    try {
      const source = readFileSync(this.path(JOURNAL_NAME), "utf8");
      if (source.length > 16_384 || !source.endsWith("\n")) {
        throw new RestoreRecoveryError("invalid");
      }
      const value = JSON.parse(source) as RecoveryJournal;
      validateJournal(value);
      const provided = Buffer.from(value.mac, "base64url");
      if (provided.toString("base64url") !== value.mac) {
        throw new RestoreRecoveryError("authentication_failed");
      }
      const expected = journalMac(this.#key, withoutMac(value));
      if (
        provided.byteLength !== expected.byteLength
        || !timingSafeEqual(provided, expected)
      ) throw new RestoreRecoveryError("authentication_failed");
      return value;
    } catch (error) {
      if (error instanceof RestoreRecoveryError) throw error;
      throw new RestoreRecoveryError("invalid");
    }
  }

  private writeJournal(payload: RecoveryJournalPayload): void {
    const journal: RecoveryJournal = {
      ...payload,
      mac: journalMac(this.#key, payload).toString("base64url"),
    };
    atomicWrite(
      this.path(JOURNAL_NAME),
      Buffer.from(`${canonicalJson(journal)}\n`, "utf8"),
    );
  }

  private path(name: string): string {
    return join(this.directory, name);
  }

  private removePath(path: string): void {
    try {
      unlinkSync(path);
    } catch (error) {
      if (
        typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: unknown }).code === "ENOENT"
      ) return;
      throw new RestoreRecoveryError("unavailable");
    }
  }
}

function encryptFile(
  source: string,
  destination: string,
  key: Buffer,
  aadPrefix: string,
): void {
  const input = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  const output = openSync(
    destination,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  const buffer = Buffer.alloc(CHUNK_BYTES);
  try {
    writeFileSync(output, MAGIC);
    let sequence = 0;
    while (true) {
      const read = readChunk(input, buffer);
      if (read === 0) break;
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(Buffer.from(`${aadPrefix}:${sequence}`));
      const ciphertext = Buffer.concat([
        cipher.update(buffer.subarray(0, read)),
        cipher.final(),
      ]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(ciphertext.byteLength);
      writeFileSync(output, length);
      writeFileSync(output, nonce);
      writeFileSync(output, cipher.getAuthTag());
      writeFileSync(output, ciphertext);
      ciphertext.fill(0);
      nonce.fill(0);
      sequence += 1;
    }
    writeFileSync(output, Buffer.alloc(4));
    fsyncSync(output);
  } finally {
    buffer.fill(0);
    closeSync(input);
    closeSync(output);
  }
}

function decryptFile(
  source: string,
  destination: string,
  key: Buffer,
  aadPrefix: string,
): void {
  const input = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  const output = openSync(
    destination,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  let sequence = 0;
  try {
    if (!readExact(input, MAGIC.length).equals(MAGIC)) {
      throw new RestoreRecoveryError("authentication_failed");
    }
    while (true) {
      const length = readExact(input, 4).readUInt32BE(0);
      if (length === 0) break;
      if (length > CHUNK_BYTES) {
        throw new RestoreRecoveryError("authentication_failed");
      }
      const nonce = readExact(input, 12);
      const tag = readExact(input, 16);
      const ciphertext = readExact(input, length);
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(Buffer.from(`${aadPrefix}:${sequence}`));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      writeFileSync(output, plaintext);
      plaintext.fill(0);
      ciphertext.fill(0);
      nonce.fill(0);
      tag.fill(0);
      sequence += 1;
    }
    if (readSync(input, Buffer.alloc(1), 0, 1, null) !== 0) {
      throw new RestoreRecoveryError("authentication_failed");
    }
    fsyncSync(output);
  } catch (error) {
    if (error instanceof RestoreRecoveryError) throw error;
    throw new RestoreRecoveryError("authentication_failed");
  } finally {
    closeSync(input);
    closeSync(output);
  }
}

function readChunk(descriptor: number, buffer: Buffer): number {
  let total = 0;
  while (total < buffer.length) {
    const read = requireRead(descriptor, buffer, total);
    if (read === 0) break;
    total += read;
  }
  return total;
}

function requireRead(
  descriptor: number,
  buffer: Buffer,
  offset: number,
): number {
  return readFileChunk(descriptor, buffer, offset, buffer.length - offset);
}

function readFileChunk(
  descriptor: number,
  buffer: Buffer,
  offset: number,
  length: number,
): number {
  return readSync(descriptor, buffer, offset, length, null);
}

function readExact(descriptor: number, length: number): Buffer {
  const result = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = readSync(
      descriptor,
      result,
      offset,
      length - offset,
      null,
    );
    if (read === 0) {
      result.fill(0);
      throw new RestoreRecoveryError("authentication_failed");
    }
    offset += read;
  }
  return result;
}

function wrapDek(
  key: Buffer,
  dek: Buffer,
  operationId: string,
): RecoveryJournalPayload["wrappedDek"] {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(`secretsauce:restore-recovery-dek:v1:${operationId}`));
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  return {
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function unwrapDek(
  key: Buffer,
  wrapped: RecoveryJournalPayload["wrappedDek"],
  operationId: string,
): Buffer {
  try {
    const nonce = exactBase64(wrapped.nonce, 12);
    const ciphertext = exactBase64(wrapped.ciphertext, 32);
    const tag = exactBase64(wrapped.tag, 16);
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(
      Buffer.from(`secretsauce:restore-recovery-dek:v1:${operationId}`),
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new RestoreRecoveryError("authentication_failed");
  }
}

function exactBase64(value: string, bytes: number): Buffer {
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.byteLength !== bytes
    || decoded.toString("base64url") !== value
  ) throw new RestoreRecoveryError("authentication_failed");
  return decoded;
}

function journalMac(
  key: Buffer,
  payload: RecoveryJournalPayload,
): Buffer {
  return createHmac("sha256", key)
    .update("secretsauce:restore-recovery-journal:v1:")
    .update(canonicalJson(payload))
    .digest();
}

function validateJournal(value: RecoveryJournal): void {
  if (
    typeof value !== "object"
    || value === null
    || value.version !== 1
    || !isUuidV7(value.operationId)
    || ![
      "snapshot_ready",
      "vault_applied",
      "database_committed",
      "health_passed",
      "rolled_back",
    ].includes(value.phase)
    || !Number.isSafeInteger(value.createdAt)
    || !Number.isSafeInteger(value.expiresAt)
    || value.expiresAt !== value.createdAt + RECOVERY_TTL_MS
    || !Number.isSafeInteger(value.databaseBytes)
    || value.databaseBytes < 1
    || value.databaseBytes > MAX_RECOVERY_BYTES
    || !Number.isSafeInteger(value.vaultBytes)
    || value.vaultBytes < 1
    || value.vaultBytes > MAX_RECOVERY_BYTES
    || !/^[0-9a-f]{64}$/.test(value.databaseSha256)
    || !/^[0-9a-f]{64}$/.test(value.vaultSha256)
    || typeof value.mac !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(value.mac)
    || Object.keys(value).sort().join(",") !== [
      "createdAt",
      "actorId",
      "archiveSha256",
      "databaseBytes",
      "databaseSha256",
      "expiresAt",
      "mac",
      "operationId",
      "phase",
      "planDigest",
      "vaultBytes",
      "vaultSha256",
      "version",
      "wrappedDek",
    ].sort().join(",")
    || !isUuidV7(value.actorId)
    || !/^[0-9a-f]{64}$/.test(value.archiveSha256)
    || !/^[0-9a-f]{64}$/.test(value.planDigest)
    || typeof value.wrappedDek !== "object"
    || value.wrappedDek === null
    || Object.keys(value.wrappedDek).sort().join(",")
      !== "ciphertext,nonce,tag"
    || !/^[A-Za-z0-9_-]{16}$/.test(value.wrappedDek.nonce)
    || !/^[A-Za-z0-9_-]{43}$/.test(value.wrappedDek.ciphertext)
    || !/^[A-Za-z0-9_-]{22}$/.test(value.wrappedDek.tag)
  ) throw new RestoreRecoveryError("invalid");
}

function validatePrepare(input: {
  operationId: string;
  actorId: string;
  archiveSha256: string;
  planDigest: string;
  databaseFile: string;
}): void {
  if (
    !isUuidV7(input.operationId)
    || !isUuidV7(input.actorId)
    || !/^[0-9a-f]{64}$/.test(input.archiveSha256)
    || !/^[0-9a-f]{64}$/.test(input.planDigest)
    || !isAbsolute(input.databaseFile)
  ) throw new RestoreRecoveryError("invalid");
}

function validateDirectory(directory: string): void {
  if (!isAbsolute(directory) || resolve(directory) !== directory) {
    throw new RestoreRecoveryError("invalid");
  }
  const metadata = lstatSync(directory);
  if (
    !metadata.isDirectory()
    || metadata.isSymbolicLink()
    || (metadata.mode & 0o777) !== 0o700
    || (process.getuid !== undefined && metadata.uid !== process.getuid())
  ) throw new RestoreRecoveryError("invalid");
}

function validPhaseTransition(
  current: RestoreRecoveryPhase,
  next: RestoreRecoveryPhase,
): boolean {
  return (
    (current === "snapshot_ready" && next === "vault_applied")
    || (current === "vault_applied" && next === "database_committed")
    || (current === "database_committed"
      && (next === "health_passed" || next === "rolled_back"))
    || (current === "vault_applied" && next === "rolled_back")
  );
}

function operationBinding(operationId: string, planDigest: string): string {
  return createHash("sha256")
    .update("secretsauce:restore-recovery-operation:v1:")
    .update(operationId)
    .update(planDigest)
    .digest("hex");
}

function withoutMac(value: RecoveryJournal): RecoveryJournalPayload;
function withoutMac(value: RecoveryJournalPayload): RecoveryJournalPayload;
function withoutMac(
  value: RecoveryJournal | RecoveryJournalPayload,
): RecoveryJournalPayload {
  const { mac: _mac, ...payload } = value as RecoveryJournal;
  return payload;
}

function fileSha256(path: string): string {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(CHUNK_BYTES);
  try {
    while (true) {
      const read = readSync(descriptor, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
    return hash.digest("hex");
  } finally {
    buffer.fill(0);
    closeSync(descriptor);
  }
}

function writePrivateFile(path: string, bytes: Buffer): void {
  const descriptor = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function atomicWrite(path: string, bytes: Buffer): void {
  const temporary = `${path}.${process.pid}.tmp`;
  writePrivateFile(temporary, bytes);
  publish(temporary, path);
}

function publish(source: string, destination: string): void {
  renameSync(source, destination);
  fsyncDirectory(dirname(destination));
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export type ProductionRestoreRecoveryVault = Pick<
  BackupVaultClient,
  "exportRecovery" | "importRecovery"
>;
