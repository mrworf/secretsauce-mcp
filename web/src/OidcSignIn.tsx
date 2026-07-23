import { useEffect, useState } from "react";
import {
  browserControlApi,
  type OidcControlApi,
  type OidcProviderLabel,
  type RestrictedOidcOptions,
} from "./controlApi";

export function OidcSignIn({
  api = browserControlApi,
  navigate = (url) => window.location.assign(url),
  restricted,
}: {
  api?: OidcControlApi;
  navigate?: (url: string) => void;
  restricted?: RestrictedOidcOptions;
}) {
  const [providers, setProviders] = useState<OidcProviderLabel[]>(restricted?.providers ?? []);
  const [loading, setLoading] = useState(restricted === undefined);
  const [starting, setStarting] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (restricted !== undefined) return;
    api.oidcProviders()
      .then(({ providers: configured }) => setProviders(configured))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [api, restricted]);

  async function begin(providerId: string) {
    setStarting(providerId);
    setFailed(false);
    try {
      const result = restricted === undefined
        ? await api.beginOidc(providerId)
        : await browserControlApi.beginRestrictedOidc(providerId, restricted.csrf_token);
      navigate(result.authorization_url);
    } catch {
      setStarting(undefined);
      setFailed(true);
    }
  }

  return (
    <main className="startup-message">
      <h1>Sign in required</h1>
      <p>
        {restricted === undefined
          ? "Choose your configured identity provider to open the control workspace."
          : "Finish enrollment with an approved external identity provider."}
      </p>
      {loading && <p role="status">Loading sign-in options…</p>}
      {!loading && providers.length === 0 && (
        <p role={failed ? "alert" : "status"}>
          {failed
            ? "Sign-in options are temporarily unavailable."
            : "No external sign-in provider is configured. Use local sign-in."}
        </p>
      )}
      {providers.length > 0 && (
        <div className="signin-actions" aria-label="External sign-in providers">
          {providers.map((provider) => (
            <button
              type="button"
              key={provider.id}
              disabled={starting !== undefined}
              onClick={() => void begin(provider.id)}
            >
              {starting === provider.id ? "Opening…" : `Continue with ${provider.display_name}`}
            </button>
          ))}
        </div>
      )}
      {failed && providers.length > 0 && (
        <p className="form-error" role="alert">External sign-in could not be started. Try again.</p>
      )}
    </main>
  );
}
