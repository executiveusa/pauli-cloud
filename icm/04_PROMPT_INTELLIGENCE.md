# Phase 04 — Prompt Intelligence

## Context

Prompts are durable intellectual property. Chat-only changes disappear, model-specific instructions pollute canonical policy, and unmeasured edits can silently reduce performance.

## Inputs

- canonical ZTE prompt;
- model-specific adapters;
- semantic prompt IDs and versions;
- evaluation score and baseline;
- run outcome and notes.

## Process

1. Register a new immutable prompt version.
2. Store canonical, adapter, and experiment files separately.
3. Reject prompt or run content containing likely credentials.
4. Compute and register SHA-256.
5. Verify all registered files and unique identities before execution and release.
6. Record model, bounded score, baseline, pass/fail, and notes for each run.
7. Reject experiment promotion without a passing measured run.
8. Require promoted semantic version to be newer than current canonical.
9. Copy verified promoted content into immutable canonical storage.
10. Write a durable learning record with score provenance.

## Outputs

- `src/prompts.mjs`;
- immutable prompt registry;
- prompt runs and evaluation records;
- evidence-gated canonical promotion;
- learnings directory;
- prompt integrity, secret, score, and promotion tests.

## Decisions

- canonical files are never overwritten;
- model-specific behavior belongs in adapters;
- promotion requires score greater than or equal to baseline;
- prompt and run records reject likely secret values;
- promoted content is physically copied to canonical storage;
- future evaluation suites may add task-specific metrics without changing registry ownership.

## QA Checklist

- [x] semantic version validation implemented
- [x] duplicate version and identity rejection implemented
- [x] SHA-256 verification implemented
- [x] prompt and run secret rejection implemented
- [x] bounded measured run recording implemented
- [x] unmeasured promotion rejection tested
- [x] canonical copy and successful promotion tested
- [x] learning record with score provenance implemented
- [x] GitHub CI matrix passes
- [x] Guardian review passes

<EOI>
phase: 04_prompt_intelligence
status: COMPLETE
implemented:
  - immutable prompt versions
  - secret-safe run and evaluation records
  - measured canonical promotion gate
  - durable score-backed learnings
verified:
  - Node 20 and Node 22 enterprise tests PASS
  - prompt tamper, secret, score, and promotion tests PASS
  - per-module coverage gate PASS
  - CI run 29515358737 PASS
  - CodeQL run 29515358534 PASS
  - Guardian review PASS
known_limits:
  - evaluation execution is external; Pauli Cloud records and enforces results
  - cryptographic signing beyond SHA-256 is deferred
next_phase: 05_fleet_and_hardening
rollback: revert Phase 04 commits; existing canonical versions remain intact
</EOI>
