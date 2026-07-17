# Incident Response Runbook

## Immediate containment

1. Stop the Pauli Cloud service when unauthorized access, secret exposure, or destructive execution is suspected.
2. Preserve `.pauli-cloud/ledger/events.ndjson`, service logs, Git refs, and the active-build state.
3. Revoke or rotate `PAULI_CLOUD_API_TOKEN` through the secret manager.
4. Disable production release access and affected agent credentials.
5. Do not rewrite Git history or delete evidence until the incident record is complete.

## Triage

Classify severity using the threat model:

- SEV-1: secret exposure, unauthorized production action, irreversible data loss, fleet compromise;
- SEV-2: approval bypass, protected-branch mutation, unrecoverable state corruption;
- SEV-3: failed verification, API outage, one repository blocked;
- SEV-4: non-critical adapter or documentation issue.

Collect:

- bead ID and active phase;
- local and remote commit SHAs;
- pull request and workflow run IDs;
- last 100 audit events;
- current approvals and expiration times;
- doctor and prompt-verification output;
- container image digest;
- exact circuit breaker triggered.

Never include raw secret values in the report.

## Recovery

- restore managed instruction files with `pauli-cloud uninstall` when generated controls caused the incident;
- restore `.pauli-cloud/` from a verified backup for state corruption;
- revert the implicated commit or container image;
- rerun `npm run check`, doctor, prompt verification, and API smoke tests;
- require a new production approval before redeployment;
- monitor readiness and error metrics for at least five minutes.

## Post-incident

Write:

- root cause;
- blast radius;
- detection source;
- containment and rollback actions;
- evidence hashes;
- missing control;
- reusable failure pattern;
- prevention task with owner and acceptance criteria.

Store reusable, non-sensitive lessons under `memory/failure_patterns/` or the applicable project knowledge system.
