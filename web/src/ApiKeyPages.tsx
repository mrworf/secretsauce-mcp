import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type ApiKeyActivity,
  type ApiKeyControlApi,
  type ApiKeyRole,
  type ApiKeyStatus,
  type ControlApiKey,
  type ControlService,
  type OneTimeApiKey,
  type UserRole,
} from "./controlApi";

const ALL_SERVICES_CONFIRMATION =
  "I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES";

export function ApiKeysPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: ApiKeyControlApi;
}) {
  const [keys, setKeys] = useState<ControlApiKey[]>([]);
  const [services, setServices] = useState<ControlService[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activity, setActivity] = useState<ApiKeyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oneTime, setOneTime] = useState<OneTimeApiKey>();
  const selected = keys.find(({ id }) => id === selectedId);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [keyResult, serviceResult] = await Promise.all([
        api.listApiKeys(),
        api.listServices(),
      ]);
      setKeys(keyResult.api_keys);
      setServices(serviceResult.services);
      setSelectedId((current) =>
        current !== undefined && keyResult.api_keys.some(({ id }) => id === current)
          ? current
          : keyResult.api_keys[0]?.id
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (role !== "user") void load();
  }, [api, role]);

  useEffect(() => {
    if (selectedId === undefined) {
      setActivity([]);
      return;
    }
    let active = true;
    api.apiKeyActivity(selectedId)
      .then((result) => {
        if (active) setActivity(result.activity);
      })
      .catch((caught) => {
        if (active) setError(messageFor(caught));
      });
    return () => {
      active = false;
    };
  }, [api, selectedId]);

  function replaceKey(key: ControlApiKey) {
    setKeys((current) => current.map((entry) => entry.id === key.id ? key : entry));
    setSelectedId(key.id);
  }

  if (role === "user") {
    return (
      <section className="content-panel">
        <h2>API key management is restricted</h2>
        <p className="muted-copy">Your role cannot view or manage system-owned API keys.</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="api-key-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">System-owned credentials</p>
            <h2 id="api-key-heading">API keys</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
        <p className="muted-copy">
          Only metadata is retained here. Raw key values are displayed once after
          creation or rotation.
        </p>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {loading
          ? <p role="status">Loading visible API key metadata…</p>
          : (
            <div className="api-key-layout">
              <div className="api-key-list" aria-label="Visible API keys">
                {keys.length === 0 && <p>No API keys are visible to this role.</p>}
                {keys.map((key) => (
                  <button
                    type="button"
                    className={key.id === selectedId
                      ? "api-key-card selected"
                      : "api-key-card"}
                    key={key.id}
                    onClick={() => setSelectedId(key.id)}
                  >
                    <span>
                      <strong>{key.nickname}</strong>
                      <small>{key.key_prefix}…{key.last_four}</small>
                    </span>
                    <span className="label-row">
                      <StatusLabel value={key.api_role} />
                      <StatusLabel value={key.status} />
                    </span>
                  </button>
                ))}
              </div>
              {selected !== undefined && (
                <ApiKeyDetail
                  apiKey={selected}
                  service={services.find(({ id }) => id === selected.service_id)}
                  activity={activity}
                  api={api}
                  onChange={replaceKey}
                  onOneTime={setOneTime}
                />
              )}
            </div>
          )}
      </section>
      <CreateApiKeyPanel
        role={role}
        services={services}
        api={api}
        onCreated={(result) => {
          setKeys((current) => [result.api_key, ...current]);
          setSelectedId(result.api_key.id);
          setOneTime(result);
        }}
      />
      <OneTimeKeyPanel result={oneTime} onDismiss={() => setOneTime(undefined)} />
    </div>
  );
}

function CreateApiKeyPanel({
  role,
  services,
  api,
  onCreated,
}: {
  role: "admin" | "superadmin";
  services: ControlService[];
  api: ApiKeyControlApi;
  onCreated: (result: OneTimeApiKey) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [keyRole, setKeyRole] = useState<ApiKeyRole>("service");
  const [serviceId, setServiceId] = useState("");
  const [expiration, setExpiration] = useState<"forever" | "days">("days");
  const [days, setDays] = useState("90");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const effectiveRole = role === "admin" ? "service" : keyRole;
  const canSubmit = nickname.trim() !== "" &&
    (effectiveRole !== "service" || serviceId !== "") &&
    (expiration === "forever" || validDays(days)) &&
    (effectiveRole !== "all_services" ||
      confirmation === ALL_SERVICES_CONFIRMATION);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.createApiKey({
        nickname: nickname.trim(),
        api_role: effectiveRole,
        ...(effectiveRole === "service" ? { service_id: serviceId } : {}),
        expiration: expiration === "forever"
          ? { policy: "forever" }
          : { policy: "days", days: Number(days) },
        ...(effectiveRole === "all_services"
          ? { all_services_confirmation: confirmation }
          : {}),
      });
      setNickname("");
      setConfirmation("");
      onCreated(result);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content-panel" aria-labelledby="create-api-key-heading">
      <p className="card-kicker">One-time issuance</p>
      <h2 id="create-api-key-heading">Create API key</h2>
      <form className="api-key-form" onSubmit={(event) => void submit(event)}>
        <label>
          Nickname
          <input
            value={nickname}
            maxLength={512}
            required
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        {role === "superadmin" ? (
          <label>
            API key role
            <select
              value={keyRole}
              onChange={(event) => {
                setKeyRole(event.target.value as ApiKeyRole);
                setConfirmation("");
              }}
            >
              <option value="service">One service</option>
              <option value="all_services">All services</option>
              <option value="system">System administration</option>
            </select>
          </label>
        ) : (
          <p className="scope-note">
            Assigned administrators can create keys only for one of their services.
          </p>
        )}
        {effectiveRole === "service" && (
          <label>
            Service
            <select
              value={serviceId}
              required
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Choose a service</option>
              {services.map((service) => (
                <option value={service.id} key={service.id}>{service.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Expiration
          <select
            value={expiration}
            onChange={(event) => setExpiration(event.target.value as "forever" | "days")}
          >
            <option value="days">After a fixed number of days</option>
            <option value="forever">No expiration</option>
          </select>
        </label>
        {expiration === "days" && (
          <label>
            Days until expiration
            <input
              type="number"
              min="1"
              max="3650"
              value={days}
              required
              onChange={(event) => setDays(event.target.value)}
            />
          </label>
        )}
        {effectiveRole === "all_services" && (
          <div className="api-key-warning" role="note">
            <strong>All-services keys are durable and high impact.</strong>
            <p>
              This key will cover every current service and every service created in
              the future until the key expires or is revoked.
            </p>
            <label>
              Type “{ALL_SERVICES_CONFIRMATION}” to confirm
              <input
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </div>
        )}
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Creating…" : "Create API key"}
        </button>
      </form>
    </section>
  );
}

function ApiKeyDetail({
  apiKey,
  service,
  activity,
  api,
  onChange,
  onOneTime,
}: {
  apiKey: ControlApiKey;
  service?: ControlService;
  activity: ApiKeyActivity[];
  api: ApiKeyControlApi;
  onChange: (key: ControlApiKey) => void;
  onOneTime: (result: OneTimeApiKey) => void;
}) {
  const [nickname, setNickname] = useState(apiKey.nickname);
  const [expiresAt, setExpiresAt] = useState(
    apiKey.expires_at === undefined ? "" : dateTimeInput(apiKey.expires_at),
  );
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNickname(apiKey.nickname);
    setExpiresAt(apiKey.expires_at === undefined ? "" : dateTimeInput(apiKey.expires_at));
    setJustification("");
    setError("");
  }, [apiKey.id, apiKey.nickname, apiKey.expires_at]);

  async function act(action: "save" | "rotate" | "revoke") {
    setBusy(true);
    setError("");
    try {
      if (action === "save") {
        const updated = await api.updateApiKey(apiKey, {
          nickname: nickname.trim(),
          ...(apiKey.expiration_policy === "timestamp" && expiresAt !== ""
            ? { expires_at: new Date(expiresAt).getTime() }
            : {}),
        });
        onChange(updated);
      } else if (action === "rotate") {
        const result = await api.rotateApiKey(apiKey, justification.trim());
        onChange(result.api_key);
        onOneTime(result);
      } else {
        const result = await api.revokeApiKey(apiKey, justification.trim());
        onChange(result.api_key);
      }
      setJustification("");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="api-key-detail" aria-labelledby="api-key-detail-heading">
      <div className="section-toolbar">
        <div>
          <p className="card-kicker">Selected metadata</p>
          <h3 id="api-key-detail-heading">{apiKey.nickname}</h3>
        </div>
        <StatusLabel value={apiKey.status} />
      </div>
      <dl className="api-key-facts">
        <div><dt>Key</dt><dd>{apiKey.key_prefix}…{apiKey.last_four}</dd></div>
        <div><dt>Role</dt><dd>{label(apiKey.api_role)}</dd></div>
        <div><dt>Service</dt><dd>{service?.name ?? "Not service-scoped"}</dd></div>
        <div><dt>Expires</dt><dd>{formatTime(apiKey.expires_at)}</dd></div>
        <div><dt>Last used</dt><dd>{formatTime(apiKey.last_used_at)}</dd></div>
      </dl>
      <form className="api-key-form" onSubmit={(event) => {
        event.preventDefault();
        void act("save");
      }}>
        <label>
          Nickname
          <input
            value={nickname}
            maxLength={512}
            required
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        {apiKey.expiration_policy === "timestamp" && apiKey.status === "active" && (
          <label>
            Expiration (may only be shortened)
            <input
              type="datetime-local"
              value={expiresAt}
              max={dateTimeInput(apiKey.expires_at!)}
              required
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={busy || nickname.trim() === "" || apiKey.status !== "active"}
        >
          Save metadata
        </button>
      </form>
      {apiKey.status === "active" && (
        <div className="api-key-actions">
          <label>
            Rotation or revocation justification
            <textarea
              value={justification}
              maxLength={512}
              onChange={(event) => setJustification(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              disabled={busy || justification.trim() === ""}
              onClick={() => void act("rotate")}
            >
              Rotate key
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={busy || justification.trim() === ""}
              onClick={() => void act("revoke")}
            >
              Revoke key
            </button>
          </div>
        </div>
      )}
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      <section className="api-key-activity" aria-labelledby="api-key-activity-heading">
        <h4 id="api-key-activity-heading">Activity</h4>
        {activity.length === 0
          ? <p className="muted-copy">No activity is available for this key.</p>
          : (
            <ol>
              {activity.map((entry) => (
                <li key={entry.id}>
                  <strong>{label(entry.action)}</strong>
                  <span>{label(entry.outcome)} · {label(entry.target_type)}</span>
                  <time dateTime={new Date(entry.occurred_at).toISOString()}>
                    {formatTime(entry.occurred_at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
      </section>
    </article>
  );
}

function OneTimeKeyPanel({
  result,
  onDismiss,
}: {
  result?: OneTimeApiKey;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (result === undefined) return null;
  return (
    <section className="content-panel one-time-key" aria-labelledby="one-time-key-heading">
      <p className="card-kicker">Shown once</p>
      <h2 id="one-time-key-heading">Copy this API key now</h2>
      <p>
        This raw value cannot be recovered after you dismiss this panel. Store it in
        an approved secret manager.
      </p>
      <code aria-label="One-time API key">{result.one_time_key}</code>
      <div className="button-row">
        <button type="button" onClick={() => {
          void navigator.clipboard.writeText(result.one_time_key).then(() => setCopied(true));
        }}>
          Copy API key
        </button>
        <button type="button" onClick={onDismiss}>I have stored it</button>
      </div>
      {copied && <p className="success-copy" role="status">API key copied.</p>}
    </section>
  );
}

function StatusLabel({ value }: { value: string }) {
  return <span className={`status-label status-${value}`}>{label(value)}</span>;
}

function label(value: string): string {
  return value.replaceAll("_", " ").replaceAll(".", " ");
}

function validDays(value: string): boolean {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 3650;
}

function formatTime(value: number | undefined): string {
  return value === undefined ? "Never" : new Date(value).toLocaleString();
}

function dateTimeInput(value: number): string {
  const date = new Date(value);
  const local = new Date(value - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function messageFor(caught: unknown): string {
  if (caught instanceof ControlApiError) return caught.message;
  return caught instanceof Error ? caught.message : "The API key request failed.";
}
