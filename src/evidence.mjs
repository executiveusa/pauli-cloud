import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { exists, readJson } from './core.mjs';
import { projectPaths } from './project.mjs';

function validTime(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export async function currentPhaseContext(root) {
  const p = projectPaths(root);
  const state = await readJson(p.state);
  let phaseStartedAt = null;

  if (await exists(p.ledger)) {
    const lines = (await fs.readFile(p.ledger, 'utf8')).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (
          event.type === 'phase.started' &&
          event.bead_id === state.bead_id &&
          event.phase === state.current_phase &&
          validTime(event.at) !== null
        ) {
          if (phaseStartedAt === null || Date.parse(event.at) > Date.parse(phaseStartedAt)) {
            phaseStartedAt = event.at;
          }
        }
      } catch {
        // Integrity validation reports malformed ledger records. Gates fail closed below.
      }
    }
  }

  return {
    state,
    phase_started_at: phaseStartedAt
  };
}

export function evidenceMatchesCurrentPhase(context, evidence) {
  const startedAt = validTime(context.phase_started_at);
  const verifiedAt = validTime(evidence?.verified_at);
  return Boolean(
    evidence?.ok === true &&
    ['enterprise', 'project'].includes(evidence?.verification_profile) &&
    typeof evidence?.verification_id === 'string' &&
    evidence.verification_id.length > 0 &&
    context.state?.bead_id &&
    evidence.bead_id === context.state.bead_id &&
    context.state?.current_phase &&
    evidence.phase === context.state.current_phase &&
    evidence.phase_started_at === context.phase_started_at &&
    startedAt !== null &&
    verifiedAt !== null &&
    verifiedAt >= startedAt
  );
}

export function verificationBinding(context) {
  return {
    verification_id: `ver_${randomUUID().replaceAll('-', '')}`,
    bead_id: context.state?.bead_id ?? null,
    phase: context.state?.current_phase ?? null,
    phase_started_at: context.phase_started_at
  };
}
