import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject, inspectProject, projectPaths } from '../src/project.mjs';
import { compilePolicy, uninstallPolicy } from '../src/compiler.mjs';
import { approveAction, evaluateGuard } from '../src/policy.mjs';
import { enterpriseVerify } from '../src/integrity.mjs';
import { phaseStart, phaseAdvance } from '../src/runtime.mjs';

const packageRoot = path.resolve('.');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-p1-'));
  spawnSync('git', ['init', '-b', 'agent/hotfix'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'fixture\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: root });
  await initProject(root, packageRoot);
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/hotfix'
  });
  return root;
}

function invoke(file, input, { cwd, env = {} } = {}) {
  return spawnSync(process.execPath, [file, '--stdin'], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

test('uninstall drift preflight leaves every managed file and manifest unchanged', async () => {
  const root = await fixture();
  await compilePolicy(root, { agent: 'claude-code' });
  const p = projectPaths(root);
  const manifestPath = path.join(p.base, 'install-manifest.json');
  const manifestBefore = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestBefore);
  const tracked = new Map();
  for (const item of manifest.files) {
    const target = path.join(root, item.path);
    try {
      tracked.set(item.path, await fs.readFile(target));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      tracked.set(item.path, null);
    }
  }

  const drifted = manifest.files.at(-1);
  await fs.appendFile(path.join(root, drifted.path), '\ndrift after install\n');
  tracked.set(drifted.path, await fs.readFile(path.join(root, drifted.path)));

  const result = await uninstallPolicy(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.changes, []);
  assert.ok(result.conflicts.some((item) => item.reason === 'post_install_drift'));
  assert.equal(await fs.readFile(manifestPath, 'utf8'), manifestBefore);

  for (const [relative, expected] of tracked) {
    const target = path.join(root, relative);
    if (expected === null) {
      await assert.rejects(() => fs.stat(target), { code: 'ENOENT' });
    } else {
      assert.deepEqual(await fs.readFile(target), expected);
    }
  }
});

test('generated hook enforces exact and project approval scopes', async () => {
  const root = await fixture();
  await compilePolicy(root, { agent: 'claude-code' });
  const guard = path.join(root, '.pauli-cloud', 'generated', 'guard.mjs');
  const configPath = path.join(root, '.pauli-cloud', 'config.json');
  const registryPath = path.join(root, '.pauli-cloud', 'approvals', 'registry.json');
  const configInput = {
    cwd: root,
    tool_name: 'Write',
    tool_input: { file_path: configPath, content: '{}' }
  };
  const registryInput = {
    cwd: root,
    tool_name: 'Write',
    tool_input: { file_path: registryPath, content: '{}' }
  };

  const exact = await approveAction(root, {
    type: 'consequential_agent_action',
    scope: '.pauli-cloud/config.json'
  });
  assert.equal(invoke(guard, configInput, {
    cwd: root,
    env: { PAULI_CLOUD_APPROVAL_ID: exact.approval_id }
  }).status, 0);
  const wrongScope = invoke(guard, registryInput, {
    cwd: root,
    env: { PAULI_CLOUD_APPROVAL_ID: exact.approval_id }
  });
  assert.equal(wrongScope.status, 2);
  assert.match(wrongScope.stderr, /active consequential-action approval/);

  const project = await approveAction(root, {
    type: 'consequential_agent_action',
    scope: 'project'
  });
  assert.equal(invoke(guard, registryInput, {
    cwd: root,
    env: { PAULI_CLOUD_APPROVAL_ID: project.approval_id }
  }).status, 0);
});

test('COMMIT gates reject stale evidence and accept current phase-bound evidence', async () => {
  const root = await fixture();
  const p = projectPaths(root);
  await phaseStart(root, {
    phase: 'p1-hotfix',
    beadId: 'ZTE-20260716-0003',
    branch: 'agent/hotfix'
  });
  for (const stage of ['PLAN', 'IMPLEMENT', 'TEST', 'GUARDIAN', 'VERIFY']) {
    await phaseAdvance(root, { to: stage });
  }

  await fs.writeFile(path.join(p.evidence, 'latest.json'), JSON.stringify({
    schema_version: '1.0.0',
    ok: true,
    verification_profile: 'enterprise',
    verification_id: 'ver_stale',
    verified_at: new Date(0).toISOString(),
    bead_id: 'ZTE-20260716-0002',
    phase: 'prior-phase',
    phase_started_at: new Date(0).toISOString()
  }));

  await assert.rejects(
    () => phaseAdvance(root, { to: 'COMMIT' }),
    /current phase-bound verification evidence/
  );
  const staleGuard = await evaluateGuard(root, { action: 'phase-commit' });
  assert.equal(staleGuard.ok, false);
  assert.equal(staleGuard.code, 'PHASE_GATE');

  const verified = await enterpriseVerify(root);
  assert.equal(verified.ok, true);
  const evidence = JSON.parse(await fs.readFile(path.join(p.evidence, 'latest.json'), 'utf8'));
  assert.equal(evidence.bead_id, 'ZTE-20260716-0003');
  assert.equal(evidence.phase, 'p1-hotfix');
  assert.ok(evidence.phase_started_at);
  assert.ok(evidence.verification_id.startsWith('ver_'));

  const currentGuard = await evaluateGuard(root, { action: 'phase-commit' });
  assert.equal(currentGuard.ok, true);
  const committed = await phaseAdvance(root, { to: 'COMMIT' });
  assert.equal(committed.state.current_stage, 'COMMIT');
});
