# Context

PR #4 was merged while three P1 review findings remained unresolved. Version 1.0.0 must not be published or deployed.

# Inputs

- merged main commit `8fb1af7`;
- issue #6 acceptance criteria;
- unresolved review findings for uninstall atomicity, phase-bound evidence, and approval scope.

# Process

1. Preserve merged modules as immutable legacy files.
2. Replace public module paths with narrow safety wrappers.
3. Add shared phase-evidence binding.
4. Add black-box regression tests.
5. Run all enterprise gates.
6. Complete Guardian review and merge only after passing evidence.

# Outputs

- transactional uninstall preflight and rollback journal;
- repository-root path confinement for managed and backup paths;
- phase-bound project and enterprise verification evidence;
- strict COMMIT and phase-commit evidence gates;
- exact/project approval-scope enforcement in generated hooks;
- compatibility wrappers and preserved legacy modules;
- Pauli Cloud version 1.0.1;
- focused regression tests and Guardian report.

# Status

COMPLETE

<EOI>
phase: 06_p1_enterprise_hotfix
bead_id: ZTE-20260716-0003
status: COMPLETE
implemented:
  - transactional uninstall preflight and rollback journal
  - phase-bound project and enterprise verification evidence
  - generated-hook approval-scope enforcement
  - compatibility and idempotence preservation
  - black-box regression tests
verified:
  - CI 29546991682: SUCCESS
  - Node 20: PASS
  - Node 22: PASS
  - per-module coverage >=80%: PASS
  - secret scan: PASS
  - enterprise self-verification: PASS
  - package and CLI smoke: PASS
  - hardened container smoke: PASS
  - CodeQL 29546991693: SUCCESS
  - Dependency Review 29546991689: SUCCESS
  - Guardian: PASS
pull_request: https://github.com/executiveusa/pauli-cloud/pull/15
production: BLOCKED_BY_ISSUE_5_AND_EXPLICIT_APPROVAL
rollback: revert the hotfix merge commit; preserved legacy modules remain available for forensic comparison
</EOI>
