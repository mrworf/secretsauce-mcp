import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { canonicalControlJson } from "./control/idempotency.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { DestinationConfig, HostMatcherConfig } from "./types.js";
import { normalizeHost } from "./urlValidation.js";

export const SERVICE_SLUG = /^[a-z][a-z0-9-]{0,63}$/;

export interface ServiceProfileInput {
  slug: string;
  name: string;
  description?: string;
  documentationUrl?: string;
}

export interface ServiceDestinationInput {
  slug: string;
  baseUrl: string;
  schemes: Array<"http" | "https">;
  hosts: Array<
    | { type: "exact"; value: string }
    | { type: "suffix"; value: string }
    | { type: "regex"; value: string }
  >;
  ports: number[];
  tlsVerify: boolean;
}

export interface ServiceDraftDocument {
  formatVersion: 1;
  service: ServiceProfileInput;
  destinations: Array<ServiceDestinationInput & { id: string }>;
}

export class ServiceConfigurationError extends Error {
  constructor(readonly code: "invalid_request" | "unsafe_destination") {
    super("Service configuration is invalid.");
    this.name = "ServiceConfigurationError";
  }
}

export function normalizeServiceProfile(input: ServiceProfileInput): ServiceProfileInput {
  const slug = boundedText(input.slug, 1, 64);
  const name = boundedText(input.name, 1, 120);
  if (!SERVICE_SLUG.test(slug)) invalid();
  const description = optionalText(input.description, 1, 1_024);
  let documentationUrl: string | undefined;
  if (input.documentationUrl !== undefined) {
    const raw = boundedText(input.documentationUrl, 8, 2_048);
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      invalid();
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== "" ||
      raw !== parsed.toString()
    ) invalid();
    documentationUrl = raw;
  }
  return {
    slug,
    name,
    ...(description === undefined ? {} : { description }),
    ...(documentationUrl === undefined ? {} : { documentationUrl }),
  };
}

export function normalizeServiceDestination(
  input: ServiceDestinationInput,
): ServiceDestinationInput & { runtime: DestinationConfig } {
  const slug = boundedText(input.slug, 1, 64);
  if (!SERVICE_SLUG.test(slug)) invalid();
  const baseUrl = canonicalBaseUrl(input.baseUrl);
  const parsed = new URL(baseUrl);
  const baseScheme = parsed.protocol.slice(0, -1) as "http" | "https";
  const schemes = uniqueSorted(input.schemes, (value) => {
    if (value !== "http" && value !== "https") unsafe();
    return value;
  }, 1, 2);
  if (!schemes.includes(baseScheme)) unsafe();
  const basePort = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  const ports = uniqueSorted(input.ports, (value) => {
    if (!Number.isInteger(value) || value < 1 || value > 65_535) unsafe();
    return value;
  }, 1, 32);
  if (!ports.includes(basePort)) unsafe();
  const hosts = uniqueSorted(input.hosts, normalizeMatcher, 1, 32);
  const runtimeHosts: HostMatcherConfig[] = hosts.map((host) => host.type === "regex"
    ? { ...host, regex: new RegExp(host.value) }
    : host);
  const baseHost = normalizeHost(parsed.hostname);
  if (!runtimeHosts.some((matcher) => {
    if (matcher.type === "exact") return matcher.value === baseHost;
    if (matcher.type === "suffix") {
      return matcher.value === baseHost || baseHost.endsWith(`.${matcher.value}`);
    }
    return matcher.regex.test(baseHost);
  })) unsafe();
  if (typeof input.tlsVerify !== "boolean") invalid();
  return {
    slug,
    baseUrl,
    schemes,
    hosts,
    ports,
    tlsVerify: input.tlsVerify,
    runtime: {
      id: slug,
      baseUrl,
      schemes,
      hosts: runtimeHosts,
      ports,
      tls: { verify: input.tlsVerify },
    },
  };
}

export function canonicalServiceDraft(document: ServiceDraftDocument): {
  document: ServiceDraftDocument;
  json: string;
  digest: string;
} {
  if (document.formatVersion !== 1 || !Array.isArray(document.destinations)) invalid();
  const service = normalizeServiceProfile(document.service);
  const destinations = document.destinations.map((destination) => {
    const normalized = normalizeServiceDestination(destination);
    const id = boundedText(destination.id, 36, 36);
    if (!isUuidV7(id)) invalid();
    return {
      id,
      slug: normalized.slug,
      baseUrl: normalized.baseUrl,
      schemes: normalized.schemes,
      hosts: normalized.hosts,
      ports: normalized.ports,
      tlsVerify: normalized.tlsVerify,
    };
  }).sort((left, right) => left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id));
  if (destinations.length > 64 || new Set(destinations.map(({ slug }) => slug)).size !== destinations.length) {
    invalid();
  }
  const normalized = { formatVersion: 1 as const, service, destinations };
  const json = canonicalControlJson(normalized);
  return {
    document: normalized,
    json,
    digest: createHash("sha256").update("secretsauce-service-draft-v1\0").update(json).digest("hex"),
  };
}

function canonicalBaseUrl(input: string): string {
  const raw = boundedText(input, 8, 2_048);
  if (raw.includes("\\") || raw.includes("\0")) unsafe();
  const rawPath = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/.exec(raw)?.[1] ?? "/";
  assertUnambiguousPathEncoding(rawPath);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    unsafe();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    normalizeHost(url.hostname) !== url.hostname.toLowerCase().replace(/\.$/, "")
  ) unsafe();
  url.hostname = normalizeHost(url.hostname);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  const canonical = url.toString();
  if (raw !== canonical) unsafe();
  return canonical;
}

function assertUnambiguousPathEncoding(pathname: string): void {
  for (let index = 0; index < pathname.length; index += 1) {
    if (pathname[index] !== "%") continue;
    const escape = pathname.slice(index + 1, index + 3);
    if (!/^[0-9a-f]{2}$/i.test(escape)) unsafe();
    const byte = Number.parseInt(escape, 16);
    const character = String.fromCharCode(byte);
    if (
      /^[A-Za-z0-9._~-]$/.test(character) ||
      byte === 0x2f ||
      byte === 0x5c ||
      byte === 0x00 ||
      byte === 0x25
    ) unsafe();
    index += 2;
  }
}

function normalizeMatcher(
  matcher: ServiceDestinationInput["hosts"][number],
): ServiceDestinationInput["hosts"][number] {
  if (matcher === null || typeof matcher !== "object") invalid();
  const value = boundedText(matcher.value, 1, matcher.type === "regex" ? 256 : 253);
  if (matcher.type === "exact") {
    const normalized = normalizeDnsOrIp(value);
    return { type: "exact", value: normalized };
  }
  if (matcher.type === "suffix") {
    const normalized = normalizeDnsOrIp(value.replace(/^\./, ""));
    if (isIP(normalized) !== 0) unsafe();
    return { type: "suffix", value: normalized };
  }
  if (matcher.type === "regex") {
    assertSafeHostRegex(value);
    try {
      new RegExp(value);
    } catch {
      unsafe();
    }
    return { type: "regex", value };
  }
  invalid();
}

function assertSafeHostRegex(value: string): void {
  if (!value.startsWith("^") || !value.endsWith("$") || value.length < 3) unsafe();
  const expression = value.slice(1, -1);
  let previousWasAtom = false;
  let previousWasQuantifier = false;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index]!;
    if (character === "\\") {
      const escaped = expression[index + 1];
      if (escaped !== "." && escaped !== "-") unsafe();
      index += 1;
      previousWasAtom = true;
      previousWasQuantifier = false;
      continue;
    }
    if (character === "[") {
      const end = expression.indexOf("]", index + 1);
      if (end < 0) unsafe();
      const characterClass = expression.slice(index + 1, end);
      if (
        characterClass.length < 1 ||
        characterClass.length > 64 ||
        !/^[A-Za-z0-9-]+$/.test(characterClass)
      ) unsafe();
      index = end;
      previousWasAtom = true;
      previousWasQuantifier = false;
      continue;
    }
    if (character === "+" || character === "*" || character === "?") {
      if (!previousWasAtom || previousWasQuantifier) unsafe();
      previousWasAtom = false;
      previousWasQuantifier = true;
      continue;
    }
    if (!/^[A-Za-z0-9-]$/.test(character)) unsafe();
    previousWasAtom = true;
    previousWasQuantifier = false;
  }
  if (!previousWasAtom && !previousWasQuantifier) unsafe();
}

function normalizeDnsOrIp(input: string): string {
  const candidate = input.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (isIP(candidate) !== 0) return candidate;
  const ascii = domainToASCII(candidate);
  if (
    ascii === "" ||
    ascii.startsWith(".") ||
    ascii.endsWith(".") ||
    ascii.split(".").some((label) => label.length < 1 || label.length > 63)
  ) unsafe();
  return ascii;
}

function uniqueSorted<T>(
  values: T[],
  normalize: (value: T) => T,
  minimum: number,
  maximum: number,
): T[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) invalid();
  const normalized = values.map(normalize);
  const encoded = normalized.map((value) => canonicalControlJson(value));
  if (new Set(encoded).size !== encoded.length) invalid();
  return normalized.sort((left, right) =>
    canonicalControlJson(left).localeCompare(canonicalControlJson(right)));
}

function optionalText(value: string | undefined, minimum: number, maximum: number): string | undefined {
  return value === undefined ? undefined : boundedText(value, minimum, maximum);
}

function boundedText(value: unknown, minimum: number, maximum: number): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length < minimum ||
    value.length > maximum ||
    value.includes("\0")
  ) invalid();
  return value;
}

function invalid(): never {
  throw new ServiceConfigurationError("invalid_request");
}

function unsafe(): never {
  throw new ServiceConfigurationError("unsafe_destination");
}
