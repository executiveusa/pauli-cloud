# Context

Agents have different session restrictions, tools, Git permissions, package managers, browser capabilities, and deployment access. Static prompts cannot safely assume those capabilities.

# Target state

Pauli Cloud inspects the active repository and agent environment, classifies constraints, adopts an assigned branch, writes machine-readable capability/state files, and generates a runtime adapter before mutation.

# Inputs

- repository path
- optional `--agent` identifier
- optional `--assigned-branch` session constraint
- Git state and remotes
- package manifests and lockfiles
- instruction files
- CI, browser, Docker, and deployment configuration
- available executable tools

# Process

1. Initialize `.pauli-cloud/` when absent.
2. Inspect Git, tools, package scripts, instruction files, CI, browser, and deployment capabilities.
3. Classify findings as `HARD`, `POLICY`, or `MISSING`.
4. Adopt the assigned branch when it matches the active session.
5. Stop mutation on a branch conflict or protected branch.
6. Scope missing optional tools only to dependent stages.
7. Write capabilities, constraints, runtime adapter, and resumable state.

# Outputs

- `.pauli-cloud/capabilities.json`
- `.pauli-cloud/constraints.json`
- `.pauli-cloud/adapters/{agent}.runtime.md`
- updated `.pauli-cloud/state/ACTIVE_BUILD_STATE.json`

# QA Checklist

- [x] `inspect` command implemented
- [x] assigned branch adoption tested
- [x] assigned branch conflict tested
- [x] mixed package-manager policy tested
- [x] browser capability absence scoped correctly
- [x] existing init and prompt-tamper tests remain green
- [ ] GitHub Actions CI passes
- [ ] PR phase ledger updated

<EOI>
phase: 01_capability_negotiation
status: VALIDATING
implemented:
  - repository and Git inspection
  - tool and package-manager detection
  - instruction-file discovery
  - browser, CI, Docker, and deployment detection
  - hard/policy/missing constraint classification
  - assigned-branch adoption
  - runtime adapter generation
  - resumable state update
verified:
  - npm test: 6/6 passing locally
  - npm run verify: PASS locally
known_limits:
  - GitHub authentication is detected through CLI availability, not connector discovery
  - enforcement hooks and policy compilation remain Phase 2
next_phase: policy_compiler_and_enforcement
rollback: revert Phase 1 commits; Phase 0 remains functional
</EOI>
