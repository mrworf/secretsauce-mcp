import { useEffect, useState } from "react";
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
    const result = await api.revokeSession(session.id, global);
    setSessions((current) => current.map((entry) =>
      entry.id === session.id && result.revoked
        ? { ...entry, status: "revoked" }
        : entry));
    setMessage(result.revoked ? "Session revoked." : "Session was already inactive.");
  }

  async function revokeGrant(grant: OAuthGrantAccess) {
    setError("");
    const result = await api.revokeOAuthGrant(grant.id);
    setGrants((current) => current.map((entry) =>
      entry.id === grant.id && result.revoked
        ? { ...entry, oauth_grant_status: "revoked", usable: false }
        : entry));
    setMessage(result.revoked ? "OAuth connection revoked." : "Connection was already inactive.");
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
      {loading
        ? <section className="content-panel"><p role="status">Loading access metadata…</p></section>
        : (
          <>
            <AccessList
              title={global ? "Global browser sessions" : "Your sessions"}
              empty="No browser sessions are visible."
              rows={sessions.map((session) => ({
                id: session.id,
                heading: session.current
                  ? `${session.user_label} · Current session`
                  : session.user_label,
                facts: [
                  `Status: ${label(session.status)}`,
                  `Last used: ${date(session.last_used_at)}`,
                  `Expires: ${date(session.expires_at)}`,
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
              title={global ? "Global MCP connections" : "Your MCP connections"}
              empty="No OAuth connections are visible."
              rows={grants.map((grant) => ({
                id: grant.id,
                heading: grant.client_name,
                facts: [
                  global ? grant.user_label : grant.client_identifier,
                  `OAuth grant: ${label(grant.oauth_grant_status)}`,
                  `Current services: ${grant.services.join(", ") || "None"}`,
                  `Last used: ${date(grant.last_used_at)}`,
                ],
                action: !global && grant.oauth_grant_status === "active"
                  ? {
                      label: "Revoke connection",
                      run: () => void revokeGrant(grant).catch((caught) =>
                        setError(messageFor(caught))),
                    }
                  : undefined,
              }))}
            />
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

function AccessList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    heading: string;
    facts: string[];
    action?: { label: string; run(): void };
  }>;
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
