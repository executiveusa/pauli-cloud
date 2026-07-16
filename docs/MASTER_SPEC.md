# Pauli Cloud Enterprise Product Requirements

## Product definition

Pauli Cloud is a model-agnostic execution-governance control plane that installs consistent ZTE, ICM, prompt-memory, safety, evidence, and Git discipline into any compatible software repository and coding-agent environment.

It is both:

1. a sovereign repository-local CLI and plain-file runtime; and
2. an optional read-oriented operational service for fleet visibility.

Core operation must not depend on a proprietary hosted backend.

## Primary user

A technical operator managing multiple repositories, models, IDEs, and autonomous agents who needs the same quality, safety, memory, approval, and recovery behavior everywhere.

## Jobs to be done

1. Initialize a project with ZTE, ICM, prompt registry, policies, approvals, adapters, evidence, and resumable state.
2. Detect agent/session constraints and compile compatible instructions instead of fighting higher-priority restrictions.
3. Enforce protected branches, secret safety, irreversible-action approvals, verification gates, and rollback.
4. Resume long builds across agents and sessions without losing state or decisions.
5. Preserve prompts as immutable, evaluated intellectual property.
6. Produce machine-readable evidence for tests, commits, remote SHAs, PRs, previews, approvals, and incidents.
7. Register and observe multiple sovereign repositories without taking ownership of their data.
8. Package the system for repeatable CLI, container, CI, and enterprise deployment.

## Version 1 acceptance

### Runtime

- Node.js 20 and 22 supported.
- No runtime npm dependencies.
- Commands support machine-readable JSON output where applicable.
- Initialization and policy compilation are idempotent.
- Atomic writes protect structured state from partial updates.
- Invalid phase transitions are rejected.
- Third identical failure activates the loop guard.

### Compatibility

- Claude Code adapter compiles scoped rules, Guardian subagent, settings hooks, and branch-safe instructions.
- Codex adapter compiles AGENTS-compatible instructions and guards.
- Generic adapter compiles Markdown, JSON, POSIX, and PowerShell controls.
- Session-assigned branches are adopted and recorded.
- Missing optional capabilities block only dependent stages.

### Security

- User-authored files are preserved or explicitly reported as conflicts.
- Changed user files are backed up and restorable.
- Protected-branch pushes and commits are blocked.
- Likely secret values are blocked and never echoed.
- Destructive commands require active, expiring approvals.
- Service defaults to loopback and requires a token beyond loopback.
- API responses are redacted and non-cacheable.
- Container runs non-root with all Linux capabilities dropped.

### Evidence

- Doctor verifies required files, configuration, resumable state, and prompt hashes.
- Verification writes a machine-readable evidence record.
- Checkpoint compares local and remote Git SHAs.
- Audit events are append-only NDJSON.
- Every critical source module maintains at least 80% line coverage.
- Node 20/22 CI, container smoke, CodeQL, dependency review, and secret scan pass.

### Prompt intelligence

- Prompt IDs and versions are unique.
- Semantic versions are mandatory.
- Canonical prompts are immutable and SHA-256 registered.
- Experiments remain separate from canonical prompts.
- Promotion requires a passing measured run whose score meets or exceeds baseline.
- Promotion writes a durable learning record.

### Operations

- Fleet registry supports multiple repository roots.
- Daily report summarizes recent events, blockers, stage, and next action.
- Service exposes health, readiness, metrics, redacted status, fleet, and recent events.
- Installation, deployment, backup, restore, incident, and release runbooks exist.
- Production release requires exact approval and protected-environment review.

## Architecture

```text
Agent / IDE / Harness
        │
        ▼
Capability Inspector
        │
        ▼
Policy Compiler + Agent Adapter
        │
        ▼
Guard + Approval Registry
        │
        ▼
Resumable Phase Runtime
        │
        ├── ICM stage files
        ├── append-only event ledger
        ├── verification evidence
        ├── Git checkpoint
        └── prompt intelligence
        │
        ▼
Repository Tools / CI / Browser / Deploy
        │
        ▼
Optional Fleet API and Metrics
```

## Repository boundaries

- `bin/`: CLI dispatcher.
- `src/core.mjs`: safe I/O, hashing, subprocesses, redaction.
- `src/project.mjs`: initialization, inspection, doctor, verification.
- `src/policy.mjs`: compiler, guards, approvals, reversible install.
- `src/runtime.mjs`: phase state, events, checkpoints, fleet, daily report.
- `src/prompts.mjs`: registry, evaluation, promotion, learnings.
- `src/server.mjs`: authenticated read-oriented API.
- `.pauli-cloud/`: generated project-owned state.
- `schemas/`: machine-readable contracts.
- `icm/`: build history and acceptance evidence.
- `docs/`: architecture and operations.

## Trust and ownership

- Project owners retain code, prompts, data, configuration, evidence, and backups.
- Pauli Cloud stores secret references, never secret values.
- Generated changes are attributable to policy hashes and reversible manifests.
- Service mode is optional; CLI and plain files remain authoritative.
- No model vendor, IDE, database, hosting provider, or agent harness is required by the domain layer.

## Deployment profiles

### Repository-local

CLI only. Best for one operator or one repository.

### Local fleet service

Docker or native process bound to loopback, with multiple repository roots registered.

### Enterprise remote service

Container behind TLS, network policy, protected secret injection, monitoring, backups, and GitHub production approvals. Remote mutation APIs are out of scope for Version 1.

## Explicit non-goals for Version 1

- autonomous PR merge;
- storing raw credentials;
- remote destructive or production mutation endpoints;
- replacing the underlying coding agent;
- silently rewriting user-authored instructions;
- full workflow orchestration across untrusted hosts;
- proprietary lock-in for core operation.

## Future roadmap

### 1.1

- JSON Schema runtime validation;
- signed checkpoint attestations;
- notification adapters;
- Windows service and systemd installers;
- policy packs and organization inheritance.

### 1.2

- PostgreSQL fleet index with repository-local state remaining authoritative;
- OpenTelemetry traces;
- role-scoped service access;
- signed webhook delivery;
- dashboard.

### 2.0 prerequisites

A write-capable remote API requires scoped identities, request signing, idempotency keys, replay protection, transactional audit events, tenant isolation, and formal external security review.
