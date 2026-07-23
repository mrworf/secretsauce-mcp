const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const OPAQUE_ALPHABET = /^[A-Za-z0-9_-]/;

const FORBIDDEN_HEADER_NAMES = new Set([
  "host",
  ":authority",
  "forwarded",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "cookie",
  "cookie2",
  "set-cookie",
  "set-cookie2",
]);

export interface CredentialPlacement {
  kind: "header" | "query" | "body";
  name: string;
  prefix?: string;
  suffix?: string;
  enforceHeaderOwnership: boolean;
}

export class CredentialPlacementError extends Error {
  constructor() {
    super("Credential placement is invalid.");
    this.name = "CredentialPlacementError";
  }
}

export function normalizeCredentialPlacement(input: unknown): CredentialPlacement {
  if (!plainObject(input)) throw new CredentialPlacementError();
  requireKeys(input, [
    "kind",
    "name",
    ...(Object.hasOwn(input, "prefix") ? ["prefix"] : []),
    ...(Object.hasOwn(input, "suffix") ? ["suffix"] : []),
    ...(Object.hasOwn(input, "enforce_header_ownership")
      ? ["enforce_header_ownership"]
      : []),
  ]);
  if (!["header", "query", "body"].includes(String(input.kind))) {
    throw new CredentialPlacementError();
  }
  const kind = input.kind as CredentialPlacement["kind"];
  if (typeof input.name !== "string") throw new CredentialPlacementError();
  const name = input.name.normalize("NFKC").trim();
  if (
    name.length < 1 ||
    name.length > 256 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) throw new CredentialPlacementError();
  if (kind === "header") {
    const normalized = name.toLowerCase();
    if (
      !HEADER_NAME.test(name) ||
      FORBIDDEN_HEADER_NAMES.has(normalized) ||
      normalized.startsWith("x-forwarded-")
    ) throw new CredentialPlacementError();
  }
  const prefix = hint(input.prefix);
  const suffix = hint(input.suffix);
  if (suffix !== undefined && OPAQUE_ALPHABET.test(suffix)) {
    throw new CredentialPlacementError();
  }
  const enforceHeaderOwnership = input.enforce_header_ownership ?? false;
  if (
    typeof enforceHeaderOwnership !== "boolean" ||
    (enforceHeaderOwnership && kind !== "header")
  ) throw new CredentialPlacementError();
  return {
    kind,
    name,
    ...(prefix === undefined ? {} : { prefix }),
    ...(suffix === undefined ? {} : { suffix }),
    enforceHeaderOwnership,
  };
}

function hint(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    /[\r\n\0]/.test(value)
  ) throw new CredentialPlacementError();
  return value;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireKeys(
  input: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(input).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) throw new CredentialPlacementError();
}
