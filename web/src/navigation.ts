import {
  permissionCanAppearInNavigation,
  permissionOutcome,
  type ControlCapability,
  type ControlRole,
} from "../../src/control/permissions";

export type HumanControlRole = Extract<ControlRole, "user" | "admin" | "superadmin">;

export interface NavigationItem {
  label: string;
  path: string;
  description: string;
  capability: ControlCapability;
  group: "Workspace" | "Operations" | "Account";
}

export const CONTROL_NAVIGATION: readonly NavigationItem[] = [
  { label: "Overview", path: "/", description: "System and access summary", capability: "view_own_grants", group: "Workspace" },
  { label: "Services", path: "/services", description: "Available service configuration", capability: "view_service_configuration", group: "Workspace" },
  { label: "Credentials", path: "/credentials", description: "Write-only credential status", capability: "manage_credentials_policies", group: "Workspace" },
  { label: "Policies", path: "/policies", description: "Authorization policy workspace", capability: "manage_credentials_policies", group: "Workspace" },
  { label: "Users", path: "/users", description: "Permitted user administration", capability: "view_ordinary_users", group: "Workspace" },
  { label: "Service groups", path: "/groups", description: "Service-scoped groups", capability: "manage_service_groups", group: "Workspace" },
  { label: "Access and sessions", path: "/access", description: "Sessions and grants", capability: "view_own_grants", group: "Operations" },
  { label: "API keys", path: "/api-keys", description: "System-owned API key metadata", capability: "manage_api_keys", group: "Operations" },
  { label: "Activity", path: "/activity", description: "Operational activity", capability: "view_activity_dashboard", group: "Operations" },
  { label: "Status", path: "/status", description: "Service and component health", capability: "view_status_dashboard", group: "Operations" },
  { label: "MCP audit", path: "/mcp-audit", description: "Runtime audit events", capability: "view_runtime_audit", group: "Operations" },
  { label: "Administrative audit", path: "/administrative-audit", description: "Control-plane audit events", capability: "view_administrative_audit", group: "Operations" },
  { label: "Security", path: "/security", description: "Personal and system security", capability: "manage_own_security", group: "Operations" },
  { label: "Backup and restore", path: "/backup", description: "Protected configuration lifecycle", capability: "create_portable_backup", group: "Operations" },
  { label: "Recovery tasks", path: "/migration", description: "Migration and restore remediation", capability: "manage_global_settings", group: "Operations" },
  { label: "Profile", path: "/profile", description: "Personal profile and security", capability: "manage_own_security", group: "Account" },
  { label: "OpenAPI", path: "/openapi", description: "Authenticated API documentation", capability: "manage_own_security", group: "Account" },
] as const;

export function navigationForRole(role: HumanControlRole): readonly NavigationItem[] {
  return CONTROL_NAVIGATION.filter((item) =>
    permissionCanAppearInNavigation(permissionOutcome(role, item.capability)));
}

export function navigationItem(pathname: string): NavigationItem | undefined {
  return CONTROL_NAVIGATION.find(({ path }) => path === pathname);
}
