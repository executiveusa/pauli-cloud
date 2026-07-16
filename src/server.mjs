import http from 'node:http';
import fs from 'node:fs/promises';
import {
  isLoopback,
  now,
  redactObject
} from './core.mjs';
import {
  doctorProject,
  projectPaths,
  statusProject
} from './project.mjs';
import { fleetList } from './runtime.mjs';

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string'
      ? 'text/plain; charset=utf-8'
      : 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(payload);
}

function authorized(req, token) {
  if (!token) return true;
  return (req.headers.authorization ?? '') === `Bearer ${token}`;
}

export async function startServer(root, {
  host = '127.0.0.1',
  port = 4317,
  token = process.env.PAULI_CLOUD_API_TOKEN
} = {}) {
  if (!isLoopback(host) && !token) {
    throw new Error('PAULI_CLOUD_API_TOKEN is required when binding beyond loopback');
  }
  const started = Date.now();
  const counters = {
    requests_total: 0,
    errors_total: 0
  };
  const server = http.createServer(async (req, res) => {
    counters.requests_total += 1;
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method !== 'GET') {
        return send(res, 405, { error: 'method_not_allowed' });
      }
      if (url.pathname === '/healthz') {
        return send(res, 200, {
          status: 'ok',
          time: now(),
          uptime_seconds: Math.floor((Date.now() - started) / 1000)
        });
      }
      if (url.pathname === '/readyz') {
        const result = await doctorProject(root);
        return send(res, result.ok ? 200 : 503, {
          status: result.ok ? 'ready' : 'not_ready',
          checks: redactObject(result.checks)
        });
      }
      if (url.pathname === '/metrics') {
        return send(
          res,
          200,
          `# TYPE pauli_cloud_requests_total counter\npauli_cloud_requests_total ${counters.requests_total}\n# TYPE pauli_cloud_errors_total counter\npauli_cloud_errors_total ${counters.errors_total}\n`
        );
      }
      if (!authorized(req, token)) {
        return send(res, 401, { error: 'unauthorized' }, {
          'www-authenticate': 'Bearer'
        });
      }
      if (url.pathname === '/v1/status') {
        return send(res, 200, redactObject(await statusProject(root)));
      }
      if (url.pathname === '/v1/fleet') {
        return send(res, 200, redactObject(await fleetList(root)));
      }
      if (url.pathname === '/v1/events') {
        const p = projectPaths(root);
        let events = [];
        try {
          events = (await fs.readFile(p.ledger, 'utf8'))
            .split('\n')
            .filter(Boolean)
            .slice(-100)
            .map((line) => JSON.parse(line));
        } catch {}
        return send(res, 200, { events: redactObject(events) });
      }
      return send(res, 404, { error: 'not_found' });
    } catch (error) {
      counters.errors_total += 1;
      return send(res, 500, {
        error: 'internal_error',
        message: error.message
      });
    }
  });
  server.keepAliveTimeout = 5_000;
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.maxHeadersCount = 100;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return {
    server,
    host,
    port,
    summary: `Pauli Cloud service listening on http://${host}:${port}`
  };
}
