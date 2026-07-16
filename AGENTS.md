# Agent Instructions

Before mutation:

1. Read `README.md`, `docs/MASTER_SPEC.md`, and `.pauli-cloud/` when present.
2. Adopt the branch assigned by the current session or worktree. Never fight a higher-priority branch restriction.
3. Load the resumable state and continue the next exact action.
4. Preserve unrelated work and never push directly to protected branches.
5. Run `npm run check` before claiming completion.
6. Do not expose secrets or perform irreversible actions without explicit approval.

Execution loop:

`CONTEXT → SPECIFY → IMPLEMENT → TEST → ATTACK → FIX → VERIFY → ICM → LEARN → COMMIT → PUSH`
