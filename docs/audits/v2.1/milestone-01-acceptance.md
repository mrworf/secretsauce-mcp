# Milestone 01 Acceptance: Private Vault REST Boundary

Date: 2026-07-27  
Implementation commit: `7f53670`

## Result

Accepted. Every first-party vault operation now crosses the versioned private
HTTP/1.1 resource boundary over protected Unix-domain sockets. Provisioning
status and credential traffic have distinct socket lifecycles. Credential
requests and responses are mutually authenticated, request-correlated,
replay-resistant, and bound to the current vault boot before result parsing or
domain/store access.

## Acceptance mapping

- `VAULTAPI-001`–`VAULTAPI-003`: `src/vault/broker.ts`,
  `src/vault/client.ts`, `src/vault/httpProtocol.ts`, and
  `docs/openapi/vault-v1.yaml` implement the closed resource contract, exact
  representation authentication, nonce/timestamp checks, and authenticated
  responses.
- `VAULTAPI-004`–`VAULTAPI-006`: `src/vault/domain.ts`,
  `src/vault/protocol.ts`, and `src/vault/capabilities.ts` preserve the fixed
  caller matrix, one-use capabilities, and transport-neutral domain boundary.
  Capabilities now include the boot identifier.
- `VAULTAPI-007`–`VAULTAPI-008`, `SETUP-022`, and `SETUP-025`:
  `src/vault/config.ts`, `src/vault/socketEndpoint.ts`,
  `src/vault/healthCli.ts`, `examples/vault.yaml`, and
  `docker-compose.example.yaml` use separate status and credential sockets,
  validate endpoint identity and parent metadata, retain read-only client
  mounts, and expose no vault TCP/HTTPS listener.
- Acceptance 21.7: `test/vault-http-protocol.test.ts`,
  `test/vault-domain.test.ts`, `test/vault-broker.test.ts`,
  `test/vault-socket-endpoint.test.ts`,
  `test/vault-process-integration.test.ts`,
  `test/v1-migration-process-integration.test.ts`, and
  `test/vault-deployment.test.ts` cover canonical authentication, caller
  denial, separate status access, endpoint replacement/mode/symlink failures,
  process restart, changed boot identity, rejection of prior-boot capability,
  persistence continuity, and no-network deployment.

## Validation evidence

- Focused domain/capability/protocol: 12/12 passed.
- Focused endpoint/broker/process/deployment/config/credential: 32/32 passed.
- `npm run build`: passed.
- `npm run check:control-openapi`: current.
- `node scripts/validate-v2.1-readiness.mjs`: validated 14 artifacts.
- `npm run scan:release-artifacts`: passed for 599 closed-scope files.
- Permission-correct `npm test`: passed.
- `git diff --check`: passed.

The release scan initially encountered sandbox `spawnSync git EPERM`; the
unchanged command passed with the required Git execution permission.

## Deferred ownership

- Milestone 02 owns preparing/error/retry provisioning state and suppression of
  the credential listener until configured commit.
- Milestone 03 owns public setup projection and application Compose gating.
- Milestone 04 owns host-authorized root-maintenance operations.
- Independent release assurance remains Milestone 10 evidence.
