# M23 slice 01 — Complete People account journey

Status: completed; plans were persisted and self-checked before production edits.

## Goal
Authorized users open one compact account row into a full detail page; eligible administrators safely update contact/role and inspect durable truthful dates.

## Scope / dependencies
Full M23 outcome; consumes M22 shared shell/form decoration and M18 durable reset fencing. Excludes M24 SMTP/settings and new lifecycle permissions. Existing external registry remains separate.

## Entry points and behavior
People list with named links, filter and return context; full detail with account form, recovery actions, read-only dates/identity, separate Owner lifecycle controls. Account changes use explicit review and recent password/TOTP, verified trusted-channel category for contact, stale target revision rejection and immediate sign-out/grant/proof revocation. Self-contact returns normal login. Notices report independently after commit.

## State and security
Add optional server-owned creation, last-console-sign-in and restored-history metadata. Missing legacy values remain Unknown; tracked empty sign-in is Never. Full password+TOTP or recovery code admission updates metadata atomically; other events do not. Archives carry only metadata, never authority. Preserve password/factor/lifecycle on account edit. Advance generation and remove target/issuer proofs and sessions. Persist audit revocation intents before state writes and replay generation fencing across restart without inventing successful edits. New durable format must reject old binaries safely. Owner continuity rechecked with current state. No metadata is accepted from mutations.

## Validation and errors
Strict input schema, contact format/uniqueness, actor and target role matrix, current revision/recent authentication, immutable-field rejection. Audit/storage uncertainty does not claim success; forbidden/stale updates leave prior safe fields intact. Existing recovery exclusions and installation rollback preserved.

## Surfaces
src/consolePeople.ts, consolePeoplePage.ts, consoleStore.ts, consoleHttp.ts, consolePage.ts, consolePresentation.ts, consoleJournal.ts, consoleBackupArchive.ts, consoleRestore.ts; focused existing/new tests; scripts/verify-console-people-details-browser.mjs; operator documentation and evidence.

## Positive and negative tests
Allowed and denied role/contact combinations on endpoint and browser; self-contact sign-out; final Owner races; stale actor/revision/auth; invalid, duplicate, unverified and immutable input; proof/session/grant/reference revocation and uncertain writes across restart; notification failure separate. Creation and exact included/excluded login events, recovery-code reuse rejection, monotonic timestamps, legacy Unknown, encrypted archive/restore/rollback historical metadata. Keyboard link/row/filter return, permissions, actual/reference screenshot comparisons, narrow/200% text reflow.

## Commands and acceptance
Focused Vitest test files while iterating; adapted actual HTTPS browser scripts sequentially; `npm test` and `npm run build` once final. Each milestone criterion must have exact evidence. Commit only after required validation passes, including this plan and governing plan. One commit: `delivery: M23 account details and bounded administration`. Root records final SHA/status without squashing.

## Delivered and verified
The governing milestone outcome is complete. See QA acceptance/validation and UX comparison artifacts for all six criterion mappings, exact source hashes and commands. One coherent commit includes production, tests, plans, docs and evidence. Root records the resulting SHA without squashing. Format 3 and legacy role endpoint migration are documented; no remaining M23 blocker.

Implementation commit: `7f9b64c733d5fa22b28a1d5e0e0e913596b5860f`. Root accepted all six criteria and verified recorded source/report hashes.
