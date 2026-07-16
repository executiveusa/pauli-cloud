# Pauli Cloud Agent Contract

## Before mutation

1. Read `README.md`, `docs/MASTER_SPEC.md`, `SECURITY.md`, and applicable scoped instructions.
2. Load `.pauli-cloud/state/ACTIVE_BUILD_STATE.json` when present.
3. Run `pauli-cloud inspect` and adopt the session-assigned branch or worktree.
4. Never push directly to `main`, `master`, or `develop`.
5. Search for reusable code before creating a module.
6. Preserve unrelated work and user-authored instruction files.
7. Never print secret values or perform irreversible, financial, consequential, or production actions without an active approval.

## Execution loop

`CONTEXT → PLAN → IMPLEMENT → TEST → GUARDIAN → VERIFY → COMMIT → PUSH → COMPLETE`

- Advance stages in order.
- The third materially identical failure activates `LOOP_GUARD`.
- Entry into `COMMIT` requires passing verification evidence.
- Each phase ends with a remotely verified Git checkpoint when GitHub access exists.
- Large work is resumable; update the active-build state before a session boundary.

## Required gates

```bash
npm ci --ignore-scripts
npm run check
npm pack --dry-run
```

For container changes:

```bash
docker build .
```

For generated policy changes:

```bash
pauli-cloud compile . --agent=<agent> --dry-run
pauli-cloud doctor .
pauli-cloud prompt . --operation=verify
```

## Completion claims

Do not claim a test, commit, push, PR, browser check, container, release, or deployment unless objective evidence exists. Production release remains behind the exact ZTE production gate and protected GitHub environment approval.
