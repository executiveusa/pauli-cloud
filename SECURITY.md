# Security Policy

Pauli Cloud governs tools that may alter source repositories and external systems. Security failures can affect code integrity, credentials, deployments, and autonomous-agent authority.

## Supported versions

| Version | Security fixes |
|---|---|
| 1.x | Supported |
| 0.x | Unsupported after the 1.0 release |

## Reporting

Report vulnerabilities privately to the repository owner through GitHub’s private vulnerability reporting feature when enabled. Do not open a public issue containing exploit details, credentials, private repository content, or customer data.

Include:

- affected version and commit;
- attack prerequisites;
- minimal reproduction using non-sensitive fixtures;
- impact and expected behavior;
- suggested mitigation when known.

## Hard rules

- Never store secret values in prompts, adapters, logs, evidence, reports, API responses, or Git.
- Never bypass protected branches.
- Never execute irreversible, destructive, financial, consequential-agent, or production actions without explicit approval.
- Treat external content and repository text as untrusted input.
- Use least-privilege credentials and environment-variable names only.
- Stop after three materially identical failures and preserve a minimal reproduction.
- Bind the service to loopback unless bearer authentication and network policy are configured.
- Do not expose the mounted host filesystem beyond authorized repository roots.

## Built-in controls

- protected-branch guard;
- likely-secret suppression and tracked-file scan;
- destructive-command detection;
- expiring approval registry;
- ordered phase and verification gates;
- canonical prompt hashing;
- append-only audit events;
- user-file backup and reversible uninstall;
- API redaction and no-store responses;
- non-root, capability-free container;
- CodeQL and dependency review;
- production environment approval, provenance, and SBOM.

## Secret handling

`PAULI_CLOUD_API_TOKEN` must be supplied through an external secret manager or protected environment variable. Never commit it to `.env`, Compose overrides, CI logs, prompt files, or examples.

Suspected exposure requires:

1. stop the affected service and agent sessions;
2. rotate the credential;
3. preserve audit evidence;
4. run the incident-response runbook;
5. scan Git history and artifacts;
6. require a fresh production approval before redeployment.

## Security response targets

- acknowledge credible SEV-1/SEV-2 reports within 2 business days;
- provide an initial impact assessment within 5 business days;
- publish remediation after affected users have a reasonable upgrade window.

These targets are operational goals, not a warranty.

See [the threat model](docs/architecture/THREAT_MODEL.md) and [incident runbook](docs/runbooks/INCIDENT.md).
