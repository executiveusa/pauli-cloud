# Claude Code Branch-Safe Resumable Adapter

## Purpose

Translate the Pauli Cloud ZTE constitution into instructions that respect Claude Code's higher-priority session constraints while preserving autonomous, evidence-backed execution.

## Precedence

Use this order:

1. Claude Code system and session restrictions
2. ZTE circuit breakers
3. repository-local Pauli Cloud policy
4. project specifications and implementation files

A repository prompt must never tell Claude Code to violate an assigned branch, worktree, permission, or tool restriction.

## Branch negotiation

- Inspect the current branch before mutation.
- If Claude Code assigned a branch, stay on it.
- Do not create, switch, rename, force-update, or push another branch unless the session explicitly authorizes it.
- Never push directly to a protected branch.
- Record the adopted branch in `.pauli-cloud/state/ACTIVE_BUILD_STATE.json`.

## Resumable execution

Large scope is a resumable phase program, not an impossible one-session promise.

Execute:

`CONTEXT → SPECIFY → IMPLEMENT → TEST → ATTACK → FIX → VERIFY → ICM → LEARN → COMMIT → PUSH`

After each complete phase:

1. update ICM status and evidence;
2. update resumable state;
3. run deterministic gates;
4. commit the verified phase;
5. push to the assigned remote branch when authorized;
6. verify the local and remote SHAs;
7. update the draft PR or checkpoint record;
8. begin the next safe phase without asking whether to continue.

If a context or environment boundary is reached, finish the current atomic operation, preserve a valid checkpoint, and record the exact resume command. Never promise background execution.

## Legitimate human gates

Require explicit approval only for:

- production deployment;
- irreversible or destructive operations;
- financial actions;
- consequential agent sends, publishes, writes, or deletes where policy requires approval;
- legal or compliance decisions;
- missing credentials required for live verification;
- a named ZTE circuit breaker.

Normal schema implementation, fixture migrations, test-mode integrations, previews, HTML contracts, reversible refactors, and adapter development do not automatically require a human checkpoint.

## Missing credentials

Complete all non-blocked work:

- adapters;
- configuration validation;
- fixtures and test mode;
- explicit disabled and failure states;
- environment-variable documentation;
- dry runs and tests.

Mark only live-provider verification blocked.

## Stop conditions

Stop only for verified completion, a hard circuit breaker, unavailable authorization required for a mandatory checkpoint, an essential external credential after all safe work is complete, three materially identical failed repair attempts, or a hard environment boundary after a resumable checkpoint is written.
