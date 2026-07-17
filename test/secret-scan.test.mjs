import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scanner = path.resolve('scripts/secret-scan.mjs');

async function repository() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pauli-cloud-secret-scan-'));
  spawnSync('git', ['init', '-b', 'agent/work'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  return root;
}

function scan(root, report) {
  return spawnSync(process.execPath, [scanner], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PAULI_CLOUD_SCAN_REPORT: report
    }
  });
}

test('secret scan allows explicit environment references', async () => {
  const root = await repository();
  await fs.writeFile(
    path.join(root, 'safe.mjs'),
    'const token = process.env.SERVICE_TOKEN;\n'
  );
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'safe'], { cwd: root });
  const report = path.join(root, 'artifacts', 'report.json');
  const result = scan(root, report);
  assert.equal(result.status, 0);
  const evidence = JSON.parse(await fs.readFile(report, 'utf8'));
  assert.equal(evidence.finding_count, 0);
});

test('secret scan blocks literals and suppresses the value', async () => {
  const root = await repository();
  const literal = 'actual-super-secret-value'; // pauli-cloud: allow-secret-fixture
  await fs.writeFile(path.join(root, 'unsafe.env'), `api_key=${literal}\n`);
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'unsafe'], { cwd: root });
  const report = path.join(root, 'artifacts', 'report.json');
  const result = scan(root, report);
  assert.equal(result.status, 1);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(literal));
  const evidence = JSON.parse(await fs.readFile(report, 'utf8'));
  assert.deepEqual(evidence.findings, [{ file: 'unsafe.env', line: 1 }]);
  assert.equal(JSON.stringify(evidence).includes(literal), false);
});
