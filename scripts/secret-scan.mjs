import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (tracked.status !== 0) {
  console.error('Secret scan requires a Git worktree.');
  process.exit(1);
}

const exemptions = new Set([
  'src/policy.mjs',
  'scripts/secret-scan.mjs',
  'test/cli.test.mjs'
]);
const directPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/
];
const assignmentPattern = /(?:^|[\s,{"'])([A-Za-z0-9_]*(?:password|passwd|secret|api[_-]?key|token)[A-Za-z0-9_]*)\s*[:=]\s*["']?([^\s"',}]+)/i;
const placeholderPattern = /^(?:\$\{|<|example|test|fake|dummy|placeholder|load-from|use-a|ci-only|none|null|redacted|changeme)/i;
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
    let detected = directPatterns.some((pattern) => pattern.test(line));
    const assignment = line.match(assignmentPattern);
    if (assignment) {
      const value = assignment[2];
      if (value.length >= 8 && !placeholderPattern.test(value)) detected = true;
    }
    if (detected) findings.push({ file, line: index + 1 });
  });
}

if (findings.length) {
  for (const finding of findings) {
    console.error(`Potential secret: ${finding.file}:${finding.line} (value suppressed)`);
  }
  process.exit(1);
}
console.log(`Secret scan passed: ${tracked.stdout.split('\0').filter(Boolean).length} tracked files checked.`);
