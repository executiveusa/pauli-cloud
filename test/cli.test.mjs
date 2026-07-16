import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = path.resolve('bin/pauli-cloud.mjs');
function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('init is idempotent and doctor passes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-'));
  assert.equal(run('init', root).status, 0);
  assert.equal(run('init', root).status, 0);
  assert.equal(run('doctor', root).status, 0);
});

test('doctor detects canonical prompt tampering', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-'));
  assert.equal(run('init', root).status, 0);
  await fs.appendFile(
    path.join(root, '.pauli-cloud', 'prompts', 'canonical', 'ZTE_AI_NATIVE_MASTER_PROMPT.md'),
    '\nmodified\n'
  );
  const result = run('doctor', root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /hash mismatch/);
});
