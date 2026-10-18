# Service credential clearing: bounded architecture resolution

## Scope

REC-DEC-008, confirmed feedback PO-FB-060 and PO-FB-065–067. This resolves architecture semantics for the requested service credential action and last-change attribution. It is not the final architecture-stage review. No production code, SMTP behavior or running deployment changed.

## Executive Summary

The intended behavior is supportable within the existing single-owner state model. STATE-09 now separates credential identity from optional value, defines current and saved-draft dependencies, guards dispatch when an applied value is missing, and preserves durable attribution. No Product Owner mechanism choice remains. Cross-artifact adoption and independent security review remain required.

## What Is Good

`src/consoleServices.ts` already separates placement drafts from immediate value operations and invalidates runtime references after mutations. `src/consoleStore.ts:187` provides audit-admitted durable transitions and uncertain outcomes. These boundaries support the change without introducing a second secret store or distributed coordination.

## What Is Bad Or Risky

`src/consoleServices.ts:139` currently rejects every referenced deletion, while its value records assume a value is always present and lack actor attribution. `detail` reports every stored record available. Normalized runtime configuration also contains secret copies. Removing only the primary value field would leave unsafe execution or leaked backup material.

`src/consoleBackupSchema.ts:20` assumes every managed credential has a string value, and its runtime consistency check normalizes all active dependencies. Missing-value state must be represented coherently through runtime publication and archive validation; merely relaxing a parser is insufficient. Retaining lifecycle and readiness separately avoids silently turning Clear into Disable.

## What Should Change

Adopt STATE-09 into CONFIG-02/03, BACKUP consistency/recovery and corresponding UX/read models. Replace the PRD statement that all referenced credential deletion is blocked with the clear-value/retain-key distinction. Do not generalize this amendment to SMTP. Clarify the existing CONFIG-03 paragraph that currently conflates SMTP draft/review replacement with immediate service value replacement.

Confirmation must identify clear versus key deletion and bind the exact dependencies/version shown. Both applied and durable proposed references retain a key; history does not. Applied missing values gate execution; draft-only missing values gate activation. A later explicit Set does not apply drafts, enable disabled services or revive references. Preserve old response protection for already-dispatched work.

Persist last successful actor and missing-value/generation state, with Unknown for legacy attribution and source-qualified historical metadata after restore. Fault-injection evidence must cover pre/post state replacement and restart, not only live-process invalidation. The acceptance scenarios in STATE-09 define the required outcome evidence without prescribing storage implementation.

## What I Would Not Change Yet

Do not add distributed invalidation, per-secret archives, retroactive exported-backup erasure, historical audit scans, a new vault, automatic lifecycle transitions or new SMTP semantics. Existing atomic state, bounded worker recovery and explicit whole-instance restore are sufficient.

## Overall Opinion

Architecture semantics are resolved under established intent. The adapter reports RECONCILIATION_REQUIRED solely for PRD/UX/security adoption, with no additional product question. A later scoped architecture review must validate the adopted definition and approved UX; this bounded result is not that pass. Documentation-only checks parsed the adapter and verified artifact hashes; executable tests are deferred to implementation.
