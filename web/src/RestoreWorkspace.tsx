import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  browserControlApi,
  type RestoreCommitResult,
  type RestoreControlApi,
  type RestorePreview,
  type RestoreStage,
  type UserRole,
} from "./controlApi";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;

export function RestoreWorkspace({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: RestoreControlApi;
}) {
  const [stage, setStage] = useState<RestoreStage>();
  const [preview, setPreview] = useState<RestorePreview>();
  const [result, setResult] = useState<RestoreCommitResult>();
  const [archive, setArchive] = useState<File>();
  const [resumeId, setResumeId] = useState(initialResumeId);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [justification, setJustification] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState<"stage" | "resume" | "preview" | "commit">();
  const [error, setError] = useState("");
  const archiveInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const step = result !== undefined
    ? 5
    : preview !== undefined
      ? 4
      : stage !== undefined
        ? 3
        : 1;

  useEffect(() => {
    if (step > 1) heading.current?.focus();
  }, [step]);

  if (role !== "superadmin") return null;

  function clearSecrets(): void {
    setPassphrase("");
    setPassword("");
    setTotp("");
  }

  function rememberStage(stageId: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set("restore_stage", stageId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setResumeId(stageId);
  }

  async function stageArchive(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (
      archive === undefined
      || archive.size < 1
      || archive.size > MAX_ARCHIVE_BYTES
      || password === ""
      || totp === ""
    ) return;
    setBusy("stage");
    setError("");
    try {
      const created = await api.stageRestore({ archive, password, totp });
      setStage(created);
      setPreview(created.preview);
      rememberStage(created.id);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setArchive(undefined);
      if (archiveInput.current !== null) archiveInput.current.value = "";
      clearSecrets();
      setBusy(undefined);
    }
  }

  async function resume(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (resumeId === "" || password === "" || totp === "") return;
    setBusy("resume");
    setError("");
    try {
      const current = await api.resumeRestore({
        stageId: resumeId,
        password,
        totp,
      });
      setStage(current);
      setPreview(current.preview);
      if (current.state === "completed" && current.preview !== undefined) {
        setResult(resultFromStatus(current, current.preview));
      }
      rememberStage(current.id);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      clearSecrets();
      setBusy(undefined);
    }
  }

  async function buildPreview(): Promise<void> {
    if (stage === undefined) return;
    setBusy("preview");
    setError("");
    try {
      setPreview(await api.previewRestore({
        stageId: stage.id,
        ...(passphrase === "" ? {} : { passphrase }),
      }));
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPassphrase("");
      setBusy(undefined);
    }
  }

  async function commit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (
      stage === undefined
      || preview === undefined
      || confirmation !== preview.confirmation_phrase
      || justification.trim().length < 10
      || password === ""
      || totp === ""
      || (
        preview.secret_disposition === "encrypted_secrets"
        && passphrase === ""
      )
    ) return;
    setBusy("commit");
    setError("");
    try {
      const completed = await api.commitRestore({
        stageId: stage.id,
        previewId: preview.id,
        confirmation,
        justification,
        ...(preview.secret_disposition === "encrypted_secrets"
          ? { passphrase }
          : {}),
        password,
        totp,
      });
      setResult(completed);
      const url = new URL(window.location.href);
      url.searchParams.delete("restore_stage");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setConfirmation("");
      clearSecrets();
      setBusy(undefined);
    }
  }

  return (
    <section className="restore-workspace" aria-labelledby="restore-heading">
      <div className="content-copy">
        <p className="card-kicker">Replacement workflow</p>
        <h2 id="restore-heading" ref={heading} tabIndex={-1}>
          Restore portable configuration
        </h2>
        <p>
          Restore replaces portable service configuration while preserving this
          instance&apos;s identities, authenticators, settings, deployment, and
          audit history.
        </p>
      </div>

      <ol className="restore-progress" aria-label="Restore progress">
        {["Upload", "Validate", "Preview", "Confirm", "Result"].map(
          (label, index) => (
            <li
              aria-current={step === index + 1 ? "step" : undefined}
              className={step >= index + 1 ? "restore-progress-active" : ""}
              key={label}
            >
              <span>{index + 1}</span>{label}
            </li>
          ),
        )}
      </ol>

      <p className="sr-only" aria-live="polite">
        Restore step {step} of 5.
      </p>
      {error !== "" && <p className="form-error" role="alert">{error}</p>}

      {stage === undefined && result === undefined && (
        <div className="restore-intake-grid">
          <form
            className="restore-panel"
            noValidate
            onSubmit={(event) => void stageArchive(event)}
          >
            <h3>Upload and validate</h3>
            <p className="muted-copy">
              Select one gzip archive up to 256 MiB. Archive bytes are cleared
              from this page after every attempt.
            </p>
            <label>
              Portable restore archive
              <input
                accept=".gz,application/gzip"
                onChange={(event) => selectArchive(event, setArchive)}
                ref={archiveInput}
                required
                type="file"
              />
            </label>
            {archive !== undefined && archive.size > MAX_ARCHIVE_BYTES && (
              <p className="form-error" role="alert">
                The archive exceeds the 256 MiB limit.
              </p>
            )}
            {archive !== undefined && (
              <IdentityFields
                password={password}
                setPassword={setPassword}
                setTotp={setTotp}
                totp={totp}
              />
            )}
            <button
              disabled={
                archive === undefined
                || archive.size < 1
                || archive.size > MAX_ARCHIVE_BYTES
                || password === ""
                || totp === ""
                || busy !== undefined
              }
              type="submit"
            >
              {busy === "stage" ? "Validating archive…" : "Upload and validate"}
            </button>
          </form>

          <form
            className="restore-panel"
            noValidate
            onSubmit={(event) => void resume(event)}
          >
            <h3>Resume a staged restore</h3>
            <p className="muted-copy">
              Only an unexpired stage owned by your signed-in identity can resume.
            </p>
            <label>
              Restore stage ID
              <input
                autoComplete="off"
                onChange={(event) => setResumeId(event.target.value)}
                required
                value={resumeId}
              />
            </label>
            {resumeId !== "" && (
              <IdentityFields
                password={password}
                setPassword={setPassword}
                setTotp={setTotp}
                totp={totp}
              />
            )}
            <button
              disabled={
                resumeId === ""
                || password === ""
                || totp === ""
                || busy !== undefined
              }
              type="submit"
            >
              {busy === "resume" ? "Resuming…" : "Resume restore"}
            </button>
          </form>
        </div>
      )}

      {stage !== undefined && preview === undefined && (
        <section className="restore-panel" aria-labelledby="restore-validated">
          <h3 id="restore-validated">Archive validated</h3>
          <SafeStage stage={stage} />
          <label>
            Archive passphrase (optional)
            <input
              autoComplete="new-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </label>
          <p className="field-help">
            Missing or invalid passphrases deliberately create a
            configuration-only preview. This field is cleared after the attempt.
          </p>
          <button disabled={busy !== undefined} onClick={() => void buildPreview()}>
            {busy === "preview" ? "Building preview…" : "Build restore preview"}
          </button>
        </section>
      )}

      {stage !== undefined && preview !== undefined && result === undefined && (
        <form
          className="restore-confirm"
          noValidate
          onSubmit={(event) => void commit(event)}
        >
          <PreviewSummary preview={preview} />
          <div className="restore-danger">
            <span className="warning-label">Irreversible replacement</span>
            <h3>Confirm this exact archive</h3>
            <p>
              Every session, API key, OAuth grant, group, assignment, and runtime
              reference will be revoked or cleared. Restored services remain drafts.
            </p>
            <label>
              Type <code>{preview.confirmation_phrase}</code>
              <input
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
                value={confirmation}
              />
            </label>
            <label>
              Justification
              <textarea
                maxLength={1_024}
                minLength={10}
                onChange={(event) => setJustification(event.target.value)}
                required
                value={justification}
              />
            </label>
            {preview.secret_disposition === "encrypted_secrets" && (
              <label>
                Re-enter archive passphrase
                <input
                  autoComplete="new-password"
                  onChange={(event) => setPassphrase(event.target.value)}
                  type="password"
                  value={passphrase}
                />
              </label>
            )}
            <IdentityFields
              password={password}
              setPassword={setPassword}
              setTotp={setTotp}
              totp={totp}
            />
            <button
              className="danger-button"
              disabled={
                confirmation !== preview.confirmation_phrase
                || justification.trim().length < 10
                || password === ""
                || totp === ""
                || (
                  preview.secret_disposition === "encrypted_secrets"
                  && passphrase === ""
                )
                || busy !== undefined
              }
              type="submit"
            >
              {busy === "commit"
                ? "Restoring and verifying…"
                : "Replace portable configuration"}
            </button>
          </div>
        </form>
      )}

      {result !== undefined && (
        <section className="restore-result" aria-labelledby="restore-result-heading">
          <h3 id="restore-result-heading">Restore completed</h3>
          <p role="status">
            Portable configuration was replaced and health checks passed.
            Your session was revoked; sign in again to complete remediation.
          </p>
          <dl className="restore-counts">
            <Count label="Services restored" value={result.services} />
            <Count label="Credentials restored" value={result.credentials} />
            <Count label="Policies restored" value={result.policies} />
            <Count label="Remediation tasks" value={result.remediations} />
          </dl>
          <a className="button-link" href="/control/login">Sign in again</a>
        </section>
      )}
    </section>
  );
}

function IdentityFields({
  password,
  setPassword,
  setTotp,
  totp,
}: {
  password: string;
  setPassword(value: string): void;
  setTotp(value: string): void;
  totp: string;
}) {
  return (
    <div className="field-pair restore-identity">
      <label>
        Current password
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      <label>
        Current 6-digit TOTP
        <input
          autoComplete="one-time-code"
          inputMode="numeric"
          onChange={(event) => setTotp(event.target.value)}
          pattern="[0-9]{6}"
          value={totp}
        />
      </label>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: RestorePreview }) {
  return (
    <section className="restore-preview" aria-labelledby="restore-preview-heading">
      <h3 id="restore-preview-heading">Server-derived replacement preview</h3>
      <p>
        Secret mode: <strong>{preview.secret_disposition === "encrypted_secrets"
          ? "Encrypted credential values verified"
          : "Configuration only—credential values unavailable"}</strong>
      </p>
      <div className="restore-summary-grid">
        <Summary
          heading="Replaces"
          items={[
            `${preview.counts.services} services`,
            `${preview.counts.destinations} destinations`,
            `${preview.counts.credentials} credential definitions`,
            `${preview.counts.policies} policies and ${preview.counts.rules} rules`,
          ]}
        />
        <Summary
          heading="Preserves"
          items={[
            "Identities and authenticators",
            "Security and system settings",
            "Deployment configuration",
            "Audit and activity history",
          ]}
        />
        <Summary
          heading="Clears"
          items={[
            "Groups and memberships",
            "Service and rule assignments",
            "Publications and active runtime snapshots",
            `${preview.counts.unavailable_secrets} unavailable credential values`,
          ]}
        />
        <Summary
          heading="Revokes"
          items={[
            `${preview.counts.revoked_sessions} browser sessions`,
            `${preview.counts.revoked_api_keys} API keys`,
            `${preview.counts.revoked_oauth_grants} OAuth grants`,
            "Gateway and response references",
          ]}
        />
        <Summary
          heading="Remediates"
          items={[
            `${preview.counts.remediations} durable tasks`,
            "Service administration and access",
            "Credential supply and policy enablement",
            "Validation and publication",
          ]}
        />
      </div>
    </section>
  );
}

function Summary({ heading, items }: { heading: string; items: string[] }) {
  return (
    <section>
      <h4>{heading}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function SafeStage({ stage }: { stage: RestoreStage }) {
  return (
    <dl className="restore-counts">
      <Count label="Archive ID" value={stage.archive_id} />
      <Count label="Archive bytes" value={stage.archive_bytes} />
      <Count label="Expires" value={new Date(stage.expires_at).toLocaleString()} />
    </dl>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function selectArchive(
  event: ChangeEvent<HTMLInputElement>,
  setArchive: (file: File | undefined) => void,
): void {
  setArchive(event.target.files?.[0]);
}

function initialResumeId(): string {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("restore_stage") ?? "";
}

function resultFromStatus(
  stage: RestoreStage,
  preview: RestorePreview,
): RestoreCommitResult {
  return {
    operation_id: stage.id,
    stage_id: stage.id,
    preview_id: preview.id,
    signed_out: true,
    services: preview.counts.services,
    destinations: preview.counts.destinations,
    credentials: preview.counts.credentials,
    policies: preview.counts.policies,
    rules: preview.counts.rules,
    remediations: preview.counts.remediations,
    revoked_api_keys: preview.counts.revoked_api_keys,
    revoked_sessions: preview.counts.revoked_sessions,
    revoked_oauth_grants: preview.counts.revoked_oauth_grants,
  };
}

function messageFor(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "The restore operation could not be completed.";
}
