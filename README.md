# Pauli Cloud

Pauli Cloud is a model-agnostic execution-governance add-on for coding agents. It turns the Pauli Effect's ZTE loop, ICM method, prompt memory, evidence gates, and resumable Git workflow into a portable project overlay.

It is not an agent model, IDE, cloud computer, or application framework. It is the control layer that helps Claude Code, Codex, Hermes, Pi, GLM, local models, and future agents operate the same repository consistently.

## What it solves

- Session instructions can conflict with repository prompts.
- Agents stop after planning because scope is large.
- Prompt improvements disappear in chat history.
- Different models interpret the same project differently.
- Completion claims are not backed by tests, browser evidence, commits, or remote SHAs.
- Long builds cannot resume cleanly across sessions.
- Human approval boundaries are often vague or bypassed.

Pauli Cloud makes those concerns explicit and verifiable.

## Bootstrap CLI

Requirements: Node.js 20+

```bash
npm install
node ./bin/pauli-cloud.mjs init /path/to/project
node ./bin/pauli-cloud.mjs inspect /path/to/project --agent=claude-code --assigned-branch=agent/current-work
node ./bin/pauli-cloud.mjs doctor /path/to/project
node ./bin/pauli-cloud.mjs verify /path/to/project
node ./bin/pauli-cloud.mjs status /path/to/project
```

`init` creates a `.pauli-cloud/` overlay containing:

- canonical prompt registry with SHA-256 verification;
- resumable `ACTIVE_BUILD_STATE.json`;
- ICM stage files;
- Claude Code, Codex, and generic adapters;
- approval and protected-branch policy;
- evidence directory.

`inspect` records the active repository and agent environment:

- current, assigned, effective, default, and protected branches;
- dirty state, remote, and recent commits;
- GitHub, Node, package-manager, Docker, and agent tools;
- package scripts and lockfiles;
- applicable instruction files;
- CI, browser, and deployment capabilities;
- hard, policy, and missing constraints;
- a runtime adapter and next exact action.

The commands are idempotent and do not overwrite existing initialized files unless `--force` is used.

## Core principles

1. Session constraints are detected and adopted rather than argued with.
2. Large builds are resumable phase programs, not impossible one-session promises.
3. Every phase ends with tests, evidence, a commit, a push, and remote SHA verification when GitHub is available.
4. Canonical prompts are immutable and hash-verified.
5. Model-specific behavior belongs in adapters.
6. Consequential actions require explicit approval.
7. No secret values enter prompts, logs, evidence, or Git history.
8. The system gets smarter through versioned learnings and evaluated prompt promotion.

## Current status

Phase 0 provides the bootstrap kernel. Phase 1 adds capability and session-constraint negotiation. See `docs/MASTER_SPEC.md` for the product requirements, architecture, compatibility contract, and roadmap.
