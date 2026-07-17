# Phase 02 — Policy Compiler and Enforcement

## Context

Static prompts are insufficient because agent environments expose different branch restrictions, hooks, instruction files, and tool capabilities.

## Inputs

- canonical ZTE prompt and prompt hashes;
- detected agent capabilities and constraints;
- protected branches and approval policy;
- existing Claude, Codex, and generic instruction files;
- issue #3 acceptance criteria.

## Process

1. Compile one policy model from configuration, capabilities, and prompt provenance.
2. Generate agent-specific controls.
3. Merge valid Claude settings while preserving existing keys.
4. Back up every changed user file.
5. Reject unrecognized conflicts unless explicit force is used.
6. Generate POSIX, PowerShell, and Node guards.
7. Enforce protected branches, likely-secret suppression, destructive approvals, protected policy files, and phase verification.
8. Preflight all conflicts before mutation.
9. Generate a reversible install manifest and drift-safe uninstall path.

## Outputs

- `src/policy.mjs` and `src/compiler.mjs`;
- Claude Code rules, Guardian subagent, settings hooks;
- Codex contract;
- generic execution contract and guards;
- compiled policy provenance;
- approval registry;
- transactional install manifest, backups, dry-run, and uninstall;
- generated-hook, compiler, policy, and security tests.

## Decisions

- generated controls derive from one policy hash;
- valid Claude settings are merged rather than replaced;
- user-authored files fail closed as conflicts;
- secret findings report location or category, never value;
- approvals expire and are scoped by type;
- Claude blocking hooks use official exit code `2` and project-root-safe exec arguments;
- uninstall refuses post-install drift unless force is explicit.

## QA Checklist

- [x] Claude, Codex, and generic compilation implemented
- [x] dry-run implemented
- [x] transactional conflict preflight implemented
- [x] deterministic recompile implemented
- [x] configured protected branches compiled and tested
- [x] user-file preservation tested
- [x] Claude settings merge and restore tested
- [x] generated Claude hooks black-box tested
- [x] protected branch and policy-file guards tested
- [x] secret suppression tested
- [x] irreversible approval tested
- [x] drift-safe reversible uninstall tested
- [x] GitHub CI matrix passes
- [x] Guardian review passes

<EOI>
phase: 02_policy_compiler
status: COMPLETE
implemented:
  - cross-agent transactional policy compiler
  - generated blocking hooks and guards
  - backup and drift-safe restore manifest
  - expiring approval registry
  - dry-run and reversible uninstall
verified:
  - Node 20 and Node 22 enterprise tests PASS
  - generated Claude hook black-box tests PASS
  - per-module coverage gate PASS
  - CI run 29515358737 PASS
  - CodeQL run 29515358534 PASS
  - Guardian review PASS
known_limits:
  - generated Claude hooks require a compatible installed Claude Code version
  - organization-wide inherited policy packs are deferred
next_phase: 03_resumable_runtime
rollback: run pauli-cloud uninstall or revert Phase 02 commits
</EOI>
