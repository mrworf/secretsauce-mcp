import { type FormEvent, useEffect, useState } from "react";
import brandLockup from "../../assets/brand/secretsauce-lockup.png";
import {
  browserControlApi,
  type BrowserAuthenticationApi,
  type OidcControlApi,
  type OidcProviderLabel,
} from "./controlApi";

type LoginApi = Pick<BrowserAuthenticationApi, "login"> & OidcControlApi;

export function LoginPage({
  api = browserControlApi,
  navigate = (url) => window.location.assign(url),
}: {
  api?: LoginApi;
  navigate?: (url: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [providers, setProviders] = useState<OidcProviderLabel[]>([]);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<string>();
  const [message, setMessage] = useState("");
  const completed = new URLSearchParams(window.location.search).get("enrollment") === "complete";

  useEffect(() => {
    api.oidcProviders()
      .then(({ providers: values }) => setProviders(values))
      .catch(() => setProviders([]));
  }, [api]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const destination = requestedDestination();
      const result = await api.login({
        email,
        password,
        totp,
        ...(destination === undefined ? {} : { destination }),
      });
      setPassword("");
      setTotp("");
      navigate(result.purpose === "password_change"
        ? "/control/enroll"
        : result.destination ?? "/control/");
    } catch {
      setPassword("");
      setTotp("");
      setMessage("Sign-in details are invalid.");
    } finally {
      setBusy(false);
    }
  }

  async function beginOidc(providerId: string) {
    setStarting(providerId);
    setMessage("");
    try {
      const result = await api.beginOidc(providerId);
      navigate(result.authorization_url);
    } catch {
      setStarting(undefined);
      setMessage("Sign-in details are invalid.");
    }
  }

  return (
    <div className="setup-shell">
      <header className="setup-header">
        <img src={brandLockup} alt="SecretSauce" />
      </header>
      <main className="setup-main">
        <section className="setup-card login-card" aria-labelledby="login-heading">
          <p className="eyebrow">SecretSauce control</p>
          <h1 id="login-heading">Sign in</h1>
          {completed && (
            <p className="success-message" role="status">
              Enrollment complete. Sign in with your new credentials.
            </p>
          )}
          <form className="profile-form" onSubmit={(event) => void submit(event)}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Authenticator code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={totp}
                onChange={(event) => setTotp(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {providers.length > 0 && (
            <div className="signin-alternatives">
              <p>or use your organization</p>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  disabled={starting !== undefined}
                  onClick={() => void beginOidc(provider.id)}
                >
                  {starting === provider.id
                    ? "Opening…"
                    : `Continue with ${provider.display_name}`}
                </button>
              ))}
            </div>
          )}
          <p
            className={message === "" ? "visually-hidden" : "form-error"}
            role={message === "" ? "status" : "alert"}
            aria-live="polite"
          >
            {message}
          </p>
          <a className="enrollment-entry" href="/control/enroll">Enroll account</a>
        </section>
      </main>
      <footer className="setup-footer">Give agents access, not secrets.</footer>
    </div>
  );
}

function requestedDestination(): string | undefined {
  const value = new URLSearchParams(window.location.search).get("next");
  if (
    value === null
    || !(value === "/control" || value.startsWith("/control/"))
    || value.startsWith("//")
    || /[\u0000-\u001f\u007f\\]/.test(value)
  ) return undefined;
  return value;
}
