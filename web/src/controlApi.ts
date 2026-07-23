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
    code: "service_archived" | "service_admin_required" | "destination_required";
    pointer: "/lifecycle" | "/admins" | "/destinations";
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
  actor_role: "admin" | "superadmin";
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
    GroupControlApi & CredentialControlApi = {
  session: () => get<ControlSession>("/api/v2/auth/session"),
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
    get(`/api/v2/services/${encodeURIComponent(serviceId)}/access`),
  ownServices: () => get("/api/v2/users/me/services"),
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
};

function safeProviderId(providerId: string): string {
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(providerId)) {
    throw new ControlApiError("invalid_request", "The provider is invalid.");
  }
  return encodeURIComponent(providerId);
}

async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
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
