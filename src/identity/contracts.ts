export const IDENTITY_ROLES = ["superadmin", "admin", "user"] as const;
export type IdentityRole = (typeof IDENTITY_ROLES)[number];

export const IDENTITY_STATUSES = [
  "invited",
  "enrollment_required",
  "active",
  "suspended",
  "deactivated",
] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export type PasswordState = "not_configured" | "temporary" | "configured" | "disabled";
export type TotpState = "not_configured" | "configured" | "disabled";

export interface IdentityProfile {
  email: string;
  normalizedEmail: string;
  givenName: string;
  familyName: string;
}

export interface IdentityReadModel extends IdentityProfile {
  id: string;
  role: IdentityRole;
  status: IdentityStatus;
  securityEpoch: number;
  passwordPolicyVersion: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  mcpEligible: false;
}

export interface LocalAuthenticatorStateReadModel {
  userId: string;
  passwordState: PasswordState;
  totpState: TotpState;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderIdentity {
  providerId: string;
  issuer: string;
  subject: string;
}

export interface ProviderLinkReadModel extends ProviderIdentity {
  id: string;
  userId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}
