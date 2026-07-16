import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject, inspectProject } from '../src/project.mjs';
import { compilePolicy } from '../src/compiler.mjs';

const packageRoot = path.resolve('.');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-compiler-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'fixture\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: root });
  await initProject(root, packageRoot);
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/work'
  });
  return root;
}

test('transactional compile applies a conflict-free preflight', async () => {
  const root = await fixture();
  const result = await compilePolicy(root, { agent: 'generic' });
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.equal(
    await fs.stat(path.join(root, '.pauli-cloud', 'generated', 'guard.mjs')).then(() => true),
    true
  );
});

test('transactional compile performs no writes when preflight finds a conflict', async () => {
  const root = await fixture();
  const conflict = path.join(root, '.claude', 'rules', 'pauli-cloud-zte.md');
  await fs.mkdir(path.dirname(conflict), { recursive: true });
  await fs.writeFile(conflict, 'user-authored rule\n');

  const result = await compilePolicy(root, { agent: 'claude-code' });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.match(result.summary, /blocked before mutation/);
  assert.equal(await fs.readFile(conflict, 'utf8'), 'user-authored rule\n');
  await assert.rejects(
    () => fs.stat(path.join(root, '.pauli-cloud', 'generated', 'guard.mjs')),
    { code: 'ENOENT' }
  );
  await assert.rejects(
    () => fs.stat(path.join(root, '.claude', 'settings.json')),
    { code: 'ENOENT' }
  );
});
