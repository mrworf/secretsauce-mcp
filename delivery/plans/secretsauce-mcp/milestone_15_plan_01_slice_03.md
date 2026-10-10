# M15 corrective slice: admitted name-worker context

## Goal and scope
Preserve the sensitive-name worker bounds captured when a gateway request is admitted, while new requests use applied bounds. Root post-commit review found the live mutable bounds survived ResponseTokenizer.withBroker; a delayed response could silently receive reduced name coverage. Keep catalogue, scanner pool, broker fencing and shared global occupied-worker count. No later milestone behavior.

## Dependency and state
Depends on committed slices01/02. Before production edits this plan is persisted and reviewed. Snapshot immutable bounds at tokenizer admission; existing matcher/catalogue arrays can be shared, and global worker count remains shared. No persisted state/schema or new external input. Limits apply still updates only future admitted contexts.

## Authorization and failures
Existing gateway auth/destination/policy/admission and immutable broker generations remain authoritative. Worker allocation uses current live global capacity and shared occupancy; evaluation uses captured coverage/heap/deadline; timeout/termination release semantics remain. Do not log response bodies/secrets. No bypass or unbounded work.

## Validation and commit
Add real loopback delayed-response positive regression: admit request with ordinary sensitive-name coverage, lower name length while downstream pending, release response, verify secret value is replaced. A subsequently admitted request obeys lowered coverage. Related response/scanner/protection/limits tests and build pass; final slice04 suite/browser/Docker remains required. Commit only corrective code/test/plan/evidence, preserving existing02commit. This third commit is justified by independent security review of an admission-context defect.

## Execution record
PASS43tests4files with pretestbuild: actual delayed downstream protects admitted value afterlowering coverage; newrequest obeyslowered bound; snapshot still enforces current maxInflight sharedoccupiedcounter. Matcherconfig/compiledregex/pool reused. Fixturecorrected tobindsame liveconfig asproduction and use newlydifferent responsevalue (existing learnedvalues independentlyprotected).
