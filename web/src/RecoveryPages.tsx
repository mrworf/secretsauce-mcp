import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  browserControlApi,
  type RecoveryControlApi,
  type RecoverySnapshot,
  type RecoveryTask,
} from "./controlApi";

export function RecoveryPage({
  api = browserControlApi,
}: {
  api?: RecoveryControlApi;
}) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot>();
  const [initialError, setInitialError] = useState("");
  const [paginationError, setPaginationError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setInitialError("");
    setSnapshot(undefined);
    try {
      setSnapshot(await api.recoveryRemediations());
    } catch {
      setInitialError("Recovery tasks are unavailable.");
    }
  }, [api]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  if (initialError !== "") {
    return (
      <section className="content-panel error-panel" role="alert">
        <h2>Recovery tasks could not be loaded</h2>
        <p>{initialError} No local path, source content, or credential value was displayed.</p>
        <button type="button" onClick={() => void loadInitial()}>Retry recovery tasks</button>
      </section>
    );
  }
  if (snapshot === undefined) {
    return <p className="dashboard-loading" role="status">Loading recovery tasks…</p>;
  }

  async function loadMore() {
    if (snapshot?.next_cursor === undefined) return;
    setLoadingMore(true);
    setPaginationError("");
    try {
      const next = await api.recoveryRemediations(snapshot.next_cursor);
      setSnapshot({
        ...next,
        tasks: [...snapshot.tasks, ...next.tasks],
      });
    } catch {
      setPaginationError("Additional recovery tasks could not be loaded. Existing tasks remain available.");
    } finally {
      setLoadingMore(false);
    }
  }

  const open = snapshot.tasks.filter(({ state }) => state === "open");
  return (
    <div className="dashboard-stack">
      <section className="content-panel" aria-labelledby="recovery-summary-heading">
        <p className="card-kicker">Durable configuration recovery</p>
        <h2 id="recovery-summary-heading">Migration and restore status</h2>
        <p>
          Required work is derived from the current V2 database and survives
          restart. Source files, archive paths, credential sources, and vault
          identifiers are never shown here.
        </p>
        <dl className="detail-grid" aria-label="Recovery task totals">
          <div><dt>Open</dt><dd>{snapshot.counts.open}</dd></div>
          <div><dt>Completed</dt><dd>{snapshot.counts.completed}</dd></div>
          <div><dt>Dismissed</dt><dd>{snapshot.counts.dismissed}</dd></div>
          <div><dt>Total</dt><dd>{snapshot.counts.total}</dd></div>
        </dl>
        <div className="recovery-outcomes">
          <article>
            <h3>V1 migration</h3>
            <p>
              {snapshot.migration.state === "pending"
                ? "No completed V1 migration is recorded."
                : `${snapshot.migration.services} services imported; ${snapshot.migration.discarded_acl_entries} V1 ACL entries discarded.`}
            </p>
          </article>
          <article>
            <h3>Latest restore</h3>
            <p>
              {snapshot.latest_restore === undefined
                ? "No completed portable restore is recorded."
                : `${snapshot.latest_restore.state}: ${snapshot.latest_restore.services} services and ${snapshot.latest_restore.credentials} credential definitions processed.`}
            </p>
          </article>
        </div>
      </section>

      <section className="content-panel" aria-labelledby="recovery-open-heading">
        <h2 id="recovery-open-heading">Required work</h2>
        {open.length === 0
          ? <p className="muted-copy">No open recovery tasks in this page.</p>
          : (
              <ul className="recovery-task-list">
                {open.map((task) => <RecoveryTaskItem key={`${task.kind}:${task.id}`} task={task} />)}
              </ul>
            )}
        {snapshot.next_cursor !== undefined && (
          <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading…" : "Load more tasks"}
          </button>
        )}
        {paginationError !== "" && <p role="alert">{paginationError}</p>}
      </section>
    </div>
  );
}

export function OpenApiHelpPage() {
  return (
    <section className="content-panel" aria-labelledby="openapi-help-heading">
      <p className="card-kicker">Management API contract</p>
      <h2 id="openapi-help-heading">OpenAPI 3.1 reference</h2>
      <p>
        The generated contract is served from this control origin and matches
        the runtime request and response schemas.
      </p>
      <a className="button-link" href="/api/v2/openapi.json">
        Open generated OpenAPI JSON
      </a>
      <div className="foundation-grid" aria-label="Management API conventions">
        <article>
          <h3>Authentication</h3>
          <p>
            Routes explicitly accept browser sessions, system-owned API keys,
            or host-local CLI authority. API keys never satisfy browser step-up.
          </p>
        </article>
        <article>
          <h3>Safe mutations</h3>
          <p>
            Mutable resources use strong ETags through If-Match. Retry-sensitive
            creates require Idempotency-Key and bind it to the authenticated
            operation.
          </p>
        </article>
        <article>
          <h3>Inputs and errors</h3>
          <p>
            Pagination is bounded and cursor-based. Password, TOTP, passphrase,
            credential, and one-time API-key inputs are no-store and never
            appear in URLs, logs, audit, or examples. Errors use stable codes.
          </p>
        </article>
      </div>
    </section>
  );
}

function RecoveryTaskItem({ task }: { task: RecoveryTask }) {
  return (
    <li>
      <div>
        <span className="status-chip">{task.kind}</span>
        <strong>{taskLabel(task.task_kind)}</strong>
        <p>Service <code>{task.service_slug}</code></p>
      </div>
      <Link className="button-link" to={taskDestination(task.task_kind)}>
        Open workspace
      </Link>
    </li>
  );
}

function taskLabel(kind: RecoveryTask["task_kind"]): string {
  return {
    assign_service_admin: "Assign a service administrator",
    assign_service_access: "Assign intended service access",
    supply_credential: "Supply an unavailable credential",
    review_enable_policy: "Review, assign, and enable migrated policy",
    assign_enable_policy: "Assign and enable restored policy",
    validate_publish_service: "Validate and publish the service",
    missing_archive_secret: "Supply values excluded from the archive",
  }[kind];
}

function taskDestination(kind: RecoveryTask["task_kind"]): string {
  if (kind === "assign_service_access") return "/groups";
  if (kind === "supply_credential" || kind === "missing_archive_secret") {
    return "/credentials";
  }
  if (kind === "review_enable_policy" || kind === "assign_enable_policy") {
    return "/policies";
  }
  return "/services";
}
