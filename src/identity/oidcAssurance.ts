import type { OidcProviderConfig } from "../types.js";
import {
  parseProviderAssertion,
  type ProviderAssertion,
} from "./provider.js";

const AMR_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const FORBIDDEN_TEXT = /[\p{Cc}\p{Cf}]/u;

export class OidcAssuranceError extends Error {
  constructor() {
    super("OIDC authentication failed.");
    this.name = "OidcAssuranceError";
  }
}

export function normalizeVerifiedOidcClaims(
  provider: OidcProviderConfig,
  claims: unknown,
  now = Date.now(),
): ProviderAssertion {
  try {
    if (
      claims === null ||
      typeof claims !== "object" ||
      Array.isArray(claims) ||
      !Number.isSafeInteger(now) ||
      now < 0
    ) throw new Error("invalid claims");
    const values = claims as Record<string, unknown>;
    if (Object.keys(values).length > 100) throw new Error("too many claims");
    const subject = boundedString(values.sub, 255);
    const authenticationSeconds = values.auth_time;
    if (
      typeof authenticationSeconds !== "number" ||
      !Number.isSafeInteger(authenticationSeconds) ||
      authenticationSeconds < 0
    ) throw new Error("invalid authentication time");
    const authenticationTime = authenticationSeconds * 1_000;
    if (
      !Number.isSafeInteger(authenticationTime) ||
      authenticationTime > now + provider.clockSkewSeconds * 1_000 ||
      now - authenticationTime > provider.maxAuthenticationAgeMs + provider.clockSkewSeconds * 1_000
    ) throw new Error("authentication time outside policy");

    const acr = optionalBoundedString(values.acr, 256);
    const amr = normalizeAmr(values.amr);
    const matchingClause = provider.assuranceAnyOf.find((clause) =>
      (clause.acr === undefined || clause.acr === acr) &&
      (clause.amr === undefined || clause.amr.every((member) => amr.includes(member))));
    if (matchingClause === undefined) throw new Error("insufficient assurance");
    const evidence = [
      ...(matchingClause.acr === undefined ? [] : ["acr"]),
      ...(matchingClause.amr === undefined
        ? []
        : matchingClause.amr.map((member) => `amr.${member.toLowerCase()}`)),
    ];
    const profile = normalizeProfile(provider, values);
    return parseProviderAssertion({
      providerId: provider.id,
      issuer: provider.issuer,
      subject,
      authenticationTime,
      mfa: { verified: true, evidence },
      ...(profile === undefined ? {} : { profile }),
    });
  } catch {
    throw new OidcAssuranceError();
  }
}

function normalizeAmr(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) throw new Error("invalid amr");
  const members = value.map((member) => {
    if (
      typeof member !== "string" ||
      member.length < 1 ||
      member.length > 64 ||
      !AMR_VALUE.test(member)
    ) throw new Error("invalid amr");
    return member;
  });
  if (new Set(members).size !== members.length) throw new Error("ambiguous amr");
  return members;
}

function normalizeProfile(
  provider: OidcProviderConfig,
  claims: Record<string, unknown>,
): ProviderAssertion["profile"] | undefined {
  const mapping = provider.profileClaims;
  const email = mappedString(claims, mapping.email, 1024);
  const emailVerified = mappedBoolean(claims, mapping.emailVerified);
  const givenName = mappedString(claims, mapping.givenName, 512);
  const familyName = mappedString(claims, mapping.familyName, 512);
  if (
    email === undefined &&
    emailVerified === undefined &&
    givenName === undefined &&
    familyName === undefined
  ) return undefined;
  return {
    ...(email === undefined ? {} : { email }),
    ...(emailVerified === undefined ? {} : { emailVerified }),
    ...(givenName === undefined ? {} : { givenName }),
    ...(familyName === undefined ? {} : { familyName }),
  };
}

function mappedString(
  claims: Record<string, unknown>,
  claimName: string | undefined,
  maximumBytes: number,
): string | undefined {
  if (claimName === undefined || !(claimName in claims)) return undefined;
  return boundedString(claims[claimName], maximumBytes);
}

function mappedBoolean(
  claims: Record<string, unknown>,
  claimName: string | undefined,
): boolean | undefined {
  if (claimName === undefined || !(claimName in claims)) return undefined;
  const value = claims[claimName];
  if (typeof value !== "boolean") throw new Error("invalid boolean claim");
  return value;
}

function optionalBoundedString(value: unknown, maximumBytes: number): string | undefined {
  if (value === undefined) return undefined;
  return boundedString(value, maximumBytes);
}

function boundedString(value: unknown, maximumBytes: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    Buffer.byteLength(value, "utf8") > maximumBytes ||
    value.normalize("NFC") !== value ||
    FORBIDDEN_TEXT.test(value)
  ) throw new Error("invalid string claim");
  return value;
}
