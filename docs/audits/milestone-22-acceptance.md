# Milestone 22 acceptance review

## Outcome

Milestone 22 is accepted. SecretSauce now performs bounded,
interactive-superadmin-only portable restore through validation, exact preview,
exclusive maintenance, encrypted recovery, vault-first replacement, one atomic
database replacement, post-commit health verification, and deterministic
rollback.

## Evidence

- Migration 0022 and strict repositories persist actor-bound one-hour stages and
  previews, plan/checksum/secret-disposition binding, one-use claims, durable
  remediation work, and a singleton restore phase without archive bodies,
  passphrases, ciphertext, vault locators, keys, or local paths.
- Restore decoding reuses the strict bounded ustar boundary and independently
  verifies exact entries, modes, manifest metadata, hashes, byte/object/scalar/
  depth limits, core-schema YAML, canonical portable objects, UUID uniqueness,
  and every service/destination/credential/policy/rule cross-reference.
- Private staging requires an owned canonical mode-`0700` directory, mode-`0600`
  regular files, bounded bytes/counts, exclusive publication, actor isolation,
  expiry, and database-referenced cleanup without following links.
- Vault capabilities authenticate validation, exact encrypted or empty restore
  replacement, and full recovery export/import. Each capability binds its exact
  actor, operation, archive hash, plan digest, selection, expiry, and one-use
  authorization without returning plaintext.
- Preview protects the retained-active-superadmin invariant, treats missing or
  wrong passphrases as an explicit configuration-only plan, and separately
  reports replacements, removals, preserved domains, cleared bindings, revoked
  authority, unavailable values, and fixed remediation work.
- The shared maintenance gate rejects new ordinary control/data-plane work,
  drains in-flight work before mutation, exempts only restore coordination, and
  releases maintenance only after success or completed rollback.
- Recovery encrypts SQLite and full-vault snapshots with a fresh memory-only DEK
  wrapped by a distinct stable key, bounds space/input/retention, authenticates
  its fsynced journal, removes plaintext temporary state, and resumes or fails
  closed before listeners on restart.
- Exact replacement preserves target identities, authenticators, linked
  providers, settings, and existing audit; replaces only portable domains;
  removes groups/bindings; disables/unassigns rules; makes services drafts;
  revokes API keys, sessions, OAuth grants/tokens, and references; advances
  generations; and creates durable remediation tasks in one transaction.
- Commit recomputes the plan before consuming the preview and operation-bound
  step-up proof, replaces the vault first, commits SQLite atomically, runs the
  database/schema/vault/identity/audit health gate, and restores both stores for
  injected failures.
- Strict no-store routes accept only browser sessions with restore permission,
  exclude every API-key role, enforce CSRF and step-up, bind an exact destructive
  phrase and justification, clear passphrase buffers, return stable safe errors,
  and describe the bounded binary intake and result in OpenAPI.
- The responsive five-step workspace supports secure upload and actor-bound
  resume, renders only server-derived preview/result state, preserves safe retry
  context, clears every secret input after all outcomes, requires the exact
  phrase, and signs the browser out after success.
- Operator guidance documents stable private mounts, complete dependency sets,
  archive custody, crash response, fail-closed recovery, and post-restore
  assignment/credential/policy/publication remediation.

## Verification

- Focused state, archive, staging, vault, preview, maintenance, recovery,
  replacement, commit, route, browser-client, workspace, and documentation
  acceptance: passed.
- Real broker-process encrypted validation/replacement/recovery, exact
  before/after database assertions, injected rollback phases, actor/expiry/
  mismatch isolation, and positive/negative boundary fixtures: passed.
- Production TypeScript and Vite build: passed.
- Control OpenAPI currency check: passed.
- Full regression with loopback/private-socket permission: 127 files and 890
  tests passed.

## Delivery commits

- `7df5b58` — decision-complete milestone plan
- `7b9ac08` — durable restore state and claims
- `9f0edf3` — strict portable restore archive validation
- `c219777` — private bounded archive staging
- `a326078` — exact vault restore and recovery operations
- `e1b71cb` — exact server-derived restore preview
- `e4671c9` — exclusive restore maintenance gate
- `e966fd1` — encrypted restore recovery and startup resumption
- `752dc28` — atomic portable-domain replacement and remediation
- `84cbe97` — exact commit coordination, health gate, and rollback
- `7c39cb9` — resumable high-friction restore workspace

## Residual boundaries

- Restore replaces the complete portable configuration set; selective merge and
  V1 YAML migration are intentionally outside this milestone.
- Target identities and settings survive, but groups, every access binding,
  active authorization artifact, publication, and runtime reference are
  deliberately removed or revoked.
- Missing or wrong archive passphrases intentionally restore definitions without
  values. They do not provide password recovery or partial secret import.
- Restored services are deliberately unavailable until administrators complete
  access, credential, policy, validation, and publication remediation.
- The stable recovery directory, recovery key, database, vault store, and
  backup-only vault keys are an operator-managed availability boundary. Loss or
  rotation during an interrupted commit cannot be repaired by bypassing journal
  authentication.
- The supported deployment remains exactly one database-owning gateway process;
  restore maintenance and recovery state are not a multi-replica coordinator.
