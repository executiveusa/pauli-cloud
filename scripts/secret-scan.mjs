import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (tracked.status !== 0) {
  console.error('Secret scan requires a Git worktree.');
  process.exit(1);
}

const exemptions = new Set([
  'src/policy.mjs',
  'scripts/secret-scan.mjs'
]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"'${}]{8,}/i
];
const findings = [];
for (const file of tracked.stdout.split('\0').filter(Boolean)) {
  if (exemptions.has(file)) continue;
  let content;
  try {
    content = await fs.readFile(file, 'utf8');
  } catch {
    continue;
  }
  if (content.includes('\0')) continue;
  content.split('\n').forEach((line, index) => {
    if (line.includes('pauli-cloud: allow-secret-fixture')) return;
    if (patterns.some((pattern) => pattern.test(line))) {
      findings.push({ file, line: index + 1 });
    }
  });
}
if (findings.length) {
  for (const finding of findings) {
    console.error(`Potential secret: ${finding.file}:${finding.line} (value suppressed)`);
  }
  process.exit(1);
}
console.log(`Secret scan passed: ${tracked.stdout.split('\0').filter(Boolean).length} tracked files checked.`);
