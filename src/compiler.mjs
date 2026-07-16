import {
  compilePolicy as applyPolicy,
  uninstallPolicy
} from './policy.mjs';

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

  if (requestedDryRun) return preview;

  if ((preview.conflicts ?? []).length > 0) {
    return {
      ...preview,
      ok: false,
      dry_run: false,
      applied: false,
      summary: `Policy compile blocked before mutation: ${preview.conflicts.length} conflicts.`
    };
  }

  const applied = await applyPolicy(root, {
    ...options,
    dryRun: false
  });
  return {
    ...applied,
    applied: applied.ok === true
  };
}

export { uninstallPolicy };
