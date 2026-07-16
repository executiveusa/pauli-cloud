import fs from 'node:fs/promises';
import path from 'node:path';
import {
  exists,
  now,
  readJson,
  safeName,
  sha256,
  writeJsonAtomic,
  writeTextAtomic
} from './core.mjs';
import { projectPaths } from './project.mjs';

function parseVersion(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error('version must use semantic versioning: X.Y.Z');
  }
  return value;
}

function compareVersion(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export async function registerPrompt(root, {
  id,
  version,
  file,
  status = 'experiment',
  model = 'generic'
} = {}) {
  if (!id || !version || !file) throw new Error('id, version, and file are required');
  if (!['canonical', 'adapter', 'experiment'].includes(status)) {
    throw new Error('invalid prompt status');
  }
  const p = projectPaths(root);
  const safeId = safeName(id);
  parseVersion(version);
  const source = path.resolve(file);
  const content = await fs.readFile(source, 'utf8');
  if (!content.trim()) throw new Error('prompt is empty');
  const registry = await readJson(p.registry);
  if ((registry.prompts ?? []).some((item) => item.id === safeId && item.version === version)) {
    throw new Error(`prompt ${safeId}@${version} already exists`);
  }
  const relative = `${status}/${safeId}/${version}.md`;
  const target = path.join(path.dirname(p.registry), relative);
  await writeTextAtomic(target, content);
  const entry = {
    id: safeId,
    version,
    path: relative,
    sha256: sha256(content),
    status,
    model,
    created_at: now(),
    immutable: status === 'canonical'
  };
  registry.prompts.push(entry);
  registry.prompts.sort((a, b) =>
    a.id.localeCompare(b.id) || compareVersion(a.version, b.version)
  );
  await writeJsonAtomic(p.registry, registry);
  return {
    ok: true,
    summary: `Prompt ${safeId}@${version} registered as ${status}.`,
    prompt: entry
  };
}

export async function verifyPrompts(root) {
  const p = projectPaths(root);
  const registry = await readJson(p.registry);
  const checks = [];
  for (const item of registry.prompts ?? []) {
    const file = path.join(path.dirname(p.registry), item.path);
    const present = await exists(file);
    let actual = null;
    if (present) actual = sha256(await fs.readFile(file));
    checks.push({
      name: `${item.id}@${item.version}`,
      ok: present && actual === item.sha256,
      detail: present ? (actual === item.sha256 ? 'verified' : 'hash mismatch') : 'missing'
    });
  }
  const ok = checks.every((item) => item.ok);
  return {
    ok,
    summary: ok ? `${checks.length} prompts verified.` : 'Prompt verification failed.',
    checks
  };
}

export async function recordPromptRun(root, {
  id,
  version,
  model = 'unknown',
  score = null,
  baselineScore = null,
  passed = false,
  notes = ''
} = {}) {
  if (!id || !version) throw new Error('id and version are required');
  const p = projectPaths(root);
  const registry = await readJson(p.registry);
  const prompt = registry.prompts.find((item) =>
    item.id === safeName(id) && item.version === version
  );
  if (!prompt) throw new Error('prompt version not found');
  const record = {
    schema_version: '1.0.0',
    run_id: `run_${Date.now().toString(36)}`,
    prompt_id: prompt.id,
    version,
    model,
    score,
    baseline_score: baselineScore,
    passed: Boolean(passed),
    notes,
    recorded_at: now()
  };
  const file = path.join(p.base, 'prompts', 'runs', `${record.run_id}.json`);
  await writeJsonAtomic(file, record);
  return {
    ok: true,
    summary: `Prompt run ${record.run_id} recorded.`,
    run: record,
    path: file
  };
}

export async function promotePrompt(root, { id, version } = {}) {
  const p = projectPaths(root);
  const registry = await readJson(p.registry);
  const safeId = safeName(id);
  const prompt = registry.prompts.find((item) =>
    item.id === safeId && item.version === version
  );
  if (!prompt) throw new Error('prompt version not found');
  if (prompt.status !== 'experiment') throw new Error('only experiments may be promoted');

  const runDir = path.join(p.base, 'prompts', 'runs');
  const runs = [];
  if (await exists(runDir)) {
    for (const name of await fs.readdir(runDir)) {
      if (!name.endsWith('.json')) continue;
      const run = await readJson(path.join(runDir, name));
      if (run.prompt_id === safeId && run.version === version) runs.push(run);
    }
  }
  const passing = runs.filter((run) =>
    run.passed &&
    typeof run.score === 'number' &&
    typeof run.baseline_score === 'number' &&
    run.score >= run.baseline_score
  );
  if (!passing.length) {
    throw new Error('promotion requires a passing measured run with score >= baseline');
  }
  const current = registry.prompts
    .filter((item) => item.id === safeId && item.status === 'canonical')
    .sort((a, b) => compareVersion(b.version, a.version))[0];
  if (current && compareVersion(version, current.version) <= 0) {
    throw new Error('promoted version must be newer than the current canonical version');
  }
  prompt.status = 'canonical';
  prompt.immutable = true;
  prompt.promoted_at = now();
  prompt.promotion_run_id = passing
    .sort((a, b) =>
      (b.score - b.baseline_score) - (a.score - a.baseline_score)
    )[0].run_id;
  await writeJsonAtomic(p.registry, registry);
  const learning = {
    prompt_id: safeId,
    version,
    promoted_at: prompt.promoted_at,
    run_id: prompt.promotion_run_id,
    lesson: 'Measured experiment met or exceeded its baseline and was promoted.'
  };
  await writeJsonAtomic(
    path.join(p.base, 'prompts', 'learnings', `${safeId}-${version}.json`),
    learning
  );
  return {
    ok: true,
    summary: `Prompt ${safeId}@${version} promoted to canonical.`,
    prompt
  };
}
