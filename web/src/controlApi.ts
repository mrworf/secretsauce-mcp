export type UserRole = "superadmin" | "admin" | "user";
export type UserStatus =
  | "invited"
  | "enrollment_required"
  | "active"
  | "suspended"
  | "deactivated";

export interface ControlUser {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  role: UserRole;
  status: UserStatus;
  password_state: "not_configured" | "temporary" | "configured" | "disabled";
  totp_state: "not_configured" | "configured" | "disabled";
  version: number;
  created_at: number;
  updated_at: number;
}

export interface ControlSession {
  user_id: string;
  role: UserRole;
  csrf_token: string;
  expires_at: number;
}

export type DashboardWindow = "24h" | "7d" | "30d" | "90d";
export interface DashboardCount {
  value: number | null;
  suppressed: boolean;
  threshold: 3;
}
export interface ActivityDashboard {
  generated_at: number;
  window: DashboardWindow;
  start_at: number;
  end_at: number;
  totals: {
    requests: number;
    allow: number;
    deny: number;
    error: number;
    credential_uses: number;
    tokenizations: number;
    api_key_activity: number;
    active_users: DashboardCount;
  };
  trend: Array<{
    bucket_start: number;
    requests: number;
    allow: number;
    deny: number;
    error: number;
    status_1xx: number;
    status_2xx: number;
    status_3xx: number;
    status_4xx: number;
    status_5xx: number;
  }>;
  services: Array<{
    service_id: string;
    service_name: string;
    requests: number;
    credential_uses: number;
    active_users: DashboardCount;
  }>;
  endpoints: Array<{
    service_id: string;
    service_name: string;
    category: string;
    requests: number;
  }>;
  freshness: {
    cursor_sequence: number;
    source_sequence: number;
    last_completed_at: number | null;
    partial: boolean;
  };
}
export interface StatusDashboard {
  generated_at: number;
  services: Array<{
    service_id: string;
    name: string;
    lifecycle: ServiceLifecycle;
    publication_generation: number;
    credentials: Record<"configured" | "unconfigured" | "disabled" | "archived", number>;
    references: {
      state: "available" | "unavailable";
      gref: { active: number; expiring: number; expired: number };
      sec: { active: number; expiring: number; expired: number };
    };
    active_grant_count: number;
    api_keys: { active: number; expiring: number; expired: number };
    pending_remediation_count: number;
  }>;
  service_count: number;
  services_truncated: boolean;
  system?: {
    components: Record<"database" | "schema" | "vault" | "audit" | "identity", string>;
    jobs: Record<"audit" | "activity" | "inactivity", {
      state: "ready" | "degraded" | "unavailable";
      next_run_at: number | null;
      last_completed_at: number | null;
      last_outcome: string | null;
      last_code: string | null;
    }>;
    audit_capacity: {
      administrative_rows: number;
      runtime_rows: number;
      estimated_bytes: number;
      warnings: string[];
    };
    api_keys: { active: number; expiring: number; expired: number; non_expiring: number };
    users: {
      suspended: number;
      deactivated: number;
      pending_enrollment: number;
      active_without_services: number;
    };
  };
}
export interface DashboardRemediation {
  id: string;
  code: string;
  severity: "info" | "warning" | "critical";
  service_id?: string;
  generation: number;
  state: "open" | "acknowledged" | "dismissed" | "resolved";
  first_seen_at: number;
  last_seen_at: number;
  version: number;
}
export interface SecurityDashboard {
  generated_at: number;
  signals: Array<{
    code: string;
    severity: "info" | "warning" | "critical";
    count: number;
    first_seen_at: number;
    last_seen_at: number;
    service_id?: string;
    remediation_id?: string;
    remediation_state?: DashboardRemediation["state"];
    remediation_version?: number;
  }>;
  remediations: DashboardRemediation[];
}
export interface DashboardControlApi {
  activityDashboard(input?: {
    window?: DashboardWindow;
    service_id?: string;
  }): Promise<ActivityDashboard>;
  statusDashboard(): Promise<StatusDashboard>;
  securityDashboard(): Promise<SecurityDashboard>;
  updateDashboardRemediation(
    remediation: DashboardRemediation,
    input: {
      state: "acknowledged" | "dismissed";
      justification: string;
      password: string;
      totp: string;
    },
  ): Promise<DashboardRemediation>;
  rebuildActivity(input: {
    justification: string;
    password: string;
    totp: string;
  }): Promise<unknown>;
}

export type ApiKeyRole = "service" | "all_services" | "system";
export type ApiKeyStatus = "active" | "expired" | "revoked";

export interface ControlApiKey {
  id: string;
  key_prefix: string;
  nickname: string;
  last_four: string;
  api_role: ApiKeyRole;
  service_id?: string;
  expiration_policy: "forever" | "timestamp";
  expires_at?: number;
  status: ApiKeyStatus;
  creator_id: string;
  version: number;
  created_at: number;
  updated_at: number;
  last_used_at?: number;
  revoked_at?: number;
}

export interface OneTimeApiKey {
  api_key: ControlApiKey;
  one_time_key: string;
  one_time_value_displayed: true;
}

export interface ApiKeyActivity {
  id: string;
  api_key_id: string;
  nickname: string;
  last_four: string;
  api_role: ApiKeyRole;
  service_id?: string;
  action: string;
  outcome: "allow" | "deny" | "error";
  target_type: string;
  target_id?: string;
  request_id: string;
  failure_code?: string;
  occurred_at: number;
}

export type ServiceLifecycle = "draft" | "published" | "archived";

export interface ControlService {
  id: string;
  slug: string;
  name: string;
  description?: string;
  documentation_url?: string;
  lifecycle: ServiceLifecycle;
  draft_matches_published: boolean;
  publication_generation: number;
  published_revision?: {
    id: string;
    sequence: number;
    published_at: number;
  };
  destination_count: number;
  admin_count: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface ServiceDestination {
  id: string;
  slug: string;
  base_url: string;
  schemes: Array<"http" | "https">;
  hosts: Array<{ type: "exact" | "suffix" | "regex"; value: string }>;
  ports: number[];
  tls_verify: boolean;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface ControlServiceDetail extends ControlService {
  destinations: ServiceDestination[];
}

export interface ServiceDraftDocument {
  format_version: 1;
  service: {
    slug: string;
    name: string;
    description?: string;
    documentation_url?: string;
  };
  destinations: Array<Omit<ServiceDestination, "version" | "created_at" | "updated_at">>;
}

export interface ServiceValidation {
  valid: boolean;
  draft_digest: string;
  issues: Array<{
    code:
      | "service_archived"
      | "service_admin_required"
      | "destination_required"
      | "credential_reconciliation_required"
      | "policy_configuration_invalid";
    pointer: "/lifecycle" | "/admins" | "/destinations" | "/credentials" | "/policies";
  }>;
  warnings: Array<{
    code: "tls_verification_disabled";
    pointer: string;
  }>;
}

export interface ServiceRevision {
  id: string;
  sequence: number;
  digest: string;
  publication_generation: number;
  source_revision_id?: string;
  actor_role: "admin" | "superadmin" | "service" | "all_services";
  published_at: number;
}

export interface ServiceAdmin {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  status: string;
  assigned_at: number;
}

export interface ServiceProfileInput {
  slug: string;
  name: string;
  description?: string;
  documentation_url?: string;
}

export interface ServiceGroup {
  id: string;
  service_id: string;
  name: string;
  description?: string;
  lifecycle: "active" | "archived";
  member_count: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface ServiceGroupMember {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  status: UserStatus;
}

export interface ServiceAssignments {
  service_id: string;
  selector?: {
    kind: "all" | "explicit";
    group_ids: string[];
    user_ids: string[];
  };
  version: number;
  authorization_generation: number;
}

export interface EffectiveServiceAccess {
  service_id: string;
  user_id: string;
  email: string;
  given_name: string;
  family_name: string;
  contributions: Array<
    | { kind: "all" }
    | { kind: "direct" }
    | { kind: "group"; group_id: string; group_name: string }
  >;
}

export interface OwnService {
  id: string;
  slug: string;
  name: string;
}

export interface ControlCredential {
  id: string;
  service_id: string;
  name: string;
  description?: string;
  placement: {
    kind: "header" | "query" | "body";
    name: string;
    prefix?: string;
    suffix?: string;
    enforce_header_ownership: boolean;
  };
  selector?: {
    kind: "all" | "explicit";
    group_ids: string[];
    user_ids: string[];
  };
  status: "configured" | "unconfigured" | "disabled" | "archived";
  last_four?: string;
  value_updated_at?: number;
  authorization_generation: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface SelfApiKeyApproval {
  api_key_id: string;
  nickname: string;
  last_four: string;
  vault_generation: number;
  approved_at: number;
}

export type PolicyBoundary =
  | { kind: "service" }
  | { kind: "credential"; credential_id: string };

export type PolicySelectorInput =
  | { kind: "all" }
  | { kind: "groups"; group_ids: string[] }
  | {
      kind: "users";
      user_ids: string[];
      direct_assignment_confirmed: true;
    }
  | {
      kind: "principals";
      group_ids: string[];
      user_ids: string[];
      direct_assignment_confirmed: boolean;
    };

export interface ControlPolicy {
  id: string;
  service_id: string;
  boundary: PolicyBoundary;
  name: string;
  description?: string;
  operating_mode: "allow" | "deny";
  lifecycle: "active" | "archived";
  evaluation_generation: number;
  rule_count: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface PolicyRuleInput {
  name: string;
  reason?: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: boolean;
  methods: string[];
  hosts: Array<{ kind: "exact" | "suffix" | "regex"; value: string }>;
  paths: Array<{ kind: "exact" | "prefix" | "regex"; value: string }>;
  response_safeguards: {
    secretlint: { enabled: boolean; disabled_rule_ids: string[] };
    binary_response: { scan: boolean; max_bytes: number | null };
  };
  selector?: PolicySelectorInput;
}

export interface ControlPolicyRule extends Omit<PolicyRuleInput, "selector"> {
  id: string;
  service_id: string;
  policy_id: string;
  selector?: {
    kind: "all" | "explicit";
    group_ids: string[];
    user_ids: string[];
  };
  version: number;
  created_at: number;
  updated_at: number;
}

export interface ControlPolicyDetail extends ControlPolicy {
  rules: ControlPolicyRule[];
}

export interface PolicyCopyDocument {
  format_version: 1;
  policy: {
    name: string;
    description?: string;
    operating_mode: "allow" | "deny";
    rules: PolicyRuleInput[];
  };
}

export interface PolicySimulation {
  allowed: boolean;
  subject_id: string;
  group_ids: string[];
  canonical_target: { method: string; host: string; pathname: string };
  boundaries: Array<{
    boundary_id: string;
    kind: "service" | "credential";
    assignment_allowed: boolean;
    allowed: boolean;
    mode: "allow" | "deny";
    selected_priority?: number;
    selected_rule_ids: string[];
    decisive_rule_id?: string;
    reason_code:
      | "assignment_denied"
      | "default_allow"
      | "default_deny"
      | "selected_allow"
      | "selected_deny"
      | "deny_tie";
    rules: Array<{
      rule_id: string;
      applicable: boolean;
      request_matched: boolean;
      selected: boolean;
      reason_code: string;
      priority: number;
      effect: "allow" | "deny";
    }>;
  }>;
  reason_code: "all_boundaries_allow" | "boundary_denied";
  links: Array<{
    kind: "service" | "credential" | "group" | "user" | "policy";
    id: string;
    href: string;
  }>;
}

export interface PolicyControlApi
  extends Pick<ServiceControlApi, "listServices" | "service">,
    Pick<ControlApi, "listUsers">,
    Pick<GroupControlApi, "listGroups">,
    Pick<CredentialControlApi, "listCredentials"> {
  listPolicies(serviceId: string): Promise<{ policies: ControlPolicy[] }>;
  policy(serviceId: string, policyId: string): Promise<ControlPolicyDetail>;
  createPolicy(serviceId: string, input: {
    name: string;
    description?: string;
    operating_mode: "allow" | "deny";
    boundary: PolicyBoundary;
  }): Promise<ControlPolicyDetail>;
  updatePolicy(policy: ControlPolicyDetail, input: {
    name: string;
    description?: string;
    operating_mode: "allow" | "deny";
  }): Promise<ControlPolicyDetail>;
  createPolicyRule(
    policy: ControlPolicyDetail,
    input: PolicyRuleInput,
  ): Promise<ControlPolicyRule>;
  updatePolicyRule(
    rule: ControlPolicyRule,
    input: PolicyRuleInput,
  ): Promise<ControlPolicyRule>;
  replacePolicyRuleAssignments(
    rule: ControlPolicyRule,
    selector: PolicySelectorInput,
  ): Promise<ControlPolicyRule>;
  archivePolicy(policy: ControlPolicyDetail): Promise<ControlPolicyDetail>;
  deletePolicy(policy: ControlPolicyDetail): Promise<{ policy_id: string; deleted: true }>;
  deletePolicyRule(rule: ControlPolicyRule): Promise<{ rule_id: string; deleted: true }>;
  copyPolicy(serviceId: string, policyId: string): Promise<PolicyCopyDocument>;
  clonePolicy(
    serviceId: string,
    policyId: string,
    input: { target_service_id: string; boundary: PolicyBoundary; name?: string },
  ): Promise<ControlPolicyDetail>;
  bulkCopyPolicies(serviceId: string, input: {
    copies: Array<{
      source_policy_id: string;
      target_service_id: string;
      boundary: PolicyBoundary;
      name?: string;
    }>;
  }): Promise<{ policies: ControlPolicyDetail[] }>;
  importPolicy(
    serviceId: string,
    input: { boundary: PolicyBoundary; document: PolicyCopyDocument },
  ): Promise<ControlPolicyDetail>;
  simulatePolicy(serviceId: string, input: {
    user_id: string;
    destination_id: string;
    method: string;
    path?: string;
    credential_ids: string[];
  }): Promise<PolicySimulation>;
}

export type CredentialSelectorInput =
  | { kind: "all" }
  | {
      kind: "principals";
      group_ids: string[];
      user_ids: string[];
      direct_assignment_confirmed: boolean;
    };

export interface CredentialControlApi
  extends Pick<ServiceControlApi, "listServices">,
    Pick<ControlApi, "listUsers">,
    Pick<GroupControlApi, "listGroups"> {
  listCredentials(serviceId: string): Promise<{ credentials: ControlCredential[] }>;
  createCredential(serviceId: string, input: {
    name: string;
    description?: string;
    placement: {
      kind: "header" | "query" | "body";
      name: string;
      prefix?: string;
      suffix?: string;
      enforce_header_ownership?: boolean;
    };
    selector: CredentialSelectorInput;
  }): Promise<ControlCredential>;
  replaceCredentialValue(
    credential: ControlCredential,
    value: string,
    captureLastFour: boolean,
  ): Promise<ControlCredential>;
  approveSelfApiKey(
    credential: ControlCredential,
    input: {
      value: string;
      capture_last_four: boolean;
      justification: string;
      risk_acknowledgement: string;
      password: string;
      totp: string;
    },
  ): Promise<{
    credential: ControlCredential;
    approval: SelfApiKeyApproval;
  }>;
  deleteCredentialValue(
    credential: ControlCredential,
    justification: string,
  ): Promise<ControlCredential>;
  replaceCredentialAssignments(
    credential: ControlCredential,
    selector: CredentialSelectorInput,
  ): Promise<ControlCredential>;
  credentialAction(
    credential: ControlCredential,
    action: "disable" | "enable" | "archive",
    justification?: string,
  ): Promise<ControlCredential>;
}

export interface ServiceDestinationInput {
  slug: string;
  base_url: string;
  schemes: Array<"http" | "https">;
  hosts: Array<{ type: "exact" | "suffix" | "regex"; value: string }>;
  ports: number[];
  tls_verify: boolean;
}

export interface OidcProviderLabel {
  id: string;
  display_name: string;
}

export interface OneTimeUser {
  user: ControlUser;
  one_time_value_displayed: boolean;
  temporary_password?: string;
  expires_at?: number;
}

export interface AccessSession {
  id: string;
  user_id: string;
  user_label: string;
  role: UserRole;
  current: boolean;
  issued_at: number;
  last_used_at: number;
  expires_at: number;
  status: "active" | "expired" | "revoked" | "invalid";
}

export interface OAuthGrantAccess {
  id: string;
  user_id: string;
  user_label: string;
  client_id: string;
  client_identifier: string;
  client_name: string;
  resource: string;
  scopes: string[];
  authentication_method: "local_password_totp" | "oidc";
  issued_at: number;
  last_used_at: number;
  expires_at: number;
  oauth_grant_status: "active" | "expired" | "revoked" | "invalid";
  usable: boolean;
  services: string[];
}

export interface ServiceGrantAccess {
  grant_id: string;
  user_id: string;
  user_label: string;
  client_id: string;
  client_identifier: string;
  client_name: string;
  service_id: string;
  service_name: string;
  issued_at: number;
  last_used_at: number;
  expires_at: number;
  oauth_grant_status: "active" | "expired" | "revoked" | "invalid";
  capability_status: "active" | "invalid";
  credential_count: number;
  policy_count: number;
  references: {
    gref: { active: number; expired: number; invalid: number };
    sec: { active: number; expired: number; invalid: number };
  };
}

export interface AccessControlApi
  extends Pick<ServiceControlApi, "listServices"> {
  listSessions(global?: boolean): Promise<{ items: AccessSession[]; next_cursor?: string }>;
  listOAuthGrants(global?: boolean): Promise<{ items: OAuthGrantAccess[]; next_cursor?: string }>;
  revokeSession(sessionId: string, global?: boolean): Promise<{
    target_id: string;
    revoked: boolean;
  }>;
  revokeOAuthGrant(grantId: string): Promise<{
    target_id: string;
    revoked: boolean;
  }>;
  serviceGrantAccess(serviceId: string): Promise<{
    items: ServiceGrantAccess[];
    next_cursor?: string;
  }>;
  invalidateCapabilities(
    serviceId: string,
    target:
      | { kind: "service" }
      | { kind: "assignment"; user_id: string },
    justification: string,
  ): Promise<{
    capability_status: "invalidated";
    invalidated_references: number;
    oauth_grants_revoked: 0;
  }>;
}

export interface SecuritySettings {
  password_minimum_length: number;
  password_blocklist_version: number;
  password_policy_version: number;
  admin_session_absolute_ms: number;
  admin_session_inactivity_ms: number;
  user_session_absolute_ms: number;
  user_session_inactivity_ms: number;
  oauth_access_token_ms: number;
  oauth_refresh_inactivity_ms: number;
  oauth_refresh_absolute_ms: number;
  step_up_mode: "five_minutes" | "always";
  login_attempts: number;
  login_window_ms: number;
  password_attempts: number;
  password_window_ms: number;
  totp_attempts: number;
  totp_window_ms: number;
  management_api_attempts: number;
  management_api_window_ms: number;
  search_attempts: number;
  search_window_ms: number;
  backup_attempts: number;
  backup_window_ms: number;
  inactivity_suspension_days: number | null;
  suspended_deactivation_days: number | null;
  security_job_interval_ms: number;
  security_job_batch_size: number;
  security_job_wall_time_ms: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface SecurityJobState {
  next_run_at: number;
  lease_expires_at: number | null;
  last_started_at: number | null;
  last_completed_at: number | null;
  last_outcome: "completed" | "partial" | "skipped" | "error" | null;
  last_code: string | null;
  suspended_count: number;
  deactivated_count: number;
  protected_count: number;
  version: number;
}

export interface GlobalSecurityEvent {
  id: string;
  kind: "password_change" | "totp_reset";
  actor_user_id: string;
  actor_role: "superadmin";
  justification: string;
  affected_users: number;
  resulting_global_epoch: number;
  resulting_password_policy_version: number;
  created_at: number;
  replayed?: boolean;
}

export type SecuritySettingsPatch = Partial<Omit<
  SecuritySettings,
  "password_policy_version" | "version" | "created_at" | "updated_at"
>>;

export interface SecurityControlApi {
  securitySettings(): Promise<SecuritySettings>;
  updateSecuritySettings(
    current: SecuritySettings,
    patch: SecuritySettingsPatch,
    input: {
      justification: string;
      acknowledgement: string;
      password: string;
      totp: string;
    },
  ): Promise<SecuritySettings>;
  inactivityJob(): Promise<SecurityJobState>;
  runInactivityJob(input: {
    justification: string;
    acknowledgement: string;
    password: string;
    totp: string;
    step_up_mode: "five_minutes" | "always";
  }): Promise<SecurityJobState>;
  securityEvents(): Promise<{
    items: GlobalSecurityEvent[];
    state_version: number;
  }>;
  executeGlobalSecurityEvent(
    kind: "password_change" | "totp_reset",
    version: number,
    input: {
      justification: string;
      acknowledgement: string;
      password: string;
      totp: string;
    },
  ): Promise<GlobalSecurityEvent>;
}

export type AuditDomain = "administrative" | "runtime";

export interface AuditEvent {
  domain: AuditDomain;
  event_id: string;
  occurred_at: number;
  category: string;
  outcome: "allow" | "deny" | "error" | "warning";
  action: string;
  actor_id?: string;
  actor_label: string;
  target_id?: string;
  target_label?: string;
  service_id?: string;
  service_label?: string;
  correlation_id?: string;
  justification?: string;
  failure_code?: string;
  changes: unknown[];
  source: Record<string, unknown>;
  details: Record<string, unknown>;
}

export interface AuditFilter {
  q?: string;
  category?: string;
  outcome?: AuditEvent["outcome"];
  preset?: "24h" | "7d" | "30d" | "90d" | "year";
  start_utc?: string;
  end_utc?: string;
  cursor?: string;
}

export interface AuditRetentionOverview {
  settings: {
    administrative_days: number | null;
    runtime_days: number | null;
    version: number;
    created_at: number;
    updated_at: number;
  };
  administrative: AuditCapacity;
  runtime: AuditCapacity;
  maintenance: AuditMaintenance;
}

export interface AuditCapacity {
  row_count: number;
  oldest_occurred_at: number | null;
  newest_occurred_at: number | null;
  estimated_bytes: number;
  warnings: string[];
}

export interface AuditMaintenance {
  next_run_at: number;
  lease_expires_at: number | null;
  last_started_at: number | null;
  last_completed_at: number | null;
  last_outcome: "completed" | "partial" | "skipped" | "error" | null;
  last_code: string | null;
  retained_administrative_count: number;
  retained_runtime_count: number;
  repaired_index_count: number;
  version: number;
}

export interface AuditControlApi {
  auditEvents(
    domain: AuditDomain,
    filter?: AuditFilter,
  ): Promise<{ events: AuditEvent[]; next_cursor?: string }>;
  selfSecurity(
    filter?: Pick<AuditFilter, "preset" | "start_utc" | "end_utc" | "cursor">,
  ): Promise<{ events: AuditEvent[]; next_cursor?: string }>;
  exportAudit(
    domain: AuditDomain,
    filter: Omit<AuditFilter, "cursor">,
    justification: string,
  ): Promise<{
    filename: string;
    media_type: "application/x-ndjson";
    content: string;
    row_count: number;
    byte_count: number;
  }>;
  auditRetention(): Promise<AuditRetentionOverview>;
  updateAuditRetention(input: {
    current: AuditRetentionOverview;
    administrative_days: number | null;
    runtime_days: number | null;
    justification: string;
    acknowledgement: string;
    password: string;
    totp: string;
  }): Promise<AuditRetentionOverview>;
  runAuditMaintenance(input: {
    justification: string;
    acknowledgement: string;
    password: string;
    totp: string;
  }): Promise<AuditRetentionOverview>;
}

interface Envelope<T> {
  data: T;
}

export class ControlApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ControlApiError";
  }
}

export interface ControlApi {
  session(): Promise<ControlSession>;
  self(): Promise<ControlUser>;
  listUsers(input?: {
    q?: string;
    role?: UserRole;
    status?: UserStatus;
    cursor?: string;
  }): Promise<{ users: ControlUser[]; next_cursor?: string }>;
  updateSelf(user: ControlUser, profile: UserProfileInput): Promise<ControlUser>;
  updateUser(user: ControlUser, profile: UserProfileInput): Promise<ControlUser>;
  invite(input: UserProfileInput & { role: "admin" | "user" }): Promise<OneTimeUser>;
  userAction(
    user: ControlUser,
    action: UserAction,
    justification: string,
    role?: UserRole,
  ): Promise<ControlUser | OneTimeUser | { user_id: string; deleted: true }>;
}

export interface ServiceControlApi {
  listServices(input?: {
    q?: string;
    lifecycle?: ServiceLifecycle;
    cursor?: string;
  }): Promise<{ services: ControlService[]; next_cursor?: string }>;
  service(serviceId: string): Promise<ControlServiceDetail>;
  createService(input: ServiceProfileInput): Promise<ControlService>;
  updateService(
    service: ControlServiceDetail,
    input: {
      name: string;
      description?: string | null;
      documentation_url?: string | null;
    },
  ): Promise<ControlServiceDetail>;
  createDestination(
    service: ControlServiceDetail,
    input: ServiceDestinationInput,
  ): Promise<ControlServiceDetail>;
  updateDestination(
    service: ControlServiceDetail,
    destinationId: string,
    input: Omit<ServiceDestinationInput, "slug">,
  ): Promise<ControlServiceDetail>;
  deleteDestination(
    service: ControlServiceDetail,
    destinationId: string,
  ): Promise<ControlServiceDetail>;
  validateService(serviceId: string): Promise<ServiceValidation>;
  publishService(service: ControlServiceDetail): Promise<ControlServiceDetail>;
  serviceRevisions(serviceId: string): Promise<{ revisions: ServiceRevision[] }>;
  copyService(serviceId: string): Promise<ServiceDraftDocument>;
  importService(
    service: ControlServiceDetail,
    document: ServiceDraftDocument,
  ): Promise<ControlServiceDetail>;
  cloneService(
    sourceServiceId: string,
    input: Pick<ServiceProfileInput, "slug" | "name">,
  ): Promise<ControlServiceDetail>;
  serviceAdmins(serviceId: string): Promise<{ admins: ServiceAdmin[] }>;
  assignServiceAdmin(
    service: ControlServiceDetail,
    userId: string,
  ): Promise<ControlServiceDetail>;
  removeServiceAdmin(
    service: ControlServiceDetail,
    userId: string,
    justification: string,
  ): Promise<ControlServiceDetail>;
  rollbackService(
    service: ControlServiceDetail,
    revisionId: string,
    justification: string,
  ): Promise<ControlServiceDetail>;
  archiveService(
    service: ControlServiceDetail,
    justification: string,
  ): Promise<ControlServiceDetail>;
  deleteService(
    service: ControlServiceDetail,
    justification: string,
    password: string,
    totp: string,
  ): Promise<{ service_id: string; deleted: true }>;
}

export interface ApiKeyControlApi
  extends Pick<ServiceControlApi, "listServices"> {
  listApiKeys(input?: {
    q?: string;
    role?: ApiKeyRole;
    status?: ApiKeyStatus;
    service_id?: string;
    cursor?: string;
  }): Promise<{ api_keys: ControlApiKey[]; next_cursor?: string }>;
  apiKey(apiKeyId: string): Promise<ControlApiKey>;
  createApiKey(input: {
    nickname: string;
    api_role: ApiKeyRole;
    service_id?: string;
    expiration: { policy: "forever" } | { policy: "days"; days: number };
    all_services_confirmation?: string;
  }): Promise<OneTimeApiKey>;
  updateApiKey(
    apiKey: ControlApiKey,
    input: { nickname?: string; expires_at?: number },
  ): Promise<ControlApiKey>;
  revokeApiKey(
    apiKey: ControlApiKey,
    justification: string,
  ): Promise<{ api_key: ControlApiKey; changed: boolean }>;
  rotateApiKey(
    apiKey: ControlApiKey,
    justification: string,
  ): Promise<OneTimeApiKey>;
  apiKeyActivity(
    apiKeyId: string,
    cursor?: string,
  ): Promise<{ activity: ApiKeyActivity[]; next_cursor?: string }>;
}

export interface GroupControlApi
  extends Pick<ServiceControlApi, "listServices">,
    Pick<ControlApi, "listUsers"> {
  listGroups(serviceId: string): Promise<{ groups: ServiceGroup[] }>;
  createGroup(
    serviceId: string,
    input: { name: string; description?: string },
  ): Promise<ServiceGroup>;
  updateGroup(
    group: ServiceGroup,
    input: { name: string; description?: string },
  ): Promise<ServiceGroup>;
  groupMembers(
    serviceId: string,
    groupId: string,
  ): Promise<{ members: ServiceGroupMember[] }>;
  replaceGroupMembers(group: ServiceGroup, userIds: string[]): Promise<ServiceGroup>;
  archiveGroup(group: ServiceGroup, justification: string): Promise<ServiceGroup>;
  deleteGroup(
    group: ServiceGroup,
    justification: string,
  ): Promise<{ group_id: string; deleted: true; replayed: boolean }>;
  serviceAssignments(serviceId: string): Promise<ServiceAssignments>;
  replaceServiceAssignments(
    assignments: ServiceAssignments,
    input:
      | { kind: "all" }
      | { kind: "principals"; group_ids: string[]; user_ids: string[];
        direct_assignment_confirmed: boolean },
  ): Promise<ServiceAssignments>;
  serviceAccess(serviceId: string): Promise<{ access: EffectiveServiceAccess[] }>;
  ownServices(): Promise<{ services: OwnService[] }>;
}

export interface OidcControlApi {
  oidcProviders(): Promise<{ providers: OidcProviderLabel[] }>;
  beginOidc(providerId: string): Promise<{ authorization_url: string; expires_at: number }>;
}

export interface RestrictedOidcOptions {
  csrf_token: string;
  providers: OidcProviderLabel[];
}

export interface OidcManagementLink {
  id: string;
  provider_id: string;
  provider_display_name: string;
  created_at: number;
  last_authenticated_at?: number;
}

export interface OidcManagementApi {
  oidcEnrollmentOptions(): Promise<RestrictedOidcOptions>;
  beginRestrictedOidc(
    providerId: string,
    csrfToken: string,
  ): Promise<{ authorization_url: string; expires_at: number }>;
  listOidcLinks(userId: string): Promise<{ links: OidcManagementLink[] }>;
  beginOidcLink(
    user: ControlUser,
    providerId: string,
    justification: string,
  ): Promise<{ authorization_url: string; expires_at: number }>;
  unlinkOidc(
    user: ControlUser,
    linkId: string,
    justification: string,
  ): Promise<{ user_id: string; deleted: true; version: number }>;
}

export interface UserProfileInput {
  email: string;
  given_name: string;
  family_name: string;
}

export type UserAction =
  | "password-reset"
  | "totp-reset"
  | "suspend"
  | "reactivate"
  | "deactivate"
  | "restore-enrollment"
  | "role"
  | "delete";

export const browserControlApi:
  ControlApi & OidcControlApi & OidcManagementApi & ServiceControlApi &
    GroupControlApi & CredentialControlApi & PolicyControlApi & AccessControlApi &
    ApiKeyControlApi & SecurityControlApi & AuditControlApi & DashboardControlApi = {
  session: () => get<ControlSession>("/api/v2/auth/session"),
  activityDashboard: (input = {}) => {
    const query = new URLSearchParams();
    if (input.window !== undefined) query.set("window", input.window);
    if (input.service_id !== undefined) query.set("service_id", input.service_id);
    const suffix = query.size === 0 ? "" : `?${query.toString()}`;
    return interactiveGet(`/api/v2/dashboard/activity${suffix}`);
  },
  statusDashboard: () => interactiveGet("/api/v2/dashboard/status"),
  securityDashboard: () => interactiveGet("/api/v2/dashboard/security"),
  updateDashboardRemediation: (remediation, input) =>
    updateDashboardRemediationWithStepUp(remediation, input),
  rebuildActivity: (input) => rebuildActivityWithStepUp(input),
  auditEvents: (domain, filter = {}) => {
    const query = auditQuery(filter);
    query.set("limit", "50");
    return interactiveGet(`/api/v2/audits/${domain}?${query.toString()}`);
  },
  selfSecurity: (filter = {}) => {
    const query = auditQuery(filter);
    query.set("limit", "50");
    return interactiveGet(`/api/v2/audits/self-security?${query.toString()}`);
  },
  exportAudit: (domain, filter, justification) =>
    mutation(`/api/v2/audits/${domain}/export`, "POST", {
      ...filter,
      justification,
    }),
  auditRetention: () => interactiveGet("/api/v2/audits/retention"),
  updateAuditRetention: (input) => updateAuditRetentionWithStepUp(input),
  runAuditMaintenance: (input) => runAuditMaintenanceWithStepUp(input),
  securitySettings: () =>
    interactiveGet<SecuritySettings>("/api/v2/security/settings"),
  updateSecuritySettings: (current, patch, input) =>
    updateSecuritySettingsWithStepUp(current, patch, input),
  inactivityJob: () =>
    interactiveGet<SecurityJobState>("/api/v2/security/jobs/inactivity"),
  runInactivityJob: (input) => runInactivityJobWithStepUp(input),
  securityEvents: () =>
    interactiveGet<{
      items: GlobalSecurityEvent[];
      state_version: number;
    }>("/api/v2/security/events"),
  executeGlobalSecurityEvent: (kind, version, input) =>
    executeGlobalSecurityEventWithStepUp(kind, version, input),
  oidcProviders: () => get<{ providers: OidcProviderLabel[] }>("/api/v2/auth/oidc/providers"),
  beginOidc: (providerId) => {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)) {
      return Promise.reject(new ControlApiError("invalid_request", "The provider is invalid."));
    }
    return request(`/api/v2/auth/oidc/${encodeURIComponent(providerId)}/begin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  },
  oidcEnrollmentOptions: () =>
    get<RestrictedOidcOptions>("/api/v2/auth/enrollment/oidc/providers"),
  beginRestrictedOidc: (providerId, csrfToken) =>
    request(`/api/v2/auth/enrollment/oidc/${safeProviderId(providerId)}/begin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: "{}",
    }),
  listOidcLinks: (userId) =>
    get(`/api/v2/users/${encodeURIComponent(userId)}/oidc-links`),
  beginOidcLink: (user, providerId, justification) =>
    mutation(
      `/api/v2/users/${user.id}/oidc-links/${safeProviderId(providerId)}/begin`,
      "POST",
      { justification },
      user.version,
    ),
  unlinkOidc: (user, linkId, justification) =>
    mutation(
      `/api/v2/users/${user.id}/oidc-links/${encodeURIComponent(linkId)}`,
      "DELETE",
      { justification },
      user.version,
    ),
  self: () => get<ControlUser>("/api/v2/auth/self/profile"),
  listUsers: (input = {}) => {
    const query = new URLSearchParams();
    query.set("limit", "50");
    if (input.q !== undefined && input.q.trim() !== "") query.set("q", input.q.trim());
    if (input.role !== undefined) query.set("role", input.role);
    if (input.status !== undefined) query.set("status", input.status);
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    return get(`/api/v2/users?${query.toString()}`);
  },
  updateSelf: (user, profile) =>
    mutation("/api/v2/auth/self/profile", "PATCH", profile, user.version),
  updateUser: (user, profile) =>
    mutation(`/api/v2/users/${user.id}/profile`, "PATCH", profile, user.version),
  invite: (input) =>
    mutation("/api/v2/users", "POST", input, undefined, true),
  userAction: (user, action, justification, role) => {
    if (action === "delete") {
      return mutation(
        `/api/v2/users/${user.id}`,
        "DELETE",
        { justification },
        user.version,
      );
    }
    if (action === "role") {
      return mutation(
        `/api/v2/users/${user.id}/role`,
        "PATCH",
        { role, justification },
        user.version,
      );
    }
    return mutation(
      `/api/v2/users/${user.id}/${action}`,
      "POST",
      { justification },
      user.version,
      ["password-reset", "totp-reset", "restore-enrollment"].includes(action),
    );
  },
  listServices: (input = {}) => {
    const query = new URLSearchParams({ limit: "50" });
    if (input.q !== undefined && input.q.trim() !== "") query.set("q", input.q.trim());
    if (input.lifecycle !== undefined) query.set("lifecycle", input.lifecycle);
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    return get(`/api/v2/services?${query.toString()}`);
  },
  listApiKeys: (input = {}) => {
    const query = new URLSearchParams({ limit: "50" });
    if (input.q !== undefined && input.q.trim() !== "") query.set("q", input.q.trim());
    if (input.role !== undefined) query.set("role", input.role);
    if (input.status !== undefined) query.set("status", input.status);
    if (input.service_id !== undefined) query.set("service_id", input.service_id);
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    return get(`/api/v2/api-keys?${query.toString()}`);
  },
  apiKey: (apiKeyId) =>
    get(`/api/v2/api-keys/${encodeURIComponent(apiKeyId)}`),
  createApiKey: (input) =>
    mutation("/api/v2/api-keys", "POST", input),
  updateApiKey: (apiKey, input) =>
    mutation(
      `/api/v2/api-keys/${encodeURIComponent(apiKey.id)}`,
      "PATCH",
      input,
      apiKey.version,
    ),
  revokeApiKey: (apiKey, justification) =>
    mutation(
      `/api/v2/api-keys/${encodeURIComponent(apiKey.id)}/revoke`,
      "POST",
      { justification },
      apiKey.version,
    ),
  rotateApiKey: (apiKey, justification) =>
    mutation(
      `/api/v2/api-keys/${encodeURIComponent(apiKey.id)}/rotate`,
      "POST",
      { justification },
      apiKey.version,
    ),
  apiKeyActivity: (apiKeyId, cursor) => {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor !== undefined) query.set("cursor", cursor);
    return get(
      `/api/v2/api-keys/${encodeURIComponent(apiKeyId)}/activity?${query.toString()}`,
    );
  },
  service: (serviceId) => get(`/api/v2/services/${encodeURIComponent(serviceId)}`),
  createService: (input) => mutation("/api/v2/services", "POST", input, undefined, true),
  updateService: (service, input) =>
    mutation(`/api/v2/services/${service.id}`, "PATCH", input, service.version),
  createDestination: (service, input) =>
    mutation(
      `/api/v2/services/${service.id}/destinations`,
      "POST",
      input,
      service.version,
    ),
  updateDestination: (service, destinationId, input) =>
    mutation(
      `/api/v2/services/${service.id}/destinations/${encodeURIComponent(destinationId)}`,
      "PATCH",
      input,
      service.version,
    ),
  deleteDestination: (service, destinationId) =>
    mutation(
      `/api/v2/services/${service.id}/destinations/${encodeURIComponent(destinationId)}`,
      "DELETE",
      undefined,
      service.version,
    ),
  validateService: (serviceId) =>
    mutation(`/api/v2/services/${serviceId}/validate`, "POST", {}),
  publishService: (service) =>
    mutation(`/api/v2/services/${service.id}/publish`, "POST", {}, service.version),
  serviceRevisions: (serviceId) =>
    get(`/api/v2/services/${serviceId}/revisions`),
  copyService: (serviceId) => get(`/api/v2/services/${serviceId}/copy`),
  importService: (service, document) =>
    mutation(`/api/v2/services/${service.id}/import`, "POST", document, service.version),
  cloneService: (serviceId, input) =>
    mutation(`/api/v2/services/${serviceId}/clone`, "POST", input, undefined, true),
  serviceAdmins: (serviceId) => get(`/api/v2/services/${serviceId}/admins`),
  assignServiceAdmin: async (service, userId) => {
    await mutation<ControlService>(
      `/api/v2/services/${service.id}/admins/${encodeURIComponent(userId)}`,
      "PUT",
      {},
      service.version,
    );
    return get(`/api/v2/services/${service.id}`);
  },
  removeServiceAdmin: async (service, userId, justification) => {
    await mutation<ControlService>(
      `/api/v2/services/${service.id}/admins/${encodeURIComponent(userId)}`,
      "DELETE",
      { justification },
      service.version,
    );
    return get(`/api/v2/services/${service.id}`);
  },
  rollbackService: (service, revisionId, justification) =>
    mutation(
      `/api/v2/services/${service.id}/revisions/${encodeURIComponent(revisionId)}/rollback`,
      "POST",
      { justification },
      service.version,
      true,
    ),
  archiveService: (service, justification) =>
    mutation(
      `/api/v2/services/${service.id}/archive`,
      "POST",
      { justification },
      service.version,
      true,
    ),
  deleteService: (service, justification, password, totp) =>
    deleteServiceWithStepUp(service, justification, password, totp),
  listGroups: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/groups`),
  createGroup: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/groups`,
      "POST",
      input,
      undefined,
      true,
    ),
  updateGroup: (group, input) =>
    mutation(
      `/api/v2/services/${group.service_id}/groups/${group.id}`,
      "PATCH",
      input,
      group.version,
    ),
  groupMembers: (serviceId, groupId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/groups/${encodeURIComponent(groupId)}/members`),
  replaceGroupMembers: (group, userIds) =>
    mutation(
      `/api/v2/services/${group.service_id}/groups/${group.id}/members`,
      "PUT",
      { user_ids: userIds },
      group.version,
      true,
    ),
  archiveGroup: (group, justification) =>
    mutation(
      `/api/v2/services/${group.service_id}/groups/${group.id}/archive`,
      "POST",
      { justification },
      group.version,
      true,
    ),
  deleteGroup: (group, justification) =>
    mutation(
      `/api/v2/services/${group.service_id}/groups/${group.id}`,
      "DELETE",
      { justification },
      group.version,
      true,
    ),
  serviceAssignments: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/assignments`),
  replaceServiceAssignments: (assignments, input) =>
    mutation(
      `/api/v2/services/${assignments.service_id}/assignments`,
      "PUT",
      input,
      assignments.version,
      true,
    ),
  serviceAccess: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/assignments/access`),
  ownServices: () => get("/api/v2/users/me/services"),
  listSessions: (global = false) =>
    get(global ? "/api/v2/security/sessions" : "/api/v2/access/sessions"),
  listOAuthGrants: (global = false) =>
    get(global ? "/api/v2/security/oauth-grants" : "/api/v2/access/grants"),
  revokeSession: (sessionId, global = false) =>
    mutation(
      global
        ? `/api/v2/security/sessions/${encodeURIComponent(sessionId)}`
        : `/api/v2/access/sessions/${encodeURIComponent(sessionId)}`,
      "DELETE",
      undefined,
    ),
  revokeOAuthGrant: (grantId) =>
    mutation(
      `/api/v2/access/grants/${encodeURIComponent(grantId)}`,
      "DELETE",
      undefined,
    ),
  serviceGrantAccess: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/access`),
  invalidateCapabilities: (serviceId, target, justification) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/capabilities/invalidate`,
      "POST",
      { target, justification },
    ),
  listCredentials: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/credentials`),
  createCredential: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/credentials`,
      "POST",
      input,
      undefined,
      true,
    ),
  replaceCredentialValue: (credential, value, captureLastFour) =>
    mutation(
      `/api/v2/services/${credential.service_id}/credentials/${credential.id}/value`,
      "PUT",
      { value, capture_last_four: captureLastFour },
      credential.version,
      true,
    ),
  approveSelfApiKey: (credential, input) =>
    approveSelfApiKeyWithStepUp(credential, input),
  deleteCredentialValue: (credential, justification) =>
    mutation(
      `/api/v2/services/${credential.service_id}/credentials/${credential.id}/value`,
      "DELETE",
      { justification },
      credential.version,
      true,
    ),
  replaceCredentialAssignments: (credential, selector) =>
    mutation(
      `/api/v2/services/${credential.service_id}/credentials/${credential.id}/assignments`,
      "PUT",
      selector,
      credential.version,
      true,
    ),
  credentialAction: (credential, action, justification) =>
    mutation(
      `/api/v2/services/${credential.service_id}/credentials/${credential.id}/${action}`,
      "POST",
      action === "enable" ? {} : { justification },
      credential.version,
      action !== "enable",
    ),
  listPolicies: (serviceId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/policies`),
  policy: (serviceId, policyId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/policies/${encodeURIComponent(policyId)}`),
  createPolicy: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/policies`,
      "POST",
      input,
      undefined,
      true,
    ),
  updatePolicy: (policy, input) =>
    mutation(
      `/api/v2/services/${policy.service_id}/policies/${policy.id}`,
      "PATCH",
      input,
      policy.version,
    ),
  createPolicyRule: (policy, input) =>
    mutation(
      `/api/v2/services/${policy.service_id}/policies/${policy.id}/rules`,
      "POST",
      input,
      undefined,
      true,
    ),
  updatePolicyRule: (rule, input) =>
    mutation(
      `/api/v2/services/${rule.service_id}/policies/${rule.policy_id}/rules/${rule.id}`,
      "PATCH",
      input,
      rule.version,
    ),
  replacePolicyRuleAssignments: (rule, selector) =>
    mutation(
      `/api/v2/services/${rule.service_id}/policies/${rule.policy_id}/rules/${rule.id}/assignments`,
      "PUT",
      selector,
      rule.version,
    ),
  archivePolicy: (policy) =>
    mutation(
      `/api/v2/services/${policy.service_id}/policies/${policy.id}/archive`,
      "POST",
      {},
      policy.version,
    ),
  deletePolicy: (policy) =>
    mutation(
      `/api/v2/services/${policy.service_id}/policies/${policy.id}`,
      "DELETE",
      {},
      policy.version,
    ),
  deletePolicyRule: (rule) =>
    mutation(
      `/api/v2/services/${rule.service_id}/policies/${rule.policy_id}/rules/${rule.id}`,
      "DELETE",
      {},
      rule.version,
    ),
  copyPolicy: (serviceId, policyId) =>
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/policies/${encodeURIComponent(policyId)}/copy`),
  clonePolicy: (serviceId, policyId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/policies/${encodeURIComponent(policyId)}/clone`,
      "POST",
      input,
      undefined,
      true,
    ),
  bulkCopyPolicies: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/policies/bulk-copy`,
      "POST",
      input,
      undefined,
      true,
    ),
  importPolicy: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/policies/import`,
      "POST",
      input,
      undefined,
      true,
    ),
  simulatePolicy: (serviceId, input) =>
    mutation(
      `/api/v2/services/${encodeURIComponent(serviceId)}/policy-simulations`,
      "POST",
      input,
    ),
};

function auditQuery(filter: AuditFilter): URLSearchParams {
  const query = new URLSearchParams();
  if (filter.q !== undefined && filter.q.trim() !== "") query.set("q", filter.q.trim());
  if (filter.category !== undefined && filter.category !== "") {
    query.set("category", filter.category);
  }
  if (filter.outcome !== undefined) query.set("outcome", filter.outcome);
  if (filter.preset !== undefined) query.set("preset", filter.preset);
  if (filter.start_utc !== undefined) query.set("start_utc", filter.start_utc);
  if (filter.end_utc !== undefined) query.set("end_utc", filter.end_utc);
  if (filter.cursor !== undefined) query.set("cursor", filter.cursor);
  return query;
}

async function updateAuditRetentionWithStepUp(input: {
  current: AuditRetentionOverview;
  administrative_days: number | null;
  runtime_days: number | null;
  justification: string;
  acknowledgement: string;
  password: string;
  totp: string;
}): Promise<AuditRetentionOverview> {
  const body = {
    administrative_days: input.administrative_days,
    runtime_days: input.runtime_days,
    justification: input.justification,
    acknowledgement: input.acknowledgement,
  };
  const session = await browserControlApi.session();
  const proof = await performStepUp(session, input.password, input.totp, {
    method: "PATCH",
    route_id: "audits.retention.update",
    target_ids: [],
    expected_version: input.current.settings.version,
    body,
  });
  if (proof.proof === undefined) {
    throw new ControlApiError("step_up_required", "Exact audit retention proof is required.");
  }
  return request("/api/v2/audits/retention", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "x-step-up-proof": proof.proof,
      "if-match": `"${input.current.settings.version}"`,
    },
    body: JSON.stringify(body),
  });
}

async function runAuditMaintenanceWithStepUp(input: {
  justification: string;
  acknowledgement: string;
  password: string;
  totp: string;
}): Promise<AuditRetentionOverview> {
  const body = {
    justification: input.justification,
    acknowledgement: input.acknowledgement,
  };
  const session = await browserControlApi.session();
  const proof = await performStepUp(session, input.password, input.totp, {
    method: "POST",
    route_id: "audits.retention.run",
    target_ids: [],
    body,
  });
  if (proof.proof === undefined) {
    throw new ControlApiError("step_up_required", "Exact audit maintenance proof is required.");
  }
  return request("/api/v2/audits/retention/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "x-step-up-proof": proof.proof,
    },
    body: JSON.stringify(body),
  });
}

async function updateDashboardRemediationWithStepUp(
  remediation: DashboardRemediation,
  input: {
    state: "acknowledged" | "dismissed";
    justification: string;
    password: string;
    totp: string;
  },
): Promise<DashboardRemediation> {
  const body = {
    state: input.state,
    justification: input.justification,
  };
  const session = await browserControlApi.session();
  const proof = await performStepUp(session, input.password, input.totp, {
    method: "PATCH",
    route_id: "dashboard.remediations.update",
    target_ids: [remediation.id],
    expected_version: remediation.version,
    body,
  });
  if (proof.proof === undefined) {
    throw new ControlApiError(
      "step_up_required",
      "An exact remediation proof is required.",
    );
  }
  return request(
    `/api/v2/dashboard/remediations/${encodeURIComponent(remediation.id)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrf_token,
        "x-step-up-proof": proof.proof,
        "if-match": `"${remediation.version}"`,
      },
      body: JSON.stringify(body),
    },
  );
}

async function rebuildActivityWithStepUp(input: {
  justification: string;
  password: string;
  totp: string;
}): Promise<unknown> {
  const body = {
    acknowledgement: "REBUILD ACTIVITY AGGREGATES",
    justification: input.justification,
  };
  const session = await browserControlApi.session();
  const proof = await performStepUp(session, input.password, input.totp, {
    method: "POST",
    route_id: "dashboard.activity.rebuild",
    target_ids: [],
    body,
  });
  if (proof.proof === undefined) {
    throw new ControlApiError(
      "step_up_required",
      "An exact activity rebuild proof is required.",
    );
  }
  return request("/api/v2/dashboard/activity/rebuild", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "x-step-up-proof": proof.proof,
    },
    body: JSON.stringify(body),
  });
}

function safeProviderId(providerId: string): string {
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)) {
    throw new ControlApiError("invalid_request", "The provider is invalid.");
  }
  return encodeURIComponent(providerId);
}

async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

async function interactiveGet<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: "GET",
    headers: { "x-secretsauce-user-activity": "interactive" },
  });
}

async function updateSecuritySettingsWithStepUp(
  current: SecuritySettings,
  patch: SecuritySettingsPatch,
  input: {
    justification: string;
    acknowledgement: string;
    password: string;
    totp: string;
  },
): Promise<SecuritySettings> {
  const body = {
    ...patch,
    justification: input.justification,
    acknowledgement: input.acknowledgement,
  };
  const session = await browserControlApi.session();
  const operation = {
    method: "PATCH" as const,
    route_id: "security.settings.update",
    target_ids: [],
    expected_version: current.version,
    body,
  };
  const stepUp = await performStepUp(
    session,
    input.password,
    input.totp,
    current.step_up_mode === "always" ? operation : undefined,
  );
  return request("/api/v2/security/settings", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "if-match": `"${current.version}"`,
      ...(stepUp.proof === undefined
        ? {}
        : { "x-step-up-proof": stepUp.proof }),
    },
    body: JSON.stringify(body),
  });
}

async function runInactivityJobWithStepUp(input: {
  justification: string;
  acknowledgement: string;
  password: string;
  totp: string;
  step_up_mode: "five_minutes" | "always";
}): Promise<SecurityJobState> {
  const body = {
    justification: input.justification,
    acknowledgement: input.acknowledgement,
  };
  const session = await browserControlApi.session();
  const stepUp = await performStepUp(
    session,
    input.password,
    input.totp,
    input.step_up_mode === "always"
      ? {
          method: "POST",
          route_id: "security.inactivity_job.run",
          target_ids: [],
          body,
        }
      : undefined,
  );
  return request("/api/v2/security/jobs/inactivity/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      ...(stepUp.proof === undefined
        ? {}
        : { "x-step-up-proof": stepUp.proof }),
    },
    body: JSON.stringify(body),
  });
}

async function executeGlobalSecurityEventWithStepUp(
  kind: "password_change" | "totp_reset",
  version: number,
  input: {
    justification: string;
    acknowledgement: string;
    password: string;
    totp: string;
  },
): Promise<GlobalSecurityEvent> {
  const body = {
    justification: input.justification,
    acknowledgement: input.acknowledgement,
  };
  const session = await browserControlApi.session();
  const idempotencyKey = crypto.randomUUID();
  const routeId = `security.events.${kind}`;
  const stepUp = await performStepUp(session, input.password, input.totp, {
    method: "POST",
    route_id: routeId,
    target_ids: [],
    expected_version: version,
    idempotency_key: idempotencyKey,
    body,
  });
  if (stepUp.proof === undefined) {
    throw new ControlApiError(
      "step_up_required",
      "A proof for this exact security event is required.",
    );
  }
  const suffix = kind === "password_change" ? "password-change" : "totp-reset";
  return request(`/api/v2/security/events/${suffix}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "x-step-up-proof": stepUp.proof,
      "if-match": `"${version}"`,
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

async function performStepUp(
  session: ControlSession,
  password: string,
  totp: string,
  operation?: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    route_id: string;
    target_ids: string[];
    expected_version?: number;
    idempotency_key?: string;
    body: unknown;
  },
): Promise<{ mode: "five_minutes" | "always"; proof?: string }> {
  return request("/api/v2/auth/step-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
    },
    body: JSON.stringify({
      password,
      totp,
      ...(operation === undefined ? {} : { operation }),
    }),
  });
}

async function mutation<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  expectedVersion?: number,
  idempotent = false,
): Promise<T> {
  const session = await browserControlApi.session();
  return request<T>(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      ...(expectedVersion === undefined
        ? {}
        : { "if-match": `"${expectedVersion}"` }),
      ...(idempotent ? { "idempotency-key": crypto.randomUUID() } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function deleteServiceWithStepUp(
  service: ControlServiceDetail,
  justification: string,
  password: string,
  totp: string,
): Promise<{ service_id: string; deleted: true }> {
  const session = await browserControlApi.session();
  const idempotencyKey = crypto.randomUUID();
  const body = { justification };
  const operation = {
    method: "DELETE" as const,
    route_id: "services.delete",
    target_ids: [service.id],
    expected_version: service.version,
    idempotency_key: idempotencyKey,
    body,
  };
  const stepUp = await request<{ mode: "five_minutes" | "always"; proof?: string }>(
    "/api/v2/auth/step-up",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrf_token,
      },
      body: JSON.stringify({ password, totp, operation }),
    },
  );
  if (stepUp.mode !== "always" || stepUp.proof === undefined) {
    throw new ControlApiError(
      "step_up_required",
      "A proof for this exact deletion is required.",
    );
  }
  return request(`/api/v2/services/${service.id}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
      "x-step-up-proof": stepUp.proof,
      "if-match": `"${service.version}"`,
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

async function approveSelfApiKeyWithStepUp(
  credential: ControlCredential,
  input: {
    value: string;
    capture_last_four: boolean;
    justification: string;
    risk_acknowledgement: string;
    password: string;
    totp: string;
  },
): Promise<{
  credential: ControlCredential;
  approval: SelfApiKeyApproval;
}> {
  const session = await browserControlApi.session();
  const idempotencyKey = crypto.randomUUID();
  const body = {
    value: input.value,
    capture_last_four: input.capture_last_four,
    justification: input.justification,
    risk_acknowledgement: input.risk_acknowledgement,
  };
  const operation = {
    method: "PUT" as const,
    route_id: "credentials.self_api_key.approve",
    target_ids: [credential.id, credential.service_id].sort(),
    expected_version: credential.version,
    idempotency_key: idempotencyKey,
    body,
  };
  const stepUp = await request<{
    mode: "five_minutes" | "always";
    proof?: string;
  }>("/api/v2/auth/step-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": session.csrf_token,
    },
    body: JSON.stringify({
      password: input.password,
      totp: input.totp,
      operation,
    }),
  });
  if (stepUp.mode !== "always" || stepUp.proof === undefined) {
    throw new ControlApiError(
      "step_up_required",
      "A proof for this exact credential approval is required.",
    );
  }
  return request(
    `/api/v2/services/${credential.service_id}/credentials/${credential.id}/self-api-key`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrf_token,
        "x-step-up-proof": stepUp.proof,
        "if-match": `"${credential.version}"`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    },
  );
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ControlApiError("invalid_response", "The control service returned an invalid response.");
  }
  if (!response.ok) {
    const error = payload as { error?: { code?: unknown; message?: unknown } };
    const code = typeof error.error?.code === "string"
      ? error.error.code
      : "request_failed";
    const message = typeof error.error?.message === "string"
      ? error.error.message
      : "The request could not be completed.";
    throw new ControlApiError(code, message);
  }
  const envelope = payload as Partial<Envelope<T>>;
  if (!("data" in envelope)) {
    throw new ControlApiError("invalid_response", "The control service returned an invalid response.");
  }
  return envelope.data as T;
}
