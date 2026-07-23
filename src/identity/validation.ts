import { domainToASCII } from "node:url";
import { z } from "zod";
import type { IdentityProfile, ProviderIdentity } from "./contracts.js";
import { IdentityError } from "./errors.js";

const forbiddenText = /[\p{Cc}\p{Cf}]/u;
const forbiddenEmailSpace = /\s/u;
const localEmailPattern = /^[\p{L}\p{M}\p{N}.!#$%&'*+/=?^_`{|}~-]+$/u;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const providerIdPattern = /^[a-z][a-z0-9_.-]{0,63}$/;

const profileInputSchema = z.object({
  email: z.string(),
  givenName: z.string(),
  familyName: z.string(),
}).strict();

const providerIdentitySchema = z.object({
  providerId: z.string(),
  issuer: z.string(),
  subject: z.string(),
}).strict();

export function parseIdentityProfile(input: unknown): IdentityProfile {
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) throw new IdentityError("invalid_identity_profile");
  try {
    const email = normalizeDisplayEmail(parsed.data.email);
    const normalizedEmail = normalizeEmail(email);
    return {
      email,
      normalizedEmail,
      givenName: normalizeName(parsed.data.givenName),
      familyName: normalizeName(parsed.data.familyName),
    };
  } catch {
    throw new IdentityError("invalid_identity_profile");
  }
}

export function normalizeEmail(input: string): string {
  const email = normalizeDisplayEmail(input);
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1) {
    throw new Error("invalid email");
  }
  const local = email.slice(0, at).toLocaleLowerCase("und");
  const unicodeDomain = email.slice(at + 1).toLocaleLowerCase("und");
  if (
    Buffer.byteLength(local, "utf8") > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    forbiddenEmailSpace.test(local) ||
    forbiddenText.test(local) ||
    !localEmailPattern.test(local)
  ) {
    throw new Error("invalid local part");
  }
  const domain = domainToASCII(unicodeDomain).toLowerCase();
  const labels = domain.split(".");
  if (
    domain.length === 0 ||
    domain.length > 253 ||
    labels.some((label) => !domainLabelPattern.test(label))
  ) {
    throw new Error("invalid domain");
  }
  const normalized = `${local}@${domain}`;
  if (Buffer.byteLength(normalized, "utf8") > 254) throw new Error("email too long");
  return normalized;
}

export function parseProviderIdentity(input: unknown): ProviderIdentity {
  const parsed = providerIdentitySchema.safeParse(input);
  if (!parsed.success) throw new IdentityError("invalid_provider_identity");
  try {
    const providerId = parsed.data.providerId;
    if (!providerIdPattern.test(providerId)) throw new Error("invalid provider");
    const issuer = normalizeProviderIssuer(parsed.data.issuer);
    const subject = parsed.data.subject.normalize("NFC");
    if (
      subject !== parsed.data.subject ||
      subject.trim() !== subject ||
      subject.length === 0 ||
      subject.length > 255 ||
      Buffer.byteLength(subject, "utf8") > 255 ||
      forbiddenText.test(subject)
    ) {
      throw new Error("invalid subject");
    }
    return { providerId, issuer, subject };
  } catch {
    throw new IdentityError("invalid_provider_identity");
  }
}

export function normalizeProviderIssuer(input: string): string {
  const issuerUrl = new URL(input);
  const canonical = issuerUrl.pathname === "/"
    ? issuerUrl.origin
    : `${issuerUrl.origin}${issuerUrl.pathname}`;
  if (
    issuerUrl.protocol !== "https:" ||
    issuerUrl.username !== "" ||
    issuerUrl.password !== "" ||
    issuerUrl.search !== "" ||
    issuerUrl.hash !== "" ||
    issuerUrl.pathname.includes("\\") ||
    issuerUrl.pathname.includes("%") ||
    input !== canonical ||
    Buffer.byteLength(canonical, "utf8") > 2048
  ) {
    throw new Error("invalid issuer");
  }
  return canonical;
}

function normalizeDisplayEmail(input: string): string {
  const email = input.normalize("NFKC").trim();
  if (
    email.length < 3 ||
    email.length > 254 ||
    Buffer.byteLength(email, "utf8") > 1024 ||
    forbiddenText.test(email)
  ) {
    throw new Error("invalid email");
  }
  return email;
}

function normalizeName(input: string): string {
  const value = input.normalize("NFKC").trim();
  if (
    [...value].length > 128 ||
    Buffer.byteLength(value, "utf8") > 512 ||
    forbiddenText.test(value)
  ) {
    throw new Error("invalid name");
  }
  return value;
}
