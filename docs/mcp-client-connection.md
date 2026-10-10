# Connect ChatGPT or Codex

Start with an enrolled local account and an explicitly assigned synthetic service. Consent never grants an assignment. Ask the Owner for the full MCP URL and to allow the platform's HTTPS client metadata origin or exact document URL. The supported built-in flow is CIMD, public token exchange (`none`) and S256 PKCE. DCR, arbitrary static client IDs and client secrets are not supported by this built-in server. Real ChatGPT/Codex validation remains required; these instructions do not certify interoperability.

Keep the values distinct:

| Value | Example |
| --- | --- |
| OAuth resource and built-in issuer origin | `https://mcp.example.org` |
| Full MCP Server URL | `https://mcp.example.org/mcp` |

The client must reach trusted HTTPS MCP and OAuth endpoints. The browser must reach consent. Public MCP reachability does not require public console access: a host operator can restrict `/console` at the ingress while forwarding `/mcp`, OAuth discovery and `/oauth/*`. Publishing infrastructure or changing ingress needs separate operator authorization. Private downstream support is independent of public-only, DNS-pinned client metadata retrieval.

## ChatGPT web

Open ChatGPT's custom MCP connection surface (currently Plugins → plus → Add custom MCP server). Enter the full Server URL, choose OAuth with CIMD and public-client token exchange, create/install the connection, and start authorization. Select discovered scopes `gateway.read`, `gateway.references`, `gateway.request`. On the gateway page verify client, callback and scopes, enter enrolled email/password and a fresh authenticator code, and explicitly consent. Deny or close to cancel. Exact interface labels and access depend on the current account/workspace. [Official custom MCP guidance](https://developers.openai.com/api/docs/guides/custom-mcp-server) describes the current connection surface.

ChatGPT uses a `https://chatgpt.com` client metadata document; our issuer does not advertise issuer-bound authorization responses, so the platform may use a callback-specific document. Allow its verified origin or exact displayed document, never a guessed callback or arbitrary client ID. [Official authentication guidance](https://developers.openai.com/plugins/build/auth) describes CIMD callback identification.

## Codex CLI and IDE

Configure Streamable HTTP with the full URL:

```toml
[mcp_servers.secretsauce]
url = "https://mcp.example.org/mcp"
auth = "oauth"
enabled = true
default_tools_approval_mode = "prompt"
```

Run `codex mcp login secretsauce --oauth-client-registration cimd`. A Codex version supporting CIMD is required; consult `codex mcp login --help`. Our discovery advertises CIMD and `none`, which current Codex also selects automatically. Leave static `oauth.client_id` unset. Codex's callback-specific CIMD uses `https://chatgpt.com/oauth/codex/<callback_id>/client.json` and an HTTP literal-loopback callback with a selected port. Owner allows the verified HTTPS metadata origin/document. The gateway accepts only a port difference for registered `127.0.0.1` or `[::1]` HTTP loopback redirects; host, path and query stay exact. Consent and exchange bind the actual requested callback. IDE users add the URL under MCP servers, restart the extension and select Authenticate. [Official Codex MCP guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) documents CIMD and these surfaces.

## Use, revoke and reconnect

Discover the five tools: `list_services`, `describe_service_policy`, `get_gateway_service_references`, `service_request`, `explain_denial`. List assigned services, acquire temporary references, then make a permitted synthetic request; use the denial ID to explain a denied request. Clients may separately require tool approval. A platform refusal before a tool call reaches the gateway has no gateway denial ID.

Inspect/revoke through My account → Inspect my connected clients. New admissions stop immediately; already dispatched downstream work may finish. Other clients keep their grants but reacquire temporary references. Normal restart keeps encrypted configuration, stable signing and hash-only refresh state when their entire directories/key material are retained with one writer. Temporary gateway references disappear: call `get_gateway_service_references` again. After endpoint/authentication changes, revoked grants, expired consent or account recovery, restart connection authorization. Never paste credentials, codes, cookies, tokens or temporary references into setup commands or evidence. Advanced external/bearer limits are described in [managed client access](console-mcp-clients.md).

Primary documentation checked 2026-10-10; real authorized platform exercises are tracked separately as PRE-015.
