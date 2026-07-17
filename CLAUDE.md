# Claude Code Project Instructions

Pauli Cloud is a portable, model-agnostic governance control plane—not an application-specific product.

## Session compatibility

- Stay on the branch assigned to the Claude Code session.
- Never generate a conflicting branch command.
- Treat large scope as resumable, independently verified phases.
- Do not stop after planning while safe implementation remains.
- Use `.pauli-cloud/state/ACTIVE_BUILD_STATE.json` as the resume contract.

## Execution

1. Read `AGENTS.md`, `docs/MASTER_SPEC.md`, and `SECURITY.md`.
2. Run `pauli-cloud inspect` before mutation.
3. Follow the ordered phase state machine.
4. Use the compiled Pauli Cloud rules, Guardian agent, and hooks when present.
5. Run `npm run check` before a verified checkpoint.
6. Update ICM evidence and Git checkpoint state after every complete phase.

## Hard boundaries

- Canonical prompts are immutable; create a new semantic version.
- Never overwrite an unrecognized user-authored instruction file.
- Never expose secret values.
- Never claim a push, PR, browser test, container, release, or deployment without evidence.
- Production, irreversible, financial, destructive, and consequential actions require explicit approval.
- Production release also requires the protected GitHub `production` environment.
