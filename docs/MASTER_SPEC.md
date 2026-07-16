# Pauli Cloud Product Requirements

## Product

Pauli Cloud is an independent overlay that installs consistent execution governance into any software repository and any compatible coding-agent environment.

## Primary user

A technical operator managing multiple repositories, models, IDEs, and autonomous agents who needs the same quality, safety, memory, and Git discipline everywhere.

## Jobs to be done

1. Initialize a project with ZTE, ICM, prompt registry, policies, adapters, and resumable state.
2. Detect agent/session constraints and compile compatible instructions.
3. Verify prompt integrity, ICM completeness, protected-branch policy, and checkpoint evidence.
4. Resume long builds across models and sessions without losing decisions.
5. Preserve successful patterns and recurring failures as reusable assets.
6. Produce machine-readable evidence for commits, PRs, tests, previews, and approvals.

## MVP acceptance

- Zero-dependency CLI works on Node 20+.
- `init` is idempotent.
- `doctor` detects missing governance artifacts and prompt tampering.
- `verify` writes machine-readable evidence.
- Claude Code, Codex, and generic adapters are generated.
- CI runs tests and self-verification.
- Product work occurs through a branch and PR.

# Architecture

```text
Agent / IDE / Harness
        │
        ▼
Agent Adapter
        │
        ▼
Policy + Capability Negotiator
        │
        ├── ZTE Constitution
        ├── ICM Stage Runtime
        ├── Prompt Registry
        ├── Resume State
        ├── Approval Registry
        └── Evidence Ledger
        │
        ▼
Repository Tools / Git / CI / Browser / Deploy
```

## Boundaries

- `bin/`: portable CLI kernel.
- `.pauli-cloud/`: generated project overlay.
- `prompts/`: immutable canonical prompts and model-specific adapters.
- `icm/`: sequential, inspectable product-development stages.
- `schemas/`: future machine-readable contracts.

## Agent compatibility contract

Every adapter must declare:

- instruction precedence;
- branch/worktree constraints;
- available tools;
- background execution limits;
- approval behavior;
- test and browser capabilities;
- Git and PR capabilities;
- resume mechanism;
- unsupported features.

Claude Code adopts its session-assigned branch and uses resumable checkpoints. Codex reads `AGENTS.md` and uses isolated worktrees where appropriate. Hermes, Pi, GLM, local models, and generic agents consume plain Markdown instructions plus JSON state and policy contracts.

# Roadmap

## Phase 0 — Bootstrap kernel

- CLI: init, doctor, verify, status
- prompt hash registry
- ICM bootstrap
- agent adapters
- tests and CI

## Phase 1 — Capability and constraint negotiation

- detect branch, GitHub auth, package manager, test commands, CI, browser support, and deployment targets
- generate session-compatible instructions
- record hard and soft constraints

## Phase 2 — Policy compiler and enforcement

- compile ZTE policies into Claude hooks, Codex instructions, generic shell guards, and CI checks
- block secrets, protected-branch pushes, unsafe destructive commands, and unverified commits

## Phase 3 — Resumable execution runtime

- phase/bead state machine
- checkpoint ledger
- remote SHA verification
- PR phase ledger
- loop guard and alternate-plan records

## Phase 4 — Prompt intelligence

- canonical/adapter/experiment separation
- run capture and evaluation
- measured promotion workflow
- reusable learnings and failure patterns

## Phase 5 — Fleet and service mode

- daemon/API
- multi-repository registry
- dashboard
- notifications
- OpenTelemetry
- optional Docker/Coolify deployment
