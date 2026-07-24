import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";
import { GatewayError } from "./errors.js";
import { evaluatePolicy } from "./policy.js";
import { getService, resolveDestination } from "./registry.js";
import { audit } from "./audit.js";
import { bodySummary, createLogger, headerNames } from "./logger.js";
import { prohibitedCookieHeaderNames, stripCookieHeaders } from "./cookies.js";
import {
  assertRequestReferencePlacement,
  substituteRequestBodyTokens,
  substituteTokens,
} from "./substitution.js";
import type {
  ResponseSecretTokenRecord,
  RuntimeReferenceBindings,
  TokenRecord,
} from "./tokens.js";
import type { AuthContext, GatewayConfig } from "./types.js";
import {
  assertSafeBinaryBody,
  classifyResponseBody,
  DEFAULT_BINARY_RESPONSE_MAX_BYTES,
  inspectBinaryBody,
  isBinaryMediaType,
  responseMimeType,
} from "./binaryResponse.js";
import { decodeDeclaredBase64Bytes, encodeBase64Bytes } from "./base64Body.js";
import { enforceCredentialHeaderUsage } from "./headerEnforcement.js";
import { acquireServiceRequest } from "./serviceRequestLimiter.js";
import { createRequestId } from "./requestId.js";
import { createRequestDependencies, type RequestDependencies } from "./requestDependencies.js";
import { evaluatePolicySnapshot } from "./policy.js";
import { resolveDestinationTarget } from "./urlValidation.js";
import type {
  CredentialConfig,
  HostMatcherConfig,
  PolicyRuleConfig,
  ServiceConfig,
} from "./types.js";
import type {
  RuntimeSelector,
  RuntimeServiceSnapshot,
} from "./runtimeSnapshots.js";
import { ServiceRequestLimiter } from "./serviceRequestLimiter.js";
import { canonicalJson } from "./vault/canonicalJson.js";
import type { PolicyEvaluationExplanation } from "./policy.js";
import {
  SelfApiKeyProtectionError,
  scanStructuralApiKeyCandidates,
  type ActiveSelfApiKeyMatch,
  type SelfApiKeyLocation,
} from "./selfApiKeyProtection.js";

export interface ServiceRequestInput {
  service: string;
  destination?: string;
  method: string;
  path?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  service_reference?: string;
  reason: string;
}

export interface DownstreamRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  tlsVerify: boolean;
}

export interface ServiceResponse {
  request_id: string;
  status_code: number;
  headers: Record<string, string>;
  body: string | null;
  body_encoding: "utf8" | "mcp_blob";
  body_size_bytes: number;
  body_sha256: string;
  secret_tokenized: boolean;
  secret_tokenization_count: number;
  tls: {
    verify: boolean;
  };
  truncated: boolean;
  binaryBody?: Buffer;
  binaryMimeType?: string;
}

export async function executeServiceRequest(
  config: GatewayConfig,
  auth: AuthContext,
  input: ServiceRequestInput,
  dependencies: RequestDependencies = createRequestDependencies(config),
): Promise<ServiceResponse> {
  if (dependencies.runtimeAuthority !== undefined) {
    return executePersistedServiceRequest(
      config,
      auth,
      input,
      dependencies,
    );
  }
  const logger = createLogger(config.logging);
  validateRequestInput(input);
  const service = getService(config, input.service, auth);
  const target = resolveDestination(config, auth, input.service, input.destination, {
    ...(input.path === undefined ? {} : { path: input.path }),
    ...(input.url === undefined ? {} : { url: input.url }),
  });
  const requestStarted = Date.now();
  const requestId = createRequestId();
  const policy = evaluatePolicy(service, target, input.method);
  if (!policy.allowed) {
    const denial = dependencies.capabilities.denialStore.record({
      subject: auth.subject,
      reason: policy.reason,
      ...(policy.matchedRule === undefined ? {} : { matched_rule: policy.matchedRule }),
      policy_mode: policy.policyMode,
      ...(policy.suggestion === undefined ? {} : { suggestion: policy.suggestion }),
    }, requestId);
    audit({
      type: "service_request",
      request_id: denial.request_id,
      subject: auth.subject,
      service: service.id,
      destination: target.destination.id,
      access_ids: [],
      internal_reference_ids: [],
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      policy_decision: "deny",
      ...(policy.matchedRule === undefined ? {} : { matched_policy_rule: policy.matchedRule }),
      request_timestamp: new Date().toISOString(),
      request_duration_ms: 0,
      tls_verify: target.tls.verify,
      secret_tokenization_count: 0,
      error_code: "policy_denied",
      error_message: policy.reason,
    }, dependencies.auditSink);
    logger.debug("service_request.denied", {
      request_id: denial.request_id,
      subject: auth.subject,
      service: service.id,
      destination: target.destination.id,
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      policy_mode: policy.policyMode,
      matched_policy_rule: policy.matchedRule,
      tls_verify: target.tls.verify,
      error_code: "policy_denied",
    });
    throw new GatewayError("policy_denied", policy.reason, denial.request_id);
  }

  let releaseCapacity: () => void;
  try {
    releaseCapacity = acquireServiceRequest(dependencies.capabilities.serviceRequestLimiter, auth.subject, service.id);
  } catch (error) {
    if (!(error instanceof GatewayError) || error.code !== "capacity_exceeded") throw error;
    audit({
      type: "service_request",
      request_id: requestId,
      subject: auth.subject,
      service: service.id,
      destination: target.destination.id,
      access_ids: [],
      internal_reference_ids: [],
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      policy_decision: "allow",
      ...(policy.matchedRule === undefined ? {} : { matched_policy_rule: policy.matchedRule }),
      request_timestamp: new Date(requestStarted).toISOString(),
      request_duration_ms: Date.now() - requestStarted,
      tls_verify: target.tls.verify,
      secret_tokenization_count: 0,
      error_code: error.code,
      error_message: error.message,
    }, dependencies.auditSink);
    logger.debug("service_request.capacity_rejected", {
      request_id: requestId,
      subject: auth.subject,
      service: service.id,
      destination: target.destination.id,
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      matched_policy_rule: policy.matchedRule,
      error_code: error.code,
    });
    throw new GatewayError(error.code, error.message, requestId);
  }
  try {
  const broker = dependencies.capabilities.tokenBroker;
  const selfTarget = isConfiguredSelfTarget(config, target.url);
  const tokenTarget = { service: service.id, destination: target.destination.id };
  let serviceReferenceRecord: TokenRecord | undefined;
  if (service.credentials.length === 0) {
    if (typeof input.service_reference !== "string" || input.service_reference.length === 0) {
      throw new GatewayError("reference_invalid", "service_reference is required for this service.");
    }
    serviceReferenceRecord = broker.validateServiceReferenceUse(auth, tokenTarget, input.service_reference);
  } else if (input.service_reference !== undefined) {
    throw new GatewayError("reference_invalid", "service_reference is only valid for gateway access references.");
  }
  const callerHeaders = input.headers ?? {};
  rejectCallerControlledHeaders(callerHeaders);
  const requestCookieHeaders = prohibitedCookieHeaderNames(callerHeaders);
  if (requestCookieHeaders.length > 0) {
    logger.warn("service_request.cookie_rejected", {
      direction: "request", service: service.id, destination: target.destination.id, header_types: requestCookieHeaders,
    });
    throw new GatewayError("cookie_not_allowed", "Cookie headers are not allowed in service requests.");
  }
  const query = input.query ?? {};
  if (selfTarget && dependencies.selfApiKeyProtectionPrechecked !== true) {
    const inspectionValues = [
      { value: callerHeaders, location: "header" as const },
      { value: query, location: "query" as const },
      { value: input.body, location: "body" as const },
      ...service.credentials.map(({ secret }) => ({
        value: secret,
        location: "credential" as const,
      })),
    ];
    let matches: ActiveSelfApiKeyMatch[];
    try {
      matches = await activeSelfApiKeyMatches(
        dependencies,
        inspectionValues,
        auth.subject,
      );
    } catch (error) {
      if (
        !(error instanceof GatewayError)
        || error.code !== "self_api_key_denied"
      ) throw error;
      const candidate = scanStructuralApiKeyCandidates(inspectionValues)[0];
      if (candidate !== undefined) {
        recordSelfApiKeyEvent({
          dependencies,
          logger,
          type: "self_api_key_blocked",
          requestId,
          auth,
          serviceId: service.id,
          destinationId: target.destination.id,
          method: input.method,
          target,
          match: {
            location: candidate.location,
            id: candidate.identifier,
          },
        });
      }
      throw new GatewayError(error.code, error.message, requestId);
    }
    if (matches.length > 0) {
      recordSelfApiKeyEvent({
        dependencies,
        logger,
        type: "self_api_key_blocked",
        requestId,
        auth,
        serviceId: service.id,
        destinationId: target.destination.id,
        method: input.method,
        target,
        match: matches[0]!,
      });
      throw new GatewayError(
        "self_api_key_denied",
        "Active SecretSauce API keys require database-backed approval.",
        requestId,
      );
    }
  }
  const headers = enforceCredentialHeaderUsage(
    { headers: callerHeaders, query, body: input.body }, broker, auth, tokenTarget, service, logger,
  );
  const headerSubstitution = substituteTokens(headers, broker, auth, tokenTarget, service);
  const querySubstitution = substituteTokens(query, broker, auth, tokenTarget, service);
  const bodySubstitution = substituteRequestBodyTokens(input.body, headerSubstitution.value, broker, auth, tokenTarget, service);
  const substitutedHeaders = headerSubstitution.value;
  const substitutedQuery = querySubstitution.value;
  const substitutedBody = bodySubstitution.value;
  const tokenRecords = [
    ...(serviceReferenceRecord === undefined ? [] : [serviceReferenceRecord]),
    ...headerSubstitution.records,
    ...querySubstitution.records,
    ...bodySubstitution.records,
  ];
  const credentialUseCount = new Set(
    tokenRecords
      .filter((record) => record.kind === "credential")
      .map((record) => record.credentialId),
  ).size;

  const downstream = buildDownstreamRequest(config, target.url, input.method, substitutedHeaders, substitutedQuery, substitutedBody, target.tls.verify);
  logger.debug("service_request.downstream_ready", {
    subject: auth.subject,
    service: service.id,
    destination: target.destination.id,
    method: input.method.toUpperCase(),
    target_scheme: target.url.protocol.replace(/:$/, ""),
    target_host: target.url.host,
    target_port: target.url.port || defaultPort(target.url.protocol),
    target_path: target.methodPath,
    tls_verify: target.tls.verify,
    matched_policy_rule: policy.matchedRule,
    credential_count: credentialUseCount,
    placeholder_count: new Set(tokenRecords.map((record) => record.id)).size,
    request_shape: {
      header_names: headerNames(callerHeaders),
      query_keys: Object.keys(query).sort(),
      body: bodySummary(input.body),
    },
  });
  const started = Date.now();
  const response = await fetchWithTimeout(downstream, config.limits.timeoutMs, config.limits.maxResponseBodyBytes);
  const cookieFiltered = stripCookieHeaders(Object.fromEntries(response.headers.entries()));
  if (cookieFiltered.removed.length > 0) {
    logger.warn("service_request.cookie_removed", {
      direction: "response", service: service.id, destination: target.destination.id, header_types: cookieFiltered.removed,
    });
  }
  const responseHeaders = cookieFiltered.headers;
  const rawBody = await limitedResponseBytes(response);
  const decodedBody = decodeDeclaredBase64Bytes(responseHeaders, rawBody.body);
  const entityBody = decodedBody ?? rawBody.body;
  const classification = classifyResponseBody(entityBody);
  const matchedPolicyRule = policy.matchedRule === undefined ? undefined : service.policy.rules.find((rule) => rule.id === policy.matchedRule);
  const disabledSecretlintRules = matchedPolicyRule?.secretlint === undefined
    ? new Set<string>()
    : "enabled" in matchedPolicyRule.secretlint
      ? new Set<string>(dependencies.secretRuntime.rules.map((rule) => rule.id))
      : new Set(matchedPolicyRule.secretlint.disabledRuleIds);
  const binaryPolicy = matchedPolicyRule?.binaryResponse ?? { scan: true, maxBytes: DEFAULT_BINARY_RESPONSE_MAX_BYTES };
  const tokenizer = dependencies.secretRuntime.tokenizer;
  let binaryScanBypassed = false;
  let tokenized: Awaited<ReturnType<typeof tokenizer.tokenizeBytes>>;
  if (classification.kind === "binary") {
    if (binaryPolicy.maxBytes !== null && entityBody.byteLength > binaryPolicy.maxBytes) {
      logger.warn("service_request.binary_response_rejected", {
        request_id: requestId,
        service: service.id,
        destination: target.destination.id,
        matched_policy_rule: policy.matchedRule,
        content_type: responseMimeType(responseHeaders),
        response_bytes: entityBody.byteLength,
        binary_max_bytes: binaryPolicy.maxBytes,
        reason: "size_limit",
      });
      throw new GatewayError("response_too_large", "Binary response exceeds its policy size limit.", requestId);
    }
    if (binaryPolicy.scan) {
      const inspection = inspectBinaryBody(entityBody, broker, auth, service);
      if (inspection.ruleIds.length > 0) {
        logger.warn("service_request.binary_response_rejected", {
          request_id: requestId,
          service: service.id,
          destination: target.destination.id,
          matched_policy_rule: policy.matchedRule,
          content_type: responseMimeType(responseHeaders),
          response_bytes: entityBody.byteLength,
          reason: "protected_data",
          rule_ids: inspection.ruleIds,
        });
        assertSafeBinaryBody(inspection, requestId);
      }
    } else {
      binaryScanBypassed = true;
      logger.warn("service_request.binary_scan_bypassed", {
        request_id: requestId,
        service: service.id,
        destination: target.destination.id,
        matched_policy_rule: policy.matchedRule,
        content_type: responseMimeType(responseHeaders),
        response_bytes: entityBody.byteLength,
        reason: "policy_override",
      });
    }
    const headersOnly = await tokenizer.tokenizeHeaders(responseHeaders, auth, service, disabledSecretlintRules);
    tokenized = { ...headersOnly, body: entityBody };
  } else {
    tokenized = await tokenizer.tokenizeBytes(
      { body: entityBody, headers: responseHeaders }, auth, service, disabledSecretlintRules,
    );
  }
  const returnedBody = decodedBody === undefined ? tokenized.body : encodeBase64Bytes(tokenized.body);
  const returnedHeaders = bodyChanged(rawBody.body, returnedBody, rawBody.truncated)
    ? withContentLength(tokenized.headers, returnedBody.byteLength)
    : tokenized.headers;
  const blobResponse = classification.kind === "binary" || isBinaryMediaType(responseHeaders);
  const bodySha256 = createHash("sha256").update(returnedBody).digest("hex");
  audit({
    type: "service_request",
    request_id: requestId,
    subject: auth.subject,
    service: service.id,
    destination: target.destination.id,
    access_ids: [...new Set(tokenRecords.map((record) => record.accessId))],
    internal_reference_ids: [...new Set(tokenRecords.map((record) => record.id))],
    method: input.method.toUpperCase(),
    target_host: target.url.host,
    target_path: target.methodPath,
    policy_decision: "allow",
    ...(policy.matchedRule === undefined ? {} : { matched_policy_rule: policy.matchedRule }),
    downstream_status_code: response.status,
    request_timestamp: new Date(started).toISOString(),
    request_duration_ms: Date.now() - started,
    tls_verify: target.tls.verify,
    secret_tokenization_count: tokenized.secretTokenizationCount,
    credential_use_count: credentialUseCount,
    secret_rule_ids: tokenized.ruleIds,
    response_internal_reference_ids: tokenized.internalRecordIds,
    ...(binaryScanBypassed ? { binary_scan_bypassed: true } : {}),
  }, dependencies.auditSink);
  if (tokenized.warnings.length > 0) {
    audit({
      type: "invalid_opaque_response_references",
      request_id: requestId,
      subject: auth.subject,
      service: service.id,
      destination: target.destination.id,
      warnings: tokenized.warnings,
      timestamp: new Date().toISOString(),
    }, dependencies.auditSink);
  }
  logger.debug("service_request.completed", {
    request_id: requestId,
    subject: auth.subject,
    service: service.id,
    destination: target.destination.id,
    method: input.method.toUpperCase(),
    target_host: target.url.host,
    target_path: target.methodPath,
    status_code: response.status,
    duration_ms: Date.now() - started,
    tls_verify: target.tls.verify,
    secret_tokenized: tokenized.secretTokenized,
    secret_tokenization_count: tokenized.secretTokenizationCount,
    secret_rule_ids: tokenized.ruleIds,
    secret_scan_pool: dependencies.secretRuntime.pool.stats(),
    response_kind: classification.kind,
    response_bytes: returnedBody.byteLength,
    truncated: rawBody.truncated,
  });

  return {
    request_id: requestId,
    status_code: response.status,
    headers: returnedHeaders,
    body: blobResponse ? null : returnedBody.toString("utf8"),
    body_encoding: blobResponse ? "mcp_blob" : "utf8",
    body_size_bytes: returnedBody.byteLength,
    body_sha256: bodySha256,
    secret_tokenized: tokenized.secretTokenized,
    secret_tokenization_count: tokenized.secretTokenizationCount,
    tls: { verify: target.tls.verify },
    truncated: rawBody.truncated,
    ...(blobResponse ? { binaryBody: returnedBody, binaryMimeType: responseMimeType(responseHeaders) } : {}),
  };
  } finally {
    releaseCapacity();
  }
}

async function executePersistedServiceRequest(
  config: GatewayConfig,
  auth: AuthContext,
  input: ServiceRequestInput,
  dependencies: RequestDependencies,
): Promise<ServiceResponse> {
  const logger = createLogger(config.logging);
  validateRequestInput(input);
  const authority = dependencies.runtimeAuthority!;
  const view = await authority.serviceView(auth, input.service);
  const unresolvedService = runtimeServiceConfig(view.snapshot, auth.subject);
  const target = resolveDestinationTarget(
    unresolvedService,
    input.destination,
    {
      ...(input.path === undefined ? {} : { path: input.path }),
      ...(input.url === undefined ? {} : { url: input.url }),
    },
  );
  const tokenTarget = {
    service: view.snapshot.service.slug,
    destination: target.destination.id,
  };
  const requestStarted = Date.now();
  const requestId = createRequestId();
  const broker = dependencies.capabilities.tokenBroker;
  const callerHeaders = input.headers ?? {};
  rejectCallerControlledHeaders(callerHeaders);
  if (prohibitedCookieHeaderNames(callerHeaders).length > 0) {
    throw new GatewayError(
      "cookie_not_allowed",
      "Cookie headers are not allowed in service requests.",
    );
  }
  assertRawRequestBound(input.body, input.method, config.limits.maxRequestBodyBytes);
  assertRequestReferencePlacement(
    callerHeaders,
    input.query ?? {},
    input.body,
  );
  const records: Array<TokenRecord | ResponseSecretTokenRecord> = [];
  if (view.snapshot.credentials.length === 0) {
    if (
      typeof input.service_reference !== "string"
      || input.service_reference.length === 0
    ) {
      throw new GatewayError(
        "reference_invalid",
        "service_reference is required for this service.",
      );
    }
    const record = broker.preflightTokenUse(
      auth,
      tokenTarget,
      input.service_reference,
    );
    if (record.kind !== "service") {
      throw new GatewayError(
        "reference_invalid",
        "Gateway reference is not a service reference.",
      );
    }
    records.push(record);
  } else if (input.service_reference !== undefined) {
    throw new GatewayError(
      "reference_invalid",
      "service_reference is only valid for gateway access references.",
    );
  }
  for (const token of configuredReferences([
    input.headers,
    input.query,
    input.body,
  ])) {
    if (token.startsWith("sec_")) {
      records.push(broker.preflightResponseSecretUse(
        auth,
        view.snapshot.service.slug,
        token,
      ));
      continue;
    }
    const record = broker.preflightTokenUse(auth, tokenTarget, token);
    if (record.kind !== "credential" || record.credentialId === undefined) {
      throw new GatewayError(
        "reference_invalid",
        "Service references cannot be substituted into downstream requests.",
      );
    }
    records.push(record);
  }
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  const consistentView = await authority.validateReferences(
    auth,
    view.snapshot.service.slug,
    target.destination.id,
    uniqueRecords,
  );
  const preflightHeaders = enforceCredentialHeaderUsage(
    {
      headers: callerHeaders,
      query: input.query ?? {},
      body: input.body,
    },
    broker,
    auth,
    tokenTarget,
    unresolvedService,
    createLogger(config.logging),
  );
  const credentialIds = [...new Set(uniqueRecords.flatMap((record) =>
    !("kind" in record) || record.credentialId === undefined
      ? []
      : [record.credentialId]))];
  const explanation = evaluateRuntimePolicy(
    consistentView.snapshot,
    consistentView.subject.id,
    consistentView.subject.groupIds,
    input.method,
    target.url.hostname,
    target.methodPath,
    credentialIds,
  );
  if (!explanation.allowed) {
    const decisive = explanation.boundaries.find(({ allowed }) => !allowed);
    const denial = dependencies.capabilities.denialStore.record({
      subject: auth.subject,
      reason: "Denied by persisted service or credential policy.",
      ...(decisive?.decisiveRuleId === undefined
        ? {}
        : { matched_rule: decisive.decisiveRuleId }),
      policy_mode: decisive?.mode ?? "deny",
      suggestion: "Use an allowed request or ask the user to update service policy.",
    }, requestId);
    audit({
      type: "service_request",
      request_id: denial.request_id,
      subject: auth.subject,
      service: consistentView.snapshot.service.id,
      destination: runtimeDestinationId(
        consistentView.snapshot,
        target.destination.id,
      ),
      access_ids: credentialIds,
      internal_reference_ids: uniqueRecords.map(({ id }) => id),
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      policy_decision: "deny",
      ...(decisive?.decisiveRuleId === undefined
        ? {}
        : { matched_policy_rule: decisive.decisiveRuleId }),
      request_timestamp: new Date(requestStarted).toISOString(),
      request_duration_ms: Date.now() - requestStarted,
      tls_verify: target.tls.verify,
      secret_tokenization_count: 0,
      error_code: "policy_denied",
      error_message: "Denied by persisted service or credential policy.",
    }, dependencies.auditSink);
    throw new GatewayError(
      "policy_denied",
      "Denied by persisted service or credential policy.",
      denial.request_id,
    );
  }
  const responseSafeguards = runtimeResponseSafeguards(
    consistentView.snapshot,
    explanation,
  );
  const selfTarget = isConfiguredSelfTarget(config, target.url);
  let release: () => void;
  try {
    release = acquireServiceRequest(
      dependencies.capabilities.serviceRequestLimiter,
      auth.subject,
      consistentView.snapshot.service.id,
    );
  } catch (error) {
    if (!(error instanceof GatewayError) || error.code !== "capacity_exceeded") {
      throw error;
    }
    audit({
      type: "service_request",
      request_id: requestId,
      subject: auth.subject,
      service: consistentView.snapshot.service.id,
      destination: runtimeDestinationId(
        consistentView.snapshot,
        target.destination.id,
      ),
      access_ids: credentialIds,
      internal_reference_ids: uniqueRecords.map(({ id }) => id),
      method: input.method.toUpperCase(),
      target_host: target.url.hostname,
      target_path: target.methodPath,
      policy_decision: "allow",
      request_timestamp: new Date(requestStarted).toISOString(),
      request_duration_ms: Date.now() - requestStarted,
      tls_verify: target.tls.verify,
      secret_tokenization_count: 0,
      error_code: error.code,
      error_message: error.message,
    }, dependencies.auditSink);
    throw error;
  }
  try {
    if (selfTarget) {
      const matches = await activeSelfApiKeyMatches(
        dependencies,
        [
          { value: callerHeaders, location: "header" },
          { value: input.query ?? {}, location: "query" },
          { value: input.body, location: "body" },
        ],
        auth.subject,
      );
      if (matches.length > 0) {
        recordSelfApiKeyEvent({
          dependencies,
          logger,
          type: "self_api_key_blocked",
          requestId,
          auth,
          serviceId: consistentView.snapshot.service.id,
          destinationId: runtimeDestinationId(
            consistentView.snapshot,
            target.destination.id,
          ),
          method: input.method,
          target,
          match: matches[0]!,
        });
        throw new GatewayError(
          "self_api_key_denied",
          "Active SecretSauce API keys require an approved credential reference.",
          requestId,
        );
      }
    }
    for (const record of uniqueRecords) {
      if ("kind" in record) {
        broker.consumePreflightedToken(record);
      } else {
        broker.consumePreflightedResponseSecret(record);
      }
    }
    const credentials = credentialIds.map((credentialId) => {
      const credential = consistentView.snapshot.credentials.find(
        ({ id }) => id === credentialId,
      );
      if (
        credential === undefined
        || credential.locator === undefined
        || credential.generation === undefined
      ) {
        throw new GatewayError(
          "reference_invalid",
          "Gateway credential reference is unavailable.",
        );
      }
      return credential;
    });
    if (credentials.length > 0 && dependencies.runtimeVault === undefined) {
      throw new GatewayError("config_error", "Runtime vault is unavailable.");
    }
    const operationDigest = createHash("sha256")
      .update(canonicalJson({
        subjectId: auth.subject,
        serviceId: consistentView.snapshot.service.id,
        destinationId: target.destination.id,
        method: input.method.toUpperCase(),
        pathname: target.methodPath,
        credentialIds,
      }), "utf8")
      .digest("hex");
    const resolved = new Map<string, string>();
    const execute = async (index: number): Promise<ServiceResponse> => {
      const credential = credentials[index];
      if (credential === undefined) {
        const service = runtimeServiceConfig(
          consistentView.snapshot,
          auth.subject,
          resolved,
          responseSafeguards,
        );
        const nestedConfig: GatewayConfig = {
          ...config,
          runtime: { authority: "yaml" },
          services: { [service.id]: service },
        };
        const nestedDependencies: RequestDependencies = {
          auditSink: dependencies.auditSink,
          secretRuntime: dependencies.secretRuntime,
          selfApiKeyProtectionPrechecked: true,
          capabilities: {
            ...dependencies.capabilities,
            serviceRequestLimiter: new ServiceRequestLimiter(
              Number.MAX_SAFE_INTEGER,
              Number.MAX_SAFE_INTEGER,
              Number.MAX_SAFE_INTEGER,
            ),
          },
        };
        const bindings: RuntimeReferenceBindings = {
          serviceId: consistentView.snapshot.service.id,
          destination: target.destination.id,
          destinationId: runtimeDestinationId(
            consistentView.snapshot,
            target.destination.id,
          ),
          snapshotId: consistentView.snapshot.id,
          publicationGeneration:
            consistentView.snapshot.service.publicationGeneration,
          serviceAuthorizationGeneration:
            consistentView.snapshot.serviceAuthorizationGeneration,
          subjectSecurityEpoch: consistentView.subject.securityEpoch,
          globalReferenceEpoch: uniqueRecords[0]?.globalReferenceEpoch ?? 0,
        };
        return await broker.withRuntimeSecrets(
          auth,
          service.id,
          resolved,
          () => executeServiceRequest(
            nestedConfig,
            auth,
            {
              ...input,
              service: service.id,
              destination: target.destination.id,
              headers: preflightHeaders,
            },
            nestedDependencies,
          ),
          bindings,
        );
      }
      return dependencies.runtimeVault!.resolve({
        subjectId: consistentView.subject.id,
        grantEpoch: uniqueRecords[0]?.globalReferenceEpoch ?? 0,
        securityEpoch: consistentView.subject.securityEpoch,
        serviceId: consistentView.snapshot.service.id,
        destinationId: runtimeDestinationId(
          consistentView.snapshot,
          target.destination.id,
        ),
        credentialId: credential.id,
        locator: credential.locator!,
        generation: credential.generation!,
        method: input.method.toUpperCase() as
          "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT",
        canonicalPath: target.methodPath,
        requestId,
        operationDigest,
      }, async (secret) => {
        if (selfTarget) {
          const matches = await activeSelfApiKeyMatches(
            dependencies,
            [{ value: secret.toString("utf8"), location: "credential" }],
            auth.subject,
          );
          for (const match of matches) {
            const approval = await authority.validateSelfApiKeyApproval({
              serviceId: consistentView.snapshot.service.id,
              credentialId: credential.id,
              vaultGeneration: credential.generation!,
              apiKeyId: match.id,
            });
            if (approval === undefined) {
              recordSelfApiKeyEvent({
                dependencies,
                logger,
                type: "self_api_key_blocked",
                requestId,
                auth,
                serviceId: consistentView.snapshot.service.id,
                destinationId: runtimeDestinationId(
                  consistentView.snapshot,
                  target.destination.id,
                ),
                method: input.method,
                target,
                match,
                credentialId: credential.id,
              });
              throw new GatewayError(
                "self_api_key_denied",
                "Active SecretSauce API keys require an approved credential reference.",
                requestId,
              );
            }
            recordSelfApiKeyEvent({
              dependencies,
              logger,
              type: "self_api_key_approved_use",
              requestId,
              auth,
              serviceId: consistentView.snapshot.service.id,
              destinationId: runtimeDestinationId(
                consistentView.snapshot,
                target.destination.id,
              ),
              method: input.method,
              target,
              match: {
                ...match,
                nickname: approval.nickname,
                lastFour: approval.lastFour,
              },
              credentialId: credential.id,
            });
          }
        }
        resolved.set(credential.id, secret.toString("utf8"));
        try {
          return await execute(index + 1);
        } finally {
          resolved.delete(credential.id);
        }
      });
    };
    try {
      return await execute(0);
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError("downstream_error", "Runtime vault operation failed.");
    }
  } finally {
    release();
  }
}

async function activeSelfApiKeyMatches(
  dependencies: RequestDependencies,
  values: readonly { value: unknown; location: SelfApiKeyLocation }[],
  subject: string,
): Promise<ActiveSelfApiKeyMatch[]> {
  let recognizable: ReturnType<typeof scanStructuralApiKeyCandidates>;
  try {
    recognizable = scanStructuralApiKeyCandidates(values);
  } catch (error) {
    if (error instanceof SelfApiKeyProtectionError) {
      throw new GatewayError(
        "self_api_key_denied",
        "Self API key inspection could not complete.",
      );
    }
    throw error;
  }
  if (recognizable.length === 0) return [];
  if (dependencies.selfApiKeyDetector === undefined) {
    throw new GatewayError(
      "self_api_key_denied",
      "Self API key inspection is unavailable.",
    );
  }
  try {
    const detector = await dependencies.selfApiKeyDetector;
    return await detector.inspect(values, {
      principal: subject,
      source: "mcp:runtime",
    });
  } catch (error) {
    if (error instanceof SelfApiKeyProtectionError) {
      throw new GatewayError(
        "self_api_key_denied",
        "Self API key inspection could not complete.",
      );
    }
    throw error;
  }
}

function recordSelfApiKeyEvent(input: {
  dependencies: RequestDependencies;
  logger: ReturnType<typeof createLogger>;
  type: "self_api_key_blocked" | "self_api_key_approved_use";
  requestId: string;
  auth: AuthContext;
  serviceId: string;
  destinationId: string;
  method: string;
  target: ReturnType<typeof resolveDestinationTarget>;
  match: {
    location: SelfApiKeyLocation;
    id?: string;
    nickname?: string;
    lastFour?: string;
  };
  credentialId?: string;
}): void {
  const event = {
    type: input.type,
    request_id: input.requestId,
    subject: input.auth.subject,
    service: input.serviceId,
    destination: input.destinationId,
    method: input.method.toUpperCase(),
    target_host: input.target.url.hostname,
    target_path: input.target.methodPath,
    location: input.match.location,
    ...(input.match.id === undefined
      ? {}
      : { management_identity_id: input.match.id }),
    ...(input.match.nickname === undefined
      ? {}
      : { nickname_snapshot: input.match.nickname }),
    ...(input.match.lastFour === undefined
      ? {}
      : { last_four_snapshot: input.match.lastFour }),
    ...(input.credentialId === undefined
      ? {}
      : { credential_id: input.credentialId }),
    timestamp: new Date().toISOString(),
  } as const;
  audit(event, input.dependencies.auditSink);
  input.logger.warn(input.type, {
    request_id: input.requestId,
    subject: input.auth.subject,
    service: input.serviceId,
    destination: input.destinationId,
    method: input.method.toUpperCase(),
    target_host: input.target.url.hostname,
    target_path: input.target.methodPath,
    location: input.match.location,
    ...(input.match.id === undefined
      ? {}
      : { management_identity_id: input.match.id }),
    ...(input.match.nickname === undefined
      ? {}
      : { nickname_snapshot: input.match.nickname }),
    ...(input.match.lastFour === undefined
      ? {}
      : { last_four_snapshot: input.match.lastFour }),
    ...(input.credentialId === undefined
      ? {}
      : { credential_id: input.credentialId }),
  });
}

export function configuredSelfOrigins(config: GatewayConfig): ReadonlySet<string> {
  const values = [
    config.control?.publicOrigin,
    config.server.resource,
    ...(config.auth.mode === "builtin_oauth"
      ? [config.auth.builtinOAuth.issuer]
      : []),
  ];
  return new Set(values.flatMap((value) => {
    if (value === undefined) return [];
    try {
      return [new URL(value).origin];
    } catch {
      return [];
    }
  }));
}

export function isConfiguredSelfTarget(
  config: GatewayConfig,
  target: URL,
): boolean {
  return configuredSelfOrigins(config).has(target.origin);
}

function assertRawRequestBound(
  body: unknown,
  method: string,
  maximum: number,
): void {
  if (
    body === undefined
    || method.toUpperCase() === "GET"
    || method.toUpperCase() === "HEAD"
  ) return;
  let encoded: string;
  try {
    encoded = typeof body === "string" ? body : JSON.stringify(body);
  } catch {
    throw new GatewayError("destination_not_allowed", "Request body is invalid.");
  }
  if (Buffer.byteLength(encoded, "utf8") > maximum) {
    throw new GatewayError("request_too_large", "Request body is too large.");
  }
}

function configuredReferences(values: unknown[]): string[] {
  const references = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/(?:gref|sec)_[A-Za-z0-9_-]+/g)) {
        references.add(match[0]);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        visit(key);
        visit(item);
      }
    }
  };
  for (const value of values) visit(value);
  return [...references];
}

function evaluateRuntimePolicy(
  snapshot: RuntimeServiceSnapshot,
  subjectId: string,
  groupIds: string[],
  method: string,
  host: string,
  pathname: string,
  credentialIds: string[],
) {
  const servicePolicy = snapshot.policies.find(
    ({ credentialId }) => credentialId === undefined,
  );
  const boundary = (
    policy: RuntimeServiceSnapshot["policies"][number] | undefined,
    kind: "service" | "credential",
    id: string,
  ) => ({
    id: policy?.id ?? id,
    kind,
    mode: policy?.mode ?? "deny" as const,
    assignmentAllowed: true,
    rules: (policy?.rules ?? []).map((rule) => ({
      id: rule.id,
      effect: rule.effect,
      priority: rule.priority,
      enabled: rule.enabled,
      methods: rule.methods,
      hosts: rule.hosts as import("./policyMatchers.js").PolicyHostMatcher[],
      paths: rule.paths as import("./policyMatchers.js").PolicyPathMatcher[],
      selector: policySelector(rule.selector),
      ...(rule.reason === undefined ? {} : { reason: rule.reason }),
    })),
  });
  return evaluatePolicySnapshot({
    subjectId,
    groupIds,
    method,
    host,
    pathname,
    service: boundary(servicePolicy, "service", snapshot.service.id),
    credentials: credentialIds.map((credentialId) => boundary(
      snapshot.policies.find((policy) => policy.credentialId === credentialId),
      "credential",
      credentialId,
    )),
  });
}

function policySelector(selector: RuntimeSelector | undefined) {
  if (selector?.kind === "all") return { kind: "all" as const };
  return {
    kind: "principals" as const,
    groupIds: selector?.groupIds ?? [],
    userIds: selector?.userIds ?? [],
  };
}

function runtimeServiceConfig(
  snapshot: RuntimeServiceSnapshot,
  subject: string,
  secrets: ReadonlyMap<string, string> = new Map(),
  responseSafeguards?: Pick<
    PolicyRuleConfig,
    "secretlint" | "binaryResponse"
  >,
): ServiceConfig {
  return {
    id: snapshot.service.slug,
    type: "http",
    name: snapshot.service.name,
    ...(snapshot.service.description === undefined
      ? {}
      : { description: snapshot.service.description }),
    ...(snapshot.service.documentationUrl === undefined
      ? {}
      : { apiDocsUrl: snapshot.service.documentationUrl }),
    destinations: snapshot.destinations.map((destination) => ({
      id: destination.slug,
      baseUrl: destination.baseUrl,
      schemes: [...destination.schemes],
      hosts: destination.hosts.map(runtimeHostMatcher),
      ports: [...destination.ports],
      tls: { verify: destination.tlsVerify },
    })),
    credentials: snapshot.credentials.map((credential): CredentialConfig => ({
      id: credential.id,
      usage: {
        kind: credential.usage.kind,
        name: credential.usage.name,
        ...(credential.usage.prefix === undefined
          ? {}
          : { prefix: credential.usage.prefix }),
        ...(credential.usage.suffix === undefined
          ? {}
          : { suffix: credential.usage.suffix }),
        enforce: credential.usage.enforceHeaderOwnership,
      },
      source: { kind: "env", name: "RUNTIME_VAULT" },
      secret: secrets.get(credential.id) ?? "",
    })),
    tls: { verify: true },
    access: { users: [subject] },
    policy: {
      mode: "allow",
      rules: responseSafeguards === undefined
        ? []
        : [{
            id: "persisted-response-safeguards",
            effect: "allow",
            priority: 1,
            methods: [],
            hosts: [],
            paths: [],
            ...responseSafeguards,
          }],
    },
  };
}

function runtimeResponseSafeguards(
  snapshot: RuntimeServiceSnapshot,
  explanation: PolicyEvaluationExplanation,
): Pick<PolicyRuleConfig, "secretlint" | "binaryResponse"> {
  const selected = explanation.boundaries.flatMap((boundary) => {
    if (boundary.selectedRuleIds.length === 0) return [defaultSafeguards()];
    return boundary.selectedRuleIds.map((ruleId) => {
      const rule = snapshot.policies
        .flatMap((policy) => policy.rules)
        .find(({ id }) => id === ruleId);
      if (rule === undefined) {
        throw new GatewayError("config_error", "Selected runtime policy rule is unavailable.");
      }
      return parseRuntimeSafeguards(rule.responseSafeguards);
    });
  });
  const safeguards = selected.length === 0 ? [defaultSafeguards()] : selected;
  const enabledSecretlint = safeguards.filter(
    ({ secretlint }) => secretlint.enabled,
  );
  const disabledRuleIds = enabledSecretlint.length === 0
    ? []
    : enabledSecretlint
      .map(({ secretlint }) => new Set(secretlint.disabledRuleIds))
      .reduce((intersection, disabled) =>
        new Set([...intersection].filter((id) => disabled.has(id))));
  const maximums = safeguards
    .map(({ binaryResponse }) => binaryResponse.maxBytes)
    .filter((value): value is number => value !== null);
  return {
    secretlint: enabledSecretlint.length === 0
      ? { enabled: false }
      : { disabledRuleIds: [...disabledRuleIds].sort() },
    binaryResponse: {
      scan: safeguards.some(({ binaryResponse }) => binaryResponse.scan),
      maxBytes: maximums.length === 0 ? null : Math.min(...maximums),
    },
  };
}

function parseRuntimeSafeguards(value: unknown): RuntimeSafeguards {
  if (!value || typeof value !== "object") {
    throw new GatewayError("config_error", "Runtime response safeguards are invalid.");
  }
  const candidate = value as {
    secretlint?: { enabled?: unknown; disabledRuleIds?: unknown };
    binaryResponse?: { scan?: unknown; maxBytes?: unknown };
  };
  if (
    typeof candidate.secretlint?.enabled !== "boolean"
    || !Array.isArray(candidate.secretlint.disabledRuleIds)
    || candidate.secretlint.disabledRuleIds.some(
      (id) => typeof id !== "string",
    )
    || typeof candidate.binaryResponse?.scan !== "boolean"
    || (
      candidate.binaryResponse.maxBytes !== null
      && (
        !Number.isSafeInteger(candidate.binaryResponse.maxBytes)
        || Number(candidate.binaryResponse.maxBytes) < 1
      )
    )
  ) {
    throw new GatewayError("config_error", "Runtime response safeguards are invalid.");
  }
  return {
    secretlint: {
      enabled: candidate.secretlint.enabled,
      disabledRuleIds: [...new Set(
        candidate.secretlint.disabledRuleIds as string[],
      )].sort(),
    },
    binaryResponse: {
      scan: candidate.binaryResponse.scan,
      maxBytes: candidate.binaryResponse.maxBytes as number | null,
    },
  };
}

interface RuntimeSafeguards {
  secretlint: {
    enabled: boolean;
    disabledRuleIds: string[];
  };
  binaryResponse: {
    scan: boolean;
    maxBytes: number | null;
  };
}

function defaultSafeguards(): RuntimeSafeguards {
  return {
    secretlint: { enabled: true, disabledRuleIds: [] },
    binaryResponse: {
      scan: true,
      maxBytes: DEFAULT_BINARY_RESPONSE_MAX_BYTES,
    },
  };
}

function runtimeHostMatcher(value: unknown): HostMatcherConfig {
  if (!value || typeof value !== "object") {
    throw new GatewayError("config_error", "Runtime destination matcher is invalid.");
  }
  const matcher = value as { type?: unknown; value?: unknown };
  if (
    (matcher.type !== "exact"
      && matcher.type !== "suffix"
      && matcher.type !== "regex")
    || typeof matcher.value !== "string"
  ) {
    throw new GatewayError("config_error", "Runtime destination matcher is invalid.");
  }
  if (matcher.type === "regex") {
    return { type: "regex", value: matcher.value, regex: new RegExp(matcher.value) };
  }
  return { type: matcher.type, value: matcher.value };
}

function runtimeDestinationId(
  snapshot: RuntimeServiceSnapshot,
  slug: string,
): string {
  const destination = snapshot.destinations.find(
    (candidate) => candidate.slug === slug,
  );
  if (destination === undefined) {
    throw new GatewayError("config_error", "Runtime destination is unavailable.");
  }
  return destination.id;
}

function validateRequestInput(input: ServiceRequestInput): void {
  if (!input.reason.trim()) throw new GatewayError("policy_denied", "service_request reason is required.");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(input.method.toUpperCase())) {
    throw new GatewayError("destination_not_allowed", `Unsupported method: ${input.method}`);
  }
}

function buildDownstreamRequest(
  config: GatewayConfig,
  url: URL,
  method: string,
  headers: Record<string, string>,
  query: Record<string, unknown>,
  body: unknown,
  tlsVerify: boolean,
): DownstreamRequest {
  const targetUrl = new URL(url.href);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    targetUrl.searchParams.set(key, String(value));
  }

  const requestHeaders = { ...headers };
  removeHeader(requestHeaders, "transfer-encoding");
  removeHeader(requestHeaders, "content-length");
  requestHeaders["host"] = targetUrl.host;
  let requestBody: string | undefined;
  if (body !== undefined && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
    if (typeof body === "string") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!hasHeader(requestHeaders, "content-type")) requestHeaders["content-type"] = "application/json";
    }
    if (Buffer.byteLength(requestBody) > config.limits.maxRequestBodyBytes) {
      throw new GatewayError("request_too_large", "Request body is too large.");
    }
    requestHeaders["content-length"] = String(Buffer.byteLength(requestBody));
  }

  return {
    url: targetUrl.href,
    method: method.toUpperCase(),
    headers: requestHeaders,
    ...(requestBody === undefined ? {} : { body: requestBody }),
    tlsVerify,
  };
}

const CALLER_CONTROLLED_AUTHORITY_HEADERS = new Set([
  "host",
  ":authority",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
]);

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function rejectCallerControlledHeaders(headers: Record<string, string>): void {
  for (const name of Object.keys(headers)) {
    const normalized = name.toLowerCase();
    if (CALLER_CONTROLLED_AUTHORITY_HEADERS.has(normalized) || normalized.startsWith("x-forwarded-")) {
      throw new GatewayError("destination_not_allowed", `Caller-supplied ${name} header is not allowed.`);
    }
    if (HOP_BY_HOP_HEADERS.has(normalized)) {
      if (normalized === "transfer-encoding") {
        throw new GatewayError("unsupported_transfer_encoding", "Caller-supplied Transfer-Encoding is not allowed.");
      }
      throw new GatewayError("destination_not_allowed", `Caller-supplied ${name} header is not allowed.`);
    }
  }
}

async function fetchWithTimeout(downstream: DownstreamRequest, timeoutMs: number, maxResponseBytes: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await sendDownstreamRequest(downstream, controller.signal, maxResponseBytes);
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (isAbortError(error)) {
      throw new GatewayError("downstream_timeout", "Downstream request timed out.");
    }
    if (isTlsError(error)) {
      throw new GatewayError("tls_error", "Downstream TLS verification failed.");
    }
    throw new GatewayError("downstream_error", downstreamErrorMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function sendDownstreamRequest(downstream: DownstreamRequest, signal: AbortSignal, maxResponseBytes: number): Promise<Response> {
  const url = new URL(downstream.url);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return await new Promise<Response>((resolve, reject) => {
    const req = request(url, {
      method: downstream.method,
      headers: downstream.headers,
      signal,
      ...(url.protocol === "https:" ? { rejectUnauthorized: downstream.tlsVerify } : {}),
    }, (res) => {
      const declaredLength = res.headers["content-length"];
      if (declaredLength !== undefined && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxResponseBytes) {
        const error = new GatewayError("response_too_large", "Downstream response is too large.");
        res.destroy(error);
        reject(error);
        return;
      }
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let settled = false;
      res.on("data", (chunk) => {
        if (settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += bytes.byteLength;
        if (totalBytes > maxResponseBytes) {
          settled = true;
          const error = new GatewayError("response_too_large", "Downstream response is too large.");
          res.destroy(error);
          req.destroy();
          reject(error);
          return;
        }
        chunks.push(bytes);
      });
      res.on("error", (error) => {
        if (!settled) reject(error);
      });
      res.on("end", () => {
        if (settled) return;
        settled = true;
        resolve(new Response(Buffer.concat(chunks), {
          status: res.statusCode ?? 0,
          headers: responseHeaders(res.headers),
        }));
      });
    });
    req.on("error", reject);
    if (downstream.body !== undefined) req.write(downstream.body);
    req.end();
  });
}

function responseHeaders(headers: Record<string, string | string[] | number | undefined>): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    } else {
      result.set(key, String(value));
    }
  }
  return result;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || readErrorCode(error) === "ABORT_ERR");
}

function isTlsError(error: unknown): boolean {
  const code = readErrorCode(error);
  return code === "DEPTH_ZERO_SELF_SIGNED_CERT"
    || code === "SELF_SIGNED_CERT_IN_CHAIN"
    || code === "CERT_HAS_EXPIRED"
    || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    || code === "ERR_TLS_CERT_ALTNAME_INVALID";
}

function downstreamErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  if (code === "ECONNREFUSED") return "Downstream connection was refused.";
  if (code === "ENETUNREACH") return "Downstream network is unreachable.";
  if (code === "EHOSTUNREACH") return "Downstream host is unreachable.";
  if (code === "ECONNRESET") return "Downstream connection was reset.";
  return "Downstream request failed.";
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function limitedResponseBytes(response: Response): Promise<{ body: Buffer; truncated: false }> {
  return { body: Buffer.from(await response.arrayBuffer()), truncated: false };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function removeHeader(headers: Record<string, string>, name: string): void {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) delete headers[key];
  }
}

function withContentLength(headers: Record<string, string>, length: number): Record<string, string> {
  const normalized = { ...headers };
  removeHeader(normalized, "content-length");
  normalized["content-length"] = String(length);
  return normalized;
}

function bodyChanged(before: Buffer, after: Buffer, truncated: boolean): boolean {
  return truncated || !before.equals(after);
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}
