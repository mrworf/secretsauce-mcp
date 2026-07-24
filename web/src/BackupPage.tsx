import { useState, type FormEvent } from "react";
import {
  browserControlApi,
  type BackupControlApi,
  type UserRole,
} from "./controlApi";

export const BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT =
  "I understand this backup permanently excludes identities, access grants, audit history, runtime state, and deployment configuration.";

const ARCHIVE_FILENAME = "secretsauce-portable-backup.tar.gz";

export function BackupPage({
  role,
  api = browserControlApi,
}: {
  role: UserRole;
  api?: BackupControlApi;
}) {
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (role !== "superadmin") {
    return (
      <section className="content-panel" aria-labelledby="backup-restricted-heading">
        <h2 id="backup-restricted-heading">Backup access is restricted</h2>
        <p className="muted-copy">
          Only a superadmin can create a portable configuration backup.
        </p>
      </section>
    );
  }

  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
  const passphraseValid = !includeSecrets
    || (passphraseBytes >= 12
      && passphraseBytes <= 1_024
      && passphrase === confirmation);
  const ready = acknowledged
    && password !== ""
    && totp !== ""
    && passphraseValid
    && !submitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const archive = await api.createPortableBackup({
        include_secrets: includeSecrets,
        acknowledgement: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
        ...(includeSecrets ? { passphrase } : {}),
        password,
        totp,
      });
      downloadArchive(archive);
      setSuccess("Portable backup downloaded.");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPassphrase("");
      setConfirmation("");
      setPassword("");
      setTotp("");
      setSubmitting(false);
    }
  }

  return (
    <section className="content-panel backup-workspace" aria-labelledby="backup-heading">
      <div className="content-copy">
        <p className="card-kicker">Protected configuration lifecycle</p>
        <h2 id="backup-heading">Create portable backup</h2>
        <p>
          Download a schema-versioned configuration archive directly to this
          browser. SecretSauce does not create a reusable download URL.
        </p>
      </div>

      <aside className="backup-exclusions" aria-labelledby="backup-exclusions-heading">
        <span className="warning-label">Permanent exclusions</span>
        <h3 id="backup-exclusions-heading">This is not a full instance snapshot</h3>
        <p>
          Identities, roles, authenticators, access grants, sessions, API keys,
          OAuth state, audit and activity history, runtime references, deployment
          configuration, and key material are never included.
        </p>
      </aside>

      <form className="backup-form" onSubmit={(event) => void submit(event)}>
        <fieldset className="backup-mode-grid">
          <legend>Backup contents</legend>
          <label className={`backup-mode ${includeSecrets ? "" : "backup-mode-selected"}`}>
            <input
              checked={!includeSecrets}
              name="backup-mode"
              onChange={() => setIncludeSecrets(false)}
              type="radio"
            />
            <span>
              <strong>Portable configuration only</strong>
              <small>
                Recommended. Credential definitions are included as unconfigured,
                without credential values.
              </small>
            </span>
          </label>
          <label className={`backup-mode backup-mode-sensitive ${includeSecrets ? "backup-mode-selected" : ""}`}>
            <input
              checked={includeSecrets}
              name="backup-mode"
              onChange={() => setIncludeSecrets(true)}
              type="radio"
            />
            <span>
              <strong>Include encrypted credential values</strong>
              <small>
                Higher sensitivity. Eligible values are encrypted with a separate
                passphrase that SecretSauce does not retain.
              </small>
            </span>
          </label>
        </fieldset>

        {includeSecrets && (
          <div className="backup-secret-fields">
            <label>
              Backup passphrase
              <input
                autoComplete="new-password"
                onChange={(event) => setPassphrase(event.target.value)}
                type="password"
                value={passphrase}
              />
            </label>
            <label>
              Confirm backup passphrase
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmation(event.target.value)}
                type="password"
                value={confirmation}
              />
            </label>
            <p className="field-help">
              Use 12–1,024 UTF-8 bytes. The passphrase and confirmation are
              cleared after every attempt.
            </p>
            {passphrase !== "" && (passphraseBytes < 12 || passphraseBytes > 1_024) && (
              <p className="form-error" role="alert">
                Passphrase must contain 12–1,024 UTF-8 bytes.
              </p>
            )}
            {confirmation !== "" && passphrase !== confirmation && (
              <p className="form-error" role="alert">Passphrases do not match.</p>
            )}
          </div>
        )}

        <label className="backup-acknowledgement">
          <input
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>{BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT}</span>
        </label>

        <div className="backup-step-up">
          <h3>Confirm your identity</h3>
          <p className="muted-copy">
            Every backup requires a fresh proof bound to this exact archive request.
          </p>
          <div className="field-pair">
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
        </div>

        {error !== "" && <p className="form-error" role="alert">{error}</p>}
        {success !== "" && <p className="success-copy" role="status">{success}</p>}
        <button disabled={!ready} type="submit">
          {submitting ? "Creating protected archive…" : "Create and download backup"}
        </button>
      </form>
    </section>
  );
}

function downloadArchive(archive: Blob): void {
  const url = URL.createObjectURL(archive);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = ARCHIVE_FILENAME;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function messageFor(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "The backup could not be created.";
}
