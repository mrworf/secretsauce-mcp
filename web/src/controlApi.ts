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

export interface OidcControlApi {
  oidcProviders(): Promise<{ providers: OidcProviderLabel[] }>;
  beginOidc(providerId: string): Promise<{ authorization_url: string; expires_at: number }>;
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

export const browserControlApi: ControlApi & OidcControlApi = {
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
};

async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

async function mutation<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
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
