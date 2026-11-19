# UX10 deletion semantics — bounded architecture and security resolution

## Scope and metadata

Definition-only derivation for confirmed PO-FB-266/268/269 and PO-FB-279–281 in PO-FEEDBACK-2026-11-19-001. Reviewed source HEAD d29f412f4587f2338dbc03b99231d179fb5f33cd, 2026-11-19 UTC. Applied software-architect-review and security-code-reviewer orchestration contracts. This proposed basis is for reconciliation adoption; it does not itself amend canonical architecture/security or authorize implementation. No tests, destructive PoCs, code edits or commits.

## Executive summary

Both requested outcomes fit the existing one-writer encrypted state, explicit reviewed Apply, service-management roles and durable audit model. No consequential product choice remains. Draft removal must carry its intended value deletion forward to Apply, including when the credential existed only in a saved draft. Archived permanent deletion must remove the current object without allowing old references or confirmations to attach to a later same-named object. Historical retention and explicit backup restore remain distinct from live deletion.

## What is good

`ConsoleServices.actor`, `candidate`, `review`, `apply`, `credentialConfirmation` and `credential` already separate management authority, draft configuration, reviewed activation and immediate secret mutations. `ConsoleStore.commit` provides intent/state/outcome ordering; STATE-09 already defines generation-bound uncertain mutation recovery. STATE-10 preserves independent values on draft discard. `useConfigurationRevision` requires a current applied dependency and does not recover secrets. These are the appropriate boundaries to extend; a new vault, deletion job platform or broad access-model redesign is unnecessary.

## Proposed clauses for adoption

### D10-01 — Credential configuration removal is proposed until Apply

A confirmed Remove credential action changes only the service proposal. Its message explains that the saved value is deleted when these changes are applied **if nothing in the resulting current configuration still uses that key**. Save for later persists the proposal and its scoped removal intent; it does not delete or clear the value. Cancel changes nothing. Discard removes the applicable unsaved/saved removal intent together with that proposal and preserves independent immediate credential actions under STATE-09/10. This is an explicit narrow replacement of the prior unconditional promise that applying placement removal retains the value; SMTP remains unchanged.

Represent the identity of intentionally removed credentials durably in the proposal, or use an equivalent deterministic mechanism that survives save/reopen/review. It must cover removing a credential which appeared only in a saved draft, not just differences against applied configuration. Guided and Advanced removal of the same credential have the same semantics. Re-adding its reference before Apply cancels its eligibility for deletion. Never collect all currently unreferenced registry values as an incidental cleanup: unrelated orphan values, and values intentionally retained by a discarded proposal, are outside this action.

### D10-02 — Exact post-Apply dependency set and one coherent mutation

Review computes and displays the non-secret exact set of saved credential keys/values that the proposed Apply will delete. It binds that effect to the actor/session, service incarnation, candidate/draft generation, configuration revision, exact key identities and their current availability/mutation generations. It must not disclose secret contents or fingerprints of values. Revalidate the same dependencies and current permission at mutation; replacement, clear, restored state, key recreation or changed references since review requires a fresh review, rather than silently deleting a different value or changing the reviewed effect.

Evaluate references in the resulting durable state: the candidate replaces the former applied configuration and consumes its own saved draft/review; those superseded copies do not keep the key alive. Any genuinely remaining current durable reference retains the key/value, including Disabled/Archived service dependencies where relevant. Keys are service-scoped today; equal names in another service are separate identities. Unsaved browser input, sanitized history and existing backups are not live references. If a proposed credential reference remains but its value is missing, retain the existing incomplete-activation rejection; never switch to unauthenticated execution to permit deletion.

Within the same admitted encrypted state transaction, publish the reviewed configuration, remove only eligible intended keys and all owned current value copies (including normalized projections), consume the removal intent/review, and advance dependency generations. No intermediate state may activate the new configuration while reporting cleanup complete although the old secret remains, or delete a value before successful Apply. Current assignments/lifecycle follow the ordinary reviewed Apply contract; secret cleanup adds no grant or activation path. If all credentials were removed, existing explicit authentication-mode validity still governs; do not silently infer no-auth.

### D10-03 — Archived permanent deletion

Expose a distinct permanent Delete action only for a current Archived service to a current eligible Owner or Administrator. Apply existing sensitive-operation, same-origin/CSRF and durable audit checks to direct API calls as well as UI. A typed displayed confirmation is error prevention, not authentication: bind it server-side to the exact current service identity/incarnation, readable display label and mutation dependency state. Reject missing/wrong typed text, a target changed since confirmation, or a service no longer Archived. Do not add an unrequested role, approval chain or new reauthentication ceremony.

The confirmed operation removes the current service record, applied and draft configurations, reviews/removal intents, assignments and stored credential records/values, together with any current normalized runtime projection. Other services, identities, global configuration and their secrets remain unchanged. No unarchive is required. Cancel changes nothing. After confirmed success the service is absent from ordinary current reads and lists; already absent is a truthful unavailable/already-deleted outcome, never authority to delete a replacement sharing its name or ID.

Retain non-secret audit/history evidence and existing encrypted backups under their ordinary retention rules. This is current-instance deletion, not physical media sanitization or retroactive archive erasure. Explain that retained backups can still contain the earlier service and secrets. Ordinary history, stale browser state, automatic startup/retry and export/import matching must not silently recreate the deleted service or its authority. Explicit authorized whole-instance restore retains its separate established snapshot recovery contract: it may recover an earlier snapshot, with services Disabled and fresh review/identity gates; deletion is not a new prohibition on explicit disaster recovery.

### D10-04 — Incarnation, admission and uncertainty

Use monotonic dependency/incarnation identity that survives object deletion, or an equivalent durable fence; a recycled string ID, display name or reset local value version must never validate an old confirmation, queued job, access/credential reference, saved review, browser save, history operation or unresolved mutation intent against a new service/key. A non-secret bounded tombstone/generation floor is an implementation option, not a retained live service or credential record. History operations must distinguish a later same-ID service from the original historical incarnation. Fresh deliberate creation/import can proceed within established ID rules with fresh authority; it cannot inherit deleted grants/values or old history implicitly.

Deletion invalidates affected references and queued work before further credential substitution/dispatch. Preserve the existing live broker/scanner/limiter objects. Already-dispatched work cannot be undone remotely; it retains its admitted bounded response-protection context but cannot repopulate deleted state or mint usable revoked references on completion. Retain only the existing bounded admitted in-flight protection context, not a new durable secret copy.

Audit admission failure prevents mutation. Persist a secret-free, target/generation-bound intent and attributable outcome. After admitted persistence/completion uncertainty, report unknown and inspect/reconcile durable state rather than repeat the action. Fence affected execution and destructive retries until the outcome is established. For Apply cleanup, reconcile a coherent old or new transaction; do not replay a standalone credential deletion over an unchanged active configuration and claim Apply succeeded. For archived deletion, old readable state must not silently regain usable authority after an admitted unresolved deletion. Replay binds the original incarnation and cannot remove a later replacement or an explicitly restored newer incarnation. A conclusive rejected operation is distinct from unknown.

### D10-05 — Compatibility, recovery and acceptance

If new durable removal intents or deletion/incarnation fences are introduced, establish old-reader rejection before admitting semantics older binaries would ignore; preserve newer state formats. Keep required non-secret fencing metadata through restart and portable recovery at owned schema paths. Validators must reject contradictory current projections and missing/mixed dependency state. A post-success backup contains no deleted current value/service via another live projection; older retained backups remain unchanged. Whole-instance restore assigns fresh local generations so pre-restore pending deletes cannot replay over an explicitly recovered value/service. Preserve historical audit attribution without pretending restore performed a new successful deletion.

Required positive/negative acceptance: applied-key and saved-draft-only removal; repeated saves/reopen; remove/re-add; Guided/Advanced parity; cancel and both discard scopes; unrelated orphan retention; remaining-reference retention; missing value/no-auth rejection; concurrent replacement/reference change; demoted/restricted/Member/Auditor direct calls; CSRF and malformed input; exact typed archived confirmation; Active/Inactive deletion rejection; stale/deleted/recreated target; other service/value preservation; old review/reference/queued completion fencing; pre/post state-write and audit-outcome faults; restart and bounded old-reader rejection; backup validation and explicit restore with newer generations. Real browser evidence must verify the scoped consequence messages and confirm/cancel states; this definition assessment is not implementation acceptance.

## What is risky and should change

The current `apply` changes configuration without a deletion plan, so an applied-diff-only cleanup would miss saved-draft-only removals and a registry sweep would destroy unrelated values. The current service lifecycle API archives but has no permanent deletion transaction. Existing credential replay matches a service/key-derived identity plus generation; introducing deletion requires checking this boundary across reuse, not assuming name equality is incarnation equality. These are defined change requirements, not demonstrated vulnerabilities in the presently implemented feature set; no CVSS exploit claim is made.

## Security assessment and limits

Threat boundaries: authenticated console/API caller versus service-management authority; stale browser/queued state versus current encrypted state; runtime credential admission versus configuration publication; retained recovery evidence versus live authority. Current Owner/Administrator control and server-side audit/authorization are positive controls. The proposed safeguards address unauthorized deletion, stale-target deletion, silent grant resurrection and partial/uncertain secret cleanup. No new security vulnerability or exploit chain was asserted by this source-only bounded review. No runtime tests or external research were needed for this repository-specific state derivation.

## What not to change yet / overall opinion

Keep the existing persistence, audit, credential registry, role and restore models. Do not add bulk purge, asynchronous deletion orchestration, a separate vault, archive destruction, remote revocation promises or data-retention exceptions. Adopt D10-01–05 into the directly affected PRD/architecture/security/UX clauses, then selectively validate those artifacts. No owner decision is outstanding.

## Producer adoption

REC-RUN-015 adopts D10-01–05 under confirmed PO-FB-269/281 (owner clarification: “yes to both”). Source proposal SHA-256: 3958a643d25901a55cad1367473c7a18b748aa7537de68dba6f8eef97fc3b9f4. This immutable producer copy preserves the resolved derivation; canonical PRD clauses below establish product authority. No runtime acceptance is claimed.
