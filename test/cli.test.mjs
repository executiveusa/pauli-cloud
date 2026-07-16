import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import {
  initProject,
  inspectProject,
  doctorProject,
  verifyProject,
  projectPaths
} from '../src/project.mjs';
import {
  compilePolicy,
  uninstallPolicy,
  evaluateGuard,
  approveAction
} from '../src/policy.mjs';
import {
  phaseStart,
  phaseAdvance,
  phaseBlock,
  phaseFail,
  checkpoint,
  fleetAdd,
  fleetList,
  fleetRemove,
  dailyReport
} from '../src/runtime.mjs';
import {
  registerPrompt,
  recordPromptRun,
  promotePrompt,
  verifyPrompts
} from '../src/prompts.mjs';
import { startServer } from '../src/server.mjs';

const packageRoot = path.resolve('.');

async function fixture(branch = 'agent/work') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-'));
  spawnSync('git', ['init', '-b', branch], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'fixture\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: root });
  await initProject(root, packageRoot);
  return root;
}

function request(port, pathName, token = null, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathName,
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        body: data,
        headers: res.headers
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('initialization is idempotent and doctor verifies prompt integrity', async () => {
  const root = await fixture();
  const second = await initProject(root, packageRoot);
  assert.equal(second.created, 0);
  assert.equal((await doctorProject(root)).ok, true);
  assert.equal((await verifyProject(root)).ok, true);
});

test('inspect adopts assigned branch and scopes optional gaps', async () => {
  const root = await fixture('agent/current');
  const result = await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/current'
  });
  assert.equal(result.ok, true);
  const p = projectPaths(root);
  const constraints = JSON.parse(
    await fs.readFile(path.join(p.base, 'constraints.json'), 'utf8')
  );
  assert.ok(constraints.constraints.some((item) =>
    item.id === 'browser_harness' && item.blocks.length === 1
  ));
});

test('inspect blocks assigned branch conflicts', async () => {
  const root = await fixture('agent/current');
  const result = await inspectProject(root, packageRoot, {
    assignedBranch: 'agent/required'
  });
  assert.equal(result.ok, false);
  assert.match(result.summary, /assigned_branch_conflict/);
});

test('policy compile is idempotent and preserves user-authored files', async () => {
  const root = await fixture();
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/work'
  });
  await fs.mkdir(path.join(root, '.claude', 'rules'), { recursive: true });
  await fs.writeFile(path.join(root, '.claude', 'rules', 'custom.md'), 'human rule\n');
  const first = await compilePolicy(root, { agent: 'claude-code' });
  assert.equal(first.ok, true);
  assert.ok(first.changes.length > 0);
  const second = await compilePolicy(root, { agent: 'claude-code' });
  assert.equal(second.changes.length, 0);
  assert.equal(
    await fs.readFile(path.join(root, '.claude', 'rules', 'custom.md'), 'utf8'),
    'human rule\n'
  );
});

test('Claude settings are merged, backed up, and restored', async () => {
  const root = await fixture();
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/work'
  });
  await fs.mkdir(path.join(root, '.claude'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { PreToolUse: [] } }, null, 2)
  );
  await compilePolicy(root, { agent: 'claude-code' });
  const merged = JSON.parse(
    await fs.readFile(path.join(root, '.claude', 'settings.json'), 'utf8')
  );
  assert.deepEqual(merged.permissions, { allow: ['Read'] });
  assert.ok(merged.hooks.PreToolUse.length > 0);
  await uninstallPolicy(root);
  const restored = JSON.parse(
    await fs.readFile(path.join(root, '.claude', 'settings.json'), 'utf8')
  );
  assert.deepEqual(restored, {
    permissions: { allow: ['Read'] },
    hooks: { PreToolUse: [] }
  });
});

test('policy compile reports conflict instead of overwriting a user file', async () => {
  const root = await fixture();
  await inspectProject(root, packageRoot, {
    agent: 'claude-code',
    assignedBranch: 'agent/work'
  });
  await fs.mkdir(path.join(root, '.claude', 'rules'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.claude', 'rules', 'pauli-cloud-zte.md'),
    'human content'
  );
  const result = await compilePolicy(root, { agent: 'claude-code' });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some((item) =>
    item.path === '.claude/rules/pauli-cloud-zte.md'
  ));
  assert.equal(
    await fs.readFile(path.join(root, '.claude', 'rules', 'pauli-cloud-zte.md'), 'utf8'),
    'human content'
  );
});

test('uninstall removes managed files and leaves user files', async () => {
  const root = await fixture();
  await inspectProject(root, packageRoot, {
    agent: 'generic',
    assignedBranch: 'agent/work'
  });
  await fs.writeFile(path.join(root, 'USER.md'), 'keep');
  await compilePolicy(root, { agent: 'generic' });
  const result = await uninstallPolicy(root);
  assert.equal(result.ok, true);
  assert.equal(await fs.readFile(path.join(root, 'USER.md'), 'utf8'), 'keep');
});

test('guards block protected branches and suppress likely secret values', async () => {
  const root = await fixture();
  const protectedResult = await evaluateGuard(root, {
    action: 'push',
    branch: 'main'
  });
  assert.equal(protectedResult.code, 'PROTECTED_BRANCH');
  const secret = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
  const secretResult = await evaluateGuard(root, {
    action: 'command',
    value: `echo ${secret}`
  });
  assert.equal(secretResult.code, 'SECRET_GUARD');
  assert.doesNotMatch(secretResult.summary, new RegExp(secret));
});

test('destructive commands require a scoped approval', async () => {
  const root = await fixture();
  const blocked = await evaluateGuard(root, {
    action: 'command',
    value: 'git reset --hard'
  });
  assert.equal(blocked.code, 'IRREVERSIBILITY_GUARD');
  const approval = await approveAction(root, { type: 'irreversible' });
  const allowed = await evaluateGuard(root, {
    action: 'command',
    value: 'git reset --hard',
    approval: approval.approval_id
  });
  assert.equal(allowed.ok, true);
});

test('phase state machine enforces ordered transitions and evidence gate', async () => {
  const root = await fixture();
  await phaseStart(root, {
    phase: 'policy',
    branch: 'agent/work',
    beadId: 'ZTE-TEST-0001'
  });
  for (const stage of ['PLAN', 'IMPLEMENT', 'TEST', 'GUARDIAN', 'VERIFY']) {
    await phaseAdvance(root, { to: stage });
  }
  await assert.rejects(
    () => phaseAdvance(root, { to: 'COMMIT' }),
    /passing verification evidence/
  );
  await verifyProject(root);
  const committed = await phaseAdvance(root, { to: 'COMMIT' });
  assert.equal(committed.state.current_stage, 'COMMIT');
  await assert.rejects(
    () => phaseAdvance(root, { to: 'COMPLETE' }),
    /invalid transition/
  );
});

test('phase blocking and loop guard preserve exact recovery state', async () => {
  const root = await fixture();
  await phaseStart(root, { phase: 'test' });
  const blocked = await phaseBlock(root, { reason: 'credential_gate' });
  assert.equal(blocked.state.current_stage, 'BLOCKED');
  assert.deepEqual(blocked.state.blockers, ['credential_gate']);
  await phaseStart(root, { phase: 'test' });
  const failed = await phaseFail(root, {
    reason: 'same failure',
    attempt: 3
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.state.current_stage, 'FAILED');
});

test('Git checkpoint requires exact remote branch SHA', async () => {
  const root = await fixture('agent/work');
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-bare-'));
  spawnSync('git', ['init', '--bare'], { cwd: remote });
  spawnSync('git', ['remote', 'add', 'origin', remote], { cwd: root });
  spawnSync('git', ['push', '-u', 'origin', 'agent/work'], { cwd: root });
  const result = await checkpoint(root, { pr: 'https://example.test/pr/1' });
  assert.equal(result.ok, true);
  assert.equal(result.local_sha, result.remote_sha);
});

test('prompt promotion requires measured improvement and canonical storage', async () => {
  const root = await fixture();
  const promptFile = path.join(root, 'candidate.md');
  await fs.writeFile(promptFile, 'candidate prompt');
  await registerPrompt(root, {
    id: 'builder',
    version: '1.0.0',
    file: promptFile,
    status: 'experiment'
  });
  await assert.rejects(
    () => promotePrompt(root, { id: 'builder', version: '1.0.0' }),
    /passing measured run/
  );
  await recordPromptRun(root, {
    id: 'builder',
    version: '1.0.0',
    score: 0.9,
    baselineScore: 0.8,
    passed: true,
    model: 'test'
  });
  const result = await promotePrompt(root, {
    id: 'builder',
    version: '1.0.0'
  });
  assert.equal(result.prompt.status, 'canonical');
  assert.match(result.prompt.path, /^canonical\//);
  assert.equal(
    await fs.readFile(
      path.join(root, '.pauli-cloud', 'prompts', result.prompt.path),
      'utf8'
    ),
    'candidate prompt'
  );
  assert.equal((await verifyPrompts(root)).ok, true);
});

test('prompt registry rejects secrets and invalid evaluation scores', async () => {
  const root = await fixture();
  const secretPrompt = path.join(root, 'secret-prompt.md');
  await fs.writeFile(secretPrompt, 'Use sk-proj-abcdefghijklmnopqrstuvwxyz123456');
  await assert.rejects(
    () => registerPrompt(root, {
      id: 'unsafe',
      version: '1.0.0',
      file: secretPrompt
    }),
    /likely secret/
  );
  const promptFile = path.join(root, 'safe-prompt.md');
  await fs.writeFile(promptFile, 'safe prompt');
  await registerPrompt(root, {
    id: 'safe',
    version: '1.0.0',
    file: promptFile
  });
  await assert.rejects(
    () => recordPromptRun(root, {
      id: 'safe',
      version: '1.0.0',
      score: 2,
      baselineScore: 0.5,
      passed: true
    }),
    /0 to 1/
  );
});

test('fleet validates Git roots and daily report detects corrupt ledger lines', async () => {
  const root = await fixture();
  const invalid = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-not-git-'));
  await assert.rejects(
    () => fleetAdd(root, { name: 'Invalid', repoPath: invalid }),
    /Git repository/
  );
  await fleetAdd(root, { name: 'Example Repo', repoPath: root });
  let list = await fleetList(root);
  assert.equal(list.repositories.length, 1);
  await fleetRemove(root, { name: 'Example Repo' });
  list = await fleetList(root);
  assert.equal(list.repositories.length, 0);
  const p = projectPaths(root);
  await fs.appendFile(p.ledger, '{invalid-json}\n');
  const report = await dailyReport(root);
  assert.equal(report.ok, false);
  assert.equal(report.report.corrupted_event_lines, 1);
});

test('service requires token, rate limits callers, and hides internal errors', async () => {
  const root = await fixture();
  await assert.rejects(
    () => startServer(root, { host: '0.0.0.0', port: 0, token: null }),
    /API_TOKEN/
  );
  const token = 'test-token';
  const service = await startServer(root, {
    host: '127.0.0.1',
    port: 0,
    token,
    rateLimit: 20
  });
  const port = service.server.address().port;
  try {
    const health = await request(port, '/healthz');
    assert.equal(health.status, 200);
    const method = await request(port, '/healthz', null, 'POST');
    assert.equal(method.status, 405);
    assert.equal(method.headers.allow, 'GET');
    const denied = await request(port, '/v1/status', 'wrong-token');
    assert.equal(denied.status, 401);
    const status = await request(port, '/v1/status', token);
    assert.equal(status.status, 200);
    assert.match(status.headers['cache-control'], /no-store/);
    assert.equal(status.headers['x-frame-options'], 'DENY');
    const metrics = await request(port, '/metrics');
    assert.equal(metrics.status, 200);
    assert.match(metrics.body, /pauli_cloud_rate_limited_total/);

    const p = projectPaths(root);
    await fs.writeFile(p.state, '{not-json}');
    const internal = await request(port, '/v1/status', token);
    assert.equal(internal.status, 500);
    assert.deepEqual(JSON.parse(internal.body), { error: 'internal_error' });
  } finally {
    await new Promise((resolve) => service.server.close(resolve));
  }

  const limitedService = await startServer(root, {
    host: '127.0.0.1',
    port: 0,
    token,
    rateLimit: 1
  });
  const limitedPort = limitedService.server.address().port;
  try {
    assert.equal((await request(limitedPort, '/healthz')).status, 200);
    const limited = await request(limitedPort, '/healthz');
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers['retry-after']) >= 1);
  } finally {
    await new Promise((resolve) => limitedService.server.close(resolve));
  }
});
