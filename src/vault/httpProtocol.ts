import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { vaultError } from "./errors.js";
import type { VaultCaller } from "./protocol.js";

export const VAULT_HTTP_AUDIENCE = "secretsauce-vault";
export const VAULT_HTTP_VERSION = "v1";
export const VAULT_HTTP_MAX_SKEW_MS = 30_000;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const noncePattern = /^[A-Za-z0-9_-]{22}$/;
const macPattern = /^[A-Za-z0-9_-]{43}$/;
const timestampPattern = /^(0|[1-9][0-9]{0,15})$/;
const allowedTargets = /^\/v1\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/;

export interface VaultHttpRequestAuthentication {
  caller: VaultCaller;
  method: string;
  target: string;
  contentType: string;
  body: Uint8Array;
  requestId: string;
  timestamp: string;
  nonce: string;
  bootId?: string;
  representationHeaders?: Readonly<Record<string, string>>;
}

export interface VaultHttpResponseAuthentication {
  caller: VaultCaller;
  bootId: string;
  requestId: string;
  status: number;
  contentType: string;
  body: Uint8Array;
}

export function canonicalVaultTarget(target: string): string {
  if (
    target.length < 1
    || target.length > 2048
    || !allowedTargets.test(target)
    || target.includes("#")
    || /%(?:2[fF]|5[cC]|3[fF]|2[eE])/.test(target)
    || /%[0-9a-fA-F]{2}/.test(target)
    || target.includes("//")
    || target.includes("/./")
    || target.includes("/../")
    || target.endsWith("/.")
    || target.endsWith("/..")
  ) {
    throw vaultError("vault_frame_invalid");
  }
  return target;
}

export function validateVaultHttpRequestFields(
  input: VaultHttpRequestAuthentication,
  now = Date.now(),
): { timestampMs: number } {
  const timestampMs = validateRequestShape(input);
  if (!Number.isSafeInteger(now)) {
    throw vaultError("vault_authentication_failed");
  }
  if (Math.abs(now - timestampMs) > VAULT_HTTP_MAX_SKEW_MS) {
    throw vaultError("vault_request_stale");
  }
  return { timestampMs };
}

function validateRequestShape(
  input: VaultHttpRequestAuthentication,
): number {
  if (
    !["data_plane", "control_plane", "backup"].includes(input.caller)
    || !/^[A-Z]{3,7}$/.test(input.method)
    || !uuidV4Pattern.test(input.requestId)
    || !timestampPattern.test(input.timestamp)
    || !noncePattern.test(input.nonce)
    || Buffer.from(input.nonce, "base64url").toString("base64url") !== input.nonce
    || Buffer.from(input.nonce, "base64url").byteLength !== 16
    || (input.bootId !== undefined && !uuidV4Pattern.test(input.bootId))
  ) {
    throw vaultError("vault_authentication_failed");
  }
  canonicalVaultTarget(input.target);
  const timestampMs = Number(input.timestamp);
  if (!Number.isSafeInteger(timestampMs)) throw vaultError("vault_authentication_failed");
  return timestampMs;
}

export function signVaultHttpRequest(
  input: VaultHttpRequestAuthentication,
  key: Uint8Array,
): string {
  validateRequestShape(input);
  return sign(requestCanonical(input), key);
}

export function verifyVaultHttpRequest(
  input: VaultHttpRequestAuthentication,
  providedMac: string,
  key: Uint8Array,
  now = Date.now(),
): { timestampMs: number } {
  const validated = validateVaultHttpRequestFields(input, now);
  verifyMac(requestCanonical(input), providedMac, key);
  return validated;
}

export function signVaultHttpResponse(
  input: VaultHttpResponseAuthentication,
  key: Uint8Array,
): string {
  validateResponseFields(input);
  return sign(responseCanonical(input), key);
}

export function verifyVaultHttpResponse(
  input: VaultHttpResponseAuthentication,
  providedMac: string,
  key: Uint8Array,
): void {
  validateResponseFields(input);
  verifyMac(responseCanonical(input), providedMac, key);
}

function requestCanonical(input: VaultHttpRequestAuthentication): string {
  const bodyDigest = digest(input.body);
  return [
    "request",
    VAULT_HTTP_AUDIENCE,
    VAULT_HTTP_VERSION,
    input.caller,
    input.method,
    canonicalVaultTarget(input.target),
    normalizedContentType(input.contentType),
    String(input.body.byteLength),
    bodyDigest,
    input.requestId,
    input.timestamp,
    input.nonce,
    input.bootId ?? "",
    canonicalRepresentationHeaders(input.representationHeaders),
  ].join("\n");
}

function responseCanonical(input: VaultHttpResponseAuthentication): string {
  return [
    "response",
    VAULT_HTTP_AUDIENCE,
    VAULT_HTTP_VERSION,
    input.caller,
    input.bootId,
    input.requestId,
    String(input.status),
    normalizedContentType(input.contentType),
    String(input.body.byteLength),
    digest(input.body),
  ].join("\n");
}

function validateResponseFields(input: VaultHttpResponseAuthentication): void {
  if (
    !["data_plane", "control_plane", "backup"].includes(input.caller)
    || !uuidV4Pattern.test(input.bootId)
    || !uuidV4Pattern.test(input.requestId)
    || !Number.isInteger(input.status)
    || input.status < 100
    || input.status > 599
  ) throw vaultError("vault_authentication_failed");
}

function normalizedContentType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 128
    || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
  ) throw vaultError("vault_frame_invalid");
  return normalized;
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalRepresentationHeaders(
  headers: Readonly<Record<string, string>> | undefined,
): string {
  if (headers === undefined) return "";
  return Object.entries(headers)
    .map(([name, value]) => {
      const normalizedName = name.toLowerCase();
      if (
        !/^x-vault-[a-z0-9-]{1,64}$/.test(normalizedName)
        || value.length > 8192
        || /[\r\n]/.test(value)
      ) throw vaultError("vault_frame_invalid");
      return `${normalizedName}:${value}`;
    })
    .sort()
    .join("\n");
}

function sign(canonical: string, key: Uint8Array): string {
  const validated = validatedKey(key);
  try {
    return createHmac("sha256", validated)
      .update("secretsauce:vault-http-auth:v1:")
      .update(canonical)
      .digest("base64url");
  } finally {
    validated.fill(0);
  }
}

function verifyMac(canonical: string, encoded: string, key: Uint8Array): void {
  if (!macPattern.test(encoded)) throw vaultError("vault_authentication_failed");
  const provided = Buffer.from(encoded, "base64url");
  if (provided.toString("base64url") !== encoded) throw vaultError("vault_authentication_failed");
  const expectedEncoded = sign(canonical, key);
  const expected = Buffer.from(expectedEncoded, "base64url");
  try {
    if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) {
      throw vaultError("vault_authentication_failed");
    }
  } finally {
    provided.fill(0);
    expected.fill(0);
  }
}

function validatedKey(value: Uint8Array): Buffer {
  if (value.byteLength !== 32) throw vaultError("vault_key_invalid");
  return Buffer.from(value);
}
