# Context

Pauli Cloud is a new independent repository. The bootstrap phase creates a portable CLI and governance overlay for any coding agent.

# Inputs

- ZTE-PERSONA-v3.0 constitution
- ICM sequential stage method
- branch-safe resumable-loop correction
- prompt preservation requirements
- PR-first GitHub workflow
- provider/model neutrality

# Process

1. Define product boundary.
2. Implement zero-dependency CLI.
3. Add generated overlay contracts.
4. Add tests and CI.
5. Verify prompt hashes and ICM files.
6. Publish through a draft pull request.

# Outputs

- working CLI
- canonical prompt registry
- agent adapters
- product specification
- tests
- CI
- bootstrap PR

# Decisions

- Pauli Cloud is an independent overlay, not a fork of one agent platform.
- Node 20 and zero runtime dependencies minimize installation friction.
- Session branch restrictions are adopted through adapters.
- Secret storage is out of scope; only credential references are allowed.

# QA Checklist

- [x] CLI initializes a project
- [x] initialization is idempotent
- [x] doctor validates ICM and prompt integrity
- [x] tampering is detected
- [x] verification emits evidence
- [x] CI is defined
- [ ] GitHub draft PR opened

<EOI>
phase: 00_bootstrap
status: VALIDATING
target_state: Portable Pauli Cloud bootstrap kernel
implemented:
  - zero-dependency Node 20 CLI
  - init, doctor, verify, and status commands
  - canonical prompt registry and SHA-256 verification
  - ICM bootstrap workspace
  - Claude Code, Codex, and generic adapters
  - tests and GitHub CI
verified:
  - npm test: 2/2 passing locally
  - npm run verify: PASS locally
known_limits:
  - executable policy compiler not yet implemented
  - GitHub checkpoint verifier not yet implemented
next_phase: capability_and_constraint_negotiation
rollback: revert bootstrap branch
</EOI>
