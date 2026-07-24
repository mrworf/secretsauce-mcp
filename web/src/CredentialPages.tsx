import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type ControlCredential,
  type ControlService,
  type ControlUser,
  type CredentialControlApi,
  type SelfApiKeyApproval,
  type ServiceGroup,
  type UserRole,
} from "./controlApi";

export const SELF_API_KEY_RISK_ACKNOWLEDGEMENT =
  "I ACCEPT RECURSIVE SECRETSAUCE MANAGEMENT AUTHORITY";

export function CredentialsPage({
  api = browserControlApi,
  role = "admin",
}: {
  api?: CredentialControlApi;
  role?: UserRole;
}) {
  const [services, setServices] = useState<ControlService[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [credentials, setCredentials] = useState<ControlCredential[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [users, setUsers] = useState<ControlUser[]>([]);
  const [approvals, setApprovals] = useState<
    Record<string, SelfApiKeyApproval>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDirectory() {
    setLoading(true);
    setError("");
    try {
      const [serviceResult, userResult] = await Promise.all([
        api.listServices(),
        api.listUsers({ role: "user", status: "active" }),
      ]);
      setServices(serviceResult.services);
      setUsers(userResult.users);
      setServiceId((current) =>
        serviceResult.services.some(({ id }) => id === current)
          ? current
          : serviceResult.services[0]?.id ?? ""
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadService(target: string, preferred?: string) {
    setLoading(true);
    setError("");
    try {
      const [credentialResult, groupResult] = await Promise.all([
        api.listCredentials(target),
        api.listGroups(target),
      ]);
      setCredentials(credentialResult.credentials);
      setGroups(groupResult.groups);
      setSelectedId((current) => {
        const candidate = preferred ?? current;
        return candidate !== undefined &&
          credentialResult.credentials.some(({ id }) => id === candidate)
          ? candidate
          : credentialResult.credentials[0]?.id;
      });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDirectory();
  }, [api]);

  useEffect(() => {
    if (serviceId !== "") void loadService(serviceId);
  }, [serviceId]);

  const selected = credentials.find(({ id }) => id === selectedId);
  const service = services.find(({ id }) => id === serviceId);

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="credentials-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Write-only downstream access</p>
            <h2 id="credentials-heading">Credential workspace</h2>
            <p className="muted-copy">
              Choose a service first. Values can be replaced or deleted, but never read back.
            </p>
          </div>
          <button type="button" disabled={loading} onClick={() => void loadDirectory()}>
            Refresh
          </button>
        </div>
        <label className="service-picker">
          Service
          <select value={serviceId} disabled={loading || services.length === 0}
            onChange={(event) => setServiceId(event.target.value)}>
            {services.length === 0 && <option value="">No manageable services</option>}
            {services.map((item) => (
              <option key={item.id} value={item.id}>{item.name} ({item.slug})</option>
            ))}
          </select>
        </label>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {loading && <p role="status">Loading safe credential metadata…</p>}
      </section>

      {service !== undefined && (
        <section className="content-panel" aria-labelledby="credential-directory-heading">
          <div className="section-toolbar">
            <div>
              <p className="card-kicker">{service.name}</p>
              <h2 id="credential-directory-heading">Credentials</h2>
            </div>
            <CreateCredential
              serviceId={service.id}
              api={api}
              onCreated={(credential) => void loadService(service.id, credential.id)}
            />
          </div>
          <div className="credential-layout">
            <div className="credential-list" aria-label="Service credentials">
              {credentials.length === 0 && (
                <p className="muted-copy">No credential definitions yet.</p>
              )}
              {credentials.map((credential) => (
                <button type="button" key={credential.id}
                  className={`credential-card${credential.id === selectedId ? " selected" : ""}`}
                  aria-pressed={credential.id === selectedId}
                  onClick={() => setSelectedId(credential.id)}>
                  <span>
                    <strong>{credential.name}</strong>
                    <small>{credential.placement.kind}: {credential.placement.name}</small>
                  </span>
                  <span className={`state-label state-${credential.status}`}>
                    {credential.status}
                  </span>
                </button>
              ))}
            </div>
            {selected !== undefined && (
              <CredentialEditor
                key={`${selected.id}:${selected.version}`}
                credential={selected}
                groups={groups}
                users={users}
                api={api}
                role={role}
                approval={approvals[selected.id]}
                onChanged={() => {
                  setApprovals((current) => withoutKey(current, selected.id));
                  void loadService(service.id, selected.id);
                }}
                onApproved={(result) => {
                  setCredentials((current) => current.map((item) =>
                    item.id === result.credential.id
                      ? result.credential
                      : item
                  ));
                  setApprovals((current) => ({
                    ...current,
                    [result.credential.id]: result.approval,
                  }));
                }}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function CreateCredential({
  serviceId,
  api,
  onCreated,
}: {
  serviceId: string;
  api: CredentialControlApi;
  onCreated(credential: ControlCredential): void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"header" | "query" | "body">("header");
  const [placementName, setPlacementName] = useState("Authorization");
  const [error, setError] = useState("");

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>New credential</button>;
  }
  return (
    <form className="compact-create-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      void api.createCredential(serviceId, {
        name,
        placement: { kind, name: placementName },
        selector: { kind: "all" },
      }).then(onCreated, (caught) => setError(messageFor(caught)));
    }}>
      <label>Name<input required maxLength={120} value={name}
        onChange={(event) => setName(event.target.value)} /></label>
      <label>Placement<select value={kind}
        onChange={(event) => setKind(event.target.value as typeof kind)}>
        <option value="header">Header</option>
        <option value="query">Query</option>
        <option value="body">Body</option>
      </select></label>
      <label>Field name<input required maxLength={256} value={placementName}
        onChange={(event) => setPlacementName(event.target.value)} /></label>
      <button type="submit">Create unconfigured credential</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function CredentialEditor({
  credential,
  groups,
  users,
  api,
  role,
  approval,
  onChanged,
  onApproved,
}: {
  credential: ControlCredential;
  groups: ServiceGroup[];
  users: ControlUser[];
  api: CredentialControlApi;
  role: UserRole;
  approval?: SelfApiKeyApproval;
  onChanged(): void;
  onApproved(result: {
    credential: ControlCredential;
    approval: SelfApiKeyApproval;
  }): void;
}) {
  const [value, setValue] = useState("");
  const [capture, setCapture] = useState(false);
  const [groupIds, setGroupIds] = useState(credential.selector?.group_ids ?? []);
  const [userIds, setUserIds] = useState(credential.selector?.user_ids ?? []);
  const [all, setAll] = useState(credential.selector?.kind === "all");
  const [confirmed, setConfirmed] = useState(false);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const archived = credential.status === "archived";

  function run(operation: Promise<unknown>) {
    setError("");
    void operation.then(onChanged, (caught) => setError(messageFor(caught)));
  }

  function submitValue(event: FormEvent) {
    event.preventDefault();
    const submitted = value;
    setValue("");
    setError("");
    void api.replaceCredentialValue(credential, submitted, capture)
      .then(onChanged, (caught) => setError(messageFor(caught)))
      .finally(() => setValue(""));
  }

  return (
    <article className="credential-editor" aria-labelledby={`credential-${credential.id}`}>
      <div className="section-toolbar">
        <div>
          <h3 id={`credential-${credential.id}`}>{credential.name}</h3>
          <p className="muted-copy">
            {credential.placement.kind} · {credential.placement.name}
          </p>
        </div>
        <span className={`state-label state-${credential.status}`}>{credential.status}</span>
      </div>
      <dl className="credential-facts">
        <div><dt>Last four</dt><dd>{credential.last_four ?? "Not captured"}</dd></div>
        <div><dt>Value updated</dt><dd>
          {credential.value_updated_at === undefined
            ? "Never"
            : new Date(credential.value_updated_at).toLocaleString()}
        </dd></div>
      </dl>
      {credential.status === "unconfigured" && (
        <p className="warning-copy" role="status">
          Remediation required: add a value before this credential can be used.
        </p>
      )}
      {!archived && (
        <form className="profile-form write-only-form" autoComplete="off" onSubmit={submitValue}>
          <label>
            {credential.status === "unconfigured" ? "New value" : "Replacement value"}
            <input type="password" name="credential-value" required maxLength={65_536}
              autoComplete="new-password" value={value}
              onChange={(event) => setValue(event.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={capture}
              onChange={(event) => setCapture(event.target.checked)} />
            Capture a printable last-four hint
          </label>
          <p className="muted-copy">The submitted value is cleared after this attempt and is never shown again.</p>
          <button type="submit">Write value</button>
        </form>
      )}
      {role === "superadmin" && !archived && (
        <SelfApiKeyRiskApproval
          credential={credential}
          approval={approval}
          api={api}
          onApproved={onApproved}
        />
      )}
      {!archived && (
        <form className="assignment-grid credential-assignment" onSubmit={(event) => {
          event.preventDefault();
          run(api.replaceCredentialAssignments(
            credential,
            all
              ? { kind: "all" }
              : {
                  kind: "principals",
                  group_ids: groupIds,
                  user_ids: userIds,
                  direct_assignment_confirmed: userIds.length > 0 && confirmed,
                },
          ));
        }}>
          <fieldset className="principal-fieldset">
            <legend>Additional credential boundary</legend>
            <label className="checkbox-label"><input type="checkbox" checked={all}
              onChange={(event) => setAll(event.target.checked)} />
              Every user already authorized for this service
            </label>
            {!all && groups.filter(({ lifecycle }) => lifecycle === "active").map((group) => (
              <label className="checkbox-label" key={group.id}>
                <input type="checkbox" checked={groupIds.includes(group.id)}
                  onChange={() => setGroupIds(toggle(groupIds, group.id))} />
                Group: {group.name}
              </label>
            ))}
            {!all && users.map((user) => (
              <label className="checkbox-label" key={user.id}>
                <input type="checkbox" checked={userIds.includes(user.id)}
                  onChange={() => {
                    setUserIds(toggle(userIds, user.id));
                    setConfirmed(false);
                  }} />
                Direct exception: {user.email}
              </label>
            ))}
            {!all && userIds.length > 0 && (
              <label className="warning-label">
                <input type="checkbox" checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)} />
                I understand groups are preferred and confirm these direct-user exceptions.
              </label>
            )}
          </fieldset>
          <button type="submit" disabled={!all &&
            groupIds.length + userIds.length === 0 || userIds.length > 0 && !confirmed}>
            Replace credential assignments
          </button>
        </form>
      )}
      {!archived && (
        <div className="lifecycle-actions">
          <label>Change justification<textarea required maxLength={1_024}
            value={justification}
            onChange={(event) => setJustification(event.target.value)} /></label>
          {credential.status === "configured" && (
            <button type="button" disabled={justification.trim() === ""}
              onClick={() => run(api.credentialAction(
                credential,
                "disable",
                justification,
              ))}>Disable credential</button>
          )}
          {credential.status === "disabled" && (
            <button type="button"
              onClick={() => run(api.credentialAction(credential, "enable"))}>
              Verify and enable
            </button>
          )}
          {["configured", "disabled"].includes(credential.status) && (
            <button className="danger-button" type="button"
              disabled={justification.trim() === ""}
              onClick={() => run(api.deleteCredentialValue(credential, justification))}>
              Delete stored value
            </button>
          )}
          <button className="danger-button" type="button"
            disabled={justification.trim() === ""}
            onClick={() => run(api.credentialAction(
              credential,
              "archive",
              justification,
            ))}>Archive credential</button>
        </div>
      )}
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function withoutKey<T>(
  values: Record<string, T>,
  key: string,
): Record<string, T> {
  const next = { ...values };
  delete next[key];
  return next;
}

function SelfApiKeyRiskApproval({
  credential,
  approval,
  api,
  onApproved,
}: {
  credential: ControlCredential;
  approval?: SelfApiKeyApproval;
  api: CredentialControlApi;
  onApproved(result: {
    credential: ControlCredential;
    approval: SelfApiKeyApproval;
  }): void;
}) {
  const [value, setValue] = useState("");
  const [capture, setCapture] = useState(false);
  const [justification, setJustification] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const ready = acknowledgement === SELF_API_KEY_RISK_ACKNOWLEDGEMENT &&
    justification.trim() !== "" &&
    justification === justification.trim() &&
    password !== "" &&
    /^\d{6}$/.test(totp);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const submittedValue = value;
    const submittedPassword = password;
    const submittedTotp = totp;
    setValue("");
    setPassword("");
    setTotp("");
    setError("");
    void api.approveSelfApiKey(credential, {
      value: submittedValue,
      capture_last_four: capture,
      justification,
      risk_acknowledgement: acknowledgement,
      password: submittedPassword,
      totp: submittedTotp,
    }).then(onApproved, (caught) => setError(messageFor(caught)))
      .finally(() => {
        setValue("");
        setPassword("");
        setTotp("");
      });
  }

  return (
    <section className="self-api-key-risk" aria-labelledby={`self-risk-${credential.id}`}>
      <h4 id={`self-risk-${credential.id}`}>Recursive management authority</h4>
      <p>
        This exceptional workflow stores an active SecretSauce management API key.
        A referenced request could then manage this deployment within every remaining
        service, credential, destination, and policy boundary.
      </p>
      <p className="muted-copy">
        Approval is bound to this credential and vault generation. Runtime use still
        requires a scoped gateway reference and revalidates the key’s live status.
      </p>
      {approval !== undefined && (
        <dl className="self-api-key-approval" aria-label="Current self API key approval">
          <div><dt>Status</dt><dd>Approved; live status revalidated per use</dd></div>
          <div><dt>API key</dt><dd>{approval.nickname}</dd></div>
          <div><dt>Last four</dt><dd>{approval.last_four}</dd></div>
          <div><dt>Vault generation</dt><dd>{approval.vault_generation}</dd></div>
          <div><dt>Approved</dt><dd>
            {new Date(approval.approved_at).toLocaleString()}
          </dd></div>
        </dl>
      )}
      <form className="profile-form" autoComplete="off" onSubmit={submit}>
        <label>
          Active SecretSauce API key
          <input
            required
            type="password"
            name="self-api-key-value"
            maxLength={65_536}
            autoComplete="new-password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={capture}
            onChange={(event) => setCapture(event.target.checked)} />
          Capture a printable last-four hint
        </label>
        <label>
          Justification
          <textarea required maxLength={512} value={justification}
            onChange={(event) => setJustification(event.target.value)} />
        </label>
        <label>
          Type the exact risk acknowledgement
          <span className="confirmation-phrase">
            {SELF_API_KEY_RISK_ACKNOWLEDGEMENT}
          </span>
          <input required autoComplete="off" value={acknowledgement}
            onChange={(event) => setAcknowledgement(event.target.value)} />
        </label>
        <label>
          Current password
          <input required type="password" autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          Current TOTP code
          <input required inputMode="numeric" pattern="\d{6}" maxLength={6}
            autoComplete="one-time-code" value={totp}
            onChange={(event) => setTotp(event.target.value)} />
        </label>
        <p className="muted-copy">
          The API key, password, and TOTP code are cleared after this attempt.
        </p>
        <button className="danger-button" type="submit" disabled={!ready}>
          Approve recursive authority
        </button>
      </form>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function messageFor(error: unknown): string {
  if (
    error instanceof ControlApiError &&
    error.code === "active_self_api_key"
  ) {
    return "Active SecretSauce API keys require the superadmin recursive-authority workflow.";
  }
  if (error instanceof ControlApiError) return error.message;
  return "The credential operation could not be completed.";
}
