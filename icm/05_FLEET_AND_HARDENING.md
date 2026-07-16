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

1. Expose health, readiness, metrics, redacted status, fleet, and recent events.
2. Require bearer authentication for operational endpoints.
3. Reject non-loopback service startup without a token.
4. Package a non-root container and least-privilege Compose profile.
5. Test Node 20/22, package contents, container health, and authentication.
6. Run CodeQL, dependency review, secret scan, and coverage gate.
7. Protect production publishing with exact approval and environment review.
8. Publish architecture, threat model, API, installation, deployment, incident, backup, and release documentation.

## Outputs

- `src/server.mjs`;
- authenticated read-oriented service;
- Dockerfile, Compose, and health check;
- CI matrix and container smoke;
- CodeQL and dependency review;
- daily scheduled self-audit;
- gated provenance/SBOM release workflow;
- enterprise runbooks and schemas.

## Decisions

- service is read-oriented in Version 1;
- default bind is loopback;
- remote service requires token and external TLS/network policy;
- container runs non-root, read-only, capability-free, and resource-limited;
- production release is manual and protected;
- repository-local CLI remains authoritative.

## QA Checklist

- [x] service authentication tested
- [x] loopback and non-loopback behavior tested
- [x] health, readiness, metrics, status, fleet, and events implemented
- [x] Docker and Compose hardening defined
- [x] Node 20/22 matrix defined
- [x] container smoke defined
- [x] per-module coverage gate defined
- [x] secret scan defined
- [x] CodeQL and dependency review defined
- [x] production release gate defined
- [x] operations runbooks published
- [ ] GitHub CI matrix passes
- [ ] container smoke passes
- [ ] CodeQL passes
- [ ] dependency review passes
- [ ] Guardian review passes

<EOI>
phase: 05_fleet_and_hardening
status: VALIDATING
implemented:
  - authenticated service and metrics
  - hardened container and Compose
  - enterprise CI and security workflows
  - production release gate
  - architecture security and operations documentation
verified:
  - local enterprise tests PASS
  - local critical module coverage above 80 percent
known_limits:
  - production environment reviewers and NPM_TOKEN require repository configuration
  - remote write API is intentionally out of scope
next_phase: final_guardian_and_release_candidate
rollback: revert Phase 05 commits or deploy prior verified image
</EOI>
