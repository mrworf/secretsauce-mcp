export const CONTROL_ROLES = [
  "user",
  "admin",
  "superadmin",
  "service",
  "all_services",
  "system",
] as const;

export type ControlRole = (typeof CONTROL_ROLES)[number];

export const CONTROL_CAPABILITIES = [
  "use_mcp",
  "manage_own_security",
  "view_own_grants",
  "view_service_configuration",
  "configure_service",
  "manage_credentials_policies",
  "create_service",
  "archive_service",
  "permanently_delete_service",
  "assign_service_admin",
  "manage_service_groups",
  "manage_service_membership",
  "invite_ordinary_user",
  "view_ordinary_users",
  "edit_ordinary_user_profile",
  "reset_ordinary_user_password",
  "reset_ordinary_user_totp",
  "suspend_reactivate_user",
  "deactivate_user",
  "permanently_delete_user",
  "manage_admin_accounts",
  "change_account_role",
  "affect_superadmin",
  "manage_global_settings",
  "global_authenticator_event",
  "manage_api_keys",
  "create_portable_backup",
  "backup_with_credentials",
  "backup_without_credentials",
  "restore",
  "self_api_key_approval",
  "vault_key_operation",
  "view_administrative_audit",
  "view_runtime_audit",
  "export_audit",
  "manage_audit_retention",
  "view_activity_dashboard",
  "view_status_dashboard",
  "view_security_dashboard",
  "manage_dashboard_remediations",
  "rebuild_activity_dashboard",
] as const;

export type ControlCapability = (typeof CONTROL_CAPABILITIES)[number];

export type PermissionOutcome =
  | "deny"
  | "allow"
  | "eligible"
  | "self"
  | "self_permitted"
  | "no_account"
  | "service_names_only"
  | "assigned_services"
  | "assigned_services_step_up"
  | "all_services"
  | "all_services_step_up"
  | "scoped_service"
  | "related_users"
  | "related_users_not_self"
  | "related_users_step_up"
  | "all_ordinary_users"
  | "all_ordinary_users_step_up"
  | "ordinary_users_without_assignment"
  | "permitted_settings"
  | "step_up"
  | "last_superadmin_rules";

type PermissionRow = Readonly<Record<ControlRole, PermissionOutcome>>;

const D = "deny";
const A = "allow";

export const CONTROL_PERMISSION_MATRIX: Readonly<Record<ControlCapability, PermissionRow>> = {
  use_mcp: row("eligible", D, D, D, D, D),
  manage_own_security: row("self", "self", "self", "no_account", "no_account", "no_account"),
  view_own_grants: row("self", "self", "self", "no_account", "no_account", "no_account"),
  view_service_configuration: row("service_names_only", "assigned_services", "all_services", "scoped_service", "all_services", D),
  configure_service: row(D, "assigned_services", "all_services", "scoped_service", "all_services", D),
  manage_credentials_policies: row(D, "assigned_services", "all_services", "scoped_service", "all_services", D),
  create_service: row(D, D, A, D, A, D),
  archive_service: row(D, D, A, D, A, D),
  permanently_delete_service: row(D, D, "step_up", D, D, D),
  assign_service_admin: row(D, D, A, D, D, D),
  manage_service_groups: row(D, "assigned_services", "all_services", "scoped_service", "all_services", D),
  manage_service_membership: row(D, "assigned_services", "all_services", "scoped_service", "all_services", D),
  invite_ordinary_user: row(D, "assigned_services", "all_services", "scoped_service", A, "ordinary_users_without_assignment"),
  view_ordinary_users: row("self", "related_users", "all_ordinary_users", "related_users", "all_ordinary_users", "all_ordinary_users"),
  edit_ordinary_user_profile: row("self_permitted", "related_users_not_self", "all_ordinary_users", D, D, "all_ordinary_users"),
  reset_ordinary_user_password: row(D, "related_users_step_up", "all_ordinary_users_step_up", "related_users", "all_ordinary_users", "all_ordinary_users"),
  reset_ordinary_user_totp: row(D, "related_users_step_up", "all_ordinary_users_step_up", "related_users", "all_ordinary_users", "all_ordinary_users"),
  suspend_reactivate_user: row(D, "related_users_step_up", "all_ordinary_users_step_up", D, D, "all_ordinary_users"),
  deactivate_user: row(D, "related_users_step_up", "all_ordinary_users_step_up", D, D, "all_ordinary_users"),
  permanently_delete_user: row(D, D, "all_ordinary_users_step_up", D, D, "all_ordinary_users"),
  manage_admin_accounts: row(D, D, A, D, D, A),
  change_account_role: row(D, D, "step_up", D, D, A),
  affect_superadmin: row(D, D, "last_superadmin_rules", D, D, D),
  manage_global_settings: row(D, D, A, D, D, "permitted_settings"),
  global_authenticator_event: row(D, D, "step_up", D, D, D),
  manage_api_keys: row(D, "assigned_services_step_up", "all_services_step_up", D, D, D),
  create_portable_backup: row(D, D, "step_up", D, D, A),
  backup_with_credentials: row(D, D, "step_up", D, D, D),
  backup_without_credentials: row(D, D, A, D, D, A),
  restore: row(D, D, "step_up", D, D, D),
  self_api_key_approval: row(D, D, "step_up", D, D, D),
  vault_key_operation: row(D, D, "step_up", D, D, D),
  view_administrative_audit: row(D, A, A, D, D, D),
  view_runtime_audit: row(D, A, A, D, D, D),
  export_audit: row(D, A, A, D, D, D),
  manage_audit_retention: row(D, D, "step_up", D, D, D),
  view_activity_dashboard: row(D, "assigned_services", "all_services", D, D, D),
  view_status_dashboard: row(D, "assigned_services", "all_services", D, D, D),
  view_security_dashboard: row(D, "assigned_services", "all_services", D, D, D),
  manage_dashboard_remediations: row(D, "assigned_services_step_up", "all_services_step_up", D, D, D),
  rebuild_activity_dashboard: row(D, D, "step_up", D, D, D),
};

export function permissionOutcome(
  role: ControlRole,
  capability: ControlCapability,
): PermissionOutcome {
  return CONTROL_PERMISSION_MATRIX[capability][role];
}

export function permissionNeedsScope(outcome: PermissionOutcome): boolean {
  return !["allow", "deny", "step_up", "no_account"].includes(outcome);
}

export function permissionNeedsHumanStepUp(outcome: PermissionOutcome): boolean {
  return outcome === "step_up" || outcome.endsWith("_step_up");
}

export function permissionCanAppearInNavigation(outcome: PermissionOutcome): boolean {
  return outcome !== "deny" && outcome !== "no_account";
}

function row(
  user: PermissionOutcome,
  admin: PermissionOutcome,
  superadmin: PermissionOutcome,
  service: PermissionOutcome,
  allServices: PermissionOutcome,
  system: PermissionOutcome,
): PermissionRow {
  return {
    user,
    admin,
    superadmin,
    service,
    all_services: allServices,
    system,
  };
}
