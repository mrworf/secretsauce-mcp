import { useEffect, useState } from "react";
import { Link } from "./routing";
import {
  browserControlApi,
  ControlApiError,
  type AccessControlApi,
  type AccessSession,
  type OAuthGrantAccess,
  type ServiceGrantAccess,
  type UserRole,
} from "./controlApi";

export function AccessPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: AccessControlApi;
}) {
  const global = role === "superadmin";
  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [grants, setGrants] = useState<OAuthGrantAccess[]>([]);
  const [serviceAccess, setServiceAccess] = useState<ServiceGrantAccess[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceId, setServiceId] = useState("");
  const [justification, setJustification] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessTotp, setAccessTotp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPersonal() {
    setLoading(true);
    setError("");
    try {
      const [sessionPage, grantPage] = await Promise.all([
        api.listSessions(global),
        api.listOAuthGrants(global),
      ]);
      setSessions(sessionPage.items);
      setGrants(grantPage.items);
      if (role !== "user") {
        const servicePage = await api.listServices();
        const visible = servicePage.services.map(({ id, name }) => ({ id, name }));
        setServices(visible);
        setServiceId((current) => current || visible[0]?.id || "");
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonal();
  }, [role]);

  useEffect(() => {
    if (serviceId === "") {
      setServiceAccess([]);
      return;
    }
    api.serviceGrantAccess(serviceId)
      .then(({ items }) => setServiceAccess(items))
      .catch((caught) => setError(messageFor(caught)));
  }, [api, serviceId]);

  async function revokeSession(session: AccessSession) {
    setError("");
    if (global && (accessPassword === "" || !/^\d{6}$/.test(accessTotp))) {
      setError("Enter your password and six-digit TOTP before administrative revocation.");
      return;
    }
    const result = global
      ? await api.revokeSession(
          session.id,
          true,
          { password: accessPassword, totp: accessTotp },
        )
      : await api.revokeSession(session.id);
    setSessions((current) => current.map((entry) =>
      entry.id === session.id && result.revoked
        ? { ...entry, status: "revoked" }
        : entry));
    setMessage(result.revoked ? "Session revoked." : "Session was already inactive.");
    if (global && session.current && result.revoked) {
      window.location.assign("/control/login");
    }
  }

  async function revokeGrant(grant: OAuthGrantAccess) {
    setError("");
    if (global && (accessPassword === "" || !/^\d{6}$/.test(accessTotp))) {
      setError("Enter your password and six-digit TOTP before administrative revocation.");
      return;
    }
    const result = global
      ? await api.revokeOAuthGrant(
          grant.id,
          true,
          { password: accessPassword, totp: accessTotp },
        )
      : await api.revokeOAuthGrant(grant.id);
    setGrants((current) => current.map((entry) =>
      entry.id === grant.id && result.revoked
        ? { ...entry, oauth_grant_status: "revoked", usable: false }
        : entry));
    setMessage(result.revoked ? "OAuth connection revoked." : "Connection was already inactive.");
  }

  async function revokeAllAdministrativeSessions() {
    if (
      justification.trim() === ""
      || accessPassword === ""
      || !/^\d{6}$/.test(accessTotp)
    ) {
      setError("Enter justification, password, and a six-digit TOTP.");
      return;
    }
    if (!window.confirm(
      "Revoke every web session globally, including this current session?",
    )) return;
    setError("");
    try {
      await api.revokeAdministrativeSessions({
        target: { kind: "all" },
        confirmation: "REVOKE ALL WEB SESSIONS",
        justification: justification.trim(),
        password: accessPassword,
        totp: accessTotp,
      });
      window.location.assign("/control/login");
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeAllAdministrativeGrants() {
    if (
      justification.trim() === ""
      || accessPassword === ""
      || !/^\d{6}$/.test(accessTotp)
    ) {
      setError("Enter justification, password, and a six-digit TOTP.");
      return;
    }
    if (!window.confirm("Revoke every agent connection globally?")) return;
    setError("");
    try {
      const result = await api.revokeAdministrativeOAuthGrants({
        target: { kind: "all" },
        confirmation: "REVOKE ALL OAUTH GRANTS",
        justification: justification.trim(),
        password: accessPassword,
        totp: accessTotp,
      });
      setGrants((current) => current.map((entry) => ({
        ...entry,
        oauth_grant_status: "revoked",
        usable: false,
      })));
      setMessage(`${result.grants_revoked} agent connections revoked globally.`);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeAllSessions() {
    if (!window.confirm(
      "Revoke all your web sessions, including this current session?",
    )) return;
    setError("");
    try {
      await api.revokeAllOwnSessions();
      window.location.assign("/control/login");
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeAllGrants() {
    if (!window.confirm("Revoke all your agent connections?")) return;
    setError("");
    try {
      const result = await api.revokeAllOwnOAuthGrants();
      setGrants((current) => current.map((entry) => ({
        ...entry,
        oauth_grant_status: "revoked",
        usable: false,
      })));
      setMessage(`${result.grants_revoked} agent connections revoked.`);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function invalidateAssignment(row: ServiceGrantAccess) {
    if (justification.trim() === "") {
      setError("Enter a justification before invalidating capabilities.");
      return;
    }
    setError("");
    try {
      const result = await api.invalidateCapabilities(
        row.service_id,
        { kind: "assignment", user_id: row.user_id },
        justification,
      );
      setServiceAccess((current) => current.map((entry) =>
        entry.grant_id === row.grant_id
          ? { ...entry, capability_status: "invalid" }
          : entry));
      setMessage(
        `${result.invalidated_references} dynamic references invalidated; no OAuth grants were revoked.`,
      );
      setJustification("");
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="account-settings-heading">
        <p className="card-kicker">Account Settings</p>
        <h2 id="account-settings-heading">Profile and authentication</h2>
        <div className="button-row">
          <Link className="button-link" to="/profile">Profile</Link>
          <Link className="button-link" to="/security">Password and TOTP</Link>
        </div>
      </section>
      <section className="content-panel access-explainer" aria-labelledby="access-boundaries">
        <p className="card-kicker">Two distinct controls</p>
        <h2 id="access-boundaries">Connections are not capabilities</h2>
        <p className="muted-copy">
          Revoking an OAuth connection ends that client connection, but does not change
          service assignments or policy. Invalidating a capability removes current dynamic
          references, but does not revoke the OAuth connection.
        </p>
      </section>

      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      {message !== "" && <p className="success-copy" role="status">{message}</p>}
      {global && (
        <section className="content-panel" aria-labelledby="access-step-up-heading">
          <h2 id="access-step-up-heading">Administrative confirmation</h2>
          <p className="muted-copy">
            Administrative revocation requires a fresh operation-bound security check.
          </p>
          <div className="profile-form">
            <label>
              Justification
              <input
                value={justification}
                maxLength={1024}
                onChange={(event) => setJustification(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={accessPassword}
                onChange={(event) => setAccessPassword(event.target.value)}
              />
            </label>
            <label>
              TOTP
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={accessTotp}
                onChange={(event) => setAccessTotp(event.target.value)}
              />
            </label>
          </div>
        </section>
      )}
      {loading
        ? <section className="content-panel"><p role="status">Loading access metadata…</p></section>
        : (
          <>
            <AccessList
              title={global ? "Global web sessions" : "Web sessions"}
              empty="No browser sessions are visible."
              footer={!global && sessions.some(({ status }) => status === "active")
                ? {
                    label: "Revoke all my web sessions",
                    run: () => void revokeAllSessions(),
                  }
                : global && sessions.some(({ status }) => status === "active")
                  ? {
                      label: "Revoke all web sessions globally",
                      run: () => void revokeAllAdministrativeSessions(),
                    }
                  : undefined}
              rows={sessions.map((session) => ({
                id: session.id,
                heading: session.current
                  ? `${session.user_label} · Current session`
                  : session.user_label,
                facts: [
                  `Status: ${label(session.status)}`,
                  `Created: ${date(session.issued_at)}`,
                  `Last used: ${date(session.last_used_at)}`,
                  `Expires: ${date(session.expires_at)}`,
                  `Authentication: ${session.authentication_method === null
                    ? "Unknown"
                    : label(session.authentication_method)}`,
                  `Device: ${session.device_family ?? "Unknown"}`,
                  `Source network: ${session.coarse_source ?? "Unknown"}`,
                ],
                action: session.status === "active"
                  ? {
                      label: "Revoke session",
                      run: () => void revokeSession(session).catch((caught) =>
                        setError(messageFor(caught))),
                    }
                  : undefined,
              }))}
            />
            <AccessList
              title={global ? "Global agent connections" : "Agent connections"}
              empty="No OAuth connections are visible."
              footer={!global && grants.some(({ oauth_grant_status }) =>
                oauth_grant_status === "active")
                ? {
                    label: "Revoke all my agent connections",
                    run: () => void revokeAllGrants(),
                  }
                : global && grants.some(({ oauth_grant_status }) =>
                  oauth_grant_status === "active")
                  ? {
                      label: "Revoke all agent connections globally",
                      run: () => void revokeAllAdministrativeGrants(),
                    }
                  : undefined}
              rows={grants.map((grant) => ({
                id: grant.id,
                heading: grant.client_name,
                facts: [
                  global ? grant.user_label : grant.client_identifier,
                  `OAuth grant: ${label(grant.oauth_grant_status)}`,
                  `Authentication: ${label(grant.authentication_method)}`,
                  `Scopes: ${grant.scopes.join(", ") || "None"}`,
                  `Current services: ${grant.services.join(", ") || "None"}`,
                  `Created: ${date(grant.issued_at)}`,
                  `Last used: ${date(grant.last_used_at)}`,
                  `Expires: ${date(grant.expires_at)}`,
                ],
                action: grant.oauth_grant_status === "active"
                  ? {
                      label: "Revoke connection",
                      run: () => void revokeGrant(grant).catch((caught) =>
                        setError(messageFor(caught))),
                    }
                  : undefined,
              }))}
            />
            <p className="muted-copy">
              Device and source-network labels are informational and do not bind
              authentication authority.
            </p>
          </>
        )}

      {role !== "user" && (
        <section className="content-panel" aria-labelledby="dynamic-access-heading">
          <div className="section-toolbar">
            <div>
              <p className="card-kicker">Service-scoped administration</p>
              <h2 id="dynamic-access-heading">Dynamic service access</h2>
            </div>
            <label>
              Service
              <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                {services.map((service) =>
                  <option value={service.id} key={service.id}>{service.name}</option>)}
              </select>
            </label>
          </div>
          <label className="access-justification">
            Invalidation justification
            <input
              value={justification}
              maxLength={1024}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Why current dynamic capability must end"
            />
          </label>
          <div className="access-grid">
            {serviceAccess.length === 0 && (
              <p className="muted-copy">No current grant relationship is visible for this service.</p>
            )}
            {serviceAccess.map((row) => (
              <article className="access-card" key={row.grant_id}>
                <div>
                  <h3>{row.user_label}</h3>
                  <p>{row.client_name}</p>
                </div>
                <dl className="access-facts">
                  <div><dt>OAuth grant</dt><dd>{label(row.oauth_grant_status)}</dd></div>
                  <div><dt>Capability</dt><dd>{label(row.capability_status)}</dd></div>
                  <div><dt>Gateway refs</dt><dd>{row.references.gref.active}</dd></div>
                  <div><dt>Response refs</dt><dd>{row.references.sec.active}</dd></div>
                </dl>
                <button
                  type="button"
                  className="danger-button"
                  disabled={row.capability_status !== "active"}
                  onClick={() => void invalidateAssignment(row)}
                >
                  Invalidate capabilities
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function UserAccessPanel({
  actorRole,
  userId,
  userLabel,
  api = browserControlApi,
}: {
  actorRole: "admin" | "superadmin";
  userId: string;
  userLabel: string;
  api?: AccessControlApi;
}) {
  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [grants, setGrants] = useState<OAuthGrantAccess[]>([]);
  const [justification, setJustification] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setError("");
    Promise.all([
      actorRole === "superadmin"
        ? api.listSessions(true, userId)
        : Promise.resolve({ items: [] as AccessSession[] }),
      api.listOAuthGrants(true, userId),
    ]).then(([sessionPage, grantPage]) => {
      setSessions(sessionPage.items);
      setGrants(grantPage.items);
    }).catch((caught) => setError(messageFor(caught)));
  }, [actorRole, api, userId]);

  function credentials(): { password: string; totp: string } | undefined {
    if (password === "" || !/^\d{6}$/.test(totp)) {
      setError("Enter your password and six-digit TOTP.");
      return undefined;
    }
    return { password, totp };
  }

  async function revokeSession(session: AccessSession) {
    const proof = credentials();
    if (proof === undefined) return;
    setError("");
    try {
      const result = await api.revokeSession(session.id, true, proof);
      setSessions((current) => current.map((entry) =>
        entry.id === session.id && result.revoked
          ? { ...entry, status: "revoked" }
          : entry));
      setMessage(result.revoked ? "Web session revoked." : "Session was already inactive.");
      if (session.current && result.revoked) window.location.assign("/control/login");
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeGrant(grant: OAuthGrantAccess) {
    const proof = credentials();
    if (proof === undefined) return;
    setError("");
    try {
      const result = await api.revokeOAuthGrant(grant.id, true, proof);
      setGrants((current) => current.map((entry) =>
        entry.id === grant.id && result.revoked
          ? { ...entry, oauth_grant_status: "revoked", usable: false }
          : entry));
      setMessage(result.revoked
        ? "Agent connection revoked."
        : "Connection was already inactive.");
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeUserSessions() {
    const proof = credentials();
    if (proof === undefined || justification.trim() === "") {
      if (justification.trim() === "") setError("Enter a justification.");
      return;
    }
    if (!window.confirm(`Revoke every web session for ${userLabel}?`)) return;
    try {
      const result = await api.revokeAdministrativeSessions({
        target: { kind: "user", id: userId },
        confirmation: `REVOKE USER SESSIONS ${userId}`,
        justification: justification.trim(),
        ...proof,
      });
      setSessions((current) => current.map((entry) => ({
        ...entry,
        status: entry.status === "active" ? "revoked" : entry.status,
      })));
      setMessage(`${result.sessions_revoked} web sessions revoked.`);
      if (sessions.some(({ current }) => current) && result.revoked) {
        window.location.assign("/control/login");
      }
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  async function revokeUserGrants() {
    const proof = credentials();
    if (proof === undefined || justification.trim() === "") {
      if (justification.trim() === "") setError("Enter a justification.");
      return;
    }
    if (!window.confirm(`Revoke every visible agent connection for ${userLabel}?`)) return;
    try {
      const result = await api.revokeAdministrativeOAuthGrants({
        target: { kind: "user", id: userId },
        confirmation: `REVOKE USER ${userId}`,
        justification: justification.trim(),
        ...proof,
      });
      setGrants((current) => current.map((entry) => ({
        ...entry,
        oauth_grant_status: "revoked",
        usable: false,
      })));
      setMessage(`${result.grants_revoked} agent connections revoked.`);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }

  return (
    <section className="content-panel" aria-labelledby={`user-access-${userId}`}>
      <p className="card-kicker">Authorized access metadata</p>
      <h3 id={`user-access-${userId}`}>Sessions and connections for {userLabel}</h3>
      <p className="muted-copy">
        Administrative actions are reauthorized when submitted. Device and source
        labels are informational.
      </p>
      <div className="profile-form">
        <label>
          Access justification
          <input
            maxLength={1024}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </label>
        <label>
          Access password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Access TOTP
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={totp}
            onChange={(event) => setTotp(event.target.value)}
          />
        </label>
      </div>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      {message !== "" && <p className="success-copy" role="status">{message}</p>}
      {actorRole === "superadmin" && (
        <AccessList
          title="User web sessions"
          empty="No browser sessions are visible."
          footer={sessions.some(({ status }) => status === "active")
            ? {
                label: "Revoke all user web sessions",
                run: () => void revokeUserSessions(),
              }
            : undefined}
          rows={sessions.map((session) => ({
            id: session.id,
            heading: session.current ? "Current session" : "Web session",
            facts: [
              `Status: ${label(session.status)}`,
              `Device: ${session.device_family ?? "Unknown"}`,
              `Source network: ${session.coarse_source ?? "Unknown"}`,
            ],
            action: session.status === "active"
              ? {
                  label: "Revoke user session",
                  run: () => void revokeSession(session),
                }
              : undefined,
          }))}
        />
      )}
      <AccessList
        title="User agent connections"
        empty="No authorized agent connections are visible."
        footer={grants.some(({ oauth_grant_status }) =>
          oauth_grant_status === "active")
          ? {
              label: "Revoke all visible user connections",
              run: () => void revokeUserGrants(),
            }
          : undefined}
        rows={grants.map((grant) => ({
          id: grant.id,
          heading: grant.client_name,
          facts: [
            `Status: ${label(grant.oauth_grant_status)}`,
            `Services: ${grant.services.join(", ") || "None"}`,
            `Scopes: ${grant.scopes.join(", ") || "None"}`,
          ],
          action: grant.oauth_grant_status === "active"
            ? {
                label: "Revoke user connection",
                run: () => void revokeGrant(grant),
              }
            : undefined,
        }))}
      />
    </section>
  );
}

function AccessList({
  title,
  empty,
  rows,
  footer,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    heading: string;
    facts: string[];
    action?: { label: string; run(): void };
  }>;
  footer?: { label: string; run(): void };
}) {
  return (
    <section className="content-panel">
      <h2>{title}</h2>
      {rows.length === 0
        ? <p className="muted-copy">{empty}</p>
        : (
          <div className="access-grid">
            {rows.map((row) => (
              <article className="access-card" key={row.id}>
                <h3>{row.heading}</h3>
                <ul>{row.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                {row.action !== undefined && (
                  <button type="button" className="danger-button" onClick={row.action.run}>
                    {row.action.label}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      {footer !== undefined && (
        <button type="button" className="danger-button" onClick={footer.run}>
          {footer.label}
        </button>
      )}
    </section>
  );
}

function date(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function messageFor(error: unknown): string {
  if (error instanceof ControlApiError) return error.message;
  return "The access operation could not be completed.";
}
