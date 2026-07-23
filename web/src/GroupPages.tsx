import { useEffect, useState, type FormEvent } from "react";
import {
  browserControlApi,
  ControlApiError,
  type ControlService,
  type ControlUser,
  type EffectiveServiceAccess,
  type GroupControlApi,
  type ServiceAssignments,
  type ServiceGroup,
} from "./controlApi";

export function GroupsPage({
  api = browserControlApi,
}: {
  api?: GroupControlApi;
}) {
  const [services, setServices] = useState<ControlService[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [users, setUsers] = useState<ControlUser[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignments>();
  const [access, setAccess] = useState<EffectiveServiceAccess[]>([]);
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

  async function loadService(targetServiceId: string, preferredGroupId?: string) {
    setLoading(true);
    setError("");
    try {
      const [groupResult, assignmentResult, accessResult] = await Promise.all([
        api.listGroups(targetServiceId),
        api.serviceAssignments(targetServiceId),
        api.serviceAccess(targetServiceId),
      ]);
      setGroups(groupResult.groups);
      setAssignments(assignmentResult);
      setAccess(accessResult.access);
      setSelectedGroupId((current) => {
        const preferred = preferredGroupId ?? current;
        return preferred !== undefined && groupResult.groups.some(({ id }) => id === preferred)
          ? preferred
          : groupResult.groups[0]?.id;
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

  const selectedGroup = groups.find(({ id }) => id === selectedGroupId);
  const selectedService = services.find(({ id }) => id === serviceId);

  return (
    <div className="page-stack">
      <section className="content-panel" aria-labelledby="groups-heading">
        <div className="section-toolbar">
          <div>
            <p className="card-kicker">Service-scoped authorization</p>
            <h2 id="groups-heading">Groups and assignments</h2>
            <p className="muted-copy">
              Choose a service first. Group membership and service access are independent,
              explicit changes.
            </p>
          </div>
          <button type="button" onClick={() => void loadDirectory()} disabled={loading}>
            Refresh
          </button>
        </div>
        <label className="service-picker">
          Service
          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            disabled={loading || services.length === 0}
          >
            {services.length === 0 && <option value="">No manageable services</option>}
            {services.map((service) => (
              <option value={service.id} key={service.id}>
                {service.name} ({service.slug})
              </option>
            ))}
          </select>
        </label>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {loading && <p role="status">Loading authorized group data…</p>}
      </section>

      {selectedService !== undefined && assignments !== undefined && (
        <>
          <section className="content-panel" aria-labelledby="group-directory-heading">
            <div className="section-toolbar">
              <div>
                <p className="card-kicker">{selectedService.name}</p>
                <h2 id="group-directory-heading">Service groups</h2>
              </div>
              <CreateGroupForm
                serviceId={serviceId}
                api={api}
                onCreated={(group) => void loadService(serviceId, group.id)}
              />
            </div>
            <div className="group-layout">
              <div className="group-list" aria-label="Service groups">
                {groups.length === 0 && <p className="muted-copy">No groups yet.</p>}
                {groups.map((group) => (
                  <button
                    type="button"
                    className={`group-card${group.id === selectedGroupId ? " selected" : ""}`}
                    aria-pressed={group.id === selectedGroupId}
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <span><strong>{group.name}</strong><small>{group.member_count} members</small></span>
                    <span className={`state-label state-${group.lifecycle}`}>{group.lifecycle}</span>
                  </button>
                ))}
              </div>
              {selectedGroup !== undefined && (
                <GroupEditor
                  key={`${selectedGroup.id}:${selectedGroup.version}`}
                  group={selectedGroup}
                  users={users}
                  api={api}
                  onChanged={() => void loadService(serviceId, selectedGroup.id)}
                  onDeleted={() => void loadService(serviceId)}
                />
              )}
            </div>
          </section>

          <AssignmentEditor
            key={`${serviceId}:${assignments.version}`}
            groups={groups}
            users={users}
            assignments={assignments}
            access={access}
            api={api}
            onChanged={() => void loadService(serviceId)}
          />
        </>
      )}
    </div>
  );
}

function CreateGroupForm({
  serviceId,
  api,
  onCreated,
}: {
  serviceId: string;
  api: GroupControlApi;
  onCreated(group: ServiceGroup): void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)}>New group</button>;
  }
  return (
    <form className="compact-create-form" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      void api.createGroup(serviceId, { name }).then(onCreated, (caught) => {
        setError(messageFor(caught));
      });
    }}>
      <label>Group name<input required maxLength={120} value={name}
        onChange={(event) => setName(event.target.value)} /></label>
      <button type="submit">Create group</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function GroupEditor({
  group,
  users,
  api,
  onChanged,
  onDeleted,
}: {
  group: ServiceGroup;
  users: ControlUser[];
  api: GroupControlApi;
  onChanged(): void;
  onDeleted(): void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const active = group.lifecycle === "active";

  useEffect(() => {
    api.groupMembers(group.service_id, group.id)
      .then(({ members }) => setMemberIds(members.map(({ id }) => id)))
      .catch((caught) => setError(messageFor(caught)));
  }, [api, group.id, group.service_id]);

  function run(operation: Promise<unknown>, after = onChanged) {
    setError("");
    void operation.then(after, (caught) => setError(messageFor(caught)));
  }

  return (
    <article className="group-editor" aria-labelledby={`group-${group.id}`}>
      <h3 id={`group-${group.id}`}>{group.name}</h3>
      <form className="profile-form" onSubmit={(event) => {
        event.preventDefault();
        run(api.updateGroup(group, {
          name,
          ...(description.trim() === "" ? {} : { description }),
        }));
      }}>
        <label>Group name<input required maxLength={120} value={name}
          disabled={!active} onChange={(event) => setName(event.target.value)} /></label>
        <label>Description<textarea maxLength={1024} value={description}
          disabled={!active} onChange={(event) => setDescription(event.target.value)} /></label>
        {active && <button type="submit">Save group profile</button>}
      </form>
      <fieldset className="principal-fieldset" disabled={!active}>
        <legend>Members</legend>
        {users.length === 0 && (
          <p className="muted-copy">No related active users are available in your authorized view.</p>
        )}
        {users.map((user) => (
          <label className="checkbox-label" key={user.id}>
            <input type="checkbox" checked={memberIds.includes(user.id)}
              onChange={() => setMemberIds(toggle(memberIds, user.id))} />
            {displayName(user)} ({user.email})
          </label>
        ))}
        {active && (
          <button type="button" onClick={() =>
            run(api.replaceGroupMembers(group, memberIds))}>
            Replace membership
          </button>
        )}
      </fieldset>
      <div className="lifecycle-actions">
        <label>Change justification<textarea required maxLength={1024}
          value={justification} onChange={(event) => setJustification(event.target.value)} /></label>
        {active ? (
          <button className="danger-button" type="button" disabled={justification.trim() === ""}
            onClick={() => run(api.archiveGroup(group, justification))}>
            Archive {group.name}
          </button>
        ) : (
          <button className="danger-button" type="button" disabled={justification.trim() === ""}
            onClick={() => run(api.deleteGroup(group, justification), onDeleted)}>
            Permanently delete {group.name}
          </button>
        )}
      </div>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function AssignmentEditor({
  groups,
  users,
  assignments,
  access,
  api,
  onChanged,
}: {
  groups: ServiceGroup[];
  users: ControlUser[];
  assignments: ServiceAssignments;
  access: EffectiveServiceAccess[];
  api: GroupControlApi;
  onChanged(): void;
}) {
  const [all, setAll] = useState(assignments.selector?.kind === "all");
  const [groupIds, setGroupIds] = useState(assignments.selector?.group_ids ?? []);
  const [userIds, setUserIds] = useState(assignments.selector?.user_ids ?? []);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const input = all
      ? { kind: "all" as const }
      : {
          kind: "principals" as const,
          group_ids: groupIds,
          user_ids: userIds,
          direct_assignment_confirmed: userIds.length > 0 && confirmed,
        };
    void api.replaceServiceAssignments(assignments, input)
      .then(onChanged, (caught) => setError(messageFor(caught)));
  }

  return (
    <section className="content-panel" aria-labelledby="assignments-heading">
      <p className="card-kicker">Effective authorization</p>
      <h2 id="assignments-heading">Service assignments</h2>
      <form className="assignment-grid" onSubmit={submit}>
        <fieldset className="principal-fieldset all-principals">
          <legend>Broad access</legend>
          <label className="checkbox-label">
            <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
            Allow every active ordinary user
          </label>
          <p className="warning-copy">
            “All users” is intentionally broad and overrides the explicit group and user selection.
          </p>
        </fieldset>
        <fieldset className="principal-fieldset" disabled={all}>
          <legend>Groups</legend>
          {groups.filter(({ lifecycle }) => lifecycle === "active").map((group) => (
            <label className="checkbox-label" key={group.id}>
              <input type="checkbox" checked={groupIds.includes(group.id)}
                onChange={() => setGroupIds(toggle(groupIds, group.id))} />
              {group.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="principal-fieldset direct-assignment" disabled={all}>
          <legend>Direct-user exceptions</legend>
          <p className="warning-copy">
            Prefer groups. Direct assignments are exceptional and require explicit confirmation.
          </p>
          {users.map((user) => (
            <label className="checkbox-label" key={user.id}>
              <input type="checkbox" checked={userIds.includes(user.id)}
                onChange={() => {
                  setUserIds(toggle(userIds, user.id));
                  setConfirmed(false);
                }} />
              {displayName(user)} ({user.email})
            </label>
          ))}
          {userIds.length > 0 && (
            <label className="checkbox-label">
              <input type="checkbox" checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)} />
              I confirm these direct-user exceptions
            </label>
          )}
        </fieldset>
        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={
          (!all && groupIds.length === 0 && userIds.length === 0) ||
          (!all && userIds.length > 0 && !confirmed)
        }>Replace service assignments</button>
      </form>
      <div className="effective-access" aria-labelledby="effective-access-heading">
        <h3 id="effective-access-heading">Effective access</h3>
        {access.length === 0 && <p className="muted-copy">No ordinary users currently have access.</p>}
        {access.map((entry) => (
          <article key={entry.user_id}>
            <strong>{entry.given_name} {entry.family_name}</strong>
            <small>{entry.email}</small>
            <p>{entry.contributions.map(contributionLabel).join("; ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function displayName(user: ControlUser): string {
  return `${user.given_name} ${user.family_name}`.trim() || user.email;
}

function contributionLabel(
  contribution: EffectiveServiceAccess["contributions"][number],
): string {
  if (contribution.kind === "all") return "Included through all users";
  if (contribution.kind === "direct") return "Direct-user exception";
  return `Member of ${contribution.group_name}`;
}

function messageFor(error: unknown): string {
  if (error instanceof ControlApiError) {
    if (error.code === "stale_version") {
      return "This record changed. Refresh before retrying; your local selections remain here.";
    }
    return error.message;
  }
  return "The group operation could not be completed.";
}
