import fs from 'node:fs/promises';
import path from 'node:path';
import * as legacy from './policy-legacy.mjs';
import {
  ensureDir,
  exists,
  readJson,
  sha256,
  writeJsonAtomic,
  writeTextAtomic
} from './core.mjs';
import { projectPaths } from './project.mjs';
import { currentPhaseContext, evidenceMatchesCurrentPhase } from './evidence.mjs';

export * from './policy-legacy.mjs';

const GUARD_PATH = '.pauli-cloud/generated/guard.mjs';
const APPROVAL_FUNCTION = /function activeApproval\(type\)\{[\s\S]*?\n\}/;

function managedPath(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) {
    throw new Error('managed path must be a non-empty relative path');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('managed path escapes repository root');
  }
  return resolved;
}

async function guardIsHardened(root) {
  const target = path.join(root, GUARD_PATH);
  if (!await exists(target)) return false;
  const source = await fs.readFile(target, 'utf8');
  return (
    source.includes("activeApproval(type,scope='project')") &&
    source.includes("activeApproval('consequential_agent_action',relativePath)")
  );
}

async function hardenGeneratedGuard(root) {
  const p = projectPaths(root);
  const target = path.join(root, GUARD_PATH);
  if (!await exists(target)) return;

  const source = await fs.readFile(target, 'utf8');
  const scopedFunction = `function activeApproval(type,scope='project'){
  const id=process.env.PAULI_CLOUD_APPROVAL_ID || '';
  const file=path.join(cwd,'.pauli-cloud','approvals','registry.json');
  try{
    const registry=JSON.parse(fs.readFileSync(file,'utf8'));
    return (registry.approvals||[]).some((item)=>item.id===id && item.type===type && item.status==='approved' && (item.scope==='project' || item.scope===scope) && (!item.expires_at || Date.parse(item.expires_at)>Date.now()));
  }catch{return false;}
}`;
  let hardened = source.replace(APPROVAL_FUNCTION, scopedFunction);
  hardened = hardened.replace(
    "&& !activeApproval('consequential_agent_action'))",
    "&& !activeApproval('consequential_agent_action',relativePath))"
  );

  const alreadyHardened =
    source.includes("activeApproval(type,scope='project')") &&
    source.includes("activeApproval('consequential_agent_action',relativePath)");
  if (hardened === source) {
    if (!alreadyHardened) throw new Error('generated guard template is incompatible with scope enforcement');
    return;
  }

  await writeTextAtomic(target, hardened, 0o700);
  const manifestPath = path.join(p.base, 'install-manifest.json');
  const manifest = await readJson(manifestPath, null);
  if (manifest) {
    const entry = manifest.files?.find((item) => item.path === GUARD_PATH);
    if (!entry) throw new Error('generated guard is missing from the install manifest');
    entry.after_sha256 = sha256(hardened);
    await writeJsonAtomic(manifestPath, manifest);
  }
}

export async function compilePolicy(root, options = {}) {
  const alreadyHardened = await guardIsHardened(root);
  if (alreadyHardened && !options.dryRun) {
    const preview = await legacy.compilePolicy(root, { ...options, dryRun: true });
    const scopeOnlyDrift =
      preview.ok &&
      (preview.changes ?? []).every((item) => item.path === GUARD_PATH);
    if (scopeOnlyDrift) {
      return {
        ...preview,
        changes: [],
        dry_run: Boolean(options.dryRun),
        summary: `Policy compile ${options.dryRun ? 'previewed' : 'completed'}: 0 changes, 0 conflicts.`
      };
    }
  }

  const result = await legacy.compilePolicy(root, options);
  if (!options.dryRun && result.ok) await hardenGeneratedGuard(root);
  return result;
}

export async function evaluateGuard(root, options = {}) {
  if (options.action !== 'phase-commit') return legacy.evaluateGuard(root, options);

  const p = projectPaths(root);
  const context = await currentPhaseContext(root);
  const evidence = await readJson(path.join(p.evidence, 'latest.json'), { ok: false });
  const allowedStage = ['VERIFY', 'COMMIT', 'PUSH', 'COMPLETE'].includes(
    context.state.current_stage
  );
  if (!allowedStage || !evidenceMatchesCurrentPhase(context, evidence)) {
    return {
      ok: false,
      code: 'PHASE_GATE',
      summary: 'Blocked: phase lacks current phase-bound verification evidence.'
    };
  }
  return {
    ok: true,
    code: 'ALLOW',
    summary: 'Policy allows the requested action.'
  };
}

export async function uninstallPolicy(root, { dryRun = false, force = false } = {}) {
  const p = projectPaths(root);
  const manifestPath = path.join(p.base, 'install-manifest.json');
  const manifest = await readJson(manifestPath, null);
  if (!manifest) {
    return {
      ok: true,
      summary: 'No managed installation found.',
      changes: [],
      conflicts: []
    };
  }

  const entries = [...(manifest.files ?? [])].reverse();
  const conflicts = [];
  const prepared = [];

  for (const item of entries) {
    let target;
    try {
      target = managedPath(root, item.path);
    } catch {
      conflicts.push({ path: item.path ?? 'unknown', reason: 'invalid_managed_path' });
      continue;
    }
    const present = await exists(target);
    const currentHash = present ? sha256(await fs.readFile(target)) : null;
    if (!force && present && item.after_sha256 && currentHash !== item.after_sha256) {
      conflicts.push({ path: item.path, reason: 'post_install_drift' });
    }

    let backup = null;
    if (item.backup) {
      try {
        backup = managedPath(root, item.backup);
      } catch {
        conflicts.push({ path: item.path, reason: 'invalid_backup_path' });
      }
      if (backup && !await exists(backup)) {
        conflicts.push({ path: item.path, reason: 'missing_backup' });
      }
    }
    prepared.push({ item, target, present, backup });
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      summary: `Policy uninstall blocked before mutation: ${conflicts.length} conflicts.`,
      changes: [],
      conflicts,
      dry_run: dryRun
    };
  }

  const changes = prepared
    .filter(({ item, present }) => item.backup || (item.created && present))
    .map(({ item }) => ({
      path: item.path,
      action: item.backup ? 'restore' : 'delete'
    }));

  if (dryRun) {
    return {
      ok: true,
      summary: `Policy uninstall previewed: ${changes.length} changes, 0 conflicts.`,
      changes,
      conflicts: [],
      dry_run: true
    };
  }

  const journalRoot = path.join(p.base, 'tmp', `uninstall-${Date.now()}`);
  const journal = [];
  try {
    await ensureDir(journalRoot);
    for (const [index, entry] of prepared.entries()) {
      const snapshot = path.join(journalRoot, `${index}.bak`);
      if (entry.present) await fs.copyFile(entry.target, snapshot);
      journal.push({
        target: entry.target,
        present: entry.present,
        snapshot
      });
    }

    for (const entry of prepared) {
      if (entry.backup) {
        await ensureDir(path.dirname(entry.target));
        await fs.copyFile(entry.backup, entry.target);
      } else if (entry.item.created && await exists(entry.target)) {
        await fs.rm(entry.target, { force: true });
      }
    }

    await fs.rm(manifestPath, { force: true });
    await fs.rm(journalRoot, { recursive: true, force: true });
    return {
      ok: true,
      summary: `Policy uninstall completed: ${changes.length} changes, 0 conflicts.`,
      changes,
      conflicts: [],
      dry_run: false
    };
  } catch {
    for (const entry of [...journal].reverse()) {
      if (entry.present) {
        await ensureDir(path.dirname(entry.target));
        await fs.copyFile(entry.snapshot, entry.target);
      } else {
        await fs.rm(entry.target, { force: true });
      }
    }
    await fs.rm(journalRoot, { recursive: true, force: true });
    return {
      ok: false,
      summary: 'Policy uninstall failed and restored the pre-uninstall state.',
      changes: [],
      conflicts: [{ path: '*', reason: 'mutation_failed_rolled_back' }],
      dry_run: false
    };
  }
}
