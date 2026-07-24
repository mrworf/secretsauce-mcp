import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "./zod.js";
import { publicRequestIdPattern } from "../requestId.js";
import { isUuidV7 } from "../persistence/uuidV7.js";

export const controlRequestIdSchema = z.string().regex(publicRequestIdPattern);
export const controlApiVersionSchema = z.literal("v2");
export const CONTROL_ERROR_CODES = [
  "invalid_request",
  "unauthenticated",
  "forbidden",
  "step_up_required",
  "not_found",
  "precondition_required",
  "stale_version",
  "identity_conflict",
  "service_conflict",
  "restore_conflict",
  "last_active_superadmin",
  "idempotency_conflict",
  "rate_limited",
  "vault_unavailable",
  "maintenance",
  "internal_error",
] as const;
export const controlPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(16).max(2048)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    .optional(),
}).strict();
export const controlPageMetaSchema = z.object({
  next_cursor: z.string().min(16).max(2048).optional(),
}).strict().meta({
  id: "ControlPageMeta",
  description: "Keyset pagination metadata. Absence of next_cursor means the page is final.",
});
export const controlExpectedVersionHeaderSchema = z.string().regex(/^"[1-9][0-9]*"$/).meta({
  id: "ControlExpectedVersion",
  description: "Strong resource ETag required in If-Match for mutable resources.",
});
export const controlIdempotencyKeySchema = z.string().min(16).max(128)
  .regex(/^[\x20-\x7e]+$/)
  .refine((value) => value.trim() === value)
  .meta({
    id: "ControlIdempotencyKey",
    description: "Printable ASCII retry key. The raw value and request body are never persisted.",
  });

const safeDetailValue = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const controlErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(CONTROL_ERROR_CODES),
    message: z.string().min(1).max(256),
    request_id: controlRequestIdSchema,
    details: z.record(z.string().min(1).max(64), safeDetailValue).optional(),
  }).strict(),
}).strict();

export function controlDataEnvelopeSchema<T extends z.ZodType>(
  data: T,
): z.ZodObject<{
  data: T;
  meta: z.ZodObject<{
    request_id: typeof controlRequestIdSchema;
    api_version: typeof controlApiVersionSchema;
  }>;
}> {
  return z.object({
    data,
    meta: z.object({
      request_id: controlRequestIdSchema,
      api_version: controlApiVersionSchema,
    }).strict(),
  }).strict();
}

export class ControlContractError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    super(message);
    this.name = "ControlContractError";
  }
}

export interface ControlCursorBinding {
  routeId: string;
  principalId: string;
  scopeDigest: string;
  sort: string;
  filterDigest: string;
}

export interface ControlCursorInput extends ControlCursorBinding {
  lastKey: string;
}

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  routeId: z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/),
  principalId: z.string().refine(isUuidV7),
  scopeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sort: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_.-]*$/),
  filterDigest: z.string().regex(/^[a-f0-9]{64}$/),
  lastKey: z.string().min(1).max(512).regex(/^[A-Za-z0-9_.:-]+$/),
  expiresAt: z.number().int().nonnegative(),
}).strict();

export class ControlCursorCodec {
  readonly #hmacKey: Buffer;

  constructor(
    hmacKey: Buffer,
    private readonly now: () => number = Date.now,
  ) {
    if (hmacKey.byteLength !== 32) throw new Error("Cursor HMAC key must be 32 bytes.");
    this.#hmacKey = Buffer.from(hmacKey);
  }

  encode(input: ControlCursorInput): string {
    const parsed = cursorPayloadSchema.omit({ version: true, expiresAt: true }).safeParse(input);
    if (!parsed.success) throw invalidRequest();
    const payload = Buffer.from(JSON.stringify({
      version: 1,
      ...parsed.data,
      expiresAt: this.safeNow() + 15 * 60 * 1000,
    }), "utf8").toString("base64url");
    const signature = this.sign(payload);
    const cursor = `${payload}.${signature}`;
    if (cursor.length > 2048) throw invalidRequest();
    return cursor;
  }

  decode(cursor: string, expected: ControlCursorBinding): { lastKey: string } {
    if (cursor.length < 16 || cursor.length > 2048) throw invalidRequest();
    const pieces = cursor.split(".");
    if (pieces.length !== 2) throw invalidRequest();
    const [payload, signature] = pieces;
    if (payload === undefined || signature === undefined || !constantTimeTextEqual(signature, this.sign(payload))) {
      throw invalidRequest();
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw invalidRequest();
    }
    const parsed = cursorPayloadSchema.safeParse(decoded);
    if (
      !parsed.success ||
      parsed.data.expiresAt <= this.safeNow() ||
      parsed.data.routeId !== expected.routeId ||
      parsed.data.principalId !== expected.principalId ||
      parsed.data.scopeDigest !== expected.scopeDigest ||
      parsed.data.sort !== expected.sort ||
      parsed.data.filterDigest !== expected.filterDigest
    ) {
      throw invalidRequest();
    }
    return { lastKey: parsed.data.lastKey };
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.#hmacKey).update(payload, "utf8").digest("base64url");
  }

  private safeNow(): number {
    const value = Math.trunc(this.now());
    if (!Number.isSafeInteger(value) || value < 0) throw invalidRequest();
    return value;
  }

  close(): void {
    this.#hmacKey.fill(0);
  }
}

export function formatVersionEtag(version: number): string {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("Version must be positive.");
  return `"${version}"`;
}

export function parseExpectedVersion(
  ifMatch: string | string[] | undefined,
  currentVersion?: number,
): number {
  if (ifMatch === undefined) {
    throw new ControlContractError(
      428,
      "precondition_required",
      "An If-Match resource version is required.",
    );
  }
  if (typeof ifMatch !== "string" || !controlExpectedVersionHeaderSchema.safeParse(ifMatch).success) {
    throw invalidRequest();
  }
  const version = Number(ifMatch.slice(1, -1));
  if (!Number.isSafeInteger(version)) throw invalidRequest();
  if (currentVersion !== undefined && version !== currentVersion) {
    throw new ControlContractError(
      409,
      "stale_version",
      "The resource changed. Refresh and retry.",
      { current_version: currentVersion },
    );
  }
  return version;
}

export function parseIdempotencyKey(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !controlIdempotencyKeySchema.safeParse(value).success) {
    throw invalidRequest();
  }
  return value;
}

function invalidRequest(): ControlContractError {
  return new ControlContractError(400, "invalid_request", "The request is invalid.");
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}
