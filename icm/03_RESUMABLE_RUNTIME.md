# Phase 03 — Resumable Execution Runtime

## Context

Large agent builds must survive context windows, model changes, environment restarts, and interrupted CI without restarting from an unverified plan.

## Inputs

- active build state;
- repository branch and Git remote;
- ZTE ordered execution stages;
- verification evidence;
- retry and loop-guard policy;
- registered repositories.

## Process

1. Start a bounded phase and assign or preserve a bead ID.
2. Enforce ordered stage transitions.
3. Require verification evidence before commit stage.
4. Record failures and activate loop guard on the third attempt.
5. Append every material transition to the event ledger with cryptographic IDs.
6. Compare local and exact remote branch SHAs for checkpoints.
7. Preserve the exact next action for future sessions.
8. Register only real Git repository roots.
9. Detect corrupt audit lines and create daily improvement reports.

## Outputs

- `src/runtime.mjs`;
- ordered phase state machine;
- append-only NDJSON event ledger;
- exact remote-SHA checkpoint;
- validated fleet registry;
- daily report and notification outbox;
- state and event schemas;
- integrity checks for event identity and corruption.

## Decisions

- filesystem state remains repository-owned and portable;
- the CLI is authoritative if the service is unavailable;
- invalid stage jumps fail closed;
- remote checkpoint success requires exact branch-ref SHA equality;
- corrupt audit events fail enterprise readiness;
- daily automation reports evidence but does not autonomously merge or deploy.

## QA Checklist

- [x] phase start and ordered advance implemented
- [x] invalid transition tested
- [x] verification-before-commit tested
- [x] blocked-state recovery tested
- [x] loop guard tested
- [x] append-only cryptographic event IDs implemented
- [x] audit corruption detection tested
- [x] exact remote SHA checkpoint tested
- [x] Git-root fleet validation tested
- [x] fleet persistence tested
- [x] daily report tested
- [x] GitHub CI matrix passes
- [x] Guardian review passes

<EOI>
phase: 03_resumable_runtime
status: COMPLETE
implemented:
  - ordered resumable phase state machine
  - retry and loop guard
  - append-only audited events
  - exact Git checkpoint verification
  - validated fleet registry
  - daily report and outbox
verified:
  - Node 20 and Node 22 enterprise tests PASS
  - checkpoint and corruption tests PASS
  - per-module coverage gate PASS
  - CI run 29515358737 PASS
  - CodeQL run 29515358534 PASS
  - Guardian review PASS
known_limits:
  - remote PR body update remains connector or GitHub CLI responsibility
  - distributed locking across hosts is deferred
next_phase: 04_prompt_intelligence
rollback: revert Phase 03 commits and restore prior state backup
</EOI>
