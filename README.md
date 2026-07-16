# Pauli Cloud

**Enterprise execution governance for any coding agent.**

Pauli Cloud installs the Pauli Effect’s Zero-Touch Engineering loop, ICM stage method, prompt memory, approval controls, evidence gates, and resumable Git workflow into any software repository.

It does not replace Claude Code, Codex, Hermes, Pi, GLM, local models, or cloud computers. It gives all of them the same inspectable operating system.

## Why it exists

Coding agents commonly fail in predictable ways:

- they fight higher-priority session or branch constraints;
- stop after planning because the project is large;
- lose decisions and prompt improvements between sessions;
- claim completion without tests, browser evidence, commits, or deployment verification;
- overwrite project instructions;
- leak credentials into logs or prompts;
- execute destructive actions without a reliable approval record.

Pauli Cloud turns those concerns into policy, state, tests, evidence, and reversible project files.

## Capabilities

- **Capability negotiation:** detects branches, GitHub access, package managers, tests, CI, browser tools, containers, deploy targets, and instruction precedence.
- **Policy compiler:** generates Claude Code rules, subagents and hooks; Codex contracts; generic Markdown, JSON, POSIX and PowerShell controls.
- **Safe installation:** merges supported settings, preserves user files, backs up mutations, supports dry-run and reversible uninstall.
- **Circuit breakers:** blocks protected branches, likely credentials, destructive commands, unverified commits, and expired approvals.
- **Resumable runtime:** ordered phase state machine, three-attempt loop guard, append-only audit events, exact next action, and remote SHA checkpointing.
- **Prompt intelligence:** immutable semantic versions, SHA-256 verification, measured run records, evidence-gated promotion, and durable learnings.
- **Fleet operations:** repository registry, daily self-improvement reports, notification outbox, and redacted service views.
- **Service API:** authenticated status, fleet and event endpoints plus health, readiness and Prometheus metrics.
- **Enterprise delivery:** Node 20/22 CI, per-module coverage floor, secret scan, CodeQL, dependency review, hardened container, provenance, and SBOM release path.

## Requirements

- Node.js 20 or 22
- Git for repository checkpoints
- GitHub authentication only when PR or remote-SHA operations are required

Pauli Cloud has no runtime npm dependencies.

## Quick start

```bash
npm install --global pauli-cloud
cd /path/to/project

pauli-cloud init .
pauli-cloud inspect . \
  --agent=claude-code \
  --assigned-branch="$(git branch --show-current)"

pauli-cloud compile . --agent=claude-code --dry-run
pauli-cloud compile . --agent=claude-code
pauli-cloud doctor .
pauli-cloud verify .
```

Until the public package is released, clone this repository and run `node ./bin/pauli-cloud.mjs` in place of `pauli-cloud`.

## Core commands

```text
init        Create the portable .pauli-cloud overlay
inspect     Detect capabilities and hard/soft constraints
compile     Compile policy for Claude Code, Codex, or a generic agent
uninstall   Restore backups and remove managed controls
guard       Evaluate a command, branch, content, or phase gate
approve     Create an expiring approval record
phase       Start, advance, block, or fail a resumable phase
checkpoint  Verify local and remote Git SHAs
prompt      Register, verify, evaluate, and promote prompts
fleet       Register and inspect managed repositories
daily       Generate the daily improvement report
serve       Start the read-oriented operational API
doctor      Validate required governance state
verify      Write machine-readable verification evidence
status      Print the exact resume state
```

All operational commands support JSON output where applicable.

## Execution lifecycle

```text
CONTEXT
→ PLAN
→ IMPLEMENT
→ TEST
→ GUARDIAN
→ VERIFY
→ COMMIT
→ PUSH
→ COMPLETE
```

Invalid stage jumps are rejected. Entry into `COMMIT` requires passing verification evidence. The third materially identical failure activates the loop guard.

## Security defaults

- service binds to `127.0.0.1` by default;
- non-loopback binding requires `PAULI_CLOUD_API_TOKEN`;
- `/v1/*` requires Bearer authentication;
- suspected secret values are never echoed;
- protected branches are denied;
- destructive commands require an active, expiring approval;
- generated files are backed up and reversible;
- container runs as non-root with all capabilities dropped;
- production release requires an exact approval phrase and GitHub environment approval.

Read [the threat model](docs/architecture/THREAT_MODEL.md) and [security policy](SECURITY.md) before remote deployment.

## Docker

```bash
mkdir -p workspace
export PAULI_CLOUD_API_TOKEN='load-from-secret-manager'
docker compose up --build -d
curl --fail http://127.0.0.1:4317/healthz
```

The Compose service uses a read-only root filesystem, no Linux capabilities, local-only port binding, resource limits, and health checks.

## Documentation

- [Master specification](docs/MASTER_SPEC.md)
- [Enterprise architecture](docs/architecture/ENTERPRISE_ARCHITECTURE.md)
- [Threat model](docs/architecture/THREAT_MODEL.md)
- [Service API](docs/architecture/API.md)
- [Installation](docs/runbooks/INSTALL.md)
- [Deployment](docs/runbooks/DEPLOY.md)
- [Backup and restore](docs/runbooks/BACKUP_RESTORE.md)
- [Incident response](docs/runbooks/INCIDENT.md)
- [Release](docs/runbooks/RELEASE.md)

## Sovereignty

The `.pauli-cloud/` directory is portable, plain-file state owned by the project. Core operation does not require a proprietary hosted service. Prompts, decisions, evidence, backups, and execution state remain exportable and reviewable.

## Status

Version `1.0.0` is the enterprise runtime release candidate. Production publishing remains behind the ZTE production gate.
