import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  appendJsonLine,
  now,
  readJson,
  run,
  safeName,
  writeJsonAtomic,
  exists
} from './core.mjs';
import { projectPaths } from './project.mjs';

const ORDER = [
  'CONTEXT',
  'PLAN',
  'IMPLEMENT',
  'TEST',
  'GUARDIAN',
  'VERIFY',
  'COMMIT',
  'PUSH',
  'COMPLETE'
];

function nextStage(current) {
  const index = ORDER.indexOf(current);
  return index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null;
}

async function event(root, type, data = {}) {
  const p = projectPaths(root);
  await appendJsonLine(p.ledger, {
    schema_version: '1.0.0',
    event_id: `evt_${randomUUID().replaceAll('-', '')}`,
    type,
    at: now(),
    ...data
  });
}

export async function phaseStart(root, { phase, beadId = null, branch = null } = {}) {
  if (!phase) throw new Error('phase is required');
  const p = projectPaths(root);
  const state = await readJson(p.state);
  const normalizedPhase = safeName(phase);
  if (
    state.current_stage &&
    !['COMPLETE', 'BLOCKED', 'FAILED', 'CONTEXT'].includes(state.current_stage) &&
    state.current_phase !== normalizedPhase
  ) {
    throw new Error(`phase ${state.current_phase} is still ${state.current_stage}`);
  }
  state.bead_id = beadId ?? state.bead_id ??
    `ZTE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now() % 10000).padStart(4, '0')}`;
  state.branch = branch ?? state.branch;
  state.current_phase = normalizedPhase;
  state.current_stage = 'CONTEXT';
  state.blockers = [];
  state.acceptance_remaining = [];
  state.next_exact_action = 'Write the bounded phase plan and binary acceptance criteria.';
  await writeJsonAtomic(p.state, state);
  await event(root, 'phase.started', {
    bead_id: state.bead_id,
    phase: state.current_phase,
    branch: state.branch
  });
  return {
    ok: true,
    summary: `Phase ${state.current_phase} started.`,
    state
  };
}

export async function phaseAdvance(root, { to = null, note = null } = {}) {
  const p = projectPaths(root);
  const state = await readJson(p.state);
  const target = to ?? nextStage(state.current_stage);
  if (!target || !ORDER.includes(target)) throw new Error(`invalid target stage: ${target}`);
  const currentIndex = ORDER.indexOf(state.current_stage);
  const targetIndex = ORDER.indexOf(target);
  if (targetIndex !== currentIndex + 1) {
    throw new Error(`invalid transition ${state.current_stage} → ${target}`);
  }
  if (target === 'COMMIT') {
    const evidence = await readJson(path.join(p.evidence, 'latest.json'), { ok: false });
    if (!evidence.ok) throw new Error('cannot enter COMMIT without passing verification evidence');
  }
  state.current_stage = target;
  state.next_exact_action = target === 'COMPLETE'
    ? 'Select the next highest-priority phase.'
    : `Execute ${target} and record evidence.`;
  await writeJsonAtomic(p.state, state);
  await event(root, 'phase.advanced', {
    bead_id: state.bead_id,
    phase: state.current_phase,
    stage: target,
    note
  });
  return {
    ok: true,
    summary: `Phase ${state.current_phase} advanced to ${target}.`,
    state
  };
}

export async function phaseBlock(root, { reason } = {}) {
  if (!reason) throw new Error('reason is required');
  const p = projectPaths(root);
  const state = await readJson(p.state);
  state.current_stage = 'BLOCKED';
  state.blockers = [...new Set([...state.blockers, reason])];
  state.next_exact_action = `Resolve blocker: ${reason}`;
  await writeJsonAtomic(p.state, state);
  await event(root, 'phase.blocked', {
    bead_id: state.bead_id,
    phase: state.current_phase,
    reason
  });
  return {
    ok: false,
    summary: `Phase blocked: ${reason}`,
    state
  };
}

export async function phaseFail(root, { reason, attempt = 1 } = {}) {
  if (!reason) throw new Error('reason is required');
  const p = projectPaths(root);
  const state = await readJson(p.state);
  state.current_stage = attempt >= 3 ? 'FAILED' : 'IMPLEMENT';
  state.next_exact_action = attempt >= 3
    ? 'Invoke LOOP_GUARD and preserve a minimal reproduction.'
    : 'Apply the smallest root-cause fix and rerun the failed gate.';
  await writeJsonAtomic(p.state, state);
  await event(root, 'phase.failed', {
    bead_id: state.bead_id,
    phase: state.current_phase,
    reason,
    attempt,
    loop_guard: attempt >= 3
  });
  return {
    ok: attempt < 3,
    summary: attempt >= 3
      ? `LOOP_GUARD: ${reason}`
      : `Failure recorded; retry ${attempt}/3.`,
    state
  };
}

export async function checkpoint(root, { pr = null } = {}) {
  const p = projectPaths(root);
  const state = await readJson(p.state);
  const branch = run('git', ['branch', '--show-current'], { cwd: root });
  const local = run('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (!branch.ok || !branch.stdout || !local.ok) throw new Error('Git checkpoint unavailable');
  const remote = run('git', ['ls-remote', 'origin', `refs/heads/${branch.stdout}`], { cwd: root });
  const remoteSha = remote.ok && remote.stdout ? remote.stdout.split(/\s+/)[0] : null;
  const matches = Boolean(remoteSha && remoteSha === local.stdout);
  state.branch = branch.stdout;
  state.last_commit = local.stdout;
  state.remote_sha_verified = matches;
  if (pr) state.draft_pr = pr;
  state.next_exact_action = matches
    ? 'Update PR ledger and advance the next phase.'
    : 'Push the current branch and re-run checkpoint.';
  await writeJsonAtomic(p.state, state);
  await event(root, 'git.checkpoint', {
    bead_id: state.bead_id,
    phase: state.current_phase,
    branch: branch.stdout,
    local_sha: local.stdout,
    remote_sha: remoteSha,
    verified: matches,
    pr
  });
  return {
    ok: matches,
    summary: matches
      ? 'Remote SHA matches local checkpoint.'
      : 'Remote SHA does not match local checkpoint.',
    branch: branch.stdout,
    local_sha: local.stdout,
    remote_sha: remoteSha,
    verified: matches
  };
}

export async function fleetAdd(root, {
  name,
  repoPath,
  remote = null,
  owner = null
} = {}) {
  if (!name || !repoPath) throw new Error('name and repo path are required');
  const p = projectPaths(root);
  const resolved = path.resolve(repoPath);
  if (!await exists(resolved)) throw new Error('repository path does not exist');
  const realRoot = await fs.realpath(resolved);
  const gitRoot = run('git', ['rev-parse', '--show-toplevel'], { cwd: realRoot });
  if (!gitRoot.ok) throw new Error('fleet entry must be a Git repository');
  const fleet = await readJson(p.fleet, { schema_version: '1.0.0', repositories: [] });
  const id = safeName(name);
  const record = {
    id,
    name,
    root: gitRoot.stdout,
    remote,
    owner,
    status: 'registered',
    added_at: now(),
    last_seen_at: now()
  };
  const index = fleet.repositories.findIndex((item) => item.id === id);
  if (index >= 0) {
    fleet.repositories[index] = {
      ...fleet.repositories[index],
      ...record,
      added_at: fleet.repositories[index].added_at
    };
  } else {
    fleet.repositories.push(record);
  }
  await writeJsonAtomic(p.fleet, fleet);
  await event(root, 'fleet.repository.upserted', {
    repository_id: id,
    repo_root: record.root
  });
  return {
    ok: true,
    summary: `Repository ${id} registered.`,
    repository: record
  };
}

export async function fleetList(root) {
  const p = projectPaths(root);
  const fleet = await readJson(p.fleet, { schema_version: '1.0.0', repositories: [] });
  return {
    ok: true,
    summary: `${fleet.repositories.length} repositories registered.`,
    repositories: fleet.repositories
  };
}

export async function fleetRemove(root, { name } = {}) {
  const p = projectPaths(root);
  const fleet = await readJson(p.fleet, { schema_version: '1.0.0', repositories: [] });
  const id = safeName(name);
  const before = fleet.repositories.length;
  fleet.repositories = fleet.repositories.filter((item) => item.id !== id);
  await writeJsonAtomic(p.fleet, fleet);
  await event(root, 'fleet.repository.removed', { repository_id: id });
  return {
    ok: true,
    summary: before === fleet.repositories.length
      ? `Repository ${id} was not registered.`
      : `Repository ${id} removed.`
  };
}

export async function dailyReport(root) {
  const p = projectPaths(root);
  const events = [];
  let corruptedEventLines = 0;
  if (await exists(p.ledger)) {
    for (const line of (await fs.readFile(p.ledger, 'utf8')).split('\n').filter(Boolean)) {
      try {
        events.push(JSON.parse(line));
      } catch {
        corruptedEventLines += 1;
      }
    }
  }
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = events.filter((item) => Date.parse(item.at) >= since);
  const state = await readJson(p.state);
  const report = {
    schema_version: '1.0.0',
    generated_at: now(),
    period_hours: 24,
    event_count: recent.length,
    corrupted_event_lines: corruptedEventLines,
    event_types: Object.fromEntries(
      [...new Set(recent.map((item) => item.type))]
        .map((type) => [type, recent.filter((item) => item.type === type).length])
    ),
    current_phase: state.current_phase,
    current_stage: state.current_stage,
    blockers: state.blockers,
    next_exact_action: state.next_exact_action
  };
  const target = path.join(
    p.base,
    'reports',
    `daily-${new Date().toISOString().slice(0, 10)}.json`
  );
  await writeJsonAtomic(target, report);
  await appendJsonLine(p.outbox, {
    type: 'daily_report',
    created_at: now(),
    path: path.relative(root, target),
    status: 'pending'
  });
  return {
    ok: corruptedEventLines === 0,
    summary: corruptedEventLines === 0
      ? `Daily report written to ${target}.`
      : `Daily report written with ${corruptedEventLines} corrupt event lines detected.`,
    report,
    path: target
  };
}
