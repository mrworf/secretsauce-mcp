#!/usr/bin/env bash
set -euo pipefail

image_name="${SECRETSAUCE_SMOKE_IMAGE:-secretsauce-mcp:release-smoke}"
container_name="${SECRETSAUCE_SMOKE_CONTAINER:-secretsauce-release-smoke}"
host_port="${SECRETSAUCE_SMOKE_PORT:-18080}"
smoke_token="release-smoke-token-value"
smoke_root="$(mktemp -d "${TMPDIR:-/tmp}/secretsauce-container-smoke.XXXXXX")"
config_file="${smoke_root}/config.yaml"
audit_directory="${smoke_root}/audit"
header_file="${smoke_root}/headers"
response_file="${smoke_root}/response.json"
mkdir -p "${audit_directory}"
chmod 0777 "${audit_directory}"

cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
  find "${smoke_root}" -type f -exec chmod u+rw {} \; 2>/dev/null || true
  rm -rf "${smoke_root}"
}
trap cleanup EXIT

cat >"${config_file}" <<'YAML'
server:
  listen: 0.0.0.0:8080
  mcp_path: /mcp
  resource: http://localhost:8080
auth:
  mode: bearer
  bearer:
    token_env: SECRETSAUCE_MCP_TOKEN
audit:
  file: /var/lib/secretsauce/audit/audit.jsonl
services:
  release-smoke:
    type: http
    name: Release Smoke
    destinations:
      - name: primary
        base_url: https://api.example.org
    no_auth: true
    access:
      users: [bearer-dev]
    policy:
      mode: deny
      rules: []
YAML
chmod 0444 "${config_file}"

docker build --platform linux/amd64 --tag "${image_name}" .
test "$(docker image inspect --format '{{.Config.User}}' "${image_name}")" = "node"
docker run --detach --name "${container_name}" \
  --platform linux/amd64 \
  --publish "127.0.0.1:${host_port}:8080" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --mount "type=bind,src=${config_file},dst=/config/config.yaml,readonly" \
  --mount "type=bind,src=${audit_directory},dst=/var/lib/secretsauce/audit" \
  --env "SECRETSAUCE_MCP_TOKEN=${smoke_token}" \
  "${image_name}" >/dev/null

wait_ready() {
  for _attempt in $(seq 1 40); do
    if curl --fail --silent --show-error \
      "http://127.0.0.1:${host_port}/health" >"${response_file}"; then
      node -e '
        const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
        if (body.status !== "ready" || body.service_count !== 1) process.exit(1);
        if (JSON.stringify(body).includes("/")) process.exit(1);
      ' "${response_file}"
      return
    fi
    sleep 1
  done
  docker logs "${container_name}" >&2
  return 1
}

post_mcp() {
  request_body="$1"
  : >"${header_file}"
  curl --fail --silent --show-error \
    --dump-header "${header_file}" \
    --header "Authorization: Bearer ${smoke_token}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json, text/event-stream" \
    --data "${request_body}" \
    "http://127.0.0.1:${host_port}/mcp" >"${response_file}"
  if grep -qi '^mcp-session-id:' "${header_file}"; then
    echo "Stateless MCP smoke received a session header." >&2
    return 1
  fi
}

verify_initialize() {
  post_mcp '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"release-smoke","version":"1"}}}'
  node -e '
    const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    if (body.result?.serverInfo?.name !== "secretsauce-mcp") process.exit(1);
  ' "${response_file}"
}

verify_tools() {
  post_mcp '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  node -e '
    const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(body.result?.tools) || body.result.tools.length < 1) process.exit(1);
  ' "${response_file}"
}

verify_tool_call() {
  post_mcp '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_services","arguments":{}}}'
  node -e '
    const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(body.result?.content) || body.result.content.length < 1) process.exit(1);
  ' "${response_file}"
}

wait_ready
verify_initialize
verify_tools
verify_tool_call
audit_size_before="$(docker exec "${container_name}" stat -c '%s' /var/lib/secretsauce/audit/audit.jsonl)"
test "${audit_size_before}" -gt 0
docker restart "${container_name}" >/dev/null
wait_ready
verify_initialize
verify_tools
verify_tool_call
audit_size_after="$(docker exec "${container_name}" stat -c '%s' /var/lib/secretsauce/audit/audit.jsonl)"
test "${audit_size_after}" -ge "${audit_size_before}"
echo "Container release smoke passed."
