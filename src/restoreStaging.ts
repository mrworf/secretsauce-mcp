import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  openSync,
  realpathSync,
  closeSync,
  type Stats,
} from "node:fs";
import {
  lstat,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import { decodeRestoreArchive } from "./restoreArchive.js";
import {
  RestoreStateError,
  RestoreStateRepository,
  type RestoreStage,
} from "./restoreState.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;

export class RestoreStagingError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "forbidden"
      | "not_found"
      | "expired"
      | "conflict"
      | "unavailable",
  ) {
    super(code);
    this.name = "RestoreStagingError";
  }
}

export class PrivateRestoreStageStore {
  readonly directory: string;

  constructor(directory: string) {
    if (
      typeof directory !== "string"
      || !isAbsolute(directory)
      || resolve(directory) !== directory
    ) throw new RestoreStagingError("unavailable");
    let metadata: Stats;
    try {
      metadata = lstatSync(directory);
      if (
        !metadata.isDirectory()
        || metadata.isSymbolicLink()
        || realpathSync(directory) !== directory
        || (metadata.mode & 0o777) !== 0o700
        || (process.getuid !== undefined && metadata.uid !== process.getuid())
      ) throw new RestoreStagingError("unavailable");
      const descriptor = openSync(directory, "r");
      closeSync(descriptor);
    } catch (error) {
      if (error instanceof RestoreStagingError) throw error;
      throw new RestoreStagingError("unavailable");
    }
    this.directory = directory;
  }

  async write(storageKey: string, archive: Uint8Array): Promise<void> {
    validateStorageKey(storageKey);
    if (
      !(archive instanceof Uint8Array)
      || archive.byteLength < 1
      || archive.byteLength > MAX_ARCHIVE_BYTES
    ) throw new RestoreStagingError("invalid");
    const destination = this.path(storageKey);
    const temporary = join(
      this.directory,
      `${storageKey}.${randomUUID()}.tmp`,
    );
    let handle;
    try {
      try {
        await lstat(destination);
        throw new RestoreStagingError("conflict");
      } catch (error) {
        if (
          error instanceof RestoreStagingError
          || !isMissing(error)
        ) throw error;
      }
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(archive);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, destination);
      const directory = await open(this.directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await unlink(temporary).catch(() => undefined);
      if (error instanceof RestoreStagingError) throw error;
      throw new RestoreStagingError("unavailable");
    }
  }

  async read(storageKey: string, expectedBytes: number): Promise<Buffer> {
    validateStorageKey(storageKey);
    if (
      !Number.isSafeInteger(expectedBytes)
      || expectedBytes < 1
      || expectedBytes > MAX_ARCHIVE_BYTES
    ) throw new RestoreStagingError("invalid");
    const path = this.path(storageKey);
    try {
      const metadata = await lstat(path);
      if (
        !metadata.isFile()
        || metadata.isSymbolicLink()
        || metadata.size !== expectedBytes
        || (metadata.mode & 0o777) !== 0o600
        || (process.getuid !== undefined && metadata.uid !== process.getuid())
      ) throw new RestoreStagingError("unavailable");
      const value = await readFile(path);
      if (value.byteLength !== expectedBytes) {
        value.fill(0);
        throw new RestoreStagingError("unavailable");
      }
      return value;
    } catch (error) {
      if (error instanceof RestoreStagingError) throw error;
      throw new RestoreStagingError("unavailable");
    }
  }

  async remove(storageKey: string): Promise<void> {
    validateStorageKey(storageKey);
    try {
      await unlink(this.path(storageKey));
    } catch (error) {
      if (!isMissing(error)) throw new RestoreStagingError("unavailable");
    }
  }

  private path(storageKey: string): string {
    return join(this.directory, `${storageKey}.tar.gz`);
  }
}

export class RestoreStageCoordinator {
  readonly #uuid: UuidV7Generator;

  constructor(
    private readonly repository: RestoreStateRepository,
    private readonly store: PrivateRestoreStageStore,
    now: () => number = Date.now,
  ) {
    this.#uuid = new UuidV7Generator({ now });
  }

  async stage(input: {
    actor: ControlAuthenticationContext;
    archive: Uint8Array;
  }): Promise<RestoreStage> {
    requireSuperadmin(input.actor);
    if (
      !(input.archive instanceof Uint8Array)
      || input.archive.byteLength < 1
      || input.archive.byteLength > MAX_ARCHIVE_BYTES
    ) throw new RestoreStagingError("invalid");
    let archiveId: string;
    let archiveSha256: string;
    let decodedSecrets: Buffer | undefined;
    try {
      const decoded = decodeRestoreArchive(input.archive);
      archiveId = decoded.archiveId;
      archiveSha256 = decoded.archiveSha256;
      decodedSecrets = decoded.secrets;
    } catch (error) {
      throw mapDecodeError(error);
    } finally {
      decodedSecrets?.fill(0);
    }
    const storageKey = this.#uuid.next();
    await this.cleanup();
    await this.store.write(storageKey, input.archive);
    try {
      return await this.repository.createStage({
        subjectUserId: input.actor.principalId,
        archiveId,
        archiveSha256,
        archiveBytes: input.archive.byteLength,
        storageKey,
      });
    } catch (error) {
      await this.store.remove(storageKey).catch(() => undefined);
      throw mapStateError(error);
    }
  }

  async status(
    actor: ControlAuthenticationContext,
    stageId: string,
  ): Promise<RestoreStage> {
    requireSuperadmin(actor);
    try {
      return await this.repository.stageForActor(
        stageId,
        actor.principalId,
      );
    } catch (error) {
      throw mapStateError(error);
    }
  }

  async read(
    actor: ControlAuthenticationContext,
    stageId: string,
  ): Promise<{ stage: RestoreStage; archive: Buffer }> {
    const stage = await this.status(actor, stageId);
    const archive = await this.store.read(stage.storageKey, stage.archiveBytes);
    const digest = createHash("sha256").update(archive).digest("hex");
    if (digest !== stage.archiveSha256) {
      archive.fill(0);
      throw new RestoreStagingError("unavailable");
    }
    return { stage, archive };
  }

  async cleanup(limit = 100): Promise<number> {
    try {
      const expired = await this.repository.cleanupExpired(limit);
      const keys = await this.repository.expiredStageStorageKeys(limit);
      await Promise.all(keys.map((key) => this.store.remove(key)));
      if (keys.length > 0) await this.repository.deleteExpiredStages(keys);
      return expired;
    } catch (error) {
      if (error instanceof RestoreStagingError) throw error;
      throw mapStateError(error);
    }
  }
}

function requireSuperadmin(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session"
    || actor.role !== "superadmin"
    || !isUuidV7(actor.principalId)
  ) throw new RestoreStagingError("forbidden");
}

function validateStorageKey(value: string): void {
  if (!isUuidV7(value)) throw new RestoreStagingError("invalid");
}

function mapDecodeError(_error: unknown): RestoreStagingError {
  return new RestoreStagingError("invalid");
}

function mapStateError(error: unknown): RestoreStagingError {
  if (!(error instanceof RestoreStateError)) {
    return new RestoreStagingError("unavailable");
  }
  if (error.restoreCode === "not_found") {
    return new RestoreStagingError("not_found");
  }
  if (error.restoreCode === "expired") {
    return new RestoreStagingError("expired");
  }
  if (error.restoreCode === "conflict") {
    return new RestoreStagingError("conflict");
  }
  return new RestoreStagingError("invalid");
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT"
  );
}
