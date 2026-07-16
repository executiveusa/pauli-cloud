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
7. Enforce protected branches, likely-secret suppression, destructive approvals, and phase verification.
8. Generate a reversible install manifest and uninstall path.

## Outputs

- `src/policy.mjs`;
- Claude Code rules, Guardian subagent, settings hooks;
- Codex contract;
- generic execution contract and guards;
- compiled policy provenance;
- approval registry;
- install manifest, backups, dry-run, and uninstall;
- policy and security tests.

## Decisions

- generated controls derive from one policy hash;
- valid Claude settings are merged rather than replaced;
- user-authored files fail closed as conflicts;
- secret findings report location or category, never value;
- approvals expire and are scoped by type.

## QA Checklist

- [x] Claude, Codex, and generic compilation implemented
- [x] dry-run implemented
- [x] deterministic recompile implemented
- [x] user-file preservation tested
- [x] Claude settings merge and restore tested
- [x] protected branch guard tested
- [x] secret suppression tested
- [x] irreversible approval tested
- [x] reversible uninstall tested
- [ ] GitHub CI matrix passes
- [ ] Guardian review passes

<EOI>
phase: 02_policy_compiler
status: VALIDATING
implemented:
  - cross-agent policy compiler
  - generated hooks and guards
  - backup and restore manifest
  - approval registry
  - dry-run and uninstall
verified:
  - local enterprise tests PASS
known_limits:
  - generated Claude hooks require a compatible installed Claude Code version
  - organization-wide inherited policy packs are deferred
next_phase: 03_resumable_runtime
rollback: run pauli-cloud uninstall or revert Phase 02 commits
</EOI>
