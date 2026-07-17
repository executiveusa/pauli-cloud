# Installation and Upgrade Runbook

## Prerequisites

- Node.js 20 or 22
- Git
- write permission to the target repository
- GitHub authentication only when remote checkpoints or PRs are required

## Package installation

```bash
npm install --global pauli-cloud
pauli-cloud --help
```

Until the npm package is released, use the repository checkout:

```bash
npm ci --ignore-scripts
node ./bin/pauli-cloud.mjs --help
```

## Initialize a repository

```bash
cd /path/to/repository
pauli-cloud init .
pauli-cloud inspect . --agent=claude-code --assigned-branch="$(git branch --show-current)"
pauli-cloud compile . --agent=claude-code --dry-run
pauli-cloud compile . --agent=claude-code
pauli-cloud doctor .
pauli-cloud verify .
```

Always review dry-run conflicts before compilation. Pauli Cloud never silently overwrites an unrecognized user-authored instruction file.

## Agent choices

```bash
pauli-cloud compile . --agent=claude-code
pauli-cloud compile . --agent=codex
pauli-cloud compile . --agent=generic
```

Model-specific files are compiled from the same policy and prompt hashes.

## Upgrade

1. Back up `.pauli-cloud/`.
2. Upgrade the package.
3. Run `pauli-cloud doctor .`.
4. Run `pauli-cloud inspect` again to refresh capabilities.
5. Run `pauli-cloud compile --dry-run`.
6. Apply the compile only after reviewing the diff.
7. Run the repository’s complete test gate.
8. Commit generated policy changes on a non-protected branch.

## Uninstall

Preview:

```bash
pauli-cloud uninstall . --dry-run
```

Restore:

```bash
pauli-cloud uninstall .
```

The install manifest restores backed-up files and removes only Pauli Cloud-managed files. User-authored files outside the manifest are untouched.

## Verification

```bash
pauli-cloud doctor . --json
pauli-cloud prompt . --operation=verify --json
pauli-cloud status . --json
```

A successful installation has no hard constraint, all canonical prompt hashes match, the ICM stage is complete, and generated files have a reversible manifest.
