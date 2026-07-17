import fs from 'node:fs/promises';
import path from 'node:path';
import {
  compilePolicy as applyPolicy,
  uninstallPolicy
} from './policy.mjs';
import {
  exists,
  readJson,
  sha256,
  writeJsonAtomic,
  writeTextAtomic
} from './core.mjs';
import { projectPaths } from './project.mjs';

const DEFAULT_BRANCH_DECLARATION = "const protectedBranches = new Set(['main','master','develop']);";
const GUARD_PATH = '.pauli-cloud/generated/guard.mjs';

function configuredGuard(source, protectedBranches) {
  if (!source.includes(DEFAULT_BRANCH_DECLARATION)) {
    throw new Error('generated guard template is incompatible with the compiler');
  }
  return source.replace(
    DEFAULT_BRANCH_DECLARATION,
    `const protectedBranches = new Set(${JSON.stringify(protectedBranches)});`
  );
}

async function finalGuardContent(root, source = null) {
  const p = projectPaths(root);
  const config = await readJson(p.config);
  const base = source ?? await fs.readFile(path.join(root, GUARD_PATH), 'utf8');
  return configuredGuard(base, config.protected_branches);
}

async function currentGuardAlreadyFinal(root) {
  const target = path.join(root, GUARD_PATH);
  if (!await exists(target)) return false;
  const current = await fs.readFile(target, 'utf8');
  if (!current.includes('const protectedBranches = new Set(')) return false;
  const p = projectPaths(root);
  const config = await readJson(p.config);
  return current.includes(
    `const protectedBranches = new Set(${JSON.stringify(config.protected_branches)});`
  );
}

async function bindConfiguredBranches(root) {
  const p = projectPaths(root);
  const target = path.join(root, GUARD_PATH);
  const source = await fs.readFile(target, 'utf8');
  const final = await finalGuardContent(root, source);
  if (source !== final) await writeTextAtomic(target, final, 0o700);

  const manifestPath = path.join(p.base, 'install-manifest.json');
  const manifest = await readJson(manifestPath);
  const entry = manifest.files.find((item) => item.path === GUARD_PATH);
  if (!entry) throw new Error('generated guard is missing from the install manifest');
  entry.after_sha256 = sha256(final);
  await writeJsonAtomic(manifestPath, manifest);
}

/**
 * Compile policy transactionally.
 *
 * The policy engine's dry-run resolves every target, merge, and conflict
 * without writing. Only a conflict-free plan is applied. This prevents a
 * later conflict from leaving an earlier subset of generated controls behind.
 */
export async function compilePolicy(root, options = {}) {
  const requestedDryRun = Boolean(options.dryRun);
  const preview = await applyPolicy(root, {
    ...options,
    dryRun: true
  });

  if ((preview.conflicts ?? []).length > 0) {
    return {
      ...preview,
      ok: false,
      dry_run: requestedDryRun,
      applied: false,
      summary: `Policy compile blocked before mutation: ${preview.conflicts.length} conflicts.`
    };
  }

  const guardOnlyDrift =
    preview.changes?.length === 1 &&
    preview.changes[0].path === GUARD_PATH &&
    await currentGuardAlreadyFinal(root);

  if (guardOnlyDrift) {
    return {
      ...preview,
      ok: true,
      changes: [],
      applied: !requestedDryRun,
      summary: `Policy compile ${requestedDryRun ? 'previewed' : 'completed'}: 0 changes, 0 conflicts.`
    };
  }

  if (requestedDryRun) return preview;

  const applied = await applyPolicy(root, {
    ...options,
    dryRun: false
  });
  if (!applied.ok) {
    return {
      ...applied,
      applied: false
    };
  }

  await bindConfiguredBranches(root);
  return {
    ...applied,
    applied: true
  };
}

export { uninstallPolicy };
