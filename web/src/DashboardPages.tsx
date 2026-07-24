import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  browserControlApi,
  type ActivityDashboard,
  type DashboardControlApi,
  type DashboardRemediation,
  type DashboardWindow,
  type SecurityDashboard,
  type StatusDashboard,
  type UserRole,
} from "./controlApi";

export function OverviewPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: DashboardControlApi;
}) {
  const [data, setData] = useState<{
    activity: ActivityDashboard;
    status: StatusDashboard;
    security: SecurityDashboard;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (role === "user") return;
    let active = true;
    Promise.all([
      api.activityDashboard(),
      api.statusDashboard(),
      api.securityDashboard(),
    ]).then(([activity, status, security]) => {
      if (active) setData({ activity, status, security });
    }).catch(() => {
      if (active) setError("The operator overview is unavailable.");
    });
    return () => {
      active = false;
    };
  }, [api, role]);
  if (role === "user") {
    return <PersonalOverview />;
  }
  if (error) return <DashboardError message={error} />;
  if (data === undefined) return <DashboardLoading label="Loading operator overview" />;
  const unresolved = data.security.remediations.slice(0, 3);
  return (
    <div className="dashboard-stack">
      <section className="metric-grid" aria-label="Operator overview">
        <Metric label="Requests in window" value={data.activity.totals.requests} />
        <Metric label="Authorization denials" value={data.activity.totals.deny} />
        <Metric label="Services in scope" value={data.status.service_count} />
        <Metric label="Open remediations" value={data.security.remediations.length} />
      </section>
      <section className="dashboard-grid">
        <article className="content-panel">
          <p className="card-kicker">Latest activity</p>
          <h2>Authorization outcomes</h2>
          <TrendSummary value={data.activity} />
          <Link className="button-link" to="/activity">Open activity</Link>
        </article>
        <article className="content-panel">
          <p className="card-kicker">Attention</p>
          <h2>Unresolved findings</h2>
          {unresolved.length === 0
            ? <p className="muted-copy">No current findings in your scope.</p>
            : <ul className="signal-list">{unresolved.map((item) =>
                <li key={item.id}><Severity value={item.severity} /> {label(item.code)}</li>)}</ul>}
          <Link className="button-link" to="/security">Open security</Link>
        </article>
      </section>
    </div>
  );
}

export function ActivityPage({
  api = browserControlApi,
}: {
  api?: DashboardControlApi;
}) {
  const [windowValue, setWindowValue] = useState<DashboardWindow>("24h");
  const [serviceId, setServiceId] = useState("");
  const [services, setServices] = useState<ActivityDashboard["services"]>([]);
  const [data, setData] = useState<ActivityDashboard>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    api.activityDashboard({
      window: windowValue,
      ...(serviceId === "" ? {} : { service_id: serviceId }),
    }).then((next) => {
      if (!active) return;
      setData(next);
      if (serviceId === "") setServices(next.services);
    }).catch(() => {
      if (active) setError("Activity reports are unavailable.");
    });
    return () => {
      active = false;
    };
  }, [api, serviceId, windowValue]);
  return (
    <div className="dashboard-stack">
      <section className="content-panel dashboard-filters" aria-labelledby="activity-filter-heading">
        <h2 id="activity-filter-heading">Activity report</h2>
        <label>Window
          <select value={windowValue} onChange={(event) =>
            setWindowValue(event.target.value as DashboardWindow)}>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </label>
        <label>Service
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">All authorized services</option>
            {services.map((service) =>
              <option key={service.service_id} value={service.service_id}>
                {service.service_name}
              </option>)}
          </select>
        </label>
      </section>
      {error && <DashboardError message={error} />}
      {data === undefined && !error && <DashboardLoading label="Loading activity report" />}
      {data !== undefined && !error && <>
        {data.freshness.partial &&
          <p className="dashboard-warning" role="status">Activity rebuild is catching up; totals may be partial.</p>}
        <section className="metric-grid" aria-label="Activity totals">
          <Metric label="Requests" value={data.totals.requests} />
          <Metric label="Allowed" value={data.totals.allow} />
          <Metric label="Denied" value={data.totals.deny} />
          <Metric label="Active users" value={countLabel(data.totals.active_users)} />
          <Metric label="Credential uses" value={data.totals.credential_uses} />
          <Metric label="Response tokenizations" value={data.totals.tokenizations} />
          <Metric label="API key activity" value={data.totals.api_key_activity} />
        </section>
        <section className="content-panel">
          <h2>Outcome trend</h2>
          <TrendBars value={data} />
        </section>
        <section className="dashboard-grid">
          <RankedTable
            heading="Most active services"
            rows={data.services.map((row) => ({
              key: row.service_id,
              name: row.service_name,
              detail: `${row.credential_uses} credential uses`,
              count: row.requests,
            }))}
          />
          <RankedTable
            heading="Policy endpoint categories"
            rows={data.endpoints.map((row) => ({
              key: `${row.service_id}:${row.category}`,
              name: row.category,
              detail: row.service_name,
              count: row.requests,
            }))}
          />
        </section>
      </>}
    </div>
  );
}

export function StatusPage({
  api = browserControlApi,
}: {
  api?: DashboardControlApi;
}) {
  const [data, setData] = useState<StatusDashboard>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.statusDashboard().then((value) => {
      if (active) setData(value);
    }).catch(() => {
      if (active) setError("Status is unavailable.");
    });
    return () => {
      active = false;
    };
  }, [api]);
  if (error) return <DashboardError message={error} />;
  if (data === undefined) return <DashboardLoading label="Loading status" />;
  return (
    <div className="dashboard-stack">
      {data.system !== undefined && <section className="content-panel">
        <h2>Component health</h2>
        <div className="health-grid">
          {Object.entries(data.system.components).map(([name, state]) =>
            <div key={name}><span>{label(name)}</span><Status value={state} /></div>)}
        </div>
        <h3>Background jobs</h3>
        <div className="health-grid">
          {Object.entries(data.system.jobs).map(([name, job]) =>
            <div key={name}><span>{label(name)}</span><Status value={job.state} /></div>)}
        </div>
        <h3>Audit capacity</h3>
        <dl className="health-grid">
          <div><dt>Administrative events</dt><dd>{format(data.system.audit_capacity.administrative_rows)}</dd></div>
          <div><dt>Runtime events</dt><dd>{format(data.system.audit_capacity.runtime_rows)}</dd></div>
          <div><dt>Estimated storage</dt><dd>{formatBytes(data.system.audit_capacity.estimated_bytes)}</dd></div>
        </dl>
        {data.system.audit_capacity.warnings.length > 0 &&
          <ul className="dashboard-warning-list" aria-label="Audit capacity warnings">
            {data.system.audit_capacity.warnings.map((warning) =>
              <li key={warning}>{label(warning)}</li>)}
          </ul>}
        <h3>System posture</h3>
        <dl className="health-grid">
          <div><dt>Active API keys</dt><dd>{format(data.system.api_keys.active)}</dd></div>
          <div><dt>Non-expiring API keys</dt><dd>{format(data.system.api_keys.non_expiring)}</dd></div>
          <div><dt>Pending enrollment</dt><dd>{format(data.system.users.pending_enrollment)}</dd></div>
          <div><dt>Active users without services</dt><dd>{format(data.system.users.active_without_services)}</dd></div>
        </dl>
      </section>}
      <section className="service-status-grid" aria-label="Service status">
        {data.services.map((service) => <article className="content-panel" key={service.service_id}>
          <p className="card-kicker">{label(service.lifecycle)}</p>
          <h2>{service.name}</h2>
          <dl className="status-facts">
            <div><dt>Configured credentials</dt><dd>{service.credentials.configured}</dd></div>
            <div><dt>Unconfigured credentials</dt><dd>{service.credentials.unconfigured}</dd></div>
            <div><dt>Active grants</dt><dd>{service.active_grant_count}</dd></div>
            <div><dt>Active API keys</dt><dd>{service.api_keys.active}</dd></div>
            <div><dt>Reference source</dt><dd><Status value={service.references.state} /></dd></div>
            <div><dt>Active gateway references</dt><dd>{service.references.gref.active}</dd></div>
            <div><dt>Active secret references</dt><dd>{service.references.sec.active}</dd></div>
            <div><dt>Pending remediations</dt><dd>{service.pending_remediation_count}</dd></div>
          </dl>
        </article>)}
      </section>
    </div>
  );
}

export function SecurityDashboardPanel({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: DashboardControlApi;
}) {
  const [data, setData] = useState<SecurityDashboard>();
  const [selected, setSelected] = useState<DashboardRemediation>();
  const [error, setError] = useState("");
  const load = () => api.securityDashboard().then(setData)
    .catch(() => setError("Security signals are unavailable."));
  useEffect(() => {
    if (role !== "user") void load();
  }, [api, role]);
  if (role === "user") return null;
  return (
    <section className="content-panel" aria-labelledby="operator-security-heading">
      <p className="card-kicker">Operator signals</p>
      <h2 id="operator-security-heading">Security findings</h2>
      {error && <p className="form-error" role="alert">{error}</p>}
      {data === undefined && !error && <DashboardLoading label="Loading security findings" />}
      {data !== undefined && data.signals.length === 0 &&
        <p className="muted-copy">No current signals in your scope.</p>}
      {data !== undefined && <ul className="signal-list">
        {data.signals.map((signal, index) => <li key={`${signal.code}:${signal.service_id ?? "global"}:${index}`}>
          <div><Severity value={signal.severity} /> <strong>{label(signal.code)}</strong></div>
          <span>{signal.count} occurrence{signal.count === 1 ? "" : "s"}</span>
          {signal.remediation_id !== undefined &&
            <button type="button" onClick={() =>
              setSelected(data.remediations.find((item) => item.id === signal.remediation_id))}>
              Review
            </button>}
        </li>)}
      </ul>}
      {selected !== undefined && <RemediationDialog
        remediation={selected}
        api={api}
        onClose={() => setSelected(undefined)}
        onSaved={() => {
          setSelected(undefined);
          void load();
        }}
      />}
    </section>
  );
}

function RemediationDialog({
  remediation,
  api,
  onClose,
  onSaved,
}: {
  remediation: DashboardRemediation;
  api: DashboardControlApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<"acknowledged" | "dismissed">("acknowledged");
  const [justification, setJustification] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="remediation-heading">
        <h3 id="remediation-heading">{label(remediation.code)}</h3>
        <p>Generation {remediation.generation}. This action applies only to this exact finding.</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          setError("");
          api.updateDashboardRemediation(remediation, {
            state,
            justification,
            password,
            totp,
          }).then(onSaved).catch(() => {
            setPassword("");
            setTotp("");
            setError("The remediation could not be updated.");
          });
        }}>
          <label>Action<select value={state} onChange={(event) =>
            setState(event.target.value as typeof state)}>
            <option value="acknowledged">Acknowledge</option>
            <option value="dismissed">Dismiss until condition changes</option>
          </select></label>
          <label>Justification<textarea required maxLength={1024} value={justification}
            onChange={(event) => setJustification(event.target.value)} /></label>
          <label>Password<input type="password" required value={password}
            onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Authenticator code<input inputMode="numeric" required value={totp}
            onChange={(event) => setTotp(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Confirm action</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonalOverview() {
  return (
    <section className="content-panel">
      <p className="card-kicker">Your workspace</p>
      <h2>Access without exposed secrets</h2>
      <p className="muted-copy">
        Review your assigned services, active grants, profile, and personal security controls.
      </p>
      <div className="dialog-actions">
        <Link className="button-link" to="/services">View services</Link>
        <Link className="button-link" to="/profile">Open profile</Link>
      </div>
    </section>
  );
}

function Metric({ label: text, value }: { label: string; value: number | string }) {
  return <article><p>{text}</p><strong>{typeof value === "number" ? format(value) : value}</strong></article>;
}

function TrendSummary({ value }: { value: ActivityDashboard }) {
  return <p className="muted-copy">
    {format(value.totals.allow)} allowed, {format(value.totals.deny)} denied, and{" "}
    {format(value.totals.error)} errors in the selected window.
  </p>;
}

function TrendBars({ value }: { value: ActivityDashboard }) {
  const visible = useMemo(() => value.trend.slice(-24), [value]);
  const maximum = Math.max(1, ...visible.map((row) => row.requests));
  return (
    <div className="trend-chart" role="img" aria-label={`${value.totals.requests} requests; ${value.totals.deny} denied`}>
      {visible.map((row) => <span key={row.bucket_start} title={`${row.requests} requests`}
        style={{ height: `${Math.max(4, row.requests / maximum * 100)}%` }} />)}
    </div>
  );
}

function RankedTable({
  heading,
  rows,
}: {
  heading: string;
  rows: Array<{ key: string; name: string; detail: string; count: number }>;
}) {
  return (
    <section className="content-panel">
      <h2>{heading}</h2>
      {rows.length === 0 ? <p className="muted-copy">No activity in this window.</p> :
        <div className="table-scroll"><table><thead><tr><th>Name</th><th>Context</th><th>Requests</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key}><td>{row.name}</td><td>{row.detail}</td>
            <td>{format(row.count)}</td></tr>)}</tbody></table></div>}
    </section>
  );
}

function Severity({ value }: { value: "info" | "warning" | "critical" }) {
  return <span className={`severity severity-${value}`}>{label(value)}</span>;
}

function Status({ value }: { value: string }) {
  return <span className={`status-chip status-${value}`}>{label(value)}</span>;
}

function DashboardLoading({ label: text }: { label: string }) {
  return <p className="muted-copy" role="status">{text}…</p>;
}

function DashboardError({ message }: { message: string }) {
  return <section className="content-panel"><p className="form-error" role="alert">{message}</p></section>;
}

function countLabel(value: { value: number | null; suppressed: boolean; threshold: 3 }) {
  return value.suppressed ? `Fewer than ${value.threshold}` : format(value.value ?? 0);
}

function format(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${format(value)} B`;
  if (value < 1024 * 1024) return `${format(Math.round(value / 1024))} KiB`;
  return `${format(Math.round(value / (1024 * 1024)))} MiB`;
}

function label(value: string) {
  return value.replaceAll(/[._-]+/g, " ").replace(/^\w/, (character) => character.toUpperCase());
}
