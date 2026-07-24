import { describe, expect, it } from "vitest";
import {
  CONTROL_CAPABILITIES,
  CONTROL_PERMISSION_MATRIX,
  CONTROL_ROLES,
  permissionCanAppearInNavigation,
  permissionNeedsHumanStepUp,
  permissionNeedsScope,
  permissionOutcome,
  type PermissionOutcome,
} from "../src/control/permissions.js";

const expected: Record<string, readonly PermissionOutcome[]> = {
  use_mcp: ["eligible", "deny", "deny", "deny", "deny", "deny"],
  manage_own_security: ["self", "self", "self", "no_account", "no_account", "no_account"],
  view_own_grants: ["self", "self", "self", "no_account", "no_account", "no_account"],
  view_service_configuration: ["service_names_only", "assigned_services", "all_services", "scoped_service", "all_services", "deny"],
  configure_service: ["deny", "assigned_services", "all_services", "scoped_service", "all_services", "deny"],
  manage_credentials_policies: ["deny", "assigned_services", "all_services", "scoped_service", "all_services", "deny"],
  create_service: ["deny", "deny", "allow", "deny", "allow", "deny"],
  archive_service: ["deny", "deny", "allow", "deny", "allow", "deny"],
  permanently_delete_service: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  assign_service_admin: ["deny", "deny", "allow", "deny", "deny", "deny"],
  manage_service_groups: ["deny", "assigned_services", "all_services", "scoped_service", "all_services", "deny"],
  manage_service_membership: ["deny", "assigned_services", "all_services", "scoped_service", "all_services", "deny"],
  invite_ordinary_user: ["deny", "assigned_services", "all_services", "scoped_service", "allow", "ordinary_users_without_assignment"],
  view_ordinary_users: ["self", "related_users", "all_ordinary_users", "related_users", "all_ordinary_users", "all_ordinary_users"],
  edit_ordinary_user_profile: ["self_permitted", "related_users_not_self", "all_ordinary_users", "deny", "deny", "all_ordinary_users"],
  reset_ordinary_user_password: ["deny", "related_users_step_up", "all_ordinary_users_step_up", "related_users", "all_ordinary_users", "all_ordinary_users"],
  reset_ordinary_user_totp: ["deny", "related_users_step_up", "all_ordinary_users_step_up", "related_users", "all_ordinary_users", "all_ordinary_users"],
  suspend_reactivate_user: ["deny", "related_users_step_up", "all_ordinary_users_step_up", "deny", "deny", "all_ordinary_users"],
  deactivate_user: ["deny", "related_users_step_up", "all_ordinary_users_step_up", "deny", "deny", "all_ordinary_users"],
  permanently_delete_user: ["deny", "deny", "all_ordinary_users_step_up", "deny", "deny", "all_ordinary_users"],
  manage_admin_accounts: ["deny", "deny", "allow", "deny", "deny", "allow"],
  change_account_role: ["deny", "deny", "step_up", "deny", "deny", "allow"],
  affect_superadmin: ["deny", "deny", "last_superadmin_rules", "deny", "deny", "deny"],
  manage_global_settings: ["deny", "deny", "allow", "deny", "deny", "permitted_settings"],
  global_authenticator_event: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  manage_api_keys: ["deny", "assigned_services_step_up", "all_services_step_up", "deny", "deny", "deny"],
  create_portable_backup: ["deny", "deny", "step_up", "deny", "deny", "allow"],
  backup_with_credentials: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  backup_without_credentials: ["deny", "deny", "allow", "deny", "deny", "allow"],
  restore: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  self_api_key_approval: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  vault_key_operation: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  view_administrative_audit: ["deny", "allow", "allow", "deny", "deny", "deny"],
  view_runtime_audit: ["deny", "allow", "allow", "deny", "deny", "deny"],
  export_audit: ["deny", "allow", "allow", "deny", "deny", "deny"],
  manage_audit_retention: ["deny", "deny", "step_up", "deny", "deny", "deny"],
  view_activity_dashboard: ["deny", "assigned_services", "all_services", "deny", "deny", "deny"],
  view_status_dashboard: ["deny", "assigned_services", "all_services", "deny", "deny", "deny"],
  view_security_dashboard: ["deny", "assigned_services", "all_services", "deny", "deny", "deny"],
  manage_dashboard_remediations: ["deny", "assigned_services_step_up", "all_services_step_up", "deny", "deny", "deny"],
  rebuild_activity_dashboard: ["deny", "deny", "step_up", "deny", "deny", "deny"],
};

describe("control permission matrix", () => {
  it("encodes every PRD capability and role cell exactly", () => {
    expect(Object.keys(expected).sort()).toEqual([...CONTROL_CAPABILITIES].sort());
    expect(Object.keys(CONTROL_PERMISSION_MATRIX).sort()).toEqual([...CONTROL_CAPABILITIES].sort());
    expect(CONTROL_ROLES).toHaveLength(6);
    for (const capability of CONTROL_CAPABILITIES) {
      const outcomes = CONTROL_ROLES.map((role) => permissionOutcome(role, capability));
      expect(outcomes, capability).toEqual(expected[capability]);
    }
  });

  it("derives navigation, scope, and human-step-up semantics without granting authority", () => {
    expect(permissionCanAppearInNavigation("deny")).toBe(false);
    expect(permissionCanAppearInNavigation("no_account")).toBe(false);
    expect(permissionCanAppearInNavigation("assigned_services")).toBe(true);
    expect(permissionNeedsScope("assigned_services")).toBe(true);
    expect(permissionNeedsScope("allow")).toBe(false);
    expect(permissionNeedsHumanStepUp("related_users_step_up")).toBe(true);
    expect(permissionNeedsHumanStepUp("step_up")).toBe(true);
    expect(permissionNeedsHumanStepUp("all_services")).toBe(false);
  });
});
