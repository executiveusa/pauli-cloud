# Context

PR #4 was merged while three P1 review findings remained unresolved. Version 1.0.0 must not be published or deployed.

# Inputs

- merged main commit `8fb1af7`;
- issue #6 acceptance criteria;
- unresolved review threads for uninstall atomicity, phase-bound evidence, and approval scope.

# Process

1. Preserve merged modules as immutable legacy files.
2. Replace public module paths with narrow safety wrappers.
3. Add shared phase-evidence binding.
4. Add black-box regression tests.
5. Run all enterprise gates.
6. Complete Guardian review and merge only after passing evidence.

# Status

VALIDATING

<EOI>
phase: 06_p1_enterprise_hotfix
bead_id: ZTE-20260716-0003
status: VALIDATING
implemented:
  - transactional uninstall preflight and rollback journal
  - phase-bound enterprise verification evidence
  - generated-hook approval-scope enforcement
  - black-box regression tests
verification_pending:
  - Node 20 and 22 CI
  - per-module coverage
  - secret scan
  - enterprise doctor and package smoke
  - container smoke
  - CodeQL and dependency review
  - Guardian review
production: BLOCKED
rollback: revert hotfix commit
</EOI>
