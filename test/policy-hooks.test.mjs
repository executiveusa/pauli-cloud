import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject, inspectProject, projectPaths } from '../src/project.mjs';
import { compilePolicy, uninstallPolicy, approveAction } from '../src/policy.mjs';

const packageRoot = path.resolve('.');

async function fixture(branch = 'agent/work') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-hooks-'));
  spawnSync('git', ['init', '-b', branch], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'fixture\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: root });
  await initProject(root, packageRoot);
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: branch
  });
  await compilePolicy(root, { agent: 'claude-code' });
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

test('generated PreToolUse hook blocks Bash policy violations with exit code 2', async () => {
  const root = await fixture();
  const guard = path.join(root, '.pauli-cloud', 'generated', 'guard.mjs');
  const result = invoke(guard, {
    cwd: root,
    tool_name: 'Bash',
    tool_input: { command: 'git push origin main' }
  }, {
    cwd: root,
    env: { PAULI_CLOUD_BRANCH: 'main' }
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /protected branch/);
});

test('generated hook protects policy files and honors an active approval ID', async () => {
  const root = await fixture();
  const guard = path.join(root, '.pauli-cloud', 'generated', 'guard.mjs');
  const input = {
    cwd: root,
    tool_name: 'Write',
    tool_input: {
      file_path: path.join(root, '.claude', 'settings.json'),
      content: '{}'
    }
  };
  const blocked = invoke(guard, input, { cwd: root });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /protected Pauli Cloud policy file/);

  const approval = await approveAction(root, {
    type: 'consequential_agent_action',
    scope: '.claude/settings.json'
  });
  const allowed = invoke(guard, input, {
    cwd: root,
    env: { PAULI_CLOUD_APPROVAL_ID: approval.approval_id }
  });
  assert.equal(allowed.status, 0);
});

test('generated Stop hook blocks unsafe stop once and avoids recursive blocking', async () => {
  const root = await fixture();
  const gate = path.join(root, '.pauli-cloud', 'generated', 'phase-gate.mjs');
  const p = projectPaths(root);
  const state = JSON.parse(await fs.readFile(p.state, 'utf8'));
  state.current_stage = 'IMPLEMENT';
  await fs.writeFile(p.state, `${JSON.stringify(state, null, 2)}\n`);

  const blocked = invoke(gate, {
    cwd: root,
    hook_event_name: 'Stop',
    stop_hook_active: false
  }, { cwd: root });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /not at a verified or resumable checkpoint/);

  const recursive = invoke(gate, {
    cwd: root,
    hook_event_name: 'Stop',
    stop_hook_active: true
  }, { cwd: root });
  assert.equal(recursive.status, 0);
});

test('uninstall refuses post-install drift unless force is explicit', async () => {
  const root = await fixture();
  const contract = path.join(root, '.claude', 'rules', 'pauli-cloud-zte.md');
  await fs.appendFile(contract, '\nuser changed this after installation\n');

  const blocked = await uninstallPolicy(root);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.conflicts.some((item) =>
    item.path === '.claude/rules/pauli-cloud-zte.md' &&
    item.reason === 'post_install_drift'
  ));
  assert.equal(await fs.stat(contract).then(() => true), true);

  const forced = await uninstallPolicy(root, { force: true });
  assert.equal(forced.ok, true);
  await assert.rejects(() => fs.stat(contract), { code: 'ENOENT' });
});
