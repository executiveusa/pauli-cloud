# Phase 05 — Fleet Service and Production Hardening

## Context

Enterprise use requires operational visibility, reproducible packaging, least-privilege deployment, release controls, and incident/restore procedures without making the optional service a core dependency.

## Inputs

- fleet repository registry;
- active state and audit events;
- service host, port, and environment token;
- container and CI environment;
- release approval and registry credentials.

## Process

1. Expose health, enterprise readiness, metrics, redacted status, fleet, and recent events.
2. Require constant-time bearer authentication for operational endpoints.
3. Reject non-loopback service startup without a token.
4. Add security headers, no-store responses, opaque errors, and rate limits.
5. Package a non-root container and least-privilege Compose profile with Git/SSH transport.
6. Test Node 20/22, package contents, container health, readiness, and authentication.
7. Run CodeQL, dependency review, value-suppressed secret scan, and per-module coverage gate.
8. Retain sanitized CI evidence artifacts.
9. Protect production publishing with exact approval and environment review.
10. Publish architecture, threat model, API, installation, deployment, incident, backup, release, and GitHub-controls documentation.

## Outputs

- `src/server.mjs` and `src/integrity.mjs`;
- authenticated read-oriented service;
- enterprise drift, approval, audit, prompt, and state readiness checks;
- Dockerfile, Compose, and health check;
- Node 20/22 CI matrix and authenticated container smoke;
- CodeQL, dependency review, secret scan, and coverage gates;
- retained test, package, scanner, and container evidence artifacts;
- daily scheduled self-audit;
- gated provenance/SBOM release workflow;
- enterprise runbooks, schemas, ownership, and contribution controls.

## Decisions

- service is read-oriented in Version 1;
- default bind is loopback;
- remote service requires token and external TLS/network policy;
- readiness fails on managed drift or corrupt state;
- container runs non-root, read-only, capability-free, and resource-limited;
- production release is manual and protected;
- repository-local CLI remains authoritative;
- branch protection and production reviewers remain an explicit repository-settings gate tracked in issue #5.

## QA Checklist

- [x] service authentication and constant-time comparison tested
- [x] loopback and non-loopback behavior tested
- [x] rate limits, security headers, opaque errors, and no-store tested
- [x] health, enterprise readiness, metrics, status, fleet, and events implemented
- [x] managed drift and corrupt-state readiness tests pass
- [x] Docker and Compose hardening implemented
- [x] Git and SSH transport included in runtime image
- [x] Node 20/22 matrix passes
- [x] package and CLI smoke passes
- [x] container build, health, readiness, and auth smoke passes
- [x] per-module coverage gate passes
- [x] value-suppressed secret scan and scanner self-tests pass
- [x] CodeQL passes
- [x] dependency review passes
- [x] production release gate defined
- [x] operations and GitHub-controls runbooks published
- [x] Guardian review passes

<EOI>
phase: 05_fleet_and_hardening
status: COMPLETE
implemented:
  - authenticated rate-limited read service and enterprise metrics
  - enterprise integrity/readiness verification
  - hardened functional container and Compose deployment
  - enterprise CI, retained evidence, and security workflows
  - protected provenance/SBOM production release gate
  - architecture, security, governance, and operations documentation
verified:
  - Node 20 and Node 22 CI PASS
  - package and CLI smoke PASS
  - hardened container build and runtime smoke PASS
  - CI run 29515358737 PASS
  - CodeQL run 29515358534 PASS
  - Dependency Review run 29515357900 PASS
  - Guardian review PASS
known_limits:
  - production environment reviewers, branch protection, and NPM_TOKEN require repository configuration under issue #5
  - remote write API is intentionally out of scope
next_phase: human_review_and_production_gate
rollback: revert Phase 05 commits or deploy prior verified image
</EOI>
