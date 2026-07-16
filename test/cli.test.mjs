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

test('inspect records capabilities and adopts assigned branch', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-inspect-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test', build: 'node build.mjs' } })
  );
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  const result = run('inspect', root, '--agent=claude-code', '--assigned-branch=agent/work');
  assert.equal(result.status, 0);
  const capabilities = JSON.parse(
    await fs.readFile(path.join(root, '.pauli-cloud', 'capabilities.json'), 'utf8')
  );
  assert.equal(capabilities.repository.effective_branch, 'agent/work');
  assert.equal(capabilities.agent, 'claude-code');
});

test('inspect blocks assigned branch conflicts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-branch-'));
  spawnSync('git', ['init', '-b', 'agent/current'], { cwd: root, encoding: 'utf8' });
  const result = run('inspect', root, '--assigned-branch=agent/required');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /assigned_branch_conflict/);
});

test('inspect detects mixed package managers', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-locks-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  const result = run('inspect', root, '--assigned-branch=agent/work');
  assert.equal(result.status, 0);
  const constraints = JSON.parse(
    await fs.readFile(path.join(root, '.pauli-cloud', 'constraints.json'), 'utf8')
  );
  assert.ok(constraints.constraints.some((item) => item.id === 'multiple_package_managers'));
});

test('missing browser tooling is scoped to browser verification', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-browser-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  const result = run('inspect', root, '--assigned-branch=agent/work');
  assert.equal(result.status, 0);
  const constraints = JSON.parse(
    await fs.readFile(path.join(root, '.pauli-cloud', 'constraints.json'), 'utf8')
  );
  const browser = constraints.constraints.find((item) => item.id === 'browser_harness');
  assert.deepEqual(browser.blocks, ['browser_verification']);
});
