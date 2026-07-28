import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { z } from "zod";
import {
  exportEncryptedVaultArchive,
  importEncryptedVaultArchive,
  replaceEncryptedVaultArchive,
  replaceVaultWithEmpty,
  validateEncryptedVaultArchive,
} from "./archive.js";
import {
  canonicalizeVaultBackupSelection,
  digestVaultBackupSelection,
  type VaultBackupSelection,
} from "./backupSelection.js";
import {
  VaultCapabilityAuthority,
  type BackupCapability,
} from "./capabilities.js";
import {
  createRequestSchema,
  deleteRequestSchema,
  exportRequestSchema,
  importRequestSchema,
  metadataRequestSchema,
  readinessRequestSchema,
  replaceEmptyRequestSchema,
  replaceRequestSchema,
  resolveRequestSchema,
} from "./contracts.js";
import { vaultError } from "./errors.js";
import {
  isOperationAllowed,
  type VaultCaller,
  type VaultOperation,
} from "./protocol.js";
import { VaultRecordStore } from "./recordStore.js";

const TRANSFER_CHUNK_BYTES = 65_536;
const MAX_TRANSFER_BYTES = 1024 * 1024 * 1024;
const MAX_TRANSFERS = 4;
const TRANSFER_TTL_MS = 5 * 60_000;

export interface AuthenticatedVaultCaller {
  caller: VaultCaller;
  bootId: string;
}

export interface VaultRequestMetadata {
  requestId: string;
  timestampMs: number;
}

export interface VaultDomainRequest {
  caller: AuthenticatedVaultCaller;
  operation: VaultOperation;
  metadata: VaultRequestMetadata;
  input: unknown;
}

interface ExportTransfer {
  kind: "export";
  tokenDigest: Buffer;
  archive: Buffer;
  offset: number;
  sequence: number;
  expiresAt: number;
}

interface ImportTransfer {
  kind: "import";
  tokenDigest: Buffer;
  chunks: Buffer[];
  totalBytes: number;
  sequence: number;
  expiresAt: number;
  operation: BackupCapability["operation"];
  selection?: VaultBackupSelection[];
}

type ArchiveTransfer = ExportTransfer | ImportTransfer;

export interface VaultDomainHandlerOptions {
  capabilityAuthority: VaultCapabilityAuthority;
  store: VaultRecordStore;
  bootId?: string;
  now?: () => number;
}

export class VaultDomainHandler {
  readonly #capabilities: VaultCapabilityAuthority;
  readonly #store: VaultRecordStore;
  readonly #bootId: string;
  readonly #now: () => number;
  readonly #transfers = new Map<string, ArchiveTransfer>();
  #closed = false;

  constructor(options: VaultDomainHandlerOptions) {
    this.#capabilities = options.capabilityAuthority;
    this.#store = options.store;
    this.#bootId = options.bootId ?? randomUUID();
    this.#now = options.now ?? Date.now;
  }

  get bootId(): string {
    return this.#bootId;
  }

  async handle(request: VaultDomainRequest): Promise<unknown> {
    if (
      this.#closed
      || request.caller.bootId !== this.#bootId
      || !isOperationAllowed(request.caller.caller, request.operation)
      || !Number.isSafeInteger(request.metadata.timestampMs)
      || request.metadata.timestampMs < 0
    ) {
      throw vaultError("vault_operation_denied");
    }
    const caller = request.caller.caller;
    const operation = request.operation;
    if (operation === "readiness") {
      parse(readinessRequestSchema, request.input);
      return this.#store.readiness();
    }
    if (caller === "control_plane") {
      if (operation === "create") {
        const payload = parse(createRequestSchema, request.input);
        const secret = decodeSecret(payload.secret);
        try {
          return this.#store.create(payload.binding, secret, {
            captureLastFour: payload.captureLastFour,
            ...(payload.locator === undefined ? {} : { locator: payload.locator }),
          });
        } finally {
          secret.fill(0);
        }
      }
      if (operation === "replace") {
        const payload = parse(replaceRequestSchema, request.input);
        const secret = decodeSecret(payload.secret);
        try {
          return this.#store.replace(
            payload.locator,
            payload.generation,
            payload.binding,
            secret,
            { captureLastFour: payload.captureLastFour },
          );
        } finally {
          secret.fill(0);
        }
      }
      if (operation === "delete") {
        const payload = parse(deleteRequestSchema, request.input);
        this.#store.delete(payload.locator, payload.generation, payload.binding);
        return { deleted: true };
      }
      if (operation === "metadata") {
        const payload = parse(metadataRequestSchema, request.input);
        return this.#store.metadata(payload.locator, payload.binding);
      }
    }
    if (caller === "data_plane" && operation === "resolve_for_request") {
      const payload = parse(resolveRequestSchema, request.input);
      const capability = this.#capabilities.consumeResolve(payload.capability);
      if (
        capability.locator !== payload.locator
        || capability.generation !== payload.generation
        || capability.serviceId !== payload.binding.serviceId
        || capability.destinationId !== payload.binding.destinationId
        || capability.credentialId !== payload.binding.credentialId
      ) {
        throw vaultError("vault_capability_invalid");
      }
      const secret = this.#store.resolve(
        payload.locator,
        payload.generation,
        payload.binding,
      );
      try {
        return { secret: secret.toString("base64url") };
      } finally {
        secret.fill(0);
      }
    }
    if (caller === "backup" && operation === "export_encrypted") {
      return this.#export(request.input);
    }
    if (caller === "backup" && operation === "import_encrypted") {
      return this.#import(request.input);
    }
    if (caller === "backup" && operation === "replace_empty") {
      const payload = parse(replaceEmptyRequestSchema, request.input);
      const capability = this.#capabilities.consumeBackup(payload.capability);
      if (
        capability.operation !== "replace_empty"
        || !selectionDigestMatches([], capability.operationDigest)
      ) throw vaultError("vault_capability_invalid");
      replaceVaultWithEmpty(this.#store);
      return { replaced: true, recordCount: 0 };
    }
    throw vaultError("vault_operation_denied");
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const transfer of this.#transfers.values()) clearTransfer(transfer);
    this.#transfers.clear();
    this.#store.close();
  }

  async #export(input: unknown): Promise<unknown> {
    const payload = parse(exportRequestSchema, input);
    this.#pruneTransfers();
    if (payload.action === "start") {
      if (this.#transfers.size >= MAX_TRANSFERS) {
        throw vaultError("vault_capacity_exceeded");
      }
      const capability = this.#capabilities.consumeBackup(payload.capability);
      if (
        capability.operation !== "export_encrypted"
        && capability.operation !== "export_recovery"
      ) throw vaultError("vault_capability_invalid");
      const selection = payload.selection === undefined
        ? undefined
        : canonicalizeVaultBackupSelection(payload.selection);
      if (
        (capability.operation === "export_encrypted"
          && (
            selection === undefined
            || !selectionDigestMatches(selection, capability.operationDigest)
          ))
        || (capability.operation === "export_recovery"
          && selection !== undefined)
      ) throw vaultError("vault_capability_invalid");
      const passphrase = decodePassphrase(payload.passphrase);
      let archive: Buffer | undefined;
      try {
        archive = await exportEncryptedVaultArchive(
          this.#store,
          passphrase,
          {},
          selection,
        );
        const transferId = randomUUID();
        this.#transfers.set(transferId, {
          kind: "export",
          tokenDigest: transferTokenDigest(payload.capability),
          archive,
          offset: 0,
          sequence: 0,
          expiresAt: this.#now() + TRANSFER_TTL_MS,
        });
        return {
          transferId,
          chunkBytes: TRANSFER_CHUNK_BYTES,
          totalBytes: archive.byteLength,
        };
      } catch (error) {
        archive?.fill(0);
        throw error;
      } finally {
        passphrase.fill(0);
      }
    }
    const transfer = this.#requireTransfer(
      payload.transferId,
      payload.transferToken,
      "export",
    );
    if (payload.sequence !== transfer.sequence) {
      throw vaultError("vault_protocol_error");
    }
    const end = Math.min(
      transfer.archive.byteLength,
      transfer.offset + TRANSFER_CHUNK_BYTES,
    );
    const chunk = transfer.archive
      .subarray(transfer.offset, end)
      .toString("base64url");
    const sequence = transfer.sequence;
    transfer.offset = end;
    transfer.sequence += 1;
    transfer.expiresAt = this.#now() + TRANSFER_TTL_MS;
    const done = end === transfer.archive.byteLength;
    if (done) {
      this.#transfers.delete(payload.transferId);
      clearTransfer(transfer);
    }
    return { sequence, chunk, done };
  }

  async #import(input: unknown): Promise<unknown> {
    const payload = parse(importRequestSchema, input);
    this.#pruneTransfers();
    if (payload.action === "start") {
      if (this.#transfers.size >= MAX_TRANSFERS) {
        throw vaultError("vault_capacity_exceeded");
      }
      const capability = this.#capabilities.consumeBackup(payload.capability);
      if (![
        "import_encrypted",
        "validate_restore",
        "replace_restore",
        "import_recovery",
      ].includes(capability.operation)) {
        throw vaultError("vault_capability_invalid");
      }
      const selection = payload.selection === undefined
        ? undefined
        : canonicalizeVaultBackupSelection(payload.selection);
      const needsSelection =
        capability.operation === "validate_restore"
        || capability.operation === "replace_restore";
      if (
        needsSelection !== (selection !== undefined)
        || (
          needsSelection
          && !selectionDigestMatches(
            selection!,
            capability.operationDigest,
          )
        )
      ) throw vaultError("vault_capability_invalid");
      const transferId = randomUUID();
      this.#transfers.set(transferId, {
        kind: "import",
        tokenDigest: transferTokenDigest(payload.capability),
        chunks: [],
        totalBytes: 0,
        sequence: 0,
        expiresAt: this.#now() + TRANSFER_TTL_MS,
        operation: capability.operation,
        ...(selection === undefined ? {} : { selection }),
      });
      return { transferId, chunkBytes: TRANSFER_CHUNK_BYTES };
    }
    const transfer = this.#requireTransfer(
      payload.transferId,
      payload.transferToken,
      "import",
    );
    if (payload.sequence !== transfer.sequence) {
      throw vaultError("vault_protocol_error");
    }
    if (payload.action === "write") {
      const chunk = decodeTransferChunk(payload.chunk);
      if (transfer.totalBytes + chunk.byteLength > MAX_TRANSFER_BYTES) {
        chunk.fill(0);
        throw vaultError("vault_archive_invalid");
      }
      transfer.chunks.push(chunk);
      transfer.totalBytes += chunk.byteLength;
      transfer.sequence += 1;
      transfer.expiresAt = this.#now() + TRANSFER_TTL_MS;
      return { accepted: true, nextSequence: transfer.sequence };
    }
    const passphrase = decodePassphrase(payload.passphrase);
    const archive = Buffer.concat(transfer.chunks, transfer.totalBytes);
    this.#transfers.delete(payload.transferId);
    clearTransfer(transfer);
    try {
      if (transfer.operation === "validate_restore") {
        const recordCount = await validateEncryptedVaultArchive(
          this.#store,
          passphrase,
          archive,
          transfer.selection!,
        );
        return { validated: true, recordCount };
      }
      if (transfer.operation === "replace_restore") {
        const recordCount = await replaceEncryptedVaultArchive(
          this.#store,
          passphrase,
          archive,
          transfer.selection!,
        );
        return { replaced: true, recordCount };
      }
      await importEncryptedVaultArchive(this.#store, passphrase, archive);
      return { imported: true };
    } finally {
      passphrase.fill(0);
      archive.fill(0);
    }
  }

  #requireTransfer<T extends ArchiveTransfer["kind"]>(
    transferId: string,
    token: string,
    kind: T,
  ): Extract<ArchiveTransfer, { kind: T }> {
    const transfer = this.#transfers.get(transferId);
    const providedDigest = transferTokenDigest(token);
    if (
      transfer === undefined
      || transfer.kind !== kind
      || transfer.expiresAt <= this.#now()
      || !timingSafeEqual(transfer.tokenDigest, providedDigest)
    ) {
      providedDigest.fill(0);
      throw vaultError("vault_capability_invalid");
    }
    providedDigest.fill(0);
    return transfer as Extract<ArchiveTransfer, { kind: T }>;
  }

  #pruneTransfers(): void {
    const now = this.#now();
    for (const [id, transfer] of this.#transfers) {
      if (transfer.expiresAt <= now) {
        this.#transfers.delete(id);
        clearTransfer(transfer);
      }
    }
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw vaultError("vault_frame_invalid");
  return parsed.data;
}

function decodeSecret(value: string): Buffer {
  const secret = Buffer.from(value, "base64url");
  if (
    secret.toString("base64url") !== value
    || secret.byteLength < 1
    || secret.byteLength > 65_536
  ) {
    secret.fill(0);
    throw vaultError("vault_frame_invalid");
  }
  return secret;
}

function decodePassphrase(value: string): Buffer {
  const passphrase = Buffer.from(value, "base64url");
  if (
    passphrase.byteLength < 12
    || passphrase.byteLength > 1_024
    || passphrase.toString("base64url") !== value
  ) {
    passphrase.fill(0);
    throw vaultError("vault_frame_invalid");
  }
  return passphrase;
}

function decodeTransferChunk(value: string): Buffer {
  const chunk = Buffer.from(value, "base64url");
  if (
    chunk.byteLength < 1
    || chunk.byteLength > TRANSFER_CHUNK_BYTES
    || chunk.toString("base64url") !== value
  ) {
    chunk.fill(0);
    throw vaultError("vault_frame_invalid");
  }
  return chunk;
}

function transferTokenDigest(value: string): Buffer {
  return createHash("sha256")
    .update("secretsauce:vault-transfer:v1:")
    .update(value)
    .digest();
}

function selectionDigestMatches(
  selection: readonly VaultBackupSelection[],
  capabilityDigestValue: string,
): boolean {
  const expectedDigest = Buffer.from(
    digestVaultBackupSelection(selection),
    "hex",
  );
  const capabilityDigest = Buffer.from(capabilityDigestValue, "hex");
  const matches = timingSafeEqual(expectedDigest, capabilityDigest);
  expectedDigest.fill(0);
  capabilityDigest.fill(0);
  return matches;
}

function clearTransfer(transfer: ArchiveTransfer): void {
  transfer.tokenDigest.fill(0);
  if (transfer.kind === "export") transfer.archive.fill(0);
  else for (const chunk of transfer.chunks) chunk.fill(0);
}
