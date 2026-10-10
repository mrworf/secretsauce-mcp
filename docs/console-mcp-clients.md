# Managed MCP client access

Built-in OAuth uses an active, enrolled local account, password, fresh authenticator code and deliberate client consent. The page identifies the verified client and requested scopes. Consent authorizes that client as the signing-in identity; it never assigns a service. Owners and Administrators require explicit service assignments, and Auditors cannot connect or execute.

Each MCP POST authenticates independently. A client grant, current account eligibility and authorization generation must still be valid after input waits and immediately before credential substitution or dispatch. Disabling/recovering an account or revoking its security authority cannot be undone by re-enabling it: old client authorization remains invalid. OAuth code redirects retain short lifetimes, single use and PKCE. The gateway does not issue or trust an MCP transport session ID.

Managed refresh state is an atomic hash-only snapshot in `oauth-refresh.json` within the single-process console storage directory. The encrypted committed configuration retains signing material. Keep the console storage and its encryption key stable across normal restarts. Legacy password-only grants and access tokens from before managed MFA consent are denied; reconnect using the enrolled-account consent flow. Unmanaged YAML mode retains its existing authorization behavior and mandatory audit admission.

Response protection remains best-effort. Trusted downstream destinations may observe their requests; scanning cannot guarantee that every encoding or reflection of a credential will be removed.

Real ChatGPT and Codex interoperability requires authorized platform exercises against a reachable synthetic test service. Local protocol tests do not provide that evidence.

Open **My account → Inspect my connected clients** or **People & Access → My connected clients** to inspect your current grants. Revoke confirms the selected client and acts immediately. Its access and refresh tokens stop authorizing new admissions. Other clients retain their grants, but temporary references for the identity are invalidated and must be reacquired. The Owner's existing **Revoke sessions and clients** action revokes all target authority and advances its authorization generation.

A revocation verifier in encrypted managed state remains until that grant's original maximum expiry. The durable audit start also records the non-secret grant selector and original expiry; unresolved revocation intents fence older state and refresh snapshots after uncertain writes. A normal restart cannot revive revoked client authority. Audit outages block consent, issuance, refresh and revocation; uncertain outcomes require operation-status inspection instead of blind retry.
