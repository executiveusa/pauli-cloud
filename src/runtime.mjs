import path from 'node:path';
import * as legacy from './runtime-legacy.mjs';
import { readJson } from './core.mjs';
import { projectPaths } from './project.mjs';
import { currentPhaseContext, evidenceMatchesCurrentPhase } from './evidence.mjs';

export * from './runtime-legacy.mjs';

export async function phaseAdvance(root, options = {}) {
  const p = projectPaths(root);
  const state = await readJson(p.state);
  const entersCommit = options.to === 'COMMIT' || (
    options.to == null && state.current_stage === 'VERIFY'
  );

  if (entersCommit) {
    const context = await currentPhaseContext(root);
    const evidence = await readJson(path.join(p.evidence, 'latest.json'), { ok: false });
    if (!evidenceMatchesCurrentPhase(context, evidence)) {
      throw new Error('cannot enter COMMIT without passing verification evidence bound to the current phase');
    }
  }

  return legacy.phaseAdvance(root, options);
}
