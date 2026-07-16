#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const positional = args.slice(1).filter((arg) => !arg.startsWith('--'));
const root = path.resolve(positional[0] ?? '.');
const json = flags.has('--json');
const force = flags.has('--force');
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `Pauli Cloud\n\nUsage:\n  pauli-cloud init [directory] [--force]\n  pauli-cloud doctor [directory] [--json]\n  pauli-cloud verify [directory] [--json]\n  pauli-cloud status [directory] [--json]\n`;

const requiredIcm = ['CONTEXT.md', 'INPUTS.md', 'PROCESS.md', 'OUTPUTS.md', 'DECISIONS.md', 'QA_CHECKLIST.md', 'STATUS.json'];

function paths(projectRoot) {
  const base = path.join(projectRoot, '.pauli-cloud');
  return {
    base,
    config: path.join(base, 'config.json'),
    state: path.join(base, 'state', 'ACTIVE_BUILD_STATE.json'),
    registry: path.join(base, 'prompts', 'registry.json'),
    prompt: path.join(base, 'prompts', 'canonical', 'ZTE_AI_NATIVE_MASTER_PROMPT.md'),
    icm: path.join(base, 'icm', '00_context'),
    evidence: path.join(base, 'evidence')
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeSafe(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (!force && await exists(filePath)) return false;
  await fs.writeFile(filePath, content, 'utf8');
  return true;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function init(projectRoot) {
  const p = paths(projectRoot);
  const prompt = await fs.readFile(path.join(packageRoot, 'prompts', 'ZTE_AI_NATIVE_MASTER_PROMPT.md'), 'utf8');
  const config = {
    schema_version: '1.0.0',
    project_name: path.basename(projectRoot),
    mode: 'resumable_verified_loop',
    protected_branches: ['main', 'master', 'develop'],
    retry_limit: 3,
    phase_checkpoint: {
      require_tests: true,
      require_commit: true,
      require_push: true,
      require_remote_sha_match: true,
      require_pr_update: true
    },
    approvals: {
      production: true,
      irreversible: true,
      financial: true,
      consequential_agent_actions: true
    },
    prompt_policy: {
      canonical_immutable: true,
      require_sha256: true,
      experiments_separate: true
    }
  };
  const state = {
    schema_version: '1.0.0',
    bead_id: null,
    branch: null,
    draft_pr: null,
    last_complete_phase: null,
    last_commit: null,
    remote_sha_verified: false,
    current_phase: '00_context',
    current_stage: 'CONTEXT',
    acceptance_remaining: [],
    blockers: [],
    credentials_needed: [],
    next_exact_action: 'Run pauli-cloud doctor, then record repository truth.',
    resume_validation_commands: ['pauli-cloud doctor .', 'pauli-cloud verify .']
  };
  const registry = {
    schema_version: '1.0.0',
    prompts: [{
      id: 'zte-ai-native-master',
      version: '3.0.0',
      path: 'canonical/ZTE_AI_NATIVE_MASTER_PROMPT.md',
      sha256: sha256(prompt),
      status: 'canonical'
    }]
  };
  const files = new Map([
    [p.config, `${JSON.stringify(config, null, 2)}\n`],
    [p.state, `${JSON.stringify(state, null, 2)}\n`],
    [p.prompt, prompt],
    [p.registry, `${JSON.stringify(registry, null, 2)}\n`],
    [path.join(p.base, 'adapters', 'generic.md'), '# Generic Adapter\n\nAdopt session constraints. Execute resumable verified phases. Preserve evidence and approvals.\n'],
    [path.join(p.base, 'adapters', 'claude-code.md'), '# Claude Code Adapter\n\nSession constraints outrank repository prompts. Stay on the assigned branch. Use resumable phase checkpoints and never promise background execution.\n'],
    [path.join(p.base, 'adapters', 'codex.md'), '# Codex Adapter\n\nRead AGENTS.md. Use the assigned branch or worktree, deterministic tests, Git checkpoints, and explicit approvals.\n'],
    [path.join(p.icm, 'CONTEXT.md'), '# Context\n\nRecord repository truth, session constraints, branch, tools, providers, and validation state.\n'],
    [path.join(p.icm, 'INPUTS.md'), '# Inputs\n\nList authoritative requirements, files, external dependencies, and evidence.\n'],
    [path.join(p.icm, 'PROCESS.md'), '# Process\n\nCONTEXT → SPECIFY → IMPLEMENT → TEST → ATTACK → FIX → VERIFY → ICM → LEARN → COMMIT → PUSH.\n'],
    [path.join(p.icm, 'OUTPUTS.md'), '# Outputs\n\nList code, evidence, reports, commits, pull requests, and rollback artifacts.\n'],
    [path.join(p.icm, 'DECISIONS.md'), '# Decisions\n\nRecord concise architecture and instruction-precedence decisions.\n'],
    [path.join(p.icm, 'QA_CHECKLIST.md'), '# QA Checklist\n\n- [ ] Context loaded\n- [ ] Acceptance criteria binary\n- [ ] Tests pass\n- [ ] Guardian review passes\n- [ ] Evidence recorded\n- [ ] Git checkpoint verified\n'],
    [path.join(p.icm, 'STATUS.json'), `${JSON.stringify({ stage: 'PENDING', updated_at: null, blockers: [] }, null, 2)}\n`],
    [path.join(p.icm, 'output', '.gitkeep'), ''],
    [path.join(p.evidence, '.gitkeep'), '']
  ]);

  let created = 0;
  for (const [filePath, content] of files) {
    if (await writeSafe(filePath, content)) created += 1;
  }
  return {
    ok: true,
    summary: `Pauli Cloud initialized at ${p.base} (${created} files created).`,
    created,
    base: p.base
  };
}

async function doctor(projectRoot) {
  const p = paths(projectRoot);
  const checks = [];
  const check = async (name, filePath) => checks.push({ name, ok: await exists(filePath), detail: filePath });

  await check('config', p.config);
  await check('active build state', p.state);
  await check('prompt registry', p.registry);
  await check('canonical ZTE prompt', p.prompt);
  for (const file of requiredIcm) await check(`ICM ${file}`, path.join(p.icm, file));

  if (checks.every((item) => item.ok)) {
    try {
      const config = JSON.parse(await fs.readFile(p.config, 'utf8'));
      checks.push({
        name: 'configuration contract',
        ok: Array.isArray(config.protected_branches) && config.retry_limit === 3,
        detail: 'protected branches and retry limit'
      });

      const state = JSON.parse(await fs.readFile(p.state, 'utf8'));
      checks.push({
        name: 'resumable state contract',
        ok: typeof state.current_stage === 'string' && Array.isArray(state.blockers),
        detail: state.current_stage
      });

      const registry = JSON.parse(await fs.readFile(p.registry, 'utf8'));
      let hashesOk = true;
      let detail = `${registry.prompts?.length ?? 0} verified`;
      for (const item of registry.prompts ?? []) {
        const actual = sha256(await fs.readFile(path.join(path.dirname(p.registry), item.path)));
        if (actual !== item.sha256) {
          hashesOk = false;
          detail = `${item.id} hash mismatch`;
          break;
        }
      }
      checks.push({ name: 'canonical prompt hashes', ok: hashesOk, detail });
    } catch (error) {
      checks.push({ name: 'configuration parsing', ok: false, detail: error.message });
    }
  }

  const ok = checks.every((item) => item.ok);
  return {
    ok,
    summary: ok ? 'Pauli Cloud doctor passed.' : 'Pauli Cloud doctor found blocking issues.',
    checks
  };
}

async function verify(projectRoot) {
  const result = await doctor(projectRoot);
  const p = paths(projectRoot);
  await fs.mkdir(p.evidence, { recursive: true });
  const evidencePath = path.join(p.evidence, 'latest.json');
  await fs.writeFile(evidencePath, `${JSON.stringify({
    schema_version: '1.0.0',
    verified_at: new Date().toISOString(),
    root: projectRoot,
    ...result
  }, null, 2)}\n`);
  return {
    ...result,
    summary: `${result.summary} Evidence: ${evidencePath}`,
    evidence: evidencePath
  };
}

async function status(projectRoot) {
  const p = paths(projectRoot);
  if (!await exists(p.state)) {
    return {
      ok: false,
      summary: 'Pauli Cloud is not initialized. Run: pauli-cloud init .',
      checks: []
    };
  }
  const state = JSON.parse(await fs.readFile(p.state, 'utf8'));
  return {
    ok: true,
    summary: `Phase ${state.current_phase} | Stage ${state.current_stage} | Branch ${state.branch ?? 'unassigned'} | Blockers ${state.blockers.length}`,
    state,
    checks: []
  };
}

function display(result) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.summary);
    for (const item of result.checks ?? []) {
      console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    }
  }
  if (!result.ok) process.exitCode = 1;
}

try {
  if (command === 'init') display(await init(root));
  else if (command === 'doctor') display(await doctor(root));
  else if (command === 'verify') display(await verify(root));
  else if (command === 'status') display(await status(root));
  else if (['help', '--help', '-h'].includes(command)) console.log(HELP);
  else throw new Error(`unknown command: ${command}\n\n${HELP}`);
} catch (error) {
  console.error(`pauli-cloud: ${error.message}`);
  process.exitCode = 1;
}
