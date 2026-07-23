import { isIP } from "node:net";
import { domainToASCII } from "node:url";

export type PolicyHostMatcher =
  | { kind: "exact"; value: string }
  | { kind: "suffix"; value: string }
  | { kind: "regex"; value: string };

export type PolicyPathMatcher =
  | { kind: "exact"; value: string }
  | { kind: "prefix"; value: string }
  | { kind: "regex"; value: string };

export interface ManagedPolicyMatchers {
  methods: string[];
  hosts: PolicyHostMatcher[];
  paths: PolicyPathMatcher[];
}

export class PolicyMatcherError extends Error {
  constructor(readonly code: "invalid_request" | "unsafe_matcher") {
    super("Policy matcher is invalid.");
    this.name = "PolicyMatcherError";
  }
}

export function normalizeManagedPolicyMatchers(input: ManagedPolicyMatchers): ManagedPolicyMatchers {
  if (input === null || typeof input !== "object" || Array.isArray(input)) invalid();
  return {
    methods: uniqueSorted(input.methods, normalizeMethod, 0, 64),
    hosts: uniqueSorted(input.hosts, normalizeHostMatcher, 0, 64),
    paths: uniqueSorted(input.paths, normalizePathMatcher, 0, 128),
  };
}

export function matchesPolicyHost(matcher: PolicyHostMatcher, host: string): boolean {
  const normalized = normalizeDnsOrIp(host);
  if (matcher.kind === "exact") return normalized === matcher.value;
  if (matcher.kind === "suffix") {
    return normalized === matcher.value || normalized.endsWith(`.${matcher.value}`);
  }
  return new RegExp(matcher.value, "u").test(normalized);
}

export function matchesPolicyPath(matcher: PolicyPathMatcher, pathname: string): boolean {
  if (matcher.kind === "exact") return pathname === matcher.value;
  if (matcher.kind === "prefix") {
    return matcher.value === "/"
      || pathname === matcher.value
      || pathname.startsWith(`${matcher.value}/`);
  }
  return new RegExp(matcher.value, "u").test(pathname);
}

function normalizeMethod(value: string): string {
  if (typeof value !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,32}$/.test(value)) {
    invalid();
  }
  return value.toUpperCase();
}

function normalizeHostMatcher(value: PolicyHostMatcher): PolicyHostMatcher {
  assertClosedMatcher(value);
  if (value.kind === "exact") return { kind: "exact", value: normalizeDnsOrIp(value.value) };
  if (value.kind === "suffix") {
    const normalized = normalizeDnsOrIp(value.value.replace(/^\./, ""));
    if (isIP(normalized) !== 0) unsafe();
    return { kind: "suffix", value: normalized };
  }
  if (value.kind === "regex") {
    assertAnchoredLinearRegex(value.value, "host");
    return { kind: "regex", value: value.value };
  }
  invalid();
}

function normalizePathMatcher(value: PolicyPathMatcher): PolicyPathMatcher {
  assertClosedMatcher(value);
  if (value.kind === "regex") {
    assertAnchoredLinearRegex(value.value, "path");
    return { kind: "regex", value: value.value };
  }
  const canonical = canonicalPath(value.value);
  return { kind: value.kind, value: canonical };
}

function canonicalPath(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 2_048
    || !value.startsWith("/")
    || value.includes("?")
    || value.includes("#")
    || value.includes("\0")
  ) invalid();
  assertUnambiguousPercentEncoding(value);
  let parsed: URL;
  try {
    parsed = new URL(value, "https://example.org");
  } catch {
    invalid();
  }
  if (parsed.pathname !== value || parsed.search !== "" || parsed.hash !== "") unsafe();
  return value;
}

function assertUnambiguousPercentEncoding(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "%") continue;
    const escape = value.slice(index + 1, index + 3);
    if (!/^[0-9A-F]{2}$/.test(escape)) unsafe();
    const byte = Number.parseInt(escape, 16);
    const character = String.fromCharCode(byte);
    if (
      /^[A-Za-z0-9._~-]$/.test(character)
      || byte === 0x2f
      || byte === 0x5c
      || byte === 0x00
      || byte === 0x25
    ) unsafe();
    index += 2;
  }
}

function assertAnchoredLinearRegex(value: string, kind: "host" | "path"): void {
  const maximum = kind === "host" ? 256 : 2_048;
  if (
    typeof value !== "string"
    || value.length < 3
    || value.length > maximum
    || !value.startsWith("^")
    || !value.endsWith("$")
    || value.includes("%")
  ) unsafe();
  const expression = value.slice(1, -1);
  let previousWasAtom = false;
  let previousWasQuantifier = false;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index]!;
    if (character === "\\") {
      const escaped = expression[index + 1];
      if (escaped !== "." && escaped !== "-" && (kind !== "path" || escaped !== "/")) unsafe();
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
        characterClass.length < 1
        || characterClass.length > 64
        || !/^[A-Za-z0-9._~/-]+$/.test(characterClass)
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
    const allowedLiteral = kind === "host"
      ? /^[A-Za-z0-9-]$/.test(character)
      : /^[A-Za-z0-9._~/-]$/.test(character);
    if (!allowedLiteral) unsafe();
    previousWasAtom = true;
    previousWasQuantifier = false;
  }
  if (!previousWasAtom && !previousWasQuantifier) unsafe();
  try {
    new RegExp(value, "u");
  } catch {
    unsafe();
  }
}

function assertClosedMatcher(value: PolicyHostMatcher | PolicyPathMatcher): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const record = value as unknown as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2
    || !Object.hasOwn(record, "kind")
    || !Object.hasOwn(record, "value")
    || typeof record.value !== "string"
  ) invalid();
}

function normalizeDnsOrIp(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 253
    || value !== value.trim()
    || value.includes("\0")
  ) invalid();
  const candidate = value.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (isIP(candidate) !== 0) return candidate;
  const ascii = domainToASCII(candidate);
  if (
    ascii === ""
    || ascii.startsWith(".")
    || ascii.endsWith(".")
    || ascii.split(".").some((label) =>
      label.length < 1 || label.length > 63 || !/^[a-z0-9-]+$/.test(label))
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
  const encoded = normalized.map((value) => JSON.stringify(value));
  if (new Set(encoded).size !== encoded.length) invalid();
  return normalized.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function invalid(): never {
  throw new PolicyMatcherError("invalid_request");
}

function unsafe(): never {
  throw new PolicyMatcherError("unsafe_matcher");
}
