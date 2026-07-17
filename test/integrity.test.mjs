import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject, inspectProject, projectPaths } from '../src/project.mjs';
import { compilePolicy } from '../src/policy.mjs';
import { enterpriseDoctor, enterpriseVerify } from '../src/integrity.mjs';

const packageRoot = path.resolve('.');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-integrity-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'fixture\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: root });
  await initProject(root, packageRoot);
  return root;
}

test('enterprise verification emits an enterprise evidence profile', async () => {
  const root = await fixture();
  const result = await enterpriseVerify(root);
  assert.equal(result.ok, true);
  const evidence = JSON.parse(await fs.readFile(result.evidence, 'utf8'));
  assert.equal(evidence.verification_profile, 'enterprise');
});

test('enterprise doctor detects managed control drift', async () => {
  const root = await fixture();
  await inspectProject(root, packageRoot, {
    agent: 'generic',
    assignedBranch: 'agent/work'
  });
  await compilePolicy(root, { agent: 'generic' });
  assert.equal((await enterpriseDoctor(root)).ok, true);
  await fs.appendFile(
    path.join(root, '.pauli-cloud', 'generated', 'EXECUTION_CONTRACT.md'),
    '\nunauthorized drift\n'
  );
  const result = await enterpriseDoctor(root);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((item) =>
    item.name.includes('EXECUTION_CONTRACT.md') &&
    item.detail === 'post-install drift'
  ));
});

test('enterprise doctor detects invalid approvals and audit events', async () => {
  const root = await fixture();
  const p = projectPaths(root);
  await fs.writeFile(
    p.approvals,
    `${JSON.stringify({
      schema_version: '1.0.0',
      approvals: [{
        id: 'duplicate',
        type: 'unsupported',
        status: 'approved',
        expires_at: 'not-a-date'
      }]
    }, null, 2)}\n`
  );
  await fs.mkdir(path.dirname(p.ledger), { recursive: true });
  await fs.writeFile(p.ledger, '{invalid-json}\n');
  const result = await enterpriseDoctor(root);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((item) =>
    item.name === 'audit ledger' && item.ok === false
  ));
  assert.ok(result.checks.some((item) =>
    item.name === 'approval duplicate' && item.ok === false
  ));
});

test('enterprise doctor rejects duplicate prompt identities', async () => {
  const root = await fixture();
  const p = projectPaths(root);
  const registry = JSON.parse(await fs.readFile(p.registry, 'utf8'));
  registry.prompts.push({ ...registry.prompts[0] });
  await fs.writeFile(p.registry, `${JSON.stringify(registry, null, 2)}\n`);
  const result = await enterpriseDoctor(root);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((item) =>
    item.name === 'prompt registry identities' &&
    item.detail.includes('duplicate')
  ));
});
