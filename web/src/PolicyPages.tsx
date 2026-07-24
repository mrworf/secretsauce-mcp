import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type ControlCredential,
  type ControlPolicy,
  type ControlPolicyDetail,
  type ControlPolicyRule,
  type ControlService,
  type ControlUser,
  type PolicyBoundary,
  type PolicyControlApi,
  type PolicyCopyDocument,
  type PolicyRuleInput,
  type PolicySimulation,
  type ServiceDestination,
  type ServiceGroup,
} from "./controlApi";

export function PoliciesPage({
  api = browserControlApi,
}: {
  api?: PolicyControlApi;
}) {
  const [services, setServices] = useState<ControlService[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [policies, setPolicies] = useState<ControlPolicy[]>([]);
  const [policy, setPolicy] = useState<ControlPolicyDetail>();
  const [credentials, setCredentials] = useState<ControlCredential[]>([]);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [users, setUsers] = useState<ControlUser[]>([]);
  const [destinations, setDestinations] = useState<ServiceDestination[]>([]);
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

  async function loadService(target: string, preferredPolicyId?: string) {
    setLoading(true);
    setError("");
    try {
      const [policyResult, credentialResult, groupResult, service] =
        await Promise.all([
          api.listPolicies(target),
          api.listCredentials(target),
          api.listGroups(target),
          api.service(target),
        ]);
      setPolicies(policyResult.policies);
      setCredentials(credentialResult.credentials);
      setGroups(groupResult.groups);
      setDestinations(service.destinations);
      const nextId = policyResult.policies.some(({ id }) => id === preferredPolicyId)
        ? preferredPolicyId
        : policyResult.policies[0]?.id;
      setPolicy(nextId === undefined ? undefined : await api.policy(target, nextId));
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

  async function selectPolicy(policyId: string) {
    setLoading(true);
    setError("");
    try {
      setPolicy(await api.policy(serviceId, policyId));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  const service = services.find(({ id }) => id === serviceId);

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="policies-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Deterministic authorization</p>
            <h2 id="policies-heading">Policy workspace</h2>
            <p className="muted-copy">
              Service and every selected credential boundary must allow. At equal
              priority, deny wins.
            </p>
          </div>
          <button type="button" disabled={loading}
            onClick={() => void loadDirectory()}>Refresh</button>
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
        {error !== "" && (
          <p className="form-error" role="alert">
            {error} Refresh to recover if another administrator changed this policy.
          </p>
        )}
        {loading && <p role="status">Loading policy snapshot…</p>}
      </section>

      {service !== undefined && (
        <section className="content-panel" aria-labelledby="policy-directory-heading">
          <div className="section-toolbar">
            <div>
              <p className="card-kicker">{service.name}</p>
              <h2 id="policy-directory-heading">Policy boundaries</h2>
            </div>
            <CreatePolicy serviceId={service.id} credentials={credentials} api={api}
              onCreated={(created) => void loadService(service.id, created.id)} />
          </div>
          <div className="policy-layout">
            <div className="policy-list" aria-label="Service policies">
              {policies.length === 0 && (
                <p className="muted-copy">
                  No policies yet. Missing boundaries default to deny.
                </p>
              )}
              {policies.map((item) => (
                <button type="button" key={item.id}
                  className={`credential-card${item.id === policy?.id ? " selected" : ""}`}
                  aria-pressed={item.id === policy?.id}
                  onClick={() => void selectPolicy(item.id)}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{boundaryLabel(item.boundary, credentials)}</small>
                  </span>
                  <span className={`state-label state-${item.lifecycle}`}>
                    {item.operating_mode} default
                  </span>
                </button>
              ))}
            </div>
            {policy !== undefined && (
              <PolicyEditor key={`${policy.id}:${policy.version}`}
                policy={policy} services={services} credentials={credentials}
                groups={groups} users={users} destinations={destinations} api={api}
                onChanged={() => void loadService(service.id, policy.id)}
                onDeleted={() => void loadService(service.id)} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function CreatePolicy({
  serviceId,
  credentials,
  api,
  onCreated,
}: {
  serviceId: string;
  credentials: ControlCredential[];
  api: PolicyControlApi;
  onCreated(policy: ControlPolicyDetail): void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [error, setError] = useState("");
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>New policy</button>;
  }
  return (
    <form className="compact-create-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      const boundary: PolicyBoundary = credentialId === ""
        ? { kind: "service" }
        : { kind: "credential", credential_id: credentialId };
      void api.createPolicy(serviceId, {
        name,
        operating_mode: "deny",
        boundary,
      }).then(onCreated, (caught) => setError(messageFor(caught)));
    }}>
      <label>Name<input required maxLength={120} value={name}
        onChange={(event) => setName(event.target.value)} /></label>
      <label>Boundary<select value={credentialId}
        onChange={(event) => setCredentialId(event.target.value)}>
        <option value="">Service</option>
        {credentials.map((credential) => (
          <option key={credential.id} value={credential.id}>
            Credential: {credential.name}
          </option>
        ))}
      </select></label>
      <p className="warning-copy">New policies start in default-deny mode.</p>
      <button type="submit">Create policy</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function PolicyEditor({
  policy,
  services,
  credentials,
  groups,
  users,
  destinations,
  api,
  onChanged,
  onDeleted,
}: {
  policy: ControlPolicyDetail;
  services: ControlService[];
  credentials: ControlCredential[];
  groups: ServiceGroup[];
  users: ControlUser[];
  destinations: ServiceDestination[];
  api: PolicyControlApi;
  onChanged(): void;
  onDeleted(): void;
}) {
  const [name, setName] = useState(policy.name);
  const [description, setDescription] = useState(policy.description ?? "");
  const [mode, setMode] = useState(policy.operating_mode);
  const [error, setError] = useState("");
  const [copy, setCopy] = useState<PolicyCopyDocument>();

  function run(operation: Promise<unknown>, callback = onChanged) {
    setError("");
    void operation.then(callback, (caught) => setError(messageFor(caught)));
  }

  return (
    <div className="policy-editor">
      <section aria-labelledby="policy-editor-heading">
        <p className="card-kicker">{boundaryLabel(policy.boundary, credentials)}</p>
        <h3 id="policy-editor-heading">{policy.name}</h3>
        <p className={mode === "deny" ? "warning-copy" : "muted-copy"}>
          No matching rule defaults to <strong>{mode}</strong>.
        </p>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        <form className="stacked-form" onSubmit={(event) => {
          event.preventDefault();
          run(api.updatePolicy(policy, {
            name,
            ...(description.trim() === "" ? {} : { description: description.trim() }),
            operating_mode: mode,
          }));
        }}>
          <label>Name<input required maxLength={120} value={name}
            onChange={(event) => setName(event.target.value)} /></label>
          <label>Description<textarea maxLength={1024} value={description}
            onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Operating mode<select value={mode}
            onChange={(event) => setMode(event.target.value as "allow" | "deny")}>
            <option value="deny">Deny when no rule matches</option>
            <option value="allow">Allow when no rule matches</option>
          </select></label>
          <button type="submit" disabled={policy.lifecycle === "archived"}>
            Save policy
          </button>
        </form>
      </section>

      <section aria-labelledby="policy-rules-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Highest priority first</p>
            <h3 id="policy-rules-heading">Rules</h3>
          </div>
          <CreateRule policy={policy} groups={groups} users={users} api={api}
            onCreated={onChanged} />
        </div>
        {policy.rules.length === 0 && (
          <p className="muted-copy">No rules. The boundary uses its default mode.</p>
        )}
        <div className="policy-rule-list">
          {[...policy.rules].sort((a, b) => b.priority - a.priority).map((rule) => (
            <RuleEditor key={`${rule.id}:${rule.version}`} rule={rule}
              groups={groups} users={users} api={api} onChanged={onChanged} />
          ))}
        </div>
      </section>

      <PolicySimulationPanel serviceId={policy.service_id} users={users}
        destinations={destinations} credentials={credentials} api={api} />

      <section aria-labelledby="policy-transfer-heading">
        <h3 id="policy-transfer-heading">Safe copy and clone</h3>
        <p className="muted-copy">
          The preview contains policy logic only—never credential values, grants,
          runtime references, or audit data.
        </p>
        <div className="button-row">
          <button type="button" onClick={() => {
            setError("");
            void api.copyPolicy(policy.service_id, policy.id)
              .then(setCopy, (caught) => setError(messageFor(caught)));
          }}>Preview safe copy</button>
          <button type="button" onClick={() => run(api.clonePolicy(
            policy.service_id,
            policy.id,
            {
              target_service_id: policy.service_id,
              boundary: policy.boundary,
              name: `${policy.name} copy`,
            },
          ))}>Clone complete policy</button>
        </div>
        {copy !== undefined && (
          <textarea aria-label="Safe policy copy preview" readOnly rows={10}
            value={JSON.stringify(copy, null, 2)} />
        )}
        <ImportPolicy services={services} credentials={credentials}
          initialDocument={copy} api={api} onImported={onChanged} />
      </section>

      <section className="danger-zone" aria-labelledby="policy-lifecycle-heading">
        <h3 id="policy-lifecycle-heading">Policy lifecycle</h3>
        {policy.lifecycle === "active" ? (
          <button type="button" onClick={() => run(api.archivePolicy(policy))}>
            Archive and disable policy
          </button>
        ) : (
          <button type="button" onClick={() => run(api.deletePolicy(policy), onDeleted)}>
            Permanently delete archived policy
          </button>
        )}
      </section>
    </div>
  );
}

function CreateRule({
  policy,
  groups,
  users,
  api,
  onCreated,
}: {
  policy: ControlPolicyDetail;
  groups: ServiceGroup[];
  users: ControlUser[];
  api: PolicyControlApi;
  onCreated(): void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [effect, setEffect] = useState<"allow" | "deny">("allow");
  const [priority, setPriority] = useState(0);
  const [methods, setMethods] = useState("GET");
  const [paths, setPaths] = useState("/");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [all, setAll] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  if (!open) {
    return <button type="button" disabled={policy.lifecycle === "archived"}
      onClick={() => setOpen(true)}>New rule</button>;
  }
  const selector = all
    ? { kind: "all" as const }
    : {
        kind: "principals" as const,
        group_ids: groupIds,
        user_ids: userIds,
        direct_assignment_confirmed: confirmed,
      };
  return (
    <form className="rule-create-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      void api.createPolicyRule(policy, {
        name,
        effect,
        priority,
        enabled: true,
        methods: splitList(methods),
        hosts: [],
        paths: splitList(paths).map((value) => ({ kind: "prefix" as const, value })),
        response_safeguards: defaultSafeguards(),
        selector,
      }).then(onCreated, (caught) => setError(messageFor(caught)));
    }}>
      <label>Name<input required maxLength={120} value={name}
        onChange={(event) => setName(event.target.value)} /></label>
      <label>Effect<select value={effect}
        onChange={(event) => setEffect(event.target.value as "allow" | "deny")}>
        <option value="allow">Allow</option><option value="deny">Deny</option>
      </select></label>
      <label>Priority<input type="number" min={-1_000_000_000} max={1_000_000_000}
        value={priority} onChange={(event) => setPriority(event.target.valueAsNumber)} /></label>
      <label>Methods, comma separated<input value={methods}
        onChange={(event) => setMethods(event.target.value)} /></label>
      <label>Path prefixes, comma separated<input required value={paths}
        onChange={(event) => setPaths(event.target.value)} /></label>
      <fieldset>
        <legend>Principal assignment</legend>
        <label><input type="checkbox" checked={all}
          onChange={(event) => setAll(event.target.checked)} />
          Every user already authorized for this service</label>
        {!all && (
          <PrincipalChoices groups={groups} users={users} groupIds={groupIds}
            userIds={userIds} setGroupIds={setGroupIds} setUserIds={setUserIds}
            confirmed={confirmed} setConfirmed={setConfirmed} />
        )}
      </fieldset>
      {!all && groupIds.length === 0 && userIds.length === 0 && (
        <p className="warning-copy">Choose at least one group or user.</p>
      )}
      <button type="submit" disabled={
        (!all && groupIds.length === 0 && userIds.length === 0) ||
        (userIds.length > 0 && !confirmed)
      }>Create enabled rule</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function RuleEditor({
  rule,
  groups,
  users,
  api,
  onChanged,
}: {
  rule: ControlPolicyRule;
  groups: ServiceGroup[];
  users: ControlUser[];
  api: PolicyControlApi;
  onChanged(): void;
}) {
  const [error, setError] = useState("");
  const [groupIds, setGroupIds] = useState(rule.selector?.group_ids ?? []);
  const [userIds, setUserIds] = useState(rule.selector?.user_ids ?? []);
  const [all, setAll] = useState(rule.selector?.kind === "all");
  const [confirmed, setConfirmed] = useState(false);
  function run(operation: Promise<unknown>) {
    setError("");
    void operation.then(onChanged, (caught) => setError(messageFor(caught)));
  }
  const input: PolicyRuleInput = {
    name: rule.name,
    ...(rule.reason === undefined ? {} : { reason: rule.reason }),
    effect: rule.effect,
    priority: rule.priority,
    enabled: rule.enabled,
    methods: rule.methods,
    hosts: rule.hosts,
    paths: rule.paths,
    response_safeguards: rule.response_safeguards,
    selector: all
      ? { kind: "all" }
      : {
          kind: "principals",
          group_ids: groupIds,
          user_ids: userIds,
          direct_assignment_confirmed: confirmed,
        },
  };
  return (
    <article className={`policy-rule policy-rule-${rule.effect}`}>
      <div className="section-toolbar">
        <div>
          <strong>{rule.name}</strong>
          <p>{rule.effect} · priority {rule.priority} · {rule.enabled ? "enabled" : "disabled"}</p>
        </div>
        <button type="button" onClick={() => run(api.updatePolicyRule(rule, {
          ...input,
          enabled: !rule.enabled,
          ...(rule.enabled ? { selector: undefined } : {}),
        }))}>{rule.enabled ? "Disable" : "Enable"}</button>
      </div>
      <p className="muted-copy">
        Methods: {rule.methods.join(", ") || "any"} · Paths:{" "}
        {rule.paths.map(({ kind, value }) => `${kind} ${value}`).join(", ") || "any"}
      </p>
      <details>
        <summary>Assignments and actions</summary>
        <fieldset>
          <legend>Rule principals</legend>
          <label><input type="checkbox" checked={all}
            onChange={(event) => setAll(event.target.checked)} />
            Every user already authorized for this service</label>
          {!all && (
            <PrincipalChoices groups={groups} users={users} groupIds={groupIds}
              userIds={userIds} setGroupIds={setGroupIds} setUserIds={setUserIds}
              confirmed={confirmed} setConfirmed={setConfirmed} />
          )}
        </fieldset>
        <div className="button-row">
          <button type="button" disabled={
            (!all && groupIds.length === 0 && userIds.length === 0) ||
            (userIds.length > 0 && !confirmed)
          } onClick={() => run(api.replacePolicyRuleAssignments(
            rule,
            input.selector!,
          ))}>Replace assignments</button>
          <button type="button" onClick={() => run(api.deletePolicyRule(rule))}>
            Delete rule
          </button>
        </div>
      </details>
      {rule.enabled && rule.selector === undefined && (
        <p className="warning-copy">Remediation required: enabled rule is unassigned.</p>
      )}
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function PrincipalChoices({
  groups,
  users,
  groupIds,
  userIds,
  setGroupIds,
  setUserIds,
  confirmed,
  setConfirmed,
}: {
  groups: ServiceGroup[];
  users: ControlUser[];
  groupIds: string[];
  userIds: string[];
  setGroupIds(value: string[]): void;
  setUserIds(value: string[]): void;
  confirmed: boolean;
  setConfirmed(value: boolean): void;
}) {
  return (
    <div className="assignment-grid">
      <div>
        <strong>Groups (preferred)</strong>
        {groups.map((group) => (
          <label key={group.id}><input type="checkbox"
            checked={groupIds.includes(group.id)}
            onChange={() => setGroupIds(toggle(groupIds, group.id))} />
            Group: {group.name}</label>
        ))}
      </div>
      <div>
        <strong>Direct-user exceptions</strong>
        {users.map((user) => (
          <label key={user.id}><input type="checkbox"
            checked={userIds.includes(user.id)}
            onChange={() => setUserIds(toggle(userIds, user.id))} />
            Direct exception: {user.email}</label>
        ))}
      </div>
      {userIds.length > 0 && (
        <label><input type="checkbox" checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)} />
          I understand groups are preferred for durable policy assignments.</label>
      )}
    </div>
  );
}

function PolicySimulationPanel({
  serviceId,
  users,
  destinations,
  credentials,
  api,
}: {
  serviceId: string;
  users: ControlUser[];
  destinations: ServiceDestination[];
  credentials: ControlCredential[];
  api: PolicyControlApi;
}) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [credentialIds, setCredentialIds] = useState<string[]>([]);
  const [result, setResult] = useState<PolicySimulation>();
  const [error, setError] = useState("");
  return (
    <section aria-labelledby="policy-simulator-heading">
      <h3 id="policy-simulator-heading">Explain a request</h3>
      <form className="simulation-form" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        setError("");
        setResult(undefined);
        void api.simulatePolicy(serviceId, {
          user_id: userId,
          destination_id: destinationId,
          method,
          path,
          credential_ids: credentialIds,
        }).then(setResult, (caught) => setError(messageFor(caught)));
      }}>
        <label>User<select required value={userId}
          onChange={(event) => setUserId(event.target.value)}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
        </select></label>
        <label>Destination<select required value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}>
          {destinations.map((destination) => (
            <option key={destination.id} value={destination.id}>{destination.slug}</option>
          ))}
        </select></label>
        <label>Method<input required maxLength={32} value={method}
          onChange={(event) => setMethod(event.target.value)} /></label>
        <label>Canonical path<input required maxLength={4096} value={path}
          onChange={(event) => setPath(event.target.value)} /></label>
        <fieldset>
          <legend>Used credential boundaries</legend>
          {credentials.map((credential) => (
            <label key={credential.id}><input type="checkbox"
              checked={credentialIds.includes(credential.id)}
              onChange={() => setCredentialIds(toggle(credentialIds, credential.id))} />
              {credential.name}</label>
          ))}
        </fieldset>
        <button type="submit" disabled={userId === "" || destinationId === ""}>
          Explain outcome
        </button>
      </form>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
      {result !== undefined && (
        <div className={`simulation-result simulation-${result.allowed ? "allow" : "deny"}`}
          role="status">
          <strong>Final outcome: {result.allowed ? "ALLOW" : "DENY"}</strong>
          <p>{result.reason_code} for {result.canonical_target.method}{" "}
            {result.canonical_target.pathname}</p>
          <ol>
            {result.boundaries.map((boundary) => (
              <li key={boundary.boundary_id}>
                {boundary.kind}: {boundary.allowed ? "allow" : "deny"} —{" "}
                {boundary.reason_code}
                {boundary.reason_code === "deny_tie" && " (deny wins equal priority)"}
                {!boundary.assignment_allowed && " (assignment denied)"}
              </li>
            ))}
          </ol>
          <nav aria-label="Authorized policy explanation links">
            {result.links.map((link) => (
              <a key={`${link.kind}:${link.id}`} href={link.href}>
                {link.kind} details
              </a>
            ))}
          </nav>
        </div>
      )}
    </section>
  );
}

function ImportPolicy({
  services,
  credentials,
  initialDocument,
  api,
  onImported,
}: {
  services: ControlService[];
  credentials: ControlCredential[];
  initialDocument?: PolicyCopyDocument;
  api: PolicyControlApi;
  onImported(): void;
}) {
  const [open, setOpen] = useState(false);
  const [targetServiceId, setTargetServiceId] = useState(services[0]?.id ?? "");
  const [credentialId, setCredentialId] = useState("");
  const [document, setDocument] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialDocument !== undefined) setDocument(JSON.stringify(initialDocument, null, 2));
  }, [initialDocument]);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>Import safe copy</button>;
  }
  return (
    <form className="stacked-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      let parsed: PolicyCopyDocument;
      try {
        parsed = JSON.parse(document) as PolicyCopyDocument;
      } catch {
        setError("Policy copy must be valid JSON.");
        return;
      }
      const boundary: PolicyBoundary = credentialId === ""
        ? { kind: "service" }
        : { kind: "credential", credential_id: credentialId };
      void api.importPolicy(targetServiceId, { boundary, document: parsed })
        .then(onImported, (caught) => setError(messageFor(caught)));
    }}>
      <label>Target service<select value={targetServiceId}
        onChange={(event) => {
          setTargetServiceId(event.target.value);
          setCredentialId("");
        }}>
        {services.map((service) => (
          <option key={service.id} value={service.id}>{service.name}</option>
        ))}
      </select></label>
      <label>Target boundary<select value={credentialId}
        onChange={(event) => setCredentialId(event.target.value)}>
        <option value="">Service</option>
        {credentials.filter(({ service_id }) => service_id === targetServiceId)
          .map((credential) => (
            <option key={credential.id} value={credential.id}>
              Credential: {credential.name}
            </option>
          ))}
      </select></label>
      <label>Closed policy document<textarea required rows={10} value={document}
        onChange={(event) => setDocument(event.target.value)} /></label>
      <p className="warning-copy">
        Cross-service imports arrive disabled and unassigned until principals are remapped.
      </p>
      <button type="submit">Validate and import complete policy</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function boundaryLabel(
  boundary: PolicyBoundary,
  credentials: ControlCredential[],
): string {
  if (boundary.kind === "service") return "Service boundary";
  const credential = credentials.find(({ id }) => id === boundary.credential_id);
  return `Credential boundary: ${credential?.name ?? boundary.credential_id}`;
}

function splitList(value: string): string[] {
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function defaultSafeguards(): PolicyRuleInput["response_safeguards"] {
  return {
    secretlint: { enabled: true, disabled_rule_ids: [] },
    binary_response: { scan: true, max_bytes: null },
  };
}

function messageFor(caught: unknown): string {
  if (caught instanceof ControlApiError) return caught.message;
  return "The policy operation failed without exposing sensitive details.";
}
