import { z } from "zod";
import { PersistenceError } from "./errors.js";
import { isUuidV7 } from "./uuidV7.js";

export const AUDIT_CATEGORIES = [
  "authentication",
  "authorization",
  "identity",
  "service",
  "credential",
  "policy",
  "security",
  "system",
  "audit",
  "other",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

const safeText = z.string().min(1).max(1_024);
const uuidV7 = z.string().refine(isUuidV7);
const safeCode = z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/);
const prohibitedValue = /(?:\b(?:authorization|set-cookie|cookie|password|secret|access[_-]?token|refresh[_-]?token|credential[_-]?value)\s*[:=]|\b(?:bearer|basic)\s+[a-z0-9+/=_-]{8,}|\b(?:gref|sec)_[^\s"'<>()[\]{},;]+|\bgh[pousr]_[a-z0-9_]{20,}|\bsk-(?:proj-)?[a-z0-9_-]{20,})/i;

const runtimeDetailValue = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const runtimeAuditProjectionSchema = z.object({
  eventId: uuidV7,
  occurredAt: z.number().int().nonnegative(),
  eventType: safeCode,
  outcome: z.enum(["allow", "deny", "error", "warning"]),
  category: z.enum(AUDIT_CATEGORIES),
  actorType: z.enum(["oauth_user", "api_key", "anonymous", "system"]),
  subjectId: uuidV7.optional(),
  subjectLabel: z.string().min(1).max(256),
  serviceId: uuidV7.optional(),
  serviceLabel: z.string().min(1).max(256).optional(),
  destination: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9_.-]*$/).optional(),
  action: safeCode.optional(),
  method: z.string().min(1).max(16).regex(/^[A-Z]+$/).optional(),
  targetHost: z.string().min(1).max(253).optional(),
  targetPath: z.string().min(1).max(2_048).optional(),
  downstreamStatus: z.number().int().min(100).max(599).optional(),
  policyRule: z.string().min(1).max(128).optional(),
  reason: safeText.optional(),
  failureCode: safeCode.optional(),
  correlationId: z.string().min(1).max(128).optional(),
  source: z.object({
    category: safeCode.max(64).optional(),
    client: z.string().min(1).max(256).optional(),
  }).strict().default({}),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  tlsVerify: z.boolean().optional(),
  tokenizationCount: z.number().int().nonnegative().max(100_000).optional(),
  credentialUseCount: z.number().int().nonnegative().max(100_000).optional(),
  details: z.record(
    z.string().min(1).max(64).regex(/^[a-z][a-z0-9_.-]*$/),
    runtimeDetailValue,
  ).refine((value) => Object.keys(value).length <= 32).default({}),
}).strict();

export type RuntimeAuditProjection = z.output<typeof runtimeAuditProjectionSchema>;

export function validateRuntimeAuditProjection(input: unknown): RuntimeAuditProjection {
  const parsed = runtimeAuditProjectionSchema.safeParse(input);
  if (!parsed.success) throw new PersistenceError("invalid_audit_event");
  rejectProhibitedAuditMaterial(parsed.data);
  return parsed.data;
}

export function canonicalAdministrativeAuditDocument(input: {
  category: AuditCategory;
  actor: {
    id?: string | undefined;
    label: string;
    type: string;
    role?: string | undefined;
    authenticationMethod: string;
  };
  action: string;
  result: string;
  target: { id?: string | undefined; label: string; type: string };
  serviceId?: string;
  serviceLabel?: string;
  justification?: string;
  changes: Array<{
    field: string;
    before?: string | number | boolean | null | undefined;
    after?: string | number | boolean | null | undefined;
  }>;
  correlationId: string;
  source: {
    category?: string | undefined;
    client?: string | undefined;
    osActor?: string | undefined;
  };
  failureCode?: string;
}): string {
  rejectProhibitedAuditMaterial(input);
  return canonicalDocument([
    input.category,
    input.actor.type,
    input.actor.id,
    input.actor.label,
    input.actor.role,
    input.actor.authenticationMethod,
    input.action,
    input.result,
    input.target.type,
    input.target.id,
    input.target.label,
    input.serviceId,
    input.serviceLabel,
    input.justification,
    ...input.changes.flatMap((change) => [
      change.field,
      primitiveText(change.before),
      primitiveText(change.after),
    ]),
    input.correlationId,
    input.source.category,
    input.source.client,
    input.source.osActor,
    input.failureCode,
  ]);
}

export function canonicalRuntimeAuditDocument(input: RuntimeAuditProjection): string {
  rejectProhibitedAuditMaterial(input);
  return canonicalDocument([
    input.eventType,
    input.outcome,
    input.category,
    input.actorType,
    input.subjectId,
    input.subjectLabel,
    input.serviceId,
    input.serviceLabel,
    input.destination,
    input.action,
    input.method,
    input.targetHost,
    input.targetPath,
    input.policyRule,
    input.reason,
    input.failureCode,
    input.correlationId,
    input.source.category,
    input.source.client,
    ...Object.entries(input.details).flatMap(([key, value]) => [key, primitiveText(value)]),
  ]);
}

function canonicalDocument(values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => value !== undefined && value.length > 0)
    .map((value) => value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\p{C}+/gu, " ").trim())
    .filter((value) => value.length > 0)
    .join(" ");
}

function primitiveText(value: string | number | boolean | null | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  return String(value);
}

function rejectProhibitedAuditMaterial(input: unknown): void {
  const visit = (value: unknown, key = ""): void => {
    const aggregateSafeCounter =
      key === "tokenizationCount" || key === "credentialUseCount";
    if (
      !aggregateSafeCounter
      && /(?:authorization|cookie|password|secret|token|credential|request_body|response_body|headers?)/i.test(key)
    ) {
      throw new PersistenceError("invalid_audit_event");
    }
    if (typeof value === "string" && prohibitedValue.test(value)) {
      throw new PersistenceError("invalid_audit_event");
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else if (value !== null && typeof value === "object") {
      for (const [entryKey, entryValue] of Object.entries(value)) visit(entryValue, entryKey);
    }
  };
  visit(input);
}
