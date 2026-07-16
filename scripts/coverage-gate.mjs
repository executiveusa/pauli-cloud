import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--experimental-test-coverage', '--test'],
  { encoding: 'utf8' }
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.status !== 0) process.exit(result.status ?? 1);

const threshold = Number(process.env.PAULI_CLOUD_COVERAGE_THRESHOLD ?? 80);
const lines = (result.stdout ?? '').split('\n');
const failures = [];
let inSource = false;
for (const line of lines) {
  if (/^# src\s+\|/.test(line)) {
    inSource = true;
    continue;
  }
  if (inSource && /^# test\s+\|/.test(line)) break;
  if (!inSource) continue;
  const match = line.match(/^#\s+([^|]+?)\s+\|\s+([0-9.]+)\s+\|/);
  if (!match || !match[1].trim().endsWith('.mjs')) continue;
  const coverage = Number(match[2]);
  if (coverage < threshold) failures.push(`${match[1].trim()}: ${coverage}%`);
}
if (failures.length) {
  console.error(`Coverage gate failed; required ${threshold}% line coverage:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Coverage gate passed: every source module is at least ${threshold}% line coverage.`);
