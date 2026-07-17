import fs from 'node:fs/promises';
import path from 'node:path';
import {
  exists,
  now,
  readJson,
  sha256,
  writeJsonAtomic
} from './core.mjs';
import { doctorProject, projectPaths } from './project.mjs';

const VALID_STAGES = new Set([
  'CONTEXT',
  'PLAN',
  'IMPLEMENT',
  'TEST',
  'GUARDIAN',
  'VERIFY',
  'COMMIT',
  'PUSH',
  'COMPLETE',
  'BLOCKED',
  'FAILED'
]);
const VALID_APPROVAL_TYPES = new Set([
  'production',
  'irreversible',
  'financial',
  'consequential_agent_action'
]);

async function managedFileChecks(root, p) {
  const manifest = await readJson(path.join(p.base, 'install-manifest.json'), null);
  if (!manifest) {
    return [{
      name: 'managed policy installation',
      ok: true,
      detail: 'not installed'
    }];
  }
  const checks = [];
  const paths = new Set();
  for (const item of manifest.files ?? []) {
    if (!item.path || paths.has(item.path)) {
      checks.push({
        name: `managed file ${item.path ?? 'unknown'}`,
        ok: false,
        detail: 'duplicate or missing manifest path'
      });
      continue;
    }
    paths.add(item.path);
    const target = path.join(root, item.path);
    const present = await exists(target);
    const actual = present ? sha256(await fs.readFile(target)) : null;
    checks.push({
      name: `managed file ${item.path}`,
      ok: present && actual === item.after_sha256,
      detail: !present ? 'missing' : actual === item.after_sha256 ? 'verified' : 'post-install drift'
    });
    if (item.backup) {
      checks.push({
        name: `backup ${item.path}`,
        ok: await exists(path.join(root, item.backup)),
        detail: item.backup
      });
    }
  }
  return checks;
}

async function approvalChecks(p) {
  const registry = await readJson(p.approvals, { approvals: [] });
  const ids = new Set();
  const checks = [];
  for (const item of registry.approvals ?? []) {
    const unique = Boolean(item.id) && !ids.has(item.id);
    ids.add(item.id);
    const validType = VALID_APPROVAL_TYPES.has(item.type);
    const validStatus = ['approved', 'revoked', 'consumed'].includes(item.status);
    const validExpiry = !item.expires_at || Number.isFinite(Date.parse(item.expires_at));
    checks.push({
      name: `approval ${item.id ?? 'unknown'}`,
      ok: unique && validType && validStatus && validExpiry,
      detail: unique && validType && validStatus && validExpiry
        ? (item.expires_at && Date.parse(item.expires_at) <= Date.now() ? 'valid but expired' : 'valid')
        : 'invalid approval record'
    });
  }
  if (!checks.length) {
    checks.push({ name: 'approval registry', ok: true, detail: 'empty' });
  }
  return checks;
}

async function ledgerChecks(p) {
  if (!await exists(p.ledger)) {
    return [{ name: 'audit ledger', ok: true, detail: 'empty' }];
  }
  const ids = new Set();
  let lines = 0;
  let invalid = 0;
  for (const line of (await fs.readFile(p.ledger, 'utf8')).split('\n').filter(Boolean)) {
    lines += 1;
    try {
      const event = JSON.parse(line);
      const valid =
        event.schema_version === '1.0.0' &&
        typeof event.event_id === 'string' &&
        !ids.has(event.event_id) &&
        typeof event.type === 'string' &&
        Number.isFinite(Date.parse(event.at));
      if (!valid) invalid += 1;
      ids.add(event.event_id);
    } catch {
      invalid += 1;
    }
  }
  return [{
    name: 'audit ledger',
    ok: invalid === 0,
    detail: `${lines} events, ${invalid} invalid`
  }];
}

async function registryChecks(p) {
  const registry = await readJson(p.registry);
  const identities = new Set();
  let duplicate = null;
  for (const item of registry.prompts ?? []) {
    const identity = `${item.id}@${item.version}`;
    if (identities.has(identity)) {
      duplicate = identity;
      break;
    }
    identities.add(identity);
  }
  return [{
    name: 'prompt registry identities',
    ok: duplicate === null,
    detail: duplicate ? `duplicate ${duplicate}` : `${identities.size} unique`
  }];
}

async function stateChecks(p) {
  const state = await readJson(p.state);
  const validCommit = state.last_commit === null || /^[0-9a-f]{40}$/.test(state.last_commit);
  return [{
    name: 'active state semantics',
    ok: VALID_STAGES.has(state.current_stage) && validCommit && Array.isArray(state.blockers),
    detail: `${state.current_phase}:${state.current_stage}`
  }];
}

export async function enterpriseDoctor(root) {
  const base = await doctorProject(root);
  if (!base.ok) return base;
  const p = projectPaths(root);
  const checks = [
    ...base.checks,
    ...await managedFileChecks(root, p),
    ...await approvalChecks(p),
    ...await ledgerChecks(p),
    ...await registryChecks(p),
    ...await stateChecks(p)
  ];
  const ok = checks.every((item) => item.ok);
  return {
    ok,
    summary: ok
      ? 'Pauli Cloud enterprise doctor passed.'
      : 'Pauli Cloud enterprise doctor found blocking integrity issues.',
    checks
  };
}

export async function enterpriseVerify(root) {
  const result = await enterpriseDoctor(root);
  const p = projectPaths(root);
  const evidence = path.join(p.evidence, 'latest.json');
  await writeJsonAtomic(evidence, {
    schema_version: '1.0.0',
    verified_at: now(),
    verification_profile: 'enterprise',
    root,
    ...result
  });
  return {
    ...result,
    summary: `${result.summary} Evidence: ${evidence}`,
    evidence
  };
}
