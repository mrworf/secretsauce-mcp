import { z } from "zod";
import { isUuidV7 } from "../persistence/uuidV7.js";
import type { VaultRecordMetadata } from "./recordStore.js";

export const locatorSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const bindingSchema = z.object({
  serviceId: z.string().refine(isUuidV7),
  destinationId: z.string().refine(isUuidV7),
  credentialId: z.string().refine(isUuidV7),
}).strict();
export const generationSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const canonicalSecretSchema = z.string().min(2).max(87_382).refine((value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength >= 1
    && decoded.byteLength <= 65_536
    && decoded.toString("base64url") === value;
});

export const readinessRequestSchema = z.object({}).strict();
export const createRequestSchema = z.object({
  binding: bindingSchema,
  secret: canonicalSecretSchema,
  locator: locatorSchema.optional(),
  captureLastFour: z.boolean().default(false),
}).strict();
export const replaceRequestSchema = z.object({
  locator: locatorSchema,
  generation: generationSchema,
  binding: bindingSchema,
  secret: canonicalSecretSchema,
  captureLastFour: z.boolean().default(false),
}).strict();
export const deleteRequestSchema = z.object({
  locator: locatorSchema,
  generation: generationSchema,
  binding: bindingSchema,
}).strict();
export const metadataRequestSchema = z.object({
  locator: locatorSchema,
  binding: bindingSchema,
}).strict();
export const resolveRequestSchema = z.object({
  capability: z.string().min(1).max(8192),
  locator: locatorSchema,
  generation: generationSchema,
  binding: bindingSchema,
}).strict();
export const passphraseSchema = z.string().min(16).max(1_366).refine((value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength >= 12
    && decoded.byteLength <= 1_024
    && decoded.toString("base64url") === value;
});
export const backupSelectionSchema = z.array(z.object({
  ...bindingSchema.shape,
  locator: locatorSchema,
  generation: generationSchema,
}).strict()).max(10_000);
export const transferChunkSchema = z.string().max(87_382).refine((value) => {
  if (value.length === 0) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength >= 1
    && decoded.byteLength <= 65_536
    && decoded.toString("base64url") === value;
});
export const exportRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    capability: z.string().min(1).max(8192),
    passphrase: passphraseSchema,
    selection: backupSelectionSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("read"),
    transferId: locatorSchema,
    transferToken: z.string().min(1).max(8192),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
]);
export const importRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    capability: z.string().min(1).max(8192),
    selection: backupSelectionSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("write"),
    transferId: locatorSchema,
    transferToken: z.string().min(1).max(8192),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    chunk: transferChunkSchema,
  }).strict(),
  z.object({
    action: z.literal("finish"),
    transferId: locatorSchema,
    transferToken: z.string().min(1).max(8192),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    passphrase: passphraseSchema,
  }).strict(),
]);
export const replaceEmptyRequestSchema = z.object({
  capability: z.string().min(1).max(8192),
}).strict();

export const metadataSchema = z.object({
  status: z.literal("configured"),
  generation: generationSchema,
  sizeClass: z.enum([
    "up_to_32_bytes",
    "up_to_128_bytes",
    "up_to_512_bytes",
    "up_to_2_kib",
    "up_to_8_kib",
    "up_to_32_kib",
    "up_to_64_kib",
  ]),
  lastFour: z.string().length(4).regex(/^[\x20-\x7e]{4}$/).optional(),
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict() satisfies z.ZodType<VaultRecordMetadata>;

export const readinessResultSchema = z.object({
  status: z.enum(["ready", "locked", "degraded"]),
  recordCount: z.number().int().nonnegative(),
}).strict();
export const createResultSchema = z.object({ locator: locatorSchema, metadata: metadataSchema }).strict();
export const replaceResultSchema = metadataSchema;
export const deleteResultSchema = z.object({ deleted: z.literal(true) }).strict();
export const metadataResultSchema = metadataSchema;
export const resolveResultSchema = z.object({ secret: canonicalSecretSchema }).strict();
export const transferStartResultSchema = z.object({
  transferId: locatorSchema,
  chunkBytes: z.literal(65_536),
  totalBytes: z.number().int().nonnegative().max(1024 * 1024 * 1024).optional(),
}).strict();
export const transferReadResultSchema = z.object({
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  chunk: transferChunkSchema,
  done: z.boolean(),
}).strict();
export const transferWriteResultSchema = z.object({
  accepted: z.literal(true),
  nextSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const transferFinishResultSchema = z.object({
  imported: z.literal(true),
}).strict();
export const restoreTransferFinishResultSchema = z.union([
  z.object({
    validated: z.literal(true),
    recordCount: z.number().int().nonnegative().max(10_000),
  }).strict(),
  z.object({
    replaced: z.literal(true),
    recordCount: z.number().int().nonnegative().max(10_000),
  }).strict(),
]);
export const replaceEmptyResultSchema = z.object({
  replaced: z.literal(true),
  recordCount: z.literal(0),
}).strict();

export const successResponseSchema = z.object({
  ok: z.literal(true),
  result: z.unknown(),
}).strict();
export const failureResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().regex(/^vault_[a-z_]{1,64}$/),
  }).strict(),
}).strict();
