# Pauli Cloud Threat Model

## Assets

- source code and Git history;
- active build state and rollback data;
- canonical prompts and evaluations;
- approval records;
- repository inventory;
- CI and deployment evidence;
- credential references;
- operator trust in completion claims.

## Adversaries and failure sources

- malicious or compromised agent instructions;
- prompt injection embedded in repository or web content;
- accidental destructive shell commands;
- secret leakage through files, logs, command arguments, or API responses;
- branch-policy bypass;
- replayed consequential actions;
- stale or fabricated verification evidence;
- compromised dependency or build action;
- unauthorized network access to the fleet API;
- corrupted or partially written state files;
- model hallucination about tools, commits, deployments, or permissions.

## Controls

| Threat | Control |
|---|---|
| Session/repository instruction conflict | Capability inspection and explicit precedence |
| Protected branch mutation | Inspector hard constraint plus generated guard |
| Secret leakage | Pre-tool secret pattern guard, tracked-file scan, response redaction |
| Destructive command | Pattern guard plus expiring irreversible approval |
| Unverified commit | Ordered phase state and evidence gate |
| Fabricated remote checkpoint | Local/remote SHA comparison |
| Prompt tampering | SHA-256 registry and doctor verification |
| Unsafe prompt promotion | Measured run must pass and meet baseline |
| User-file destruction | Backup manifest, managed markers, JSON merge, uninstall restore |
| Service exposure | Loopback default, token requirement beyond loopback |
| Sensitive API cache | `Cache-Control: no-store` and no secret values in responses |
| Dependency risk | Lockfile, dependency review, CodeQL, zero runtime dependencies |
| Container privilege | Non-root user, dropped capabilities, read-only filesystem, local port binding |
| Infinite repair loop | Three-attempt loop guard and failure event |
| False completion | Deterministic test, evidence, Git and PR ledger requirements |

## Known limitations

- Pattern-based secret detection cannot identify every credential format.
- Local filesystem state inherits host filesystem permissions and backup policy.
- The service token is bearer authentication; production ingress should add TLS and network policy.
- Approval records establish intent but do not provide hardware-backed identity.
- Generated Claude hooks depend on the installed Claude Code version supporting the documented hook schema.
- GitHub branch protection and production environment reviewers must be configured in repository settings.

## Required deployment controls

- terminate TLS at a trusted reverse proxy when accessed remotely;
- restrict ingress to operator networks or Tailscale;
- set `PAULI_CLOUD_API_TOKEN` from a secret manager;
- mount only the repositories Pauli Cloud is authorized to inspect;
- enable GitHub branch protection, required CI, CodeQL, and production environment approval;
- back up `.pauli-cloud/` and test restoration;
- rotate the API token after suspected exposure;
- review append-only events after any circuit-breaker activation.

## Incident severity

- **SEV-1:** secret exposure, unauthorized production action, irreversible data loss, fleet-wide compromise.
- **SEV-2:** approval bypass, protected-branch mutation, corrupted state without tested recovery.
- **SEV-3:** failed verification, unavailable API, one repository blocked.
- **SEV-4:** documentation, adapter, or non-critical usability defect.
