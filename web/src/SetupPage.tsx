import { useCallback, useEffect, useRef, useState } from "react";
import brandLockup from "../../assets/brand/secretsauce-lockup.png";

export type SetupState =
  | "preparing"
  | "enrollment"
  | "available"
  | "not_ready";

export interface SetupStatus {
  state: SetupState;
  message: string;
  retry_pending: boolean;
}

const INITIAL_STATUS: SetupStatus = {
  state: "preparing",
  message: "SecretSauce is preparing this installation.",
  retry_pending: false,
};
const POLL_DELAYS_MS = [1_000, 2_000, 5_000] as const;
const MAX_STATUS_BYTES = 2_048;
const defaultNavigate = (path: string): void => window.location.replace(path);
const defaultSchedule = (
  callback: () => void,
  delay: number,
): number => window.setTimeout(callback, delay);
const defaultCancel = (timer: number): void => window.clearTimeout(timer);

export async function readSetupStatus(): Promise<SetupStatus> {
  const response = await fetch("/api/v2/setup/status", {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers: { accept: "application/json" },
  });
  if (
    !response.ok
    || !response.headers.get("content-type")
      ?.toLowerCase().startsWith("application/json")
  ) throw new Error("setup status unavailable");
  const source = await response.text();
  if (source.length < 2 || source.length > MAX_STATUS_BYTES) {
    throw new Error("setup status unavailable");
  }
  return validateSetupStatus(JSON.parse(source));
}

export function SetupPage({
  readStatus = readSetupStatus,
  navigate = defaultNavigate,
  schedule = defaultSchedule,
  cancel = defaultCancel,
}: {
  readStatus?: () => Promise<SetupStatus>;
  navigate?: (path: string) => void;
  schedule?: (callback: () => void, delay: number) => number;
  cancel?: (timer: number) => void;
}) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [announcement, setAnnouncement] = useState(INITIAL_STATUS.message);
  const attempt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const inFlight = useRef<Promise<SetupStatus> | undefined>(undefined);
  const requestSerial = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestSerial.current;
    if (timer.current !== undefined) cancel(timer.current);
    timer.current = undefined;
    let next: SetupStatus;
    try {
      const pending = inFlight.current ?? readStatus();
      inFlight.current = pending;
      next = await pending;
      if (inFlight.current === pending) inFlight.current = undefined;
    } catch {
      inFlight.current = undefined;
      next = {
        state: "not_ready",
        message:
          "SecretSauce needs operator attention before setup can continue.",
        retry_pending: false,
      };
    }
    if (!mounted.current || request !== requestSerial.current) return;
    setStatus((current) => {
      if (
        current.state !== next.state
        || current.retry_pending !== next.retry_pending
      ) setAnnouncement(next.message);
      return next;
    });
    if (next.state === "preparing" || next.state === "enrollment") {
      const delay = POLL_DELAYS_MS[
        Math.min(attempt.current, POLL_DELAYS_MS.length - 1)
      ]!;
      attempt.current += 1;
      timer.current = schedule(() => void refresh(), delay);
    }
  }, [cancel, readStatus, schedule]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      requestSerial.current += 1;
      if (timer.current !== undefined) cancel(timer.current);
    };
  }, [cancel, refresh]);

  useEffect(() => {
    if (status.state === "available") navigate("/control/");
  }, [navigate, status.state]);

  return (
    <div className="setup-shell">
      <a className="skip-link" href="#setup-main">Skip to setup status</a>
      <header className="setup-header">
        <img src={brandLockup} alt="SecretSauce" />
      </header>
      <main id="setup-main" className="setup-main" tabIndex={-1}>
        <section className="setup-card" aria-labelledby="setup-heading">
          <p className="eyebrow">Secure local setup</p>
          <h1 id="setup-heading">Setting up SecretSauce</h1>
          <div className={`setup-state setup-state-${status.state}`}>
            <span className="setup-state-icon" aria-hidden="true">
              {status.state === "not_ready" ? "!" : status.state === "enrollment" ? "✓" : "•"}
            </span>
            <div>
              <h2>{headingFor(status.state)}</h2>
              <p>{status.message}</p>
            </div>
          </div>
          {status.state === "preparing" && (
            <p>This may take a moment. It is safe to refresh.</p>
          )}
          {status.state === "not_ready" && (
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                attempt.current = 0;
                void refresh();
              }}
            >
              Try again
            </button>
          )}
          {status.state === "enrollment" && (
            <a className="button-link primary-action" href="/control/enroll">
              Continue to secure enrollment
            </a>
          )}
          <p className="setup-update-note">
            Status updates automatically.{" "}
            <a href="/control/setup">Refresh status</a>
          </p>
        </section>
      </main>
      <footer className="setup-footer">
        Give agents access, not secrets.
      </footer>
      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>
  );
}

function headingFor(state: SetupState): string {
  if (state === "enrollment") return "Ready for secure enrollment";
  if (state === "available") return "SecretSauce is available";
  if (state === "not_ready") return "Operator attention needed";
  return "Preparing this installation";
}

function validateSetupStatus(value: unknown): SetupStatus {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("setup status unavailable");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",")
      !== "message,retry_pending,state"
    || !["preparing", "enrollment", "available", "not_ready"]
      .includes(String(record.state))
    || typeof record.message !== "string"
    || record.message.length < 1
    || record.message.length > 160
    || typeof record.retry_pending !== "boolean"
  ) throw new Error("setup status unavailable");
  return {
    state: record.state as SetupState,
    message: record.message,
    retry_pending: record.retry_pending,
  };
}
