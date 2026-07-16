# Deployment Runbook

## Production gate

Do not deploy to production until the operator provides the exact approval required by the active ZTE policy and the GitHub `production` environment approves the workflow.

## Local service

```bash
export PAULI_CLOUD_API_TOKEN='load-from-secret-manager'
pauli-cloud serve /path/to/workspace --host=127.0.0.1 --port=4317
curl --fail http://127.0.0.1:4317/healthz
curl --fail http://127.0.0.1:4317/readyz
```

## Docker Compose

```bash
mkdir -p workspace
export PAULI_CLOUD_API_TOKEN='load-from-secret-manager'
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:4317/healthz
curl --fail \
  -H "Authorization: Bearer $PAULI_CLOUD_API_TOKEN" \
  http://127.0.0.1:4317/v1/status
```

## Reverse proxy

When remote access is required:

- terminate TLS at Caddy, Traefik, Nginx, or a managed ingress;
- restrict source networks or require Tailscale;
- keep bearer authentication enabled;
- do not expose a host repository broader than the service requires;
- retain `Cache-Control: no-store`;
- rate-limit `/v1/*`;
- forward health probes only from trusted infrastructure.

## Pre-deploy gate

- `npm ci --ignore-scripts`
- `npm run check`
- `npm pack --dry-run`
- `docker build .`
- CodeQL successful
- dependency review successful
- branch head matches the reviewed PR SHA
- backup of mounted `.pauli-cloud/`
- rollback image or package version recorded
- API token present in the secret manager

## Post-deploy verification

For five minutes:

1. poll `/healthz` every 10 seconds;
2. poll `/readyz` every 10 seconds;
3. verify unauthorized `/v1/status` returns `401`;
4. verify authorized `/v1/status` returns `200`;
5. inspect container logs for errors;
6. inspect `pauli_cloud_errors_total`;
7. verify the mounted repository remains writable only where intended.

## Rollback

```bash
docker compose down
docker image ls pauli-cloud
# Restore the previously verified image tag in compose.yaml.
docker compose up -d
```

Restore `.pauli-cloud/` from the pre-deploy backup when state migration or corruption is involved. Run `doctor`, `prompt verify`, and readiness checks after rollback.
