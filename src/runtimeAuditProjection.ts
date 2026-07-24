import type { AuditEvent } from "./audit.js";
import type { RuntimeAuditProjection } from "./persistence/auditDocuments.js";
import { isUuidV7 } from "./persistence/uuidV7.js";

export interface RuntimeAuditProjectionOptions {
  uuid: () => string;
}

export function projectRuntimeAuditEvent(
  event: AuditEvent,
  options: RuntimeAuditProjectionOptions,
): RuntimeAuditProjection {
  const occurredAt = parseEventTime(event);
  const subjectId = isUuidV7(event.subject) ? event.subject : undefined;
  const service = "service" in event ? event.service : undefined;
  const serviceId = service !== undefined && isUuidV7(service) ? service : undefined;
  const base = {
    eventId: options.uuid(),
    occurredAt,
    eventType: event.type,
    category: event.type.startsWith("self_api_key_") ? "security" as const : "authorization" as const,
    actorType: subjectId === undefined ? "anonymous" as const : "oauth_user" as const,
    ...(subjectId === undefined ? {} : { subjectId }),
    subjectLabel: subjectId === undefined ? "authenticated-principal" : `user:${subjectId}`,
    ...(serviceId === undefined ? {} : { serviceId }),
    ...(service === undefined ? {} : {
      serviceLabel: serviceId === undefined ? service : `service:${serviceId}`,
    }),
    source: { category: "mcp" },
  };

  switch (event.type) {
    case "reference_issued":
      return {
        ...base,
        outcome: "allow",
        destination: event.destination,
        action: "reference_issued",
        reason: event.reason,
        details: { access_count: event.access_ids.length },
      };
    case "service_request":
      return {
        ...base,
        outcome: event.policy_decision === "deny"
          ? "deny"
          : event.error_code === undefined
            ? "allow"
            : "error",
        destination: event.destination,
        action: "service_request",
        method: event.method,
        targetHost: event.target_host,
        targetPath: event.target_path,
        ...(event.downstream_status_code === undefined
          ? {}
          : { downstreamStatus: event.downstream_status_code }),
        ...(event.matched_policy_rule === undefined
          ? {}
          : { policyRule: event.matched_policy_rule }),
        ...(event.error_code === undefined ? {} : { failureCode: event.error_code }),
        correlationId: event.request_id,
        durationMs: Math.max(0, Math.trunc(event.request_duration_ms)),
        tlsVerify: event.tls_verify,
        tokenizationCount: event.secret_tokenization_count,
        credentialUseCount: event.credential_use_count ?? 0,
        details: {
          policy_decision: event.policy_decision,
          ...(event.binary_scan_bypassed === undefined
            ? {}
            : { binary_scan_bypassed: event.binary_scan_bypassed }),
        },
      };
    case "invalid_opaque_response_references":
      return {
        ...base,
        outcome: "warning",
        destination: event.destination,
        action: "response_reference_warning",
        correlationId: event.request_id,
        reason: "invalid opaque response references",
        details: {
          warning_count: event.warnings.reduce((total, warning) => total + warning.count, 0),
        },
      };
    case "tool_invocation":
      return {
        ...base,
        outcome: event.outcome,
        action: event.tool,
        ...(event.request_id === undefined ? {} : { correlationId: event.request_id }),
        ...(event.error_code === undefined ? {} : { failureCode: event.error_code }),
        details: {},
      };
    case "self_api_key_blocked":
    case "self_api_key_approved_use":
      return {
        ...base,
        outcome: event.type === "self_api_key_blocked" ? "deny" : "allow",
        destination: event.destination,
        action: event.type,
        method: event.method,
        targetHost: event.target_host,
        targetPath: event.target_path,
        correlationId: event.request_id,
        details: {
          location: event.location,
          ...(event.nickname_snapshot === undefined
            ? {}
            : { nickname_snapshot: event.nickname_snapshot }),
          ...(event.last_four_snapshot === undefined
            ? {}
            : { last_four_snapshot: event.last_four_snapshot }),
          ...(event.management_identity_id === undefined
            ? {}
            : { management_identity_id: event.management_identity_id }),
          ...(event.credential_id === undefined
            ? {}
            : { managed_item_id: event.credential_id }),
        },
      };
  }
}

function parseEventTime(event: AuditEvent): number {
  const text = "request_timestamp" in event ? event.request_timestamp : event.timestamp;
  const occurredAt = Date.parse(text);
  if (!Number.isSafeInteger(occurredAt) || occurredAt < 0) {
    throw new Error("Invalid runtime audit event time.");
  }
  return occurredAt;
}
