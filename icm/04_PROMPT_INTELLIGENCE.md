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
3. Compute and register SHA-256.
4. Verify all registered files before execution and release.
5. Record model, score, baseline, pass/fail, and notes for each run.
6. Reject experiment promotion without a passing measured run.
7. Require promoted semantic version to be newer than current canonical.
8. Write a durable learning record on promotion.

## Outputs

- `src/prompts.mjs`;
- immutable prompt registry;
- prompt runs and evaluation records;
- evidence-gated promotion;
- learnings directory;
- prompt integrity tests.

## Decisions

- canonical files are never overwritten;
- model-specific behavior belongs in adapters;
- promotion requires score greater than or equal to baseline;
- prompt run records exclude raw secrets and sensitive logs;
- future evaluation suites may add task-specific metrics without changing registry ownership.

## QA Checklist

- [x] semantic version validation implemented
- [x] duplicate version rejection implemented
- [x] SHA-256 verification implemented
- [x] measured run recording implemented
- [x] unmeasured promotion rejection tested
- [x] successful promotion tested
- [x] learning record implemented
- [ ] GitHub CI matrix passes
- [ ] Guardian review passes

<EOI>
phase: 04_prompt_intelligence
status: VALIDATING
implemented:
  - immutable prompt versions
  - run and evaluation records
  - measured promotion gate
  - durable learnings
verified:
  - local enterprise tests PASS
known_limits:
  - evaluation execution is external; Pauli Cloud records and enforces results
  - cryptographic signing beyond SHA-256 is deferred
next_phase: 05_fleet_and_hardening
rollback: revert Phase 04 commits; existing canonical versions remain intact
</EOI>
