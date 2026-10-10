# Managed MCP client access

Built-in OAuth uses an active, enrolled local account, password, fresh authenticator code and deliberate client consent. The page identifies the verified client and requested scopes. Consent authorizes that client as the signing-in identity; it never assigns a service. Owners and Administrators require explicit service assignments, and Auditors cannot connect or execute.

Each MCP POST authenticates independently. A client grant, current account eligibility and authorization generation must still be valid after input waits and immediately before credential substitution or dispatch. Disabling/recovering an account or revoking its security authority cannot be undone by re-enabling it: old client authorization remains invalid. OAuth code redirects retain short lifetimes, single use and PKCE. The gateway does not issue or trust an MCP transport session ID.

Managed refresh state is an atomic hash-only snapshot in `oauth-refresh.json` within the single-process console storage directory. The encrypted committed configuration retains signing material. Keep the console storage and its encryption key stable across normal restarts. Legacy password-only grants and access tokens from before managed MFA consent are denied; reconnect using the enrolled-account consent flow. Unmanaged YAML mode retains its existing authorization behavior and mandatory audit admission.

Response protection remains best-effort. Trusted downstream destinations may observe their requests; scanning cannot guarantee that every encoding or reflection of a credential will be removed.

Real ChatGPT and Codex interoperability requires authorized platform exercises against a reachable synthetic test service. Local protocol tests do not provide that evidence.
