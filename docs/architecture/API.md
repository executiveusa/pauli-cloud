# Pauli Cloud Service API

## Service startup

```bash
export PAULI_CLOUD_API_TOKEN='use-a-secret-manager'
pauli-cloud serve /workspace --host=127.0.0.1 --port=4317
```

Binding beyond loopback is rejected unless `PAULI_CLOUD_API_TOKEN` is present.

## Authentication

`/v1/*` endpoints require:

```text
Authorization: Bearer <PAULI_CLOUD_API_TOKEN>
```

The health, readiness, and metrics endpoints do not require authentication so container orchestrators can probe them. Do not expose them publicly without an ingress policy.

## Endpoints

### `GET /healthz`

Liveness only. Returns process uptime and current server time.

```json
{
  "status": "ok",
  "time": "2026-07-16T00:00:00.000Z",
  "uptime_seconds": 12
}
```

### `GET /readyz`

Runs the Pauli Cloud doctor against the mounted workspace. Returns `200` when ready and `503` when required governance state is invalid.

### `GET /metrics`

Prometheus text format:

```text
pauli_cloud_requests_total 12
pauli_cloud_errors_total 0
```

### `GET /v1/status`

Returns redacted active-build state.

### `GET /v1/fleet`

Returns the registered repository inventory with sensitive-key redaction.

### `GET /v1/events`

Returns the most recent 100 append-only audit events with sensitive-key redaction.

## Response controls

- JSON responses use UTF-8.
- Responses set `Cache-Control: no-store`.
- Responses set `X-Content-Type-Options: nosniff`.
- Unsupported methods return `405`.
- Unknown routes return `404`.
- Authentication failure returns `401` with a Bearer challenge.
- Internal errors do not include stack traces.

## Versioning

Versioned operational endpoints use `/v1/`. Backward-incompatible changes require a new path version. Health and metrics endpoints remain unversioned for orchestrator compatibility.

## Current API boundary

Version 1 is read-oriented. Mutating phase, approval, prompt, and fleet operations remain CLI-only to reduce remote attack surface. A future write API must add idempotency keys, request signing, scoped authorization, replay protection, and complete audit events before release.
