import { z } from "zod";
import type { ProviderIdentity } from "./contracts.js";
import { IdentityError } from "./errors.js";
import { parseProviderIdentity } from "./validation.js";

const assertionSchema = z.object({
  providerId: z.string(),
  issuer: z.string(),
  subject: z.string(),
  authenticationTime: z.number().int().nonnegative(),
  mfa: z.object({
    verified: z.boolean(),
    evidence: z.array(z.string().min(1).max(64).regex(/^[a-z][a-z0-9_.-]*$/)).max(16),
  }).strict(),
  profile: z.object({
    email: z.string().max(1024).optional(),
    emailVerified: z.boolean().optional(),
    givenName: z.string().max(512).optional(),
    familyName: z.string().max(512).optional(),
  }).strict().optional(),
}).strict();

export interface ProviderAssertion extends ProviderIdentity {
  authenticationTime: number;
  mfa: {
    verified: boolean;
    evidence: readonly string[];
  };
  profile?: {
    email?: string;
    emailVerified?: boolean;
    givenName?: string;
    familyName?: string;
  };
}

export interface IdentityProviderAdapter<Request = unknown> {
  readonly providerId: string;
  authenticate(request: Request): Promise<ProviderAssertion>;
}

export function parseProviderAssertion(input: unknown): ProviderAssertion {
  const parsed = assertionSchema.safeParse(input);
  if (!parsed.success) throw new IdentityError("invalid_provider_assertion");
  let identity: ProviderIdentity;
  try {
    identity = parseProviderIdentity({
      providerId: parsed.data.providerId,
      issuer: parsed.data.issuer,
      subject: parsed.data.subject,
    });
  } catch {
    throw new IdentityError("invalid_provider_assertion");
  }
  const profile = parsed.data.profile === undefined ? undefined : {
    ...(parsed.data.profile.email === undefined ? {} : { email: parsed.data.profile.email }),
    ...(parsed.data.profile.emailVerified === undefined
      ? {}
      : { emailVerified: parsed.data.profile.emailVerified }),
    ...(parsed.data.profile.givenName === undefined
      ? {}
      : { givenName: parsed.data.profile.givenName }),
    ...(parsed.data.profile.familyName === undefined
      ? {}
      : { familyName: parsed.data.profile.familyName }),
  };
  return {
    ...identity,
    authenticationTime: parsed.data.authenticationTime,
    mfa: {
      verified: parsed.data.mfa.verified,
      evidence: [...parsed.data.mfa.evidence],
    },
    ...(profile === undefined ? {} : { profile }),
  };
}
