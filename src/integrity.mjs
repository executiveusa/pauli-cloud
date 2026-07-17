import path from 'node:path';
import * as legacy from './integrity-legacy.mjs';
import { now, writeJsonAtomic } from './core.mjs';
import { projectPaths } from './project.mjs';
import { currentPhaseContext, verificationBinding } from './evidence.mjs';

export * from './integrity-legacy.mjs';

export async function enterpriseVerify(root) {
  const result = await legacy.enterpriseDoctor(root);
  const p = projectPaths(root);
  const context = await currentPhaseContext(root);
  const evidence = path.join(p.evidence, 'latest.json');
  await writeJsonAtomic(evidence, {
    schema_version: '1.0.0',
    verified_at: now(),
    verification_profile: 'enterprise',
    ...verificationBinding(context),
    root,
    ...result
  });
  return {
    ...result,
    summary: `${result.summary} Evidence: ${evidence}`,
    evidence
  };
}
