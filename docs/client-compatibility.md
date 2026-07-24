# Codex and ChatGPT compatibility verification

SecretSauce supports both clients through the same authenticated, stateless
Streamable HTTP MCP endpoint. Automated fixtures prove protocol behavior; they
do not prove behavior inside a hosted client UI.

## Automated release gate

Run:

```text
npm test -- --run test/release-compatibility.test.ts
```

The test starts a local built-in OAuth/database identity fixture and executes
the same journey twice with independent client metadata named
`Codex release fixture` and `ChatGPT release fixture`: discovery, authorization
code plus PKCE, token exchange, MCP initialize, tools/list, a safe tool call,
restart, token refresh, and revocation denial. Every MCP POST authenticates
independently and no `mcp-session-id` is issued or trusted.

## Live deployment gate

Perform this checklist against the exact release deployment for both clients.
A failure blocks that deployment even if the automated fixture passes.

1. Verify TLS and OAuth discovery from outside the private network. Record the
   release commit/image digest, time, client/version, public origins, and
   sanitized HTTP status only.
2. Confirm `server.resource` and OAuth issuer are
   `https://mcp.example.org`, while the client MCP Server URL is
   `https://mcp.example.org/mcp`.
3. Register each client's exact redirect URI and client metadata origin under
   the deployment's allowlist. Do not use wildcard client metadata.
4. Connect Codex using [the Codex configuration](codex-setup.md), complete
   OAuth, confirm the server name/instructions, list tools, run
   `list_services`, and inspect one policy description.
5. Create the ChatGPT developer-mode app using the full `/mcp` Server URL,
   complete OAuth, confirm actions appear, run `list_services`, and inspect one
   policy description.
6. Confirm the two grants have distinct client identities and that neither can
   use an opaque reference issued to a different authenticated subject.
7. Restart the single gateway with stable OAuth/database/key mounts. Reconnect
   both clients, refresh authorization as required, and obtain new runtime
   references. Old runtime references must fail safely.
8. Revoke each grant from the control workspace. The next MCP POST from that
   client must be denied; a new authorization flow must be required.
9. Review audit by safe client label, action, outcome, and request ID. Confirm
   no authorization value, cookie, credential, opaque reference, downstream
   body, or local path appears.

Retain the sanitized checklist and client screenshots showing server/tool
names, but redact identities and request IDs when they are not needed. Never
capture OAuth values, cookies, one-time values, credential fields, or response
bodies. Platform safety checks may stop a ChatGPT action before it reaches
SecretSauce; record that separately from gateway authorization evidence.
