import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type AuditControlApi,
  type AuditDomain,
  type AuditEvent,
  type AuditFilter,
  type AuditRetentionOverview,
  type UserRole,
} from "./controlApi";

const RETENTION_ACK = "I ACCEPT AUDIT RETENTION CHANGES";
const categories = [
  "",
  "authentication",
  "authorization",
  "identity",
  "service",
  "credential",
  "policy",
  "security",
  "system",
  "audit",
  "other",
] as const;

export function AuditPage({
  domain,
  role,
  api = browserControlApi,
}: {
  domain: AuditDomain;
  role: UserRole;
  api?: AuditControlApi;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [preset, setPreset] = useState<"24h" | "7d" | "30d" | "90d" | "year" | "custom">("24h");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [ambiguity, setAmbiguity] = useState<"earlier" | "later">("earlier");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportReason, setExportReason] = useState("");

  function currentFilter(): Omit<AuditFilter, "cursor"> {
    const value: Omit<AuditFilter, "cursor"> = {
      ...(query.trim() === "" ? {} : { q: query.trim() }),
      ...(category === "" ? {} : { category }),
      ...(outcome === "" ? {} : { outcome: outcome as AuditEvent["outcome"] }),
    };
    if (preset !== "custom") return { ...value, preset };
    if (start === "" || end === "") return value;
    return {
      ...value,
      start_utc: zonedLocalToUtc(start, timezone, ambiguity),
      end_utc: zonedLocalToUtc(end, timezone, ambiguity),
    };
  }

  async function load(cursor?: string, append = false) {
    setLoading(true);
    setError("");
    try {
      const page = await api.auditEvents(domain, {
        ...currentFilter(),
        ...(cursor === undefined ? {} : { cursor }),
      });
      setEvents((current) => append ? [...current, ...page.events] : page.events);
      setNextCursor(page.next_cursor);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [domain]);

  async function search(event: FormEvent) {
    event.preventDefault();
    try {
      await load();
    } catch {
      // load owns the accessible error state.
    }
  }

  async function exportEvidence() {
    setError("");
    try {
      if (exportReason.trim() === "") throw new Error("Enter an export justification.");
      const exported = await api.exportAudit(domain, currentFilter(), exportReason.trim());
      const blob = new Blob([exported.content], { type: exported.media_type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportReason("");
    } catch (caught) {
      setError(message(caught));
    }
  }

  return (
    <div className="page-stack audit-workspace">
      {role === "admin" && (
        <p className="scope-banner" role="note">
          Results and exports are limited to services currently assigned to you.
        </p>
      )}
      <section className="content-panel" aria-labelledby={`${domain}-filters`}>
        <p className="card-kicker">{domain === "runtime" ? "MCP evidence" : "Control-plane evidence"}</p>
        <h2 id={`${domain}-filters`}>Search immutable audit history</h2>
        <form className="audit-filter-grid" onSubmit={search}>
          <label>
            Search allowed fields
            <input value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((value) => (
                <option value={value} key={value || "all"}>{value || "All categories"}</option>
              ))}
            </select>
          </label>
          <label>
            Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option value="">All outcomes</option>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <label>
            Time range
            <select value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="year">Last year</option>
              <option value="custom">Absolute local range</option>
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label>
                Start local time
                <input type="datetime-local" step="1" value={start} onChange={(event) => setStart(event.target.value)} required />
              </label>
              <label>
                End local time
                <input type="datetime-local" step="1" value={end} onChange={(event) => setEnd(event.target.value)} required />
              </label>
              <label>
                IANA display timezone
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
              </label>
              <label>
                Repeated DST time
                <select value={ambiguity} onChange={(event) => setAmbiguity(event.target.value as typeof ambiguity)}>
                  <option value="earlier">Earlier offset</option>
                  <option value="later">Later offset</option>
                </select>
              </label>
            </>
          )}
          <button type="submit" disabled={loading}>Search</button>
        </form>
      </section>

      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <section className="content-panel" aria-labelledby={`${domain}-results`}>
        <div className="panel-heading">
          <div>
            <p className="card-kicker">Newest first</p>
            <h2 id={`${domain}-results`}>Audit events</h2>
          </div>
          <span>{events.length} loaded</span>
        </div>
        {loading && events.length === 0
          ? <p role="status">Loading audit events…</p>
          : events.length === 0
            ? <p className="muted-copy">No authorized events match these filters.</p>
            : (
              <ol className="audit-event-list">
                {events.map((event) => (
                  <li key={event.event_id}>
                    <div className="audit-event-heading">
                      <strong>{event.action}</strong>
                      <span className={`outcome-badge outcome-${event.outcome}`}>{event.outcome}</span>
                    </div>
                    <p>{event.actor_label}{event.target_label === undefined ? "" : ` → ${event.target_label}`}</p>
                    <p className="muted-copy">
                      {formatInZone(event.occurred_at, timezone)} · {event.category}
                      {event.service_label === undefined ? "" : ` · ${event.service_label}`}
                    </p>
                    {event.failure_code !== undefined && <p>Code: {event.failure_code}</p>}
                  </li>
                ))}
              </ol>
            )}
        {nextCursor !== undefined && (
          <button type="button" disabled={loading} onClick={() => void load(nextCursor, true)}>
            Load next page
          </button>
        )}
      </section>

      <section className="content-panel" aria-labelledby={`${domain}-export`}>
        <h2 id={`${domain}-export`}>Export this authorized result set</h2>
        <p className="muted-copy">NDJSON is capped at 10,000 rows and 5 MiB and contains the same projection shown here.</p>
        <label>
          Export justification
          <input value={exportReason} maxLength={1024} onChange={(event) => setExportReason(event.target.value)} />
        </label>
        <button type="button" onClick={() => void exportEvidence()}>Download NDJSON</button>
      </section>

      {role === "superadmin" && <RetentionPanel api={api} />}
    </div>
  );
}

function RetentionPanel({ api }: { api: AuditControlApi }) {
  const [overview, setOverview] = useState<AuditRetentionOverview>();
  const [administrative, setAdministrative] = useState("400");
  const [runtime, setRuntime] = useState("400");
  const [justification, setJustification] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api.auditRetention().then((value) => {
      setOverview(value);
      setAdministrative(value.settings.administrative_days?.toString() ?? "");
      setRuntime(value.settings.runtime_days?.toString() ?? "");
    }).catch((caught) => setError(message(caught)));
  }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (overview === undefined) return;
    try {
      const value = await api.updateAuditRetention({
        current: overview,
        administrative_days: parseDays(administrative),
        runtime_days: parseDays(runtime),
        justification,
        acknowledgement,
        password,
        totp,
      });
      setOverview(value);
      setJustification("");
      setAcknowledgement("");
      setError("");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPassword("");
      setTotp("");
    }
  }

  async function runNow() {
    try {
      const value = await api.runAuditMaintenance({
        justification,
        acknowledgement,
        password,
        totp,
      });
      setOverview(value);
      setJustification("");
      setAcknowledgement("");
      setError("");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPassword("");
      setTotp("");
    }
  }

  if (overview === undefined) return <p role="status">Loading retention settings…</p>;
  return (
    <section className="content-panel" aria-labelledby="audit-retention-heading">
      <p className="card-kicker">Superadmin capacity control</p>
      <h2 id="audit-retention-heading">Retention and index maintenance</h2>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <div className="capacity-grid">
        <Capacity title="Administrative" value={overview.administrative} />
        <Capacity title="Runtime" value={overview.runtime} />
      </div>
      <form className="audit-filter-grid" onSubmit={save}>
        <label>
          Administrative days (blank is unlimited)
          <input type="number" min="1" max="3650" value={administrative} onChange={(event) => setAdministrative(event.target.value)} />
        </label>
        <label>
          Runtime days (blank is unlimited)
          <input type="number" min="1" max="3650" value={runtime} onChange={(event) => setRuntime(event.target.value)} />
        </label>
        <label>
          Justification
          <input value={justification} maxLength={1024} required onChange={(event) => setJustification(event.target.value)} />
        </label>
        <label>
          Exact acknowledgement
          <input value={acknowledgement} placeholder={RETENTION_ACK} required onChange={(event) => setAcknowledgement(event.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} required autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          Authenticator code
          <input inputMode="numeric" value={totp} required autoComplete="one-time-code" onChange={(event) => setTotp(event.target.value)} />
        </label>
        <button type="submit">Save retention</button>
        <button type="button" onClick={() => void runNow()}>Run maintenance now</button>
      </form>
      <p className="muted-copy">
        Last outcome: {overview.maintenance.last_outcome ?? "never"} · deleted
        {" "}{overview.maintenance.retained_administrative_count} administrative and
        {" "}{overview.maintenance.retained_runtime_count} runtime rows · repaired
        {" "}{overview.maintenance.repaired_index_count} index rows.
      </p>
    </section>
  );
}

function Capacity({
  title,
  value,
}: {
  title: string;
  value: AuditRetentionOverview["administrative"];
}) {
  return (
    <article>
      <h3>{title}</h3>
      <p>{value.row_count} rows · {formatBytes(value.estimated_bytes)}</p>
      {value.warnings.map((warning) => <p className="warning-copy" key={warning}>{warning.replaceAll("_", " ")}</p>)}
    </article>
  );
}

function zonedLocalToUtc(
  value: string,
  timeZone: string,
  ambiguity: "earlier" | "later",
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (match === null) throw new Error("Enter a valid local date and time.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new Error("Enter a valid IANA timezone.");
  }
  const expected = match.slice(1).map((part, index) => index === 5 ? Number(part ?? "0") : Number(part));
  const approximate = Date.UTC(
    expected[0]!,
    expected[1]! - 1,
    expected[2]!,
    expected[3]!,
    expected[4]!,
    expected[5]!,
  );
  const offsets = new Set(
    [-366, -2, 0, 2, 366].map((days) =>
      zonedOffset(approximate + days * 86_400_000, timeZone)),
  );
  const candidates: number[] = [];
  for (const offset of offsets) {
    const candidate = approximate - offset;
    if (zonedParts(candidate, timeZone).every((part, index) => part === expected[index])) {
      candidates.push(candidate);
    }
  }
  const unique = [...new Set(candidates)].sort((left, right) => left - right);
  if (unique.length === 0) throw new Error("That local time does not exist in the selected timezone.");
  return new Date(ambiguity === "earlier" ? unique[0]! : unique.at(-1)!).toISOString();
}

function zonedOffset(value: number, timeZone: string): number {
  const parts = zonedParts(value, timeZone);
  const represented = Date.UTC(
    parts[0]!,
    parts[1]! - 1,
    parts[2]!,
    parts[3]!,
    parts[4]!,
    parts[5]!,
  );
  return represented - Math.trunc(value / 1_000) * 1_000;
}

function zonedParts(value: number, timeZone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return [part("year"), part("month"), part("day"), part("hour"), part("minute"), part("second")];
}

function formatInZone(value: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "long",
    }).format(value);
  } catch {
    return new Date(value).toISOString();
  }
}

function parseDays(value: string): number | null {
  if (value.trim() === "") return null;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3_650) {
    throw new Error("Retention must be blank or between 1 and 3650 days.");
  }
  return days;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function message(error: unknown): string {
  if (error instanceof ControlApiError || error instanceof Error) return error.message;
  return "The audit operation could not be completed.";
}
