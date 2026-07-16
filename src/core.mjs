import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const NO_FALLBACK = Symbol('NO_FALLBACK');

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function readJson(filePath, fallback = NO_FALLBACK) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (fallback !== NO_FALLBACK && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, filePath);
}

export async function writeTextAtomic(filePath, value, mode = 0o600) {
  await ensureDir(path.dirname(filePath));
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, value, { encoding: 'utf8', mode });
  await fs.rename(temp, filePath);
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    shell: false,
    timeout: options.timeout ?? 30_000
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    error: result.error?.message ?? null
  };
}

export function now() {
  return new Date().toISOString();
}

export function safeName(value) {
  const result = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!result) throw new Error('a non-empty identifier is required');
  return result;
}

export function isLoopback(host) {
  return ['127.0.0.1', '::1', 'localhost'].includes(host);
}

export function relativeSafe(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('path escapes project root');
  }
  return relative;
}

export async function appendJsonLine(filePath, event) {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
}

export function redactObject(value) {
  const secretKey = /(secret|token|password|private.?key|api.?key|authorization|cookie)/i; // pauli-cloud: allow-secret-fixture
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        secretKey.test(key) ? '[REDACTED]' : redactObject(nested)
      ])
    );
  }
  return value;
}
