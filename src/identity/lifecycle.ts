import type { IdentityRole, IdentityStatus } from "./contracts.js";
import { IdentityError } from "./errors.js";

const transitions: Readonly<Record<IdentityStatus, readonly IdentityStatus[]>> = {
  invited: ["enrollment_required"],
  enrollment_required: ["active"],
  active: ["suspended", "deactivated"],
  suspended: ["active", "deactivated"],
  deactivated: ["enrollment_required"],
};

export function requireIdentityStatusTransition(
  current: IdentityStatus,
  next: IdentityStatus,
): void {
  if (!transitions[current].includes(next)) {
    throw new IdentityError("invalid_identity_transition");
  }
}

export function removesActiveSuperadmin(
  currentRole: IdentityRole,
  currentStatus: IdentityStatus,
  nextRole: IdentityRole,
  nextStatus: IdentityStatus,
): boolean {
  return currentRole === "superadmin" &&
    currentStatus === "active" &&
    (nextRole !== "superadmin" || nextStatus !== "active");
}

export function requireLastActiveSuperadmin(
  activeSuperadminCount: number,
  currentRole: IdentityRole,
  currentStatus: IdentityStatus,
  nextRole: IdentityRole,
  nextStatus: IdentityStatus,
): void {
  if (
    !Number.isSafeInteger(activeSuperadminCount) ||
    activeSuperadminCount < 0
  ) {
    throw new IdentityError("invalid_identity_transition");
  }
  if (
    activeSuperadminCount <= 1 &&
    removesActiveSuperadmin(currentRole, currentStatus, nextRole, nextStatus)
  ) {
    throw new IdentityError("last_active_superadmin");
  }
}
