import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  browserControlApi,
  ControlApiError,
  type ControlApi,
  type ControlUser,
  type GroupControlApi,
  type OneTimeUser,
  type OidcControlApi,
  type OidcManagementApi,
  type OidcManagementLink,
  type OwnService,
  type UserAction,
  type UserProfileInput,
  type UserRole,
  type UserStatus,
} from "./controlApi";

export function UsersPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: ControlApi;
}) {
  const [users, setUsers] = useState<ControlUser[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oneTime, setOneTime] = useState<OneTimeUser>();
  const selected = users.find((user) => user.id === selectedId);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api.listUsers({
        ...(query.trim() === "" ? {} : { q: query }),
        ...(roleFilter === "" ? {} : { role: roleFilter }),
        ...(statusFilter === "" ? {} : { status: statusFilter }),
      });
      setUsers(result.users);
      setSelectedId((current) =>
        current !== undefined && result.users.some(({ id }) => id === current)
          ? current
          : result.users[0]?.id
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (role !== "user") void load();
  }, [role]); // Initial load is explicit; filters submit as one bounded query.

  function replaceUser(user: ControlUser) {
    setUsers((current) => current.map((entry) => entry.id === user.id ? user : entry));
    setSelectedId(user.id);
  }

  if (role === "user") {
    return (
      <section className="content-panel">
        <h2>User administration is restricted</h2>
        <p className="muted-copy">
          Your account is available from <Link to="/profile">Profile</Link>. Other-user
          records are not shown.
        </p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="user-directory-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Authorized directory</p>
            <h2 id="user-directory-heading">Users</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
        <form className="filter-grid" onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}>
          <label>
            Search
            <input
              value={query}
              maxLength={512}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email or name"
            />
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(event) =>
              setRoleFilter(event.target.value as UserRole | "")}>
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) =>
              setStatusFilter(event.target.value as UserStatus | "")}>
              <option value="">All statuses</option>
              {["active", "invited", "enrollment_required", "suspended", "deactivated"]
                .map((status) => <option value={status} key={status}>{label(status)}</option>)}
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {loading
          ? <p role="status">Loading authorized users…</p>
          : (
            <div className="user-layout">
              <div className="user-list" aria-label="Authorized users">
                {users.length === 0 && <p>No users match this authorized view.</p>}
                {users.map((user) => (
                  <button
                    type="button"
                    className={user.id === selectedId ? "user-card selected" : "user-card"}
                    key={user.id}
                    onClick={() => setSelectedId(user.id)}
                  >
                    <span>
                      <strong>{displayName(user)}</strong>
                      <small>{user.email}</small>
                    </span>
                    <span className="label-row">
                      <StatusLabel value={user.role} />
                      <StatusLabel value={user.status} />
                    </span>
                  </button>
                ))}
              </div>
              {selected !== undefined && (
                <UserDetail
                  user={selected}
                  actorRole={role}
                  api={api}
                  onChange={replaceUser}
                  onDelete={(id) => {
                    setUsers((current) => current.filter((user) => user.id !== id));
                    setSelectedId(undefined);
                  }}
                  onOneTime={setOneTime}
                />
              )}
            </div>
          )}
      </section>
      <InvitePanel
        role={role}
        api={api}
        onInvited={(result) => {
          setUsers((current) => [...current, result.user]
            .sort((left, right) => left.email.localeCompare(right.email)));
          setSelectedId(result.user.id);
          setOneTime(result);
        }}
      />
      <OneTimePanel result={oneTime} onDismiss={() => setOneTime(undefined)} />
    </div>
  );
}

export function ProfilePage({
  api = browserControlApi,
}: {
  api?: ControlApi & Pick<GroupControlApi, "ownServices">;
}) {
  const [user, setUser] = useState<ControlUser>();
  const [services, setServices] = useState<OwnService[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api.self(), api.ownServices()])
      .then(([profile, result]) => {
        setUser(profile);
        setServices(result.services);
      })
      .catch((caught) => setError(messageFor(caught)));
  }, [api]);

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="profile-heading">
        <p className="card-kicker">Personal account</p>
        <h2 id="profile-heading">Profile</h2>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {user === undefined
          ? <p role="status">Loading your profile…</p>
          : (
            <ProfileForm
              user={user}
              submitLabel="Save profile"
              onSubmit={async (profile) => {
                setSaved(false);
                const updated = await api.updateSelf(user, profile);
                setUser(updated);
                setSaved(true);
              }}
            />
          )}
        {saved && <p className="success-copy" role="status">Profile saved.</p>}
      </section>
      <section className="content-panel">
        <p className="card-kicker">Current authorization</p>
        <h2>My services</h2>
        {services.length === 0 ? (
          <p className="muted-copy">No services are currently assigned to your account.</p>
        ) : (
          <ul className="own-service-list">
            {services.map((service) => (
              <li key={service.id}>
                <strong>{service.name}</strong>
                <span>{service.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="content-panel">
        <h2>Security</h2>
        <p className="muted-copy">
          Password, authenticator, and recovery actions stay isolated from profile edits.
        </p>
        <Link className="button-link" to="/security">Open security actions</Link>
      </section>
    </div>
  );
}

function UserDetail({
  user,
  actorRole,
  api,
  onChange,
  onDelete,
  onOneTime,
}: {
  user: ControlUser;
  actorRole: UserRole;
  api: ControlApi;
  onChange(user: ControlUser): void;
  onDelete(id: string): void;
  onOneTime(result: OneTimeUser): void;
}) {
  const [action, setAction] = useState<UserAction>();
  const [error, setError] = useState("");
  const canManage =
    (actorRole === "superadmin" &&
      !(user.role === "superadmin" && user.status === "deactivated")) ||
    (actorRole === "admin" && user.role === "user");

  return (
    <article className="user-detail" aria-labelledby="selected-user-heading">
      <p className="card-kicker">Selected user</p>
      <h3 id="selected-user-heading">{displayName(user)}</h3>
      <dl className="detail-list">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Role</dt><dd>{label(user.role)}</dd></div>
        <div><dt>Status</dt><dd>{label(user.status)}</dd></div>
        <div><dt>Password</dt><dd>{label(user.password_state)}</dd></div>
        <div><dt>Authenticator</dt><dd>{label(user.totp_state)}</dd></div>
      </dl>
      {canManage && (
        <>
          <ProfileForm
            user={user}
            submitLabel="Update user profile"
            onSubmit={async (profile) => onChange(await api.updateUser(user, profile))}
          />
          <div className="action-grid" aria-label="User lifecycle actions">
            {actionsFor(user, actorRole).map(({ value, text, destructive }) => (
              <button
                type="button"
                className={destructive ? "danger-button" : undefined}
                key={value}
                onClick={() => setAction(value)}
              >
                {text}
              </button>
            ))}
          </div>
        </>
      )}
      {actorRole === "superadmin" && isOidcManagementApi(api) && (
        <OidcLinksPanel
          user={user}
          api={api}
          onVersion={(version) => onChange({ ...user, version })}
        />
      )}
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      {action !== undefined && (
        <ConfirmationPanel
          user={user}
          action={action}
          onCancel={() => setAction(undefined)}
          onConfirm={async (justification, nextRole) => {
            setError("");
            try {
              const result = await api.userAction(user, action, justification, nextRole);
              if ("deleted" in result) onDelete(result.user_id);
              else if ("user" in result) {
                onChange(result.user);
                onOneTime(result);
              } else onChange(result);
              setAction(undefined);
            } catch (caught) {
              setError(messageFor(caught));
            }
          }}
        />
      )}
    </article>
  );
}

export function OidcLinksPanel({
  user,
  api,
  onVersion,
}: {
  user: ControlUser;
  api: ControlApi & OidcControlApi & OidcManagementApi;
  onVersion(version: number): void;
}) {
  const [links, setLinks] = useState<OidcManagementLink[]>([]);
  const [providers, setProviders] = useState<Array<{ id: string; display_name: string }>>([]);
  const [providerId, setProviderId] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.listOidcLinks(user.id), api.oidcProviders()])
      .then(([linked, configured]) => {
        setLinks(linked.links);
        setProviders(configured.providers);
        setProviderId((current) => current || configured.providers[0]?.id || "");
      })
      .catch((caught) => setError(messageFor(caught)));
  }, [api, user.id, user.version]);

  async function begin() {
    if (providerId === "" || justification.trim() === "") return;
    setBusy(true);
    setError("");
    try {
      const result = await api.beginOidcLink(
        user,
        providerId,
        justification.trim(),
      );
      window.location.assign(result.authorization_url);
    } catch (caught) {
      setError(messageFor(caught));
      setBusy(false);
    }
  }

  async function unlink(link: OidcManagementLink) {
    if (justification.trim() === "") {
      setError("A justification is required.");
      return;
    }
    if (!window.confirm(`Remove ${link.provider_display_name} from ${user.email}?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.unlinkOidc(user, link.id, justification.trim());
      setLinks((current) => current.filter(({ id }) => id !== link.id));
      onVersion(result.version);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="oidc-links" aria-labelledby={`oidc-links-${user.id}`}>
      <h4 id={`oidc-links-${user.id}`}>External identities</h4>
      {links.length === 0
        ? <p className="muted-copy">No external identity is linked.</p>
        : (
            <ul className="compact-list">
              {links.map((link) => (
                <li key={link.id}>
                  <span>{link.provider_display_name}</span>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busy}
                    onClick={() => void unlink(link)}
                  >
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
          )}
      <label>
        Provider
        <select
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          disabled={busy}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.display_name}</option>
          ))}
        </select>
      </label>
      <label>
        Justification
        <textarea
          maxLength={1_024}
          required
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || providerId === "" || justification.trim() === ""}
        onClick={() => void begin()}
      >
        {busy ? "Working…" : "Link external identity"}
      </button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function isOidcManagementApi(
  api: ControlApi,
): api is ControlApi & OidcControlApi & OidcManagementApi {
  const candidate = api as Partial<OidcControlApi & OidcManagementApi>;
  return typeof candidate.oidcProviders === "function" &&
    typeof candidate.listOidcLinks === "function" &&
    typeof candidate.beginOidcLink === "function" &&
    typeof candidate.unlinkOidc === "function";
}

function ProfileForm({
  user,
  submitLabel,
  onSubmit,
}: {
  user: ControlUser;
  submitLabel: string;
  onSubmit(profile: UserProfileInput): Promise<void>;
}) {
  const [profile, setProfile] = useState<UserProfileInput>({
    email: user.email,
    given_name: user.given_name,
    family_name: user.family_name,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile({
      email: user.email,
      given_name: user.given_name,
      family_name: user.family_name,
    });
  }, [user.id, user.version]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(profile);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={(event) => void submit(event)}>
      <label>Email<input type="email" required maxLength={254} value={profile.email}
        onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
      <div className="field-pair">
        <label>Given name<input maxLength={100} value={profile.given_name}
          onChange={(event) => setProfile({ ...profile, given_name: event.target.value })} /></label>
        <label>Family name<input maxLength={100} value={profile.family_name}
          onChange={(event) => setProfile({ ...profile, family_name: event.target.value })} /></label>
      </div>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
    </form>
  );
}

function InvitePanel({
  role,
  api,
  onInvited,
}: {
  role: UserRole;
  api: ControlApi;
  onInvited(result: OneTimeUser): void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  if (!["admin", "superadmin"].includes(role)) return null;
  return (
    <section className="content-panel" aria-labelledby="invite-heading">
      <div className="section-toolbar">
        <div><p className="card-kicker">Local identity</p><h2 id="invite-heading">Invite user</h2></div>
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "New invitation"}
        </button>
      </div>
      {open && (
        <form className="profile-form" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError("");
          void api.invite({
            email: String(data.get("email") ?? ""),
            given_name: String(data.get("given_name") ?? ""),
            family_name: String(data.get("family_name") ?? ""),
            role: String(data.get("role")) as "admin" | "user",
          }).then((result) => {
            onInvited(result);
            setOpen(false);
          }).catch((caught) => setError(messageFor(caught)));
        }}>
          <label>Email<input name="email" type="email" required maxLength={254} /></label>
          <div className="field-pair">
            <label>Given name<input name="given_name" maxLength={100} /></label>
            <label>Family name<input name="family_name" maxLength={100} /></label>
          </div>
          <label>Role<select name="role" defaultValue="user">
            <option value="user">User</option>
            {role === "superadmin" && <option value="admin">Admin</option>}
          </select></label>
          {error !== "" && <p className="form-error" role="alert">{error}</p>}
          <button type="submit">Create invitation</button>
        </form>
      )}
    </section>
  );
}

function ConfirmationPanel({
  user,
  action,
  onCancel,
  onConfirm,
}: {
  user: ControlUser;
  action: UserAction;
  onCancel(): void;
  onConfirm(justification: string, role?: UserRole): Promise<void>;
}) {
  const [justification, setJustification] = useState("");
  const [nextRole, setNextRole] = useState<UserRole>(user.role);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="confirmation-panel" role="dialog" aria-modal="true"
      aria-labelledby="confirmation-heading">
      <h4 id="confirmation-heading" ref={heading} tabIndex={-1}>Confirm {label(action)}</h4>
      <p>This action applies to {user.email}. Server authorization and concurrency checks remain authoritative.</p>
      {action === "role" && (
        <label>New role<select value={nextRole}
          onChange={(event) => setNextRole(event.target.value as UserRole)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select></label>
      )}
      <label>Justification<textarea required maxLength={1024} value={justification}
        onChange={(event) => setJustification(event.target.value)} /></label>
      <div className="button-row">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className={action === "delete" || action === "deactivate"
          ? "danger-button" : undefined} disabled={busy || justification.trim() === ""}
          onClick={() => {
            setBusy(true);
            void onConfirm(justification, action === "role" ? nextRole : undefined)
              .finally(() => setBusy(false));
          }}>
          {busy ? "Applying…" : "Confirm action"}
        </button>
      </div>
    </section>
  );
}

function OneTimePanel({
  result,
  onDismiss,
}: {
  result?: OneTimeUser;
  onDismiss(): void;
}) {
  if (result === undefined || !result.one_time_value_displayed) return null;
  return (
    <section className="one-time-panel" aria-labelledby="one-time-heading">
      <div aria-live="assertive" aria-atomic="true">
        <p className="card-kicker">Shown once</p>
        <h2 id="one-time-heading">Temporary password</h2>
        <p>This value cannot be shown again. Transfer it through an approved channel.</p>
        <output>{result.temporary_password}</output>
      </div>
      <div className="button-row">
        <button type="button" onClick={() =>
          void navigator.clipboard.writeText(result.temporary_password ?? "")}>
          Copy temporary password
        </button>
        <button type="button" onClick={onDismiss}>Dismiss</button>
      </div>
    </section>
  );
}

function StatusLabel({ value }: { value: string }) {
  return <span className={`state-label state-${value}`}>{label(value)}</span>;
}

function actionsFor(user: ControlUser, actorRole: UserRole): Array<{
  value: UserAction;
  text: string;
  destructive?: boolean;
}> {
  const actions: Array<{ value: UserAction; text: string; destructive?: boolean }> = [
    { value: "password-reset", text: "Reset password" },
    { value: "totp-reset", text: "Reset authenticator" },
  ];
  if (actorRole === "superadmin") actions.push({ value: "role", text: "Change role" });
  if (user.status === "active") {
    actions.push(
      { value: "suspend", text: "Suspend" },
      { value: "deactivate", text: "Deactivate", destructive: true },
    );
  } else if (user.status === "suspended") {
    actions.push(
      { value: "reactivate", text: "Reactivate" },
      { value: "deactivate", text: "Deactivate", destructive: true },
    );
  } else if (user.status === "deactivated") {
    actions.push({ value: "restore-enrollment", text: "Restore enrollment" });
    if (actorRole === "superadmin") {
      actions.push({ value: "delete", text: "Permanently delete", destructive: true });
    }
  }
  return actions;
}

function displayName(user: ControlUser): string {
  const value = `${user.given_name} ${user.family_name}`.trim();
  return value === "" ? user.email : value;
}

function label(value: string): string {
  return value.replaceAll("-", " ").replaceAll("_", " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

function messageFor(error: unknown): string {
  if (error instanceof ControlApiError && error.code === "step_up_required") {
    return "Additional authentication is required. Complete a security step-up and retry.";
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}
