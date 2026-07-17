import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as legacy from './project-legacy.mjs';
import { exists, now, readJson, writeJsonAtomic } from './core.mjs';

export * from './project-legacy.mjs';

async function phaseBinding(root) {
  const p = legacy.projectPaths(root);
  const state = await readJson(p.state);
  let phaseStartedAt = null;
  if (await exists(p.ledger)) {
    for (const line of (await fs.readFile(p.ledger, 'utf8')).split('\n').filter(Boolean)) {
      try {
        const event = JSON.parse(line);
        if (
          event.type === 'phase.started' &&
          event.bead_id === state.bead_id &&
          event.phase === state.current_phase &&
          Number.isFinite(Date.parse(event.at))
        ) {
          if (phaseStartedAt === null || Date.parse(event.at) > Date.parse(phaseStartedAt)) {
            phaseStartedAt = event.at;
          }
        }
      } catch {
        // The enterprise doctor reports malformed audit events. Evidence stays unbound.
      }
    }
  }
  return { state, phaseStartedAt };
}

export async function verifyProject(root) {
  const result = await legacy.doctorProject(root);
  const p = legacy.projectPaths(root);
  const binding = await phaseBinding(root);
  const evidence = path.join(p.evidence, 'latest.json');
  await writeJsonAtomic(evidence, {
    schema_version: '1.0.0',
    verified_at: now(),
    verification_profile: 'project',
    verification_id: `ver_${randomUUID().replaceAll('-', '')}`,
    bead_id: binding.state.bead_id ?? null,
    phase: binding.state.current_phase ?? null,
    phase_started_at: binding.phaseStartedAt,
    root,
    ...result
  });
  return {
    ...result,
    summary: `${result.summary} Evidence: ${evidence}`,
    evidence
  };
}
