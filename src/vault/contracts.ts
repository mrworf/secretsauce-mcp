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
