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
5. Append every material transition to the event ledger.
6. Compare local and remote Git SHAs for checkpoints.
7. Preserve the exact next action for future sessions.
8. Register fleet repositories and create daily improvement reports.

## Outputs

- `src/runtime.mjs`;
- ordered phase state machine;
- append-only NDJSON event ledger;
- remote-SHA checkpoint;
- fleet registry;
- daily report and notification outbox;
- state and event schemas.

## Decisions

- filesystem state remains repository-owned and portable;
- the CLI is authoritative if the service is unavailable;
- invalid stage jumps fail closed;
- remote checkpoint success requires exact SHA equality;
- daily automation reports evidence but does not autonomously merge or deploy.

## QA Checklist

- [x] phase start and ordered advance implemented
- [x] invalid transition tested
- [x] verification-before-commit tested
- [x] loop guard tested
- [x] append-only events implemented
- [x] remote SHA checkpoint implemented
- [x] fleet persistence tested
- [x] daily report tested
- [ ] GitHub CI matrix passes
- [ ] Guardian review passes

<EOI>
phase: 03_resumable_runtime
status: VALIDATING
implemented:
  - ordered phase state machine
  - retry and loop guard
  - append-only events
  - Git checkpoint verification
  - fleet registry
  - daily report and outbox
verified:
  - local enterprise tests PASS
known_limits:
  - remote PR body update remains connector or GitHub CLI responsibility
  - distributed locking across hosts is deferred
next_phase: 04_prompt_intelligence
rollback: revert Phase 03 commits and restore prior state backup
</EOI>
