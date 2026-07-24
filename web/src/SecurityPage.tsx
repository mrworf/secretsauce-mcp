import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  browserControlApi,
  ControlApiError,
  type GlobalSecurityEvent,
  type SecurityControlApi,
  type SecurityJobState,
  type SecuritySettings,
  type SecuritySettingsPatch,
  type UserRole,
} from "./controlApi";

const POLICY_ACK = "I ACCEPT SYSTEM-WIDE SECURITY POLICY CHANGES";
const PASSWORD_ACK = "REQUIRE ALL LOCAL USERS TO CHANGE PASSWORDS";
const TOTP_ACK = "ERASE ALL LOCAL TOTP AUTHENTICATORS";

type EditableKey = keyof SecuritySettingsPatch;
type Draft = Record<EditableKey, string>;

const groups: Array<{
  title: string;
  fields: Array<{
    key: EditableKey;
    label: string;
    min?: number;
    max?: number;
    nullable?: boolean;
  }>;
}> = [
  {
    title: "Passwords",
    fields: [
      { key: "password_minimum_length", label: "Minimum Unicode characters", min: 8, max: 128 },
      { key: "password_blocklist_version", label: "Blocklist policy version", min: 1 },
    ],
  },
  {
    title: "Sessions and grants",
    fields: [
      { key: "admin_session_absolute_ms", label: "Admin absolute lifetime (ms)", min: 3_600_000, max: 86_400_000 },
      { key: "admin_session_inactivity_ms", label: "Admin inactivity lifetime (ms)", min: 300_000, max: 7_200_000 },
      { key: "user_session_absolute_ms", label: "User absolute lifetime (ms)", min: 3_600_000, max: 259_200_000 },
      { key: "user_session_inactivity_ms", label: "User inactivity lifetime (ms)", min: 300_000, max: 86_400_000 },
      { key: "oauth_access_token_ms", label: "OAuth access token lifetime (ms)", min: 60_000, max: 900_000 },
      { key: "oauth_refresh_inactivity_ms", label: "Refresh inactivity lifetime (ms)", min: 86_400_000, max: 7_776_000_000 },
      { key: "oauth_refresh_absolute_ms", label: "Refresh absolute lifetime (ms)", min: 604_800_000, max: 31_536_000_000 },
    ],
  },
  {
    title: "Abuse controls",
    fields: [
      { key: "login_attempts", label: "Login attempts", min: 3, max: 20 },
      { key: "login_window_ms", label: "Login window (ms)", min: 300_000, max: 3_600_000 },
      { key: "password_attempts", label: "Password attempts", min: 3, max: 20 },
      { key: "password_window_ms", label: "Password window (ms)", min: 300_000, max: 3_600_000 },
      { key: "totp_attempts", label: "TOTP attempts", min: 3, max: 10 },
      { key: "totp_window_ms", label: "TOTP window (ms)", min: 60_000, max: 900_000 },
      { key: "management_api_attempts", label: "Management API attempts", min: 10, max: 600 },
      { key: "management_api_window_ms", label: "Management API window (ms)", min: 60_000, max: 3_600_000 },
      { key: "search_attempts", label: "Search attempts", min: 5, max: 120 },
      { key: "search_window_ms", label: "Search window (ms)", min: 60_000, max: 3_600_000 },
      { key: "backup_attempts", label: "Backup attempts", min: 1, max: 10 },
      { key: "backup_window_ms", label: "Backup window (ms)", min: 900_000, max: 86_400_000 },
    ],
  },
  {
    title: "Inactivity automation",
    fields: [
      { key: "inactivity_suspension_days", label: "Suspend after days (blank disables)", min: 1, max: 3_650, nullable: true },
      { key: "suspended_deactivation_days", label: "Deactivate suspended after days (blank disables)", min: 1, max: 3_650, nullable: true },
      { key: "security_job_interval_ms", label: "Job interval (ms)", min: 60_000, max: 86_400_000 },
      { key: "security_job_batch_size", label: "Job batch size", min: 50, max: 2_000 },
      { key: "security_job_wall_time_ms", label: "Job wall time (ms)", min: 5_000, max: 120_000 },
    ],
  },
];

export function SecurityPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: SecurityControlApi;
}) {
  if (role !== "superadmin") {
    return (
      <section className="content-panel" aria-labelledby="personal-security-heading">
        <p className="card-kicker">Your account</p>
        <h2 id="personal-security-heading">Personal security</h2>
        <p className="muted-copy">
          Password, authenticator, and linked sign-in controls remain available
          from your profile. System policy is visible only to superadmins.
        </p>
        <Link className="button-link" to="/profile">Open personal security</Link>
      </section>
    );
  }
  return <SuperadminSecurity api={api} />;
}

function SuperadminSecurity({ api }: { api: SecurityControlApi }) {
  const [settings, setSettings] = useState<SecuritySettings>();
  const [draft, setDraft] = useState<Draft>();
  const [job, setJob] = useState<SecurityJobState>();
  const [events, setEvents] = useState<GlobalSecurityEvent[]>([]);
  const [stateVersion, setStateVersion] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] =
    useState<"password_change" | "totp_reset">();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextSettings, nextJob, nextEvents] = await Promise.all([
        api.securitySettings(),
        api.inactivityJob(),
        api.securityEvents(),
      ]);
      setSettings(nextSettings);
      setDraft(toDraft(nextSettings));
      setJob(nextJob);
      setEvents(nextEvents.items);
      setStateVersion(nextEvents.state_version);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  if (signedOut !== undefined) {
    return (
      <section className="content-panel" role="status">
        <p className="card-kicker">System-wide security event completed</p>
        <h2>You are signed out</h2>
        <p>
          {signedOut === "totp_reset"
            ? "All local TOTP authenticators were erased and every human session was invalidated. Sign in and complete authenticator enrollment."
            : "Every local password credential now requires restricted password change, and every human session was invalidated."}
        </p>
      </section>
    );
  }
  if (loading) return <p role="status">Loading security controls…</p>;
  if (settings === undefined || draft === undefined || job === undefined) {
    return <p className="form-error" role="alert">{error || "Security controls are unavailable."}</p>;
  }

  return (
    <div className="page-stack security-workspace">
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <SettingsPanel
        settings={settings}
        draft={draft}
        api={api}
        onDraft={setDraft}
        onSaved={(value) => {
          setSettings(value);
          setDraft(toDraft(value));
          setError("");
        }}
        onError={setError}
      />
      <JobPanel
        job={job}
        stepUpMode={settings.step_up_mode}
        api={api}
        onJob={setJob}
        onError={setError}
      />
      <section className="content-panel danger-zone" aria-labelledby="global-events-heading">
        <p className="card-kicker">Irreversible account impact</p>
        <h2 id="global-events-heading">System-wide authenticator events</h2>
        <p className="muted-copy">
          These actions affect every local account, invalidate human sessions
          and grants, and require proof bound to this exact request.
        </p>
        <div className="security-danger-grid">
          <GlobalEventPanel
            kind="password_change"
            title="Require password changes"
            acknowledgement={PASSWORD_ACK}
            version={stateVersion!}
            api={api}
            onCompleted={() => setSignedOut("password_change")}
            onError={setError}
          />
          <GlobalEventPanel
            kind="totp_reset"
            title="Erase all local TOTP authenticators"
            acknowledgement={TOTP_ACK}
            version={stateVersion!}
            api={api}
            onCompleted={() => setSignedOut("totp_reset")}
            onError={setError}
          />
        </div>
      </section>
      <section className="content-panel" aria-labelledby="security-event-history">
        <h2 id="security-event-history">Recent system-wide events</h2>
        {events.length === 0
          ? <p className="muted-copy">No system-wide authenticator events have run.</p>
          : (
            <ul className="security-event-list">
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.kind === "password_change" ? "Password change" : "TOTP reset"}</strong>
                  <span>{event.affected_users} local accounts · {formatTime(event.created_at)}</span>
                  <span>{event.justification}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function SettingsPanel({
  settings,
  draft,
  api,
  onDraft,
  onSaved,
  onError,
}: {
  settings: SecuritySettings;
  draft: Draft;
  api: SecurityControlApi;
  onDraft: (draft: Draft) => void;
  onSaved: (settings: SecuritySettings) => void;
  onError: (message: string) => void;
}) {
  const [justification, setJustification] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      const value = await api.updateSecuritySettings(
        settings,
        fromDraft(draft, settings),
        { justification, acknowledgement, password, totp },
      );
      onSaved(value);
      setJustification("");
      setAcknowledgement("");
    } catch (caught) {
      onError(messageFor(caught));
    } finally {
      setPassword("");
      setTotp("");
      setSaving(false);
    }
  }

  return (
    <section className="content-panel" aria-labelledby="security-settings-heading">
      <div className="section-toolbar">
        <div>
          <p className="card-kicker">Policy version {settings.password_policy_version}</p>
          <h2 id="security-settings-heading">Security settings</h2>
        </div>
        <span className="status-label">Revision {settings.version}</span>
      </div>
      <form className="security-settings-form" onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend>Step-up</legend>
          <label>
            Required mode
            <select
              value={draft.step_up_mode}
              onChange={(event) => onDraft({ ...draft, step_up_mode: event.target.value })}
            >
              <option value="five_minutes">Five-minute elevation</option>
              <option value="always">Every protected operation</option>
            </select>
          </label>
        </fieldset>
        {groups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            <div className="security-field-grid">
              {group.fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    type="number"
                    step="1"
                    min={field.min}
                    max={field.max}
                    value={draft[field.key]}
                    required={!field.nullable}
                    onChange={(event) =>
                      onDraft({ ...draft, [field.key]: event.target.value })}
                  />
                  {field.min !== undefined && (
                    <small>Allowed: {field.min.toLocaleString()}–{field.max?.toLocaleString() ?? "higher"}</small>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <SensitiveConfirmation
          acknowledgement={acknowledgement}
          password={password}
          totp={totp}
          justification={justification}
          acknowledgementText={POLICY_ACK}
          onAcknowledgement={setAcknowledgement}
          onPassword={setPassword}
          onTotp={setTotp}
          onJustification={setJustification}
        />
        <button type="submit" disabled={
          saving || acknowledgement !== POLICY_ACK ||
          justification.trim() === "" || password === "" || !/^\d{6}$/.test(totp)
        }>
          {saving ? "Saving…" : "Save security settings"}
        </button>
      </form>
    </section>
  );
}

function JobPanel({
  job,
  stepUpMode,
  api,
  onJob,
  onError,
}: {
  job: SecurityJobState;
  stepUpMode: SecuritySettings["step_up_mode"];
  api: SecurityControlApi;
  onJob: (job: SecurityJobState) => void;
  onError: (message: string) => void;
}) {
  const [justification, setJustification] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [running, setRunning] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    onError("");
    try {
      onJob(await api.runInactivityJob({
        justification,
        acknowledgement,
        password,
        totp,
        step_up_mode: stepUpMode,
      }));
      setJustification("");
      setAcknowledgement("");
    } catch (caught) {
      onError(messageFor(caught));
    } finally {
      setPassword("");
      setTotp("");
      setRunning(false);
    }
  }

  return (
    <section className="content-panel" aria-labelledby="inactivity-job-heading">
      <p className="card-kicker">Durable automation</p>
      <h2 id="inactivity-job-heading">Inactivity job</h2>
      <dl className="security-job-facts">
        <div><dt>Next run</dt><dd>{formatTime(job.next_run_at)}</dd></div>
        <div><dt>Last completion</dt><dd>{formatTime(job.last_completed_at)}</dd></div>
        <div><dt>Outcome</dt><dd>{job.last_outcome ?? "Never run"}</dd></div>
        <div><dt>Last counts</dt><dd>{job.suspended_count} suspended · {job.deactivated_count} deactivated · {job.protected_count} protected</dd></div>
      </dl>
      <form className="security-action-form" onSubmit={(event) => void submit(event)}>
        <SensitiveConfirmation
          acknowledgement={acknowledgement}
          password={password}
          totp={totp}
          justification={justification}
          acknowledgementText={POLICY_ACK}
          onAcknowledgement={setAcknowledgement}
          onPassword={setPassword}
          onTotp={setTotp}
          onJustification={setJustification}
        />
        <button type="submit" disabled={
          running || acknowledgement !== POLICY_ACK ||
          justification.trim() === "" || password === "" || !/^\d{6}$/.test(totp)
        }>
          {running ? "Running…" : "Run inactivity job now"}
        </button>
      </form>
    </section>
  );
}

function GlobalEventPanel({
  kind,
  title,
  acknowledgement,
  version,
  api,
  onCompleted,
  onError,
}: {
  kind: "password_change" | "totp_reset";
  title: string;
  acknowledgement: string;
  version: number;
  api: SecurityControlApi;
  onCompleted: (event: GlobalSecurityEvent) => void;
  onError: (message: string) => void;
}) {
  const [justification, setJustification] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    onError("");
    try {
      const result = await api.executeGlobalSecurityEvent(kind, version, {
        justification,
        acknowledgement: confirmation,
        password,
        totp,
      });
      setJustification("");
      setConfirmation("");
      onCompleted(result);
    } catch (caught) {
      onError(messageFor(caught));
    } finally {
      setPassword("");
      setTotp("");
      setSubmitting(false);
    }
  }

  return (
    <article className="danger-panel">
      <h3>{title}</h3>
      <p>
        {kind === "password_change"
          ? "Every local password credential must complete restricted password change."
          : "Every local TOTP seed and pending or accepted step is deleted."}
      </p>
      <form className="security-action-form" onSubmit={(event) => void submit(event)}>
        <SensitiveConfirmation
          acknowledgement={confirmation}
          password={password}
          totp={totp}
          justification={justification}
          acknowledgementText={acknowledgement}
          onAcknowledgement={setConfirmation}
          onPassword={setPassword}
          onTotp={setTotp}
          onJustification={setJustification}
        />
        <button className="danger-button" type="submit" disabled={
          submitting || confirmation !== acknowledgement ||
          justification.trim() === "" || password === "" || !/^\d{6}$/.test(totp)
        }>
          {submitting ? "Applying…" : title}
        </button>
      </form>
    </article>
  );
}

function SensitiveConfirmation(props: {
  acknowledgement: string;
  acknowledgementText: string;
  justification: string;
  password: string;
  totp: string;
  onAcknowledgement: (value: string) => void;
  onJustification: (value: string) => void;
  onPassword: (value: string) => void;
  onTotp: (value: string) => void;
}) {
  return (
    <div className="sensitive-confirmation">
      <p>Type exactly: <code>{props.acknowledgementText}</code></p>
      <label>
        Acknowledgement
        <input
          value={props.acknowledgement}
          autoComplete="off"
          onChange={(event) => props.onAcknowledgement(event.target.value)}
        />
      </label>
      <label>
        Justification
        <textarea
          value={props.justification}
          maxLength={1_024}
          required
          onChange={(event) => props.onJustification(event.target.value)}
        />
      </label>
      <div className="field-pair">
        <label>
          Current password
          <input
            type="password"
            value={props.password}
            autoComplete="current-password"
            maxLength={4_096}
            required
            onChange={(event) => props.onPassword(event.target.value)}
          />
        </label>
        <label>
          Current 6-digit TOTP
          <input
            value={props.totp}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            onChange={(event) => props.onTotp(event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function toDraft(settings: SecuritySettings): Draft {
  const draft = {} as Draft;
  for (const group of groups) {
    for (const { key } of group.fields) {
      draft[key] = settings[key] === null ? "" : String(settings[key]);
    }
  }
  draft.step_up_mode = settings.step_up_mode;
  return draft;
}

function fromDraft(draft: Draft, current: SecuritySettings): SecuritySettingsPatch {
  const patch: SecuritySettingsPatch = {};
  for (const group of groups) {
    for (const { key, nullable } of group.fields) {
      const next = nullable && draft[key] === "" ? null : Number(draft[key]);
      if (next !== current[key]) Object.assign(patch, { [key]: next });
    }
  }
  if (draft.step_up_mode !== current.step_up_mode) {
    patch.step_up_mode = draft.step_up_mode as SecuritySettings["step_up_mode"];
  }
  return patch;
}

function formatTime(value: number | null): string {
  return value === null ? "Never" : new Date(value).toLocaleString();
}

function messageFor(error: unknown): string {
  return error instanceof ControlApiError
    ? error.message
    : "The security operation could not be completed.";
}
