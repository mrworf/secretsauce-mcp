# M14 authorized real-client verification

PRE-015 is pending. This procedure is runnable by an authorized tester with actual ChatGPT custom-MCP access, CIMD-capable Codex and an existing isolated trusted HTTPS endpoint. Local browser/protocol fixtures do not satisfy it. The operator owns accounts, network/DNS/certificate and ingress configuration; do not publish a private instance automatically. Use only synthetic identities/services/credentials and constrain console exposure. Follow [client connection guidance](mcp-client-connection.md).

Prepare an enrolled Owner and assigned Administrator/Member, an unassigned privileged account, an Auditor and a synthetic service with a permitted `/ok` operation and denied `/denied` operation. The synthetic service must produce no real private data. Owner reviews current built-in resource/issuer origins, full MCP path, client metadata restrictions and explicit service assignments. Preserve the entire managed storage directory, encryption key and stable gateway audit directory with one process writer for restart.

For **each platform separately**, record the platform/version/date and authorized tester category (no real contact details). Run:

1. Connect the full HTTPS MCP URL using OAuth CIMD. Deny once and confirm no grant; reconnect, verify client/scopes/identity, consent with enrolled password and fresh MFA. Do not capture credentials or reusable tokens.
2. Discover all five tools. Call `list_services` and confirm only assigned services appear. Record tool names and success/denial outcome, never opaque references or downstream bodies.
3. Use `get_gateway_service_references` for the assigned synthetic service. Use returned references in `service_request` for permitted `/ok`; record success and sanitized request ID only. Request denied `/denied`, then `explain_denial` using its denial ID; record the policy reason category.
4. Exercise unassigned privileged account, Auditor, disabled account and removed assignment; confirm no dispatch. Re-enable deliberate assignments for remaining positive steps. Check cross-service/cross-subject reference use denies. External/bearer tokens must not authenticate a console session.
5. Restart the process normally with stable encrypted configuration/signing/hash-only refresh/audit storage. Confirm current refresh/client authority continues; old temporary references fail. Reacquire references and repeat permitted request.
6. Revoke only this client through its user's connected-client page. Attempt another request/refresh with the client and confirm denial. Other grants retain authority but reacquire references. Reconnect with fresh consent and verify permitted behavior. Owner target-wide security revoke must deny old grants even after account re-enable.
7. Apply an explicitly reviewed authentication/endpoint change with fresh Owner MFA; confirm old clients must reconnect and previous references remain unusable. Restore test settings through another explicit review if desired, never replay old proof or silently retry uncertain operations.

If the platform blocks an action before calling the gateway, record **platform refusal; gateway not reached**, without asserting a gateway denial. If client setup uses unsupported DCR/static non-URL identification or fails before discovery, record the exact non-secret condition and stop acceptance; do not downgrade to mocks. Store dated sanitized records under `evidence/platform/secretsauce-mcp/milestone14/` only after real execution. Use the template below per client; screenshots exclude passwords, codes/seeds, setup proofs, cookies, tokens/references, raw headers and private deployment addresses. No HAR, traces or persistent browser storage export.

```yaml
platform: ChatGPT-or-Codex
client_version_or_surface: to-be-recorded
date_utc: to-be-recorded
tester_authorization: authorized-synthetic-test-category
endpoint_alias: isolated-synthetic-HTTPS
revision_tested: exact-commit-SHA
results:
  denied_consent: NOT_RUN
  enrolled_MFA_consent: NOT_RUN
  five_tool_discovery: NOT_RUN
  assigned_reference_issuance: NOT_RUN
  permitted_request: NOT_RUN
  denied_request_and_explanation: NOT_RUN
  identity_assignment_cross_subject_cross_service_negatives: NOT_RUN
  normal_restart_refresh_and_reference_reacquisition: NOT_RUN
  own_client_revoke_and_denied_existing_authority: NOT_RUN
  fresh_reconnect: NOT_RUN
  owner_security_revoke_and_mode_change: NOT_RUN
sanitized_evidence_paths: []
material_limitations: []
```

Acceptance requires both actual platform records, all required results and root review. Docker deployment/backup/restore belongs to later milestones; no such work is included here.
