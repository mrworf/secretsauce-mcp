import { z } from "zod";
import { PersistenceError } from "./errors.js";
import { isUuidV7 } from "./uuidV7.js";

const sensitiveFieldName = /(^|[_-])(authorization|cookie|set-cookie|secret|password|api[-_]?key|access[-_]?token|refresh[-_]?token|bearer[-_]?token|opaque[-_]?(?:token|reference)|raw[-_]?(?:token|reference)|(?:token|reference)[-_]?value|credential[-_]?value|body)(s|[_-]|$)/i;
const safeCode = z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/);
const uuidV7 = z.string().refine(isUuidV7, "must be a UUIDv7");
const correlationId = z.string().min(1).max(128).regex(
  /^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const safeValue = z.union([
  z.string().max(1024),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const auditSchema = z.object({
  actor: z.object({
    type: z.enum(["browser_session", "api_key", "local_cli", "system", "job"]),
    id: uuidV7.optional(),
    label: z.string().min(1).max(256),
    role: safeCode.max(64).optional(),
    authenticationMethod: safeCode.max(64),
  }).strict(),
  action: safeCode,
  result: z.enum(["allow", "deny", "error"]),
  target: z.object({
    type: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_.-]*$/),
    id: uuidV7.optional(),
    label: z.string().min(1).max(256),
  }).strict(),
  serviceId: uuidV7.optional(),
  justification: z.string().min(1).max(1024).optional(),
  changes: z.array(z.object({
    field: z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/)
      .refine((field) => !sensitiveFieldName.test(field), "secret-bearing field names are prohibited"),
    before: safeValue.optional(),
    after: safeValue.optional(),
  }).strict().refine(
    (change) => change.before !== undefined || change.after !== undefined,
    "a change requires before or after",
  )).max(100).default([]),
  correlationId,
  source: z.object({
    category: safeCode.max(64).optional(),
    client: z.string().min(1).max(256).optional(),
    osActor: z.string().min(1).max(256).optional(),
  }).strict().default({}),
  failureCode: safeCode.optional(),
}).strict().superRefine((event, context) => {
  if (event.result === "allow" && event.failureCode !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["failureCode"],
      message: "allowed events must not include a failure code",
    });
  }
  if (event.result !== "allow" && event.failureCode === undefined) {
    context.addIssue({
      code: "custom",
      path: ["failureCode"],
      message: "denied and failed events require a failure code",
    });
  }
});

export type AdministrativeAuditEventInput = z.input<typeof auditSchema>;

export interface AdministrativeAuditEvent {
  eventId: string;
  occurredAt: number;
  actor: z.output<typeof auditSchema>["actor"];
  action: string;
  result: "allow" | "deny" | "error";
  target: z.output<typeof auditSchema>["target"];
  serviceId?: string;
  justification?: string;
  changes: z.output<typeof auditSchema>["changes"];
  correlationId: string;
  source: z.output<typeof auditSchema>["source"];
  failureCode?: string;
}

export interface AdministrativeAuditBuilderOptions {
  now: () => number;
  uuid: () => string;
  sanitizeText: (value: string) => string;
}

export function buildAdministrativeAuditEvent(
  input: unknown,
  options: AdministrativeAuditBuilderOptions,
): AdministrativeAuditEvent {
  if (input === undefined || input === null) {
    throw new PersistenceError("administrative_audit_required");
  }
  const parsed = auditSchema.safeParse(input);
  if (!parsed.success) throw new PersistenceError("invalid_audit_event");
  const eventId = options.uuid();
  const occurredAt = Math.trunc(options.now());
  if (!isUuidV7(eventId) || !Number.isSafeInteger(occurredAt) || occurredAt < 0) {
    throw new PersistenceError("invalid_audit_event");
  }

  const sanitizeValue = (value: z.output<typeof safeValue>): z.output<typeof safeValue> =>
    typeof value === "string" ? options.sanitizeText(value) : value;
  const event = {
    eventId,
    occurredAt,
    actor: {
      ...parsed.data.actor,
      label: options.sanitizeText(parsed.data.actor.label),
    },
    action: parsed.data.action,
    result: parsed.data.result,
    target: {
      ...parsed.data.target,
      label: options.sanitizeText(parsed.data.target.label),
    },
    ...(parsed.data.serviceId === undefined ? {} : { serviceId: parsed.data.serviceId }),
    ...(parsed.data.justification === undefined
      ? {}
      : { justification: options.sanitizeText(parsed.data.justification) }),
    changes: parsed.data.changes.map((change) => ({
      field: change.field,
      ...(change.before === undefined ? {} : { before: sanitizeValue(change.before) }),
      ...(change.after === undefined ? {} : { after: sanitizeValue(change.after) }),
    })),
    correlationId: parsed.data.correlationId,
    source: {
      ...(parsed.data.source.category === undefined ? {} : { category: parsed.data.source.category }),
      ...(parsed.data.source.client === undefined
        ? {}
        : { client: options.sanitizeText(parsed.data.source.client) }),
      ...(parsed.data.source.osActor === undefined
        ? {}
        : { osActor: options.sanitizeText(parsed.data.source.osActor) }),
    },
    ...(parsed.data.failureCode === undefined ? {} : { failureCode: parsed.data.failureCode }),
  } satisfies AdministrativeAuditEvent;

  if (
    Buffer.byteLength(JSON.stringify(event.changes), "utf8") > 16_384 ||
    Buffer.byteLength(JSON.stringify(event.source), "utf8") > 4_096
  ) {
    throw new PersistenceError("invalid_audit_event");
  }
  return event;
}
