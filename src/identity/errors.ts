export type IdentityErrorCode =
  | "invalid_identity_profile"
  | "invalid_provider_identity"
  | "invalid_provider_assertion"
  | "invalid_identity_transition"
  | "last_active_superadmin"
  | "identity_not_found"
  | "identity_conflict"
  | "identity_stale"
  | "bootstrap_unavailable";

const messages: Record<IdentityErrorCode, string> = {
  invalid_identity_profile: "Identity profile is invalid.",
  invalid_provider_identity: "Provider identity is invalid.",
  invalid_provider_assertion: "Provider assertion is invalid.",
  invalid_identity_transition: "Identity transition is invalid.",
  last_active_superadmin: "The last active superadmin must be preserved.",
  identity_not_found: "Identity was not found.",
  identity_conflict: "Identity conflicts with an existing record.",
  identity_stale: "Identity version is stale.",
  bootstrap_unavailable: "Initial identity bootstrap is unavailable.",
};

export class IdentityError extends Error {
  constructor(readonly code: IdentityErrorCode) {
    super(messages[code]);
    this.name = "IdentityError";
  }
}
