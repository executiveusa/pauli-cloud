# Pauli Cloud Enterprise Architecture

## Purpose

Pauli Cloud is a repository-local and optionally service-hosted control plane that makes coding-agent execution consistent, resumable, inspectable, and enforceable across models and IDEs.

It does not replace Claude Code, Codex, Hermes, Pi, GLM, or a cloud-computer provider. It compiles one canonical governance system into controls each agent can actually obey.

## Components

```text
Agent / IDE / Harness
        │
        ▼
Capability Inspector
        │
        ├── session branch and worktree constraints
        ├── Git and GitHub capabilities
        ├── package, test, browser, CI, and deploy tools
        └── instruction precedence
        │
        ▼
Policy Compiler
        │
        ├── Claude Code rules, agents, settings, and hooks
        ├── Codex AGENTS contract and guards
        ├── generic Markdown, JSON, POSIX, and PowerShell controls
        └── reversible install manifest and backups
        │
        ▼
Execution Runtime
        │
        ├── ordered phase state machine
        ├── approval registry
        ├── append-only event ledger
        ├── verification evidence
        ├── Git remote-SHA checkpoint
        └── daily learning report
        │
        ▼
Prompt Intelligence
        │
        ├── immutable semantic versions
        ├── SHA-256 integrity
        ├── model adapters
        ├── measured run records
        └── evidence-gated promotion
        │
        ▼
Fleet Service
        ├── repository registry
        ├── health and readiness
        ├── redacted status and events
        ├── Prometheus metrics
        └── notification outbox
```

## Trust boundaries

1. **Session boundary:** system and session instructions outrank repository prompts. Pauli Cloud adopts assigned branches rather than generating conflicting commands.
2. **Repository boundary:** user-authored files are preserved. Managed changes are marked or recorded in the install manifest and backed up before mutation.
3. **Credential boundary:** Pauli Cloud stores credential names and approval metadata only. Runtime secrets remain in environment variables or an external vault.
4. **Execution boundary:** production, irreversible, financial, destructive, and consequential actions require explicit approvals.
5. **Network boundary:** the service binds to loopback by default. Non-loopback binding requires `PAULI_CLOUD_API_TOKEN`.
6. **Evidence boundary:** completion claims require doctor/verification evidence and, where available, matching local and remote Git SHAs.

## Data model

All durable local state lives below `.pauli-cloud/`:

```text
.pauli-cloud/
├── config.json
├── capabilities.json
├── constraints.json
├── policy.json
├── install-manifest.json
├── state/ACTIVE_BUILD_STATE.json
├── approvals/registry.json
├── ledger/events.ndjson
├── evidence/latest.json
├── fleet/repositories.json
├── prompts/
│   ├── registry.json
│   ├── canonical/
│   ├── adapter/
│   ├── experiment/
│   ├── runs/
│   └── learnings/
├── reports/
├── outbox/
├── generated/
└── backups/
```

State files use atomic rename writes. The audit ledger and notification outbox are append-only newline-delimited JSON.

## Availability model

The CLI remains the source of truth and works without the service. The service is an optional read-oriented operational surface. A service outage does not prevent repository-local doctor, verification, policy compilation, or phase recovery.

## Scaling model

Version 1 uses filesystem-backed state for portability and sovereignty. Fleet mode registers multiple repository roots and exposes aggregate status. A future service adapter may move fleet indexes to PostgreSQL while keeping each repository’s portable `.pauli-cloud/` state authoritative and exportable.

## Compatibility

- Node.js 20 and 22
- Linux, macOS, and Windows for the CLI
- POSIX and PowerShell generated guard wrappers
- Claude Code, Codex, and generic plain-file agents
- Docker and Compose service deployment

## Non-goals

- storing raw secrets;
- replacing the model or agent runtime;
- silently merging pull requests;
- bypassing the host agent’s higher-priority constraints;
- executing production changes without approval;
- requiring a proprietary Pauli Cloud backend for core operation.
