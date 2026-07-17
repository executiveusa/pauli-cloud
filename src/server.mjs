import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {
  isLoopback,
  now,
  redactObject
} from './core.mjs';
import {
  projectPaths,
  statusProject
} from './project.mjs';
import { enterpriseDoctor } from './integrity.mjs';
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
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    ...headers
  });
  res.end(payload);
}

function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(String(left), 'utf8');
  const rightBytes = Buffer.from(String(right), 'utf8');
  const size = Math.max(leftBytes.length, rightBytes.length, 1);
  const leftPadded = Buffer.alloc(size);
  const rightPadded = Buffer.alloc(size);
  leftBytes.copy(leftPadded);
  rightBytes.copy(rightPadded);
  return leftBytes.length === rightBytes.length &&
    crypto.timingSafeEqual(leftPadded, rightPadded);
}

function authorized(req, token) {
  if (!token) return true;
  const header = req.headers.authorization ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  return constantTimeEqual(provided, token);
}

function rateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const clients = new Map();
  return (req) => {
    const key = req.socket.remoteAddress ?? 'unknown';
    const current = Date.now();
    const existing = clients.get(key);
    if (!existing || current >= existing.resetAt) {
      clients.set(key, { count: 1, resetAt: current + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    existing.count += 1;
    if (existing.count <= max) return { allowed: true, retryAfter: 0 };
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - current) / 1000))
    };
  };
}

export async function startServer(root, {
  host = '127.0.0.1',
  port = 4317,
  token = process.env.PAULI_CLOUD_API_TOKEN,
  rateLimit = 120
} = {}) {
  if (!isLoopback(host) && !token) {
    throw new Error('PAULI_CLOUD_API_TOKEN is required when binding beyond loopback');
  }
  const started = Date.now();
  const allowRequest = rateLimiter({ max: rateLimit });
  const counters = {
    requests_total: 0,
    errors_total: 0,
    rate_limited_total: 0
  };
  const server = http.createServer(async (req, res) => {
    counters.requests_total += 1;
    const limit = allowRequest(req);
    if (!limit.allowed) {
      counters.rate_limited_total += 1;
      return send(res, 429, { error: 'rate_limited' }, {
        'retry-after': String(limit.retryAfter)
      });
    }
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method !== 'GET') {
        return send(res, 405, { error: 'method_not_allowed' }, {
          allow: 'GET'
        });
      }
      if (url.pathname === '/healthz') {
        return send(res, 200, {
          status: 'ok',
          time: now(),
          uptime_seconds: Math.floor((Date.now() - started) / 1000)
        });
      }
      if (url.pathname === '/readyz') {
        const result = await enterpriseDoctor(root);
        return send(res, result.ok ? 200 : 503, {
          status: result.ok ? 'ready' : 'not_ready',
          checks: redactObject(result.checks)
        });
      }
      if (url.pathname === '/metrics') {
        return send(
          res,
          200,
          `# TYPE pauli_cloud_requests_total counter\npauli_cloud_requests_total ${counters.requests_total}\n# TYPE pauli_cloud_errors_total counter\npauli_cloud_errors_total ${counters.errors_total}\n# TYPE pauli_cloud_rate_limited_total counter\npauli_cloud_rate_limited_total ${counters.rate_limited_total}\n`
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
    } catch {
      counters.errors_total += 1;
      return send(res, 500, { error: 'internal_error' });
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
