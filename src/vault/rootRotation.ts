import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
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
import type { VaultProvisioningKeyAdapter } from "./provisioningAdapters.js";
import type {
  VaultProvisioningManifest,
  VaultRootRotationTarget,
} from "./provisioningManifest.js";
import type {
  VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";

const MAX_JOURNAL_BYTES = 64 * 1024;
const canonicalUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const installationUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const targetSchema = z.enum(["identity", "vault"]);
const physicalVersion = z.union([z.literal("legacy"), canonicalUuid]);
const phaseSchema = z.enum([
  "created",
  "staged",
  "activated",
  "rewrapping",
  "verified",
  "root_switched",
]);
const journalWithoutChecksumSchema = z.object({
  version: z.literal(1),
  installationId: installationUuid,
  requestId: canonicalUuid,
  target: targetSchema,
  logicalKeyId: z.enum([
    "identity.envelope-root",
    "vault.envelope-root",
  ]),
  startingAggregate: digest,
  configuredRootPath: z.string().min(1).max(4096)
    .refine(isAbsolute),
  oldPhysicalVersion: physicalVersion,
  newPhysicalVersion: canonicalUuid,
  phase: phaseSchema,
  stagedFingerprint: digest.optional(),
  cursor: z.string().regex(/^[A-Za-z0-9._:-]{1,256}$/).optional(),
  scannedCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  rewrappedCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict().superRefine((value, context) => {
  const expectedKey = value.target === "identity"
    ? "identity.envelope-root"
    : "vault.envelope-root";
  if (value.logicalKeyId !== expectedKey) {
    context.addIssue({
      code: "custom",
      path: ["logicalKeyId"],
      message: "Logical key does not match target.",
    });
  }
  if (
    value.phase === "created"
      ? value.stagedFingerprint !== undefined
      : value.stagedFingerprint === undefined
  ) {
    context.addIssue({
      code: "custom",
      path: ["stagedFingerprint"],
      message: "Staged fingerprint does not match phase.",
    });
  }
  if (value.rewrappedCount > value.scannedCount) {
    context.addIssue({
      code: "custom",
      path: ["rewrappedCount"],
      message: "Rewrapped count exceeds scanned count.",
    });
  }
});
const journalSchema = journalWithoutChecksumSchema.extend({
  checksum: digest,
}).strict();

export type RootRotationJournal = z.infer<typeof journalSchema>;
export type RootRotationPhase = z.infer<typeof phaseSchema>;
export interface RootRotationRequest {
  target: VaultRootRotationTarget;
  requestId: string;
}

export type RootRotationDisposition =
  | { kind: "none" }
  | { kind: "new"; request: RootRotationRequest }
  | { kind: "resume"; journal: RootRotationJournal }
  | { kind: "completed"; request: RootRotationRequest };

export function parseRootRotationArguments(
  arguments_: readonly string[],
): RootRotationRequest | undefined {
  if (arguments_.length === 0) return undefined;
  if (
    arguments_.length !== 4
    || arguments_[0] !== "--rotate-root-key"
    || !targetSchema.safeParse(arguments_[1]).success
    || arguments_[2] !== "--rotation-request-id"
    || !canonicalUuid.safeParse(arguments_[3]).success
  ) throw vaultError("vault_config_invalid");
  return {
    target: arguments_[1] as VaultRootRotationTarget,
    requestId: arguments_[3]!,
  };
}

export function rootRotationDisposition(
  manifest: VaultProvisioningManifest,
  request: RootRotationRequest | undefined,
  journal: RootRotationJournal | undefined,
): RootRotationDisposition {
  if (manifest.state !== "configured" || manifest.aggregate === undefined) {
    if (request !== undefined || journal !== undefined) {
      throw vaultError("vault_config_invalid");
    }
    return { kind: "none" };
  }
  const receiptRequestId = journal?.requestId ?? request?.requestId;
  const receipt = receiptRequestId === undefined
    ? undefined
    : manifest.rotationReceipts?.find(
      (value) => value.requestId === receiptRequestId,
    );
  if (receipt !== undefined) {
    const expectedTarget = journal?.target ?? request?.target;
    if (
      expectedTarget !== receipt.target
      || (
        request !== undefined
        && (
          request.requestId !== receipt.requestId
          || request.target !== receipt.target
        )
      )
      || (
        journal !== undefined
        && (
          journal.installationId !== manifest.installationId
          || journal.requestId !== receipt.requestId
          || journal.target !== receipt.target
          || journal.oldPhysicalVersion !== receipt.oldPhysicalVersion
          || journal.newPhysicalVersion !== receipt.newPhysicalVersion
        )
      )
    ) throw vaultError("vault_config_invalid");
    return {
      kind: "completed",
      request: {
        requestId: receipt.requestId,
        target: receipt.target,
      },
    };
  }
  if (journal !== undefined) {
    if (
      journal.installationId !== manifest.installationId
      || journal.startingAggregate !== manifest.aggregate
      || (
        request !== undefined
        && (
          request.requestId !== journal.requestId
          || request.target !== journal.target
        )
      )
    ) throw vaultError("vault_config_invalid");
    return { kind: "resume", journal };
  }
  if (request === undefined) return { kind: "none" };
  return { kind: "new", request };
}

export function initialRootRotationJournal(
  manifest: VaultProvisioningManifest,
  request: RootRotationRequest,
  configuredRootPath: string,
): RootRotationJournal {
  if (
    manifest.state !== "configured"
    || manifest.aggregate === undefined
    || !isAbsolute(configuredRootPath)
  ) throw vaultError("vault_config_invalid");
  const logicalKeyId = request.target === "identity"
    ? "identity.envelope-root"
    : "vault.envelope-root";
  const entry = manifest.entries.find((value) => value.id === logicalKeyId);
  if (entry?.status !== "verified") throw vaultError("vault_config_invalid");
  return finalizeJournal({
    version: 1,
    installationId: manifest.installationId,
    requestId: request.requestId,
    target: request.target,
    logicalKeyId,
    startingAggregate: manifest.aggregate,
    configuredRootPath,
    oldPhysicalVersion: entry.activePhysicalVersion ?? "legacy",
    newPhysicalVersion: request.requestId,
    phase: "created",
    scannedCount: 0,
    rewrappedCount: 0,
  });
}

export function advanceRootRotationJournal(
  journal: RootRotationJournal,
  input: {
    phase: RootRotationPhase;
    stagedFingerprint?: string;
    cursor?: string;
    scannedCount?: number;
    rewrappedCount?: number;
  },
): RootRotationJournal {
  const parsed = parseRootRotationJournal(journal);
  const phases: readonly RootRotationPhase[] = [
    "created",
    "staged",
    "activated",
    "rewrapping",
    "verified",
    "root_switched",
  ];
  const current = phases.indexOf(parsed.phase);
  const next = phases.indexOf(input.phase);
  if (
    next < current
    || next > current + 1
    || (
      next === current
      && input.phase !== "rewrapping"
    )
  ) throw vaultError("vault_config_invalid");
  return finalizeJournal({
    ...withoutChecksum(parsed),
    phase: input.phase,
    ...(input.stagedFingerprint === undefined
      ? {}
      : { stagedFingerprint: input.stagedFingerprint }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    scannedCount: input.scannedCount ?? parsed.scannedCount,
    rewrappedCount: input.rewrappedCount ?? parsed.rewrappedCount,
  });
}

export function stagedRootPath(journal: RootRotationJournal): string {
  const parsed = parseRootRotationJournal(journal);
  return `${parsed.configuredRootPath}.rotation-${parsed.requestId}.staged`;
}

export function archivedRootPath(journal: RootRotationJournal): string {
  const parsed = parseRootRotationJournal(journal);
  return `${parsed.configuredRootPath}.rotation-${parsed.oldPhysicalVersion}.retired`;
}

export function stageRootRotationKey(
  journal: RootRotationJournal,
  registryEntry: VaultProvisioningRegistryEntry,
  adapter: VaultProvisioningKeyAdapter,
): RootRotationJournal {
  const parsed = parseRootRotationJournal(journal);
  if (
    parsed.phase !== "created"
    || registryEntry.id !== parsed.logicalKeyId
    || registryEntry.path !== parsed.configuredRootPath
    || registryEntry.adapter !== adapter.id
  ) throw vaultError("vault_config_invalid");
  const stagedEntry = {
    ...registryEntry,
    path: stagedRootPath(parsed),
  };
  adapter.create(stagedEntry);
  const fingerprint = adapter.validate(stagedEntry);
  return advanceRootRotationJournal(parsed, {
    phase: "staged",
    stagedFingerprint: fingerprint,
  });
}

export class RootRotationJournalStore {
  constructor(
    readonly file: string,
    private readonly failureInjector?: (
      stage: "after_file_sync_before_commit",
    ) => void,
  ) {}

  exists(): boolean {
    try {
      lstatSync(this.file);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw vaultError("vault_config_invalid");
    }
  }

  read(): RootRotationJournal {
    let descriptor: number | undefined;
    try {
      if (!isAbsolute(this.file)) throw new Error("path");
      descriptor = openSync(
        this.file,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const metadata = fstatSync(descriptor);
      const currentUid = process.getuid?.();
      if (
        !metadata.isFile()
        || metadata.nlink !== 1
        || (metadata.mode & 0o777) !== 0o600
        || (
          currentUid !== undefined
          && metadata.uid !== currentUid
          && metadata.uid !== 0
        )
        || metadata.size < 2
        || metadata.size > MAX_JOURNAL_BYTES
      ) throw new Error("metadata");
      const source = readFileSync(descriptor, "utf8");
      if (
        !source.endsWith("\n")
        || Buffer.byteLength(source) !== metadata.size
      ) throw new Error("representation");
      const parsed = parseRootRotationJournal(
        JSON.parse(source.slice(0, -1)),
      );
      if (`${canonicalJson(parsed)}\n` !== source) {
        throw new Error("canonical");
      }
      return parsed;
    } catch {
      throw vaultError("vault_config_invalid");
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  create(journal: RootRotationJournal): void {
    this.#write(journal, true);
  }

  replace(journal: RootRotationJournal): void {
    this.#write(journal, false);
  }

  remove(): void {
    try {
      unlinkSync(this.file);
      fsyncDirectory(dirname(this.file));
    } catch {
      throw vaultError("vault_config_invalid");
    }
  }

  #write(journalValue: RootRotationJournal, noReplace: boolean): void {
    if (!isAbsolute(this.file)) throw vaultError("vault_config_invalid");
    const journal = parseRootRotationJournal(journalValue);
    const parent = dirname(this.file);
    const metadata = lstatSync(parent);
    const currentUid = process.getuid?.();
    if (
      !metadata.isDirectory()
      || metadata.isSymbolicLink()
      || (metadata.mode & 0o022) !== 0
      || (
        currentUid !== undefined
        && metadata.uid !== currentUid
        && metadata.uid !== 0
      )
    ) throw vaultError("vault_config_invalid");
    const temporary = join(parent, `.${basename(this.file)}.${journal.requestId}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(
        temporary,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o600,
      );
      writeFileSync(descriptor, `${canonicalJson(journal)}\n`, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      this.failureInjector?.("after_file_sync_before_commit");
      if (noReplace) {
        linkSync(temporary, this.file);
        unlinkSync(temporary);
      } else {
        renameSync(temporary, this.file);
      }
      fsyncDirectory(parent);
    } catch {
      throw vaultError("vault_config_invalid");
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      try {
        unlinkSync(temporary);
      } catch {
        // The temporary may already have been committed.
      }
    }
  }
}

export function parseRootRotationJournal(value: unknown): RootRotationJournal {
  const parsed = journalSchema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_config_invalid");
  const expected = journalChecksum(withoutChecksum(parsed.data));
  if (parsed.data.checksum !== expected) {
    throw vaultError("vault_config_invalid");
  }
  return parsed.data;
}

function finalizeJournal(
  value: z.infer<typeof journalWithoutChecksumSchema>,
): RootRotationJournal {
  const parsed = journalWithoutChecksumSchema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_config_invalid");
  return {
    ...parsed.data,
    checksum: journalChecksum(parsed.data),
  };
}

function withoutChecksum(
  value: RootRotationJournal,
): z.infer<typeof journalWithoutChecksumSchema> {
  const { checksum: _checksum, ...rest } = value;
  return rest;
}

function journalChecksum(
  value: z.infer<typeof journalWithoutChecksumSchema>,
): string {
  return createHash("sha256")
    .update("secretsauce:root-rotation-journal:v1\0")
    .update(canonicalJson(value))
    .digest("hex");
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
