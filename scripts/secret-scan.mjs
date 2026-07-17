import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const excludedDirectories = new Set([
  '.git',
  '.pauli-cloud',
  'node_modules',
  'coverage',
  'workspace'
]);

async function collectFiles(root = '.') {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(target));
    else files.push(target.replace(/^\.\//, ''));
  }
  return files;
}

const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
const files = tracked.status === 0
  ? tracked.stdout.split('\0').filter(Boolean)
  : await collectFiles('.');

const exemptions = new Set([
  'src/policy.mjs',
  'src/policy-legacy.mjs',
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
const referencePattern = /^(?:process\.env\.|Deno\.env\.|Bun\.env\.|env\.|os\.environ|secrets\.|vault:|secret:|ref:)/i;
const findings = [];

for (const file of files) {
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
      const safeReference = placeholderPattern.test(value) || referencePattern.test(value);
      if (value.length >= 8 && !safeReference) detected = true;
    }
    if (detected) findings.push({ file, line: index + 1 });
  });
}

const reportPath = process.env.PAULI_CLOUD_SCAN_REPORT;
if (reportPath) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify({
    schema_version: '1.0.0',
    files_checked: files.length,
    finding_count: findings.length,
    findings
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

if (findings.length) {
  for (const finding of findings) {
    console.error(`Potential secret: ${finding.file}:${finding.line} (value suppressed)`);
  }
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} files checked.`);
