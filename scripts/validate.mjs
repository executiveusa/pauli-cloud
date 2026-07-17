import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function collect(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target));
    else if (entry.name.endsWith('.mjs')) files.push(target);
  }
  return files;
}

const files = [
  ...await collect('bin'),
  ...await collect('src'),
  ...await collect('scripts'),
  ...await collect('test')
];
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}
if (failed) process.exit(1);
console.log(`Syntax verified: ${files.length} modules`);
