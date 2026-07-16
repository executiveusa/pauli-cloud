# Backup and Restore Runbook

## Backup scope

Back up the complete `.pauli-cloud/` directory, including:

- configuration and constraints;
- active build state;
- approvals;
- append-only events;
- prompt registry, versions, runs, and learnings;
- evidence and reports;
- fleet registry;
- install manifest and generated-file backups.

Do not back up environment variables or secret-manager values into the repository archive.

## Consistent backup

1. Stop active phase mutation or place the service in maintenance mode.
2. Run `pauli-cloud doctor .`.
3. Run `pauli-cloud prompt . --operation=verify`.
4. Record the current Git commit and branch.
5. Create an encrypted archive outside the repository.
6. Compute and record the archive SHA-256.
7. Resume execution.

Example:

```bash
tar -czf pauli-cloud-state.tgz .pauli-cloud
sha256sum pauli-cloud-state.tgz
```

Use platform-appropriate encryption and storage retention controls.

## Restore

1. Stop the service and all agent mutations.
2. Preserve the damaged state for incident analysis.
3. Restore `.pauli-cloud/` from the selected archive.
4. Verify the archive hash.
5. Run doctor and prompt verification.
6. Compare active state with the Git branch and commit.
7. Re-run the latest deterministic test gate.
8. Start the service and verify health, readiness, authentication, and metrics.

## Restore acceptance

- canonical prompt hashes match;
- state JSON parses and references a real branch;
- audit ledger lines parse independently;
- install manifest backup paths exist;
- registered repository roots are reviewed;
- no expired approval is treated as active;
- readiness returns `200`;
- the operator confirms the next exact action.

## Drill frequency

Perform a restore drill before initial production release and at least quarterly. Record duration, failures, and any missing data in the operational report.
