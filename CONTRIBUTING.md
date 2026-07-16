# Contributing to Pauli Cloud

## Development setup

```bash
npm ci --ignore-scripts
npm run check
```

Use Node.js 20 or 22. Pauli Cloud intentionally has no runtime npm dependencies.

## Workflow

1. Create or use a non-protected branch or assigned worktree.
2. Read `AGENTS.md`, `docs/MASTER_SPEC.md`, and `SECURITY.md`.
3. Write a bounded plan with binary acceptance criteria and rollback.
4. Reuse existing modules and schemas.
5. Add focused tests for new behavior and failure paths.
6. Run the Guardian review against security, approvals, secrets, branch safety, idempotency, and rollback.
7. Run `npm run check` and package/container gates when applicable.
8. Open a pull request using the repository template.

## Code standards

- standard-library-first JavaScript modules;
- no shell execution when argument arrays are possible;
- atomic state writes;
- no silent exception swallowing on critical paths;
- machine-readable output for operational commands;
- user files preserved unless explicit migration rules exist;
- generated artifacts marked or recorded in the install manifest;
- secrets referenced by name only;
- backward-compatible schemas unless a major version explicitly permits migration.

## Tests

Every critical source module must maintain at least 80% line coverage. Coverage is not a substitute for meaningful assertions.

Required categories include:

- success path;
- invalid input;
- authorization/approval denial;
- idempotent repeat;
- rollback or restore;
- corruption or partial failure;
- cross-platform behavior when relevant.

## Security changes

Changes to policy, guards, approvals, service authentication, release workflows, or secret handling require:

- threat-model update;
- Guardian review;
- CODEOWNER review;
- CodeQL and dependency review;
- explicit rollback instructions.

Do not place vulnerability details in public issues. Follow `SECURITY.md`.

## Commit format

```text
[ZTE][{bead_id}] {action}: {what changed} | {why}
```

## Licensing

Contributions are accepted under Apache-2.0 unless explicitly marked otherwise before submission.
