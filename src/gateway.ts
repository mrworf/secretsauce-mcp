import { GatewayError } from "./errors.js";
import { evaluatePolicy } from "./policy.js";
import { getService, resolveDestination } from "./registry.js";
import { substituteTokens } from "./substitution.js";
import { getTokenBroker } from "./tokens.js";
import type { AuthContext, GatewayConfig } from "./types.js";

export interface ServiceRequestInput {
  service: string;
  destination?: string;
  method: string;
  path?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  reason: string;
}

export interface DownstreamRequest {
  url: string;
  init: RequestInit;
}

export interface ServiceResponse {
  request_id: string;
  status_code: number;
  headers: Record<string, string>;
  body: string;
  redacted: boolean;
  redaction_count: number;
  tls: {
    verify: boolean;
  };
  truncated: boolean;
}

export async function executeServiceRequest(
  config: GatewayConfig,
  auth: AuthContext,
  input: ServiceRequestInput,
): Promise<ServiceResponse> {
  validateRequestInput(input);
  const service = getService(config, input.service, auth);
  const target = resolveDestination(config, auth, input.service, input.destination, {
    ...(input.path === undefined ? {} : { path: input.path }),
    ...(input.url === undefined ? {} : { url: input.url }),
  });
  const policy = evaluatePolicy(service, target, input.method);
  if (!policy.allowed) throw new GatewayError("policy_denied", policy.reason);

  const broker = getTokenBroker(config);
  const tokenTarget = { service: service.id, destination: target.destination.id };
  const headers = input.headers ?? {};
  const substitutedHeaders = substituteTokens(headers, broker, auth, tokenTarget, service).value;
  const substitutedQuery = substituteTokens(input.query ?? {}, broker, auth, tokenTarget, service).value;
  const substitutedBody = substituteTokens(input.body, broker, auth, tokenTarget, service).value;

  const downstream = buildDownstreamRequest(config, target.url, input.method, substitutedHeaders, substitutedQuery, substitutedBody);
  const started = Date.now();
  const response = await fetchWithTimeout(downstream.url, downstream.init, config.limits.timeoutMs);
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const rawBody = await limitedResponseText(response, config.limits.maxResponseBodyBytes);
  const redacted = redactExact(rawBody.body, responseHeaders, service.credentials.map((credential) => credential.secret));

  return {
    request_id: `req_${started}`,
    status_code: response.status,
    headers: redacted.headers,
    body: redacted.body,
    redacted: redacted.count > 0,
    redaction_count: redacted.count,
    tls: { verify: target.tls.verify },
    truncated: rawBody.truncated,
  };
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
): DownstreamRequest {
  const targetUrl = new URL(url.href);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    targetUrl.searchParams.set(key, String(value));
  }

  const requestHeaders = { ...headers };
  let requestBody: string | undefined;
  if (body !== undefined && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
    if (typeof body === "string") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!hasHeader(requestHeaders, "content-type")) requestHeaders["content-type"] = "application/json";
    }
    if (Buffer.byteLength(requestBody) > config.limits.maxRequestBodyBytes) {
      throw new GatewayError("response_too_large", "Request body is too large.");
    }
  }

  return {
    url: targetUrl.href,
    init: {
      method: method.toUpperCase(),
      headers: requestHeaders,
      redirect: "manual",
      ...(requestBody === undefined ? {} : { body: requestBody }),
    },
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("downstream_timeout", "Downstream request timed out.");
    }
    throw new GatewayError("downstream_error", "Downstream request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

async function limitedResponseText(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  const text = await response.text();
  if (Buffer.byteLength(text) <= maxBytes) return { body: text, truncated: false };
  return { body: text.slice(0, maxBytes), truncated: true };
}

function redactExact(body: string, headers: Record<string, string>, secrets: string[]): { body: string; headers: Record<string, string>; count: number } {
  let count = 0;
  let nextBody = body;
  const nextHeaders = { ...headers };
  for (const secret of secrets.filter(Boolean)) {
    const escaped = JSON.stringify(secret).slice(1, -1);
    for (const value of [secret, escaped]) {
      for (const key of Object.keys(nextHeaders)) {
        const replaced = nextHeaders[key]?.split(value).join("[REDACTED]");
        if (replaced !== undefined && replaced !== nextHeaders[key]) {
          count += (nextHeaders[key]?.split(value).length ?? 1) - 1;
          nextHeaders[key] = replaced;
        }
      }
      const parts = nextBody.split(value);
      if (parts.length > 1) {
        count += parts.length - 1;
        nextBody = parts.join("[REDACTED]");
      }
    }
  }
  return { body: nextBody, headers: nextHeaders, count };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}
