#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const positional = args.slice(1).filter((arg) => !arg.startsWith('--'));
const root = path.resolve(positional[0] ?? '.');
const json = flags.has('--json');
const force = flags.has('--force');
const optionValue = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return fallback;
};
const assignedBranch = optionValue('assigned-branch');
const agentName = optionValue('agent', 'generic');
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `Pauli Cloud\n\nUsage:\n  pauli-cloud init [directory] [--force]\n  pauli-cloud doctor [directory] [--json]\n  pauli-cloud verify [directory] [--json]\n  pauli-cloud status [directory] [--json]\n  pauli-cloud inspect [directory] [--agent=name] [--assigned-branch=name] [--json]\n`;

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

function run(commandName, commandArgs = [], options = {}) {
  const result = spawnSync(commandName, commandArgs, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    env: options.env ?? process.env,
    shell: false
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim()
  };
}

async function findInstructionFiles(projectRoot) {
  const candidates = [
    'AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md', 'CONTRIBUTING.md', 'SECURITY.md',
    '.github/copilot-instructions.md', '.cursorrules', 'GEMINI.md'
  ];
  const found = [];
  for (const candidate of candidates) {
    if (await exists(path.join(projectRoot, candidate))) found.push(candidate);
  }
  const rulesDir = path.join(projectRoot, '.claude', 'rules');
  if (await exists(rulesDir)) {
    const queue = [rulesDir];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(entryPath);
        else if (entry.name.endsWith('.md')) found.push(path.relative(projectRoot, entryPath));
      }
    }
  }
  return found.sort();
}

async function inspect(projectRoot) {
  const p = paths(projectRoot);
  if (!await exists(p.config)) await init(projectRoot);
  const config = JSON.parse(await fs.readFile(p.config, 'utf8'));
  const gitRootResult = run('git', ['rev-parse', '--show-toplevel'], { cwd: projectRoot });
  const isGit = gitRootResult.ok;
  const currentBranch = isGit ? run('git', ['branch', '--show-current'], { cwd: projectRoot }).stdout || null : null;
  const remote = isGit ? run('git', ['remote', 'get-url', 'origin'], { cwd: projectRoot }).stdout || null : null;
  const dirty = isGit ? Boolean(run('git', ['status', '--porcelain'], { cwd: projectRoot }).stdout) : null;
  const recentCommits = isGit
    ? run('git', ['log', '-5', '--pretty=format:%H|%s'], { cwd: projectRoot }).stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, ...message] = line.split('|');
          return { sha, message: message.join('|') };
        })
    : [];
  let defaultBranch = null;
  if (isGit) {
    const symbolic = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: projectRoot });
    if (symbolic.ok) defaultBranch = symbolic.stdout.replace(/^origin\//, '');
  }

  const toolNames = ['git', 'gh', 'node', 'npm', 'pnpm', 'yarn', 'bun', 'docker', 'npx', 'claude'];
  const tools = {};
  for (const tool of toolNames) {
    const probe = run(tool, ['--version'], { cwd: projectRoot });
    tools[tool] = {
      available: probe.ok,
      version: probe.ok ? probe.stdout.split('\n')[0] : null
    };
  }

  const lockfiles = {
    npm: await exists(path.join(projectRoot, 'package-lock.json')),
    pnpm: await exists(path.join(projectRoot, 'pnpm-lock.yaml')),
    yarn: await exists(path.join(projectRoot, 'yarn.lock')),
    bun: await exists(path.join(projectRoot, 'bun.lockb')) || await exists(path.join(projectRoot, 'bun.lock'))
  };
  let packageScripts = {};
  if (await exists(path.join(projectRoot, 'package.json'))) {
    try {
      packageScripts = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')).scripts ?? {};
    } catch {}
  }
  const browser = {
    playwright: await exists(path.join(projectRoot, 'playwright.config.ts')) ||
      await exists(path.join(projectRoot, 'playwright.config.js')) ||
      await exists(path.join(projectRoot, 'playwright.config.mjs')),
    cypress: await exists(path.join(projectRoot, 'cypress.config.ts')) ||
      await exists(path.join(projectRoot, 'cypress.config.js')),
    agent_browser_config: await exists(path.join(projectRoot, 'agent-browser.json'))
  };
  const ci = {
    github_actions: await exists(path.join(projectRoot, '.github', 'workflows'))
  };
  const deployment = {
    vercel: await exists(path.join(projectRoot, 'vercel.json')),
    dockerfile: await exists(path.join(projectRoot, 'Dockerfile')),
    compose: await exists(path.join(projectRoot, 'docker-compose.yml')) ||
      await exists(path.join(projectRoot, 'compose.yml')) ||
      await exists(path.join(projectRoot, 'compose.yaml')),
    railway: await exists(path.join(projectRoot, 'railway.json')) ||
      await exists(path.join(projectRoot, 'railway.toml'))
  };
  const instructions = await findInstructionFiles(projectRoot);
  const effectiveBranch = assignedBranch ?? currentBranch;
  const constraints = [];

  if (!isGit) {
    constraints.push({
      type: 'MISSING',
      id: 'git_repository',
      blocks: ['commit', 'push', 'pull_request'],
      detail: 'Directory is not a Git repository.'
    });
  }
  if (assignedBranch && currentBranch && assignedBranch !== currentBranch) {
    constraints.push({
      type: 'HARD',
      id: 'assigned_branch_conflict',
      blocks: ['mutation'],
      detail: `Session assigned ${assignedBranch}, current branch is ${currentBranch}. Adopt the assigned branch before mutation.`
    });
  }
  if (effectiveBranch && config.protected_branches.includes(effectiveBranch)) {
    constraints.push({
      type: 'HARD',
      id: 'protected_branch',
      blocks: ['commit', 'push'],
      detail: `${effectiveBranch} is protected.`
    });
  }
  if (!tools.gh.available) {
    constraints.push({
      type: 'MISSING',
      id: 'github_cli',
      blocks: ['remote_checkpoint', 'pull_request'],
      detail: 'GitHub CLI is unavailable; local work may continue but remote checkpointing requires another authenticated GitHub path.'
    });
  }
  if (!Object.values(browser).some(Boolean)) {
    constraints.push({
      type: 'MISSING',
      id: 'browser_harness',
      blocks: ['browser_verification'],
      detail: 'No supported browser-test configuration detected.'
    });
  }
  const activeLockfiles = Object.entries(lockfiles)
    .filter(([, present]) => present)
    .map(([name]) => name);
  if (activeLockfiles.length > 1) {
    constraints.push({
      type: 'POLICY',
      id: 'multiple_package_managers',
      blocks: ['dependency_mutation'],
      detail: `Multiple lockfiles detected: ${activeLockfiles.join(', ')}.`
    });
  }

  const capabilities = {
    schema_version: '1.0.0',
    inspected_at: new Date().toISOString(),
    agent: agentName,
    repository: {
      root: isGit ? gitRootResult.stdout : projectRoot,
      is_git: isGit,
      current_branch: currentBranch,
      assigned_branch: assignedBranch,
      effective_branch: effectiveBranch,
      default_branch: defaultBranch,
      remote,
      dirty,
      recent_commits: recentCommits
    },
    tools,
    package: { lockfiles, scripts: packageScripts },
    browser,
    ci,
    deployment,
    instruction_files: instructions
  };

  await fs.writeFile(
    path.join(p.base, 'capabilities.json'),
    `${JSON.stringify(capabilities, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(p.base, 'constraints.json'),
    `${JSON.stringify({ schema_version: '1.0.0', constraints }, null, 2)}\n`,
    'utf8'
  );

  const state = JSON.parse(await fs.readFile(p.state, 'utf8'));
  state.branch = effectiveBranch;
  state.blockers = constraints
    .filter((item) => item.type === 'HARD')
    .map((item) => item.id);
  state.next_exact_action = state.blockers.length
    ? `Resolve hard constraints: ${state.blockers.join(', ')}.`
    : 'Create a bounded phase plan from the detected capabilities, then run deterministic gates.';
  await fs.writeFile(p.state, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const adapterPath = path.join(p.base, 'adapters', `${agentName}.runtime.md`);
  await fs.writeFile(
    adapterPath,
    `# Runtime Adapter: ${agentName}\n\nEffective branch: ${effectiveBranch ?? 'unassigned'}\n\nHard blockers: ${state.blockers.length ? state.blockers.join(', ') : 'none'}\n\nNext action: ${state.next_exact_action}\n`,
    'utf8'
  );

  return {
    ok: state.blockers.length === 0,
    summary: state.blockers.length
      ? `Inspection completed with hard blockers: ${state.blockers.join(', ')}.`
      : `Inspection passed for ${agentName} on ${effectiveBranch ?? 'no branch'}.`,
    checks: constraints.map((item) => ({
      name: item.id,
      ok: item.type !== 'HARD',
      detail: `${item.type}: ${item.detail}`
    })),
    capabilities: path.join(p.base, 'capabilities.json'),
    constraints: path.join(p.base, 'constraints.json'),
    adapter: adapterPath
  };
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
  await fs.writeFile(
    evidencePath,
    `${JSON.stringify({
      schema_version: '1.0.0',
      verified_at: new Date().toISOString(),
      root: projectRoot,
      ...result
    }, null, 2)}\n`
  );
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
  else if (command === 'inspect') display(await inspect(root));
  else if (['help', '--help', '-h'].includes(command)) console.log(HELP);
  else throw new Error(`unknown command: ${command}\n\n${HELP}`);
} catch (error) {
  console.error(`pauli-cloud: ${error.message}`);
  process.exitCode = 1;
}
