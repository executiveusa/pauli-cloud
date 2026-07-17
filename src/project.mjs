import fs from 'node:fs/promises';
import path from 'node:path';
import {
  exists,
  ensureDir,
  sha256,
  readJson,
  writeJsonAtomic,
  writeTextAtomic,
  run,
  now
} from './core.mjs';

export const REQUIRED_ICM = [
  'CONTEXT.md',
  'INPUTS.md',
  'PROCESS.md',
  'OUTPUTS.md',
  'DECISIONS.md',
  'QA_CHECKLIST.md',
  'STATUS.json'
];

export function projectPaths(root) {
  const base = path.join(root, '.pauli-cloud');
  return {
    base,
    config: path.join(base, 'config.json'),
    state: path.join(base, 'state', 'ACTIVE_BUILD_STATE.json'),
    registry: path.join(base, 'prompts', 'registry.json'),
    canonicalPrompt: path.join(base, 'prompts', 'canonical', 'ZTE_AI_NATIVE_MASTER_PROMPT.md'),
    icm: path.join(base, 'icm', '00_context'),
    evidence: path.join(base, 'evidence'),
    ledger: path.join(base, 'ledger', 'events.ndjson'),
    approvals: path.join(base, 'approvals', 'registry.json'),
    fleet: path.join(base, 'fleet', 'repositories.json'),
    outbox: path.join(base, 'outbox', 'notifications.ndjson')
  };
}

async function writeManaged(filePath, content, force = false) {
  if (!force && await exists(filePath)) return false;
  await writeTextAtomic(filePath, content);
  return true;
}

export async function initProject(root, packageRoot, { force = false } = {}) {
  const p = projectPaths(root);
  const sourcePrompt = path.join(packageRoot, 'prompts', 'ZTE_AI_NATIVE_MASTER_PROMPT.md');
  const prompt = await fs.readFile(sourcePrompt, 'utf8');
  const config = {
    schema_version: '1.0.0',
    project_name: path.basename(root),
    mode: 'resumable_verified_loop',
    protected_branches: ['main', 'master', 'develop'],
    retry_limit: 3,
    checkpoint: {
      tests: true,
      commit: true,
      push: true,
      remote_sha_match: true,
      pr_update: true
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
    },
    service: {
      host: '127.0.0.1',
      port: 4317
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
    next_exact_action: 'Run pauli-cloud inspect, then create a bounded phase plan.',
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
    [p.canonicalPrompt, prompt],
    [p.registry, `${JSON.stringify(registry, null, 2)}\n`],
    [p.approvals, `${JSON.stringify({ schema_version: '1.0.0', approvals: [] }, null, 2)}\n`],
    [p.fleet, `${JSON.stringify({ schema_version: '1.0.0', repositories: [] }, null, 2)}\n`],
    [path.join(p.base, 'adapters', 'generic.md'), '# Generic Adapter\n\nAdopt session constraints. Execute resumable verified phases. Preserve evidence and approvals.\n'],
    [path.join(p.base, 'adapters', 'claude-code.md'), '# Claude Code Adapter\n\nSession constraints outrank repository prompts. Stay on the assigned branch. Use resumable phase checkpoints.\n'],
    [path.join(p.base, 'adapters', 'codex.md'), '# Codex Adapter\n\nRead AGENTS.md. Use the assigned branch or worktree, deterministic tests, Git checkpoints, and explicit approvals.\n'],
    [path.join(p.icm, 'CONTEXT.md'), '# Context\n\nRecord repository truth, session constraints, branch, tools, providers, and validation state.\n'],
    [path.join(p.icm, 'INPUTS.md'), '# Inputs\n\nList authoritative requirements, files, external dependencies, and evidence.\n'],
    [path.join(p.icm, 'PROCESS.md'), '# Process\n\nCONTEXT → SPECIFY → IMPLEMENT → TEST → ATTACK → FIX → VERIFY → ICM → LEARN → COMMIT → PUSH.\n'],
    [path.join(p.icm, 'OUTPUTS.md'), '# Outputs\n\nList code, evidence, reports, commits, pull requests, and rollback artifacts.\n'],
    [path.join(p.icm, 'DECISIONS.md'), '# Decisions\n\nRecord concise architecture and instruction-precedence decisions.\n'],
    [path.join(p.icm, 'QA_CHECKLIST.md'), '# QA Checklist\n\n- [ ] Context loaded\n- [ ] Acceptance criteria binary\n- [ ] Tests pass\n- [ ] Guardian review passes\n- [ ] Evidence recorded\n- [ ] Git checkpoint verified\n'],
    [path.join(p.icm, 'STATUS.json'), `${JSON.stringify({ stage: 'PENDING', updated_at: null, blockers: [] }, null, 2)}\n`],
    [path.join(p.icm, 'output', '.gitkeep'), ''],
    [path.join(p.evidence, '.gitkeep'), ''],
    [path.join(p.base, 'ledger', '.gitkeep'), ''],
    [path.join(p.base, 'outbox', '.gitkeep'), '']
  ]);

  let created = 0;
  for (const [file, content] of files) {
    if (await writeManaged(file, content, force)) created += 1;
  }
  return {
    ok: true,
    summary: `Pauli Cloud initialized at ${p.base} (${created} files created).`,
    created,
    base: p.base
  };
}

async function findInstructionFiles(root) {
  const candidates = [
    'AGENTS.md',
    'CLAUDE.md',
    'CLAUDE.local.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    '.github/copilot-instructions.md',
    '.cursorrules',
    'GEMINI.md'
  ];
  const found = [];
  for (const candidate of candidates) {
    if (await exists(path.join(root, candidate))) found.push(candidate);
  }
  for (const dirName of ['.claude/rules', '.codex']) {
    const dir = path.join(root, dirName);
    if (!await exists(dir)) continue;
    const queue = [dir];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(target);
        else if (entry.name.endsWith('.md')) found.push(path.relative(root, target));
      }
    }
  }
  return found.sort();
}

export async function inspectProject(root, packageRoot, { agent = 'generic', assignedBranch = null } = {}) {
  const p = projectPaths(root);
  if (!await exists(p.config)) await initProject(root, packageRoot);
  const config = await readJson(p.config);
  const gitRoot = run('git', ['rev-parse', '--show-toplevel'], { cwd: root });
  const isGit = gitRoot.ok;
  const currentBranch = isGit ? run('git', ['branch', '--show-current'], { cwd: root }).stdout || null : null;
  const remote = isGit ? run('git', ['remote', 'get-url', 'origin'], { cwd: root }).stdout || null : null;
  const dirty = isGit ? Boolean(run('git', ['status', '--porcelain'], { cwd: root }).stdout) : null;
  const recentCommits = isGit
    ? run('git', ['log', '-5', '--pretty=format:%H|%s'], { cwd: root }).stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, ...message] = line.split('|');
        return { sha, message: message.join('|') };
      })
    : [];
  let defaultBranch = null;
  if (isGit) {
    const symbolic = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: root });
    if (symbolic.ok) defaultBranch = symbolic.stdout.replace(/^origin\//, '');
  }

  const tools = {};
  for (const tool of ['git', 'gh', 'node', 'npm', 'pnpm', 'yarn', 'bun', 'docker', 'npx', 'claude', 'codex']) {
    const probe = run(tool, ['--version'], { cwd: root });
    tools[tool] = {
      available: probe.ok,
      version: probe.ok ? probe.stdout.split('\n')[0] : null
    };
  }

  const lockfiles = {
    npm: await exists(path.join(root, 'package-lock.json')),
    pnpm: await exists(path.join(root, 'pnpm-lock.yaml')),
    yarn: await exists(path.join(root, 'yarn.lock')),
    bun: await exists(path.join(root, 'bun.lockb')) || await exists(path.join(root, 'bun.lock'))
  };
  let scripts = {};
  try {
    scripts = (await readJson(path.join(root, 'package.json'), {})).scripts ?? {};
  } catch {}

  const browser = {
    playwright: (await Promise.all(
      ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'].map((file) => exists(path.join(root, file)))
    )).some(Boolean),
    cypress: (await Promise.all(
      ['cypress.config.ts', 'cypress.config.js'].map((file) => exists(path.join(root, file)))
    )).some(Boolean),
    agent_browser_config: await exists(path.join(root, 'agent-browser.json'))
  };
  const ci = {
    github_actions: await exists(path.join(root, '.github', 'workflows'))
  };
  const deployment = {
    vercel: await exists(path.join(root, 'vercel.json')),
    dockerfile: await exists(path.join(root, 'Dockerfile')),
    compose: (await Promise.all(
      ['docker-compose.yml', 'compose.yml', 'compose.yaml'].map((file) => exists(path.join(root, file)))
    )).some(Boolean),
    railway: (await Promise.all(
      ['railway.json', 'railway.toml'].map((file) => exists(path.join(root, file)))
    )).some(Boolean)
  };

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
      detail: `Session assigned ${assignedBranch}, current branch is ${currentBranch}.`
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
      detail: 'GitHub CLI unavailable; another authenticated GitHub path is required for remote checkpoints.'
    });
  }
  if (!Object.values(browser).some(Boolean)) {
    constraints.push({
      type: 'MISSING',
      id: 'browser_harness',
      blocks: ['browser_verification'],
      detail: 'No browser-test configuration detected.'
    });
  }
  const activeLocks = Object.entries(lockfiles).filter(([, value]) => value).map(([key]) => key);
  if (activeLocks.length > 1) {
    constraints.push({
      type: 'POLICY',
      id: 'multiple_package_managers',
      blocks: ['dependency_mutation'],
      detail: `Multiple lockfiles: ${activeLocks.join(', ')}.`
    });
  }

  const capabilities = {
    schema_version: '1.0.0',
    inspected_at: now(),
    agent,
    repository: {
      root: isGit ? gitRoot.stdout : root,
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
    package: { lockfiles, scripts },
    browser,
    ci,
    deployment,
    instruction_files: await findInstructionFiles(root)
  };
  await writeJsonAtomic(path.join(p.base, 'capabilities.json'), capabilities);
  await writeJsonAtomic(path.join(p.base, 'constraints.json'), { schema_version: '1.0.0', constraints });

  const state = await readJson(p.state);
  state.branch = effectiveBranch;
  state.blockers = constraints.filter((item) => item.type === 'HARD').map((item) => item.id);
  state.next_exact_action = state.blockers.length
    ? `Resolve hard constraints: ${state.blockers.join(', ')}.`
    : 'Compile policy, create a bounded phase plan, and run deterministic gates.';
  await writeJsonAtomic(p.state, state);

  const adapter = path.join(p.base, 'adapters', `${agent}.runtime.md`);
  await writeTextAtomic(
    adapter,
    `# Runtime Adapter: ${agent}\n\nEffective branch: ${effectiveBranch ?? 'unassigned'}\n\nHard blockers: ${state.blockers.length ? state.blockers.join(', ') : 'none'}\n\nNext action: ${state.next_exact_action}\n`
  );

  return {
    ok: state.blockers.length === 0,
    summary: state.blockers.length
      ? `Inspection completed with hard blockers: ${state.blockers.join(', ')}.`
      : `Inspection passed for ${agent} on ${effectiveBranch ?? 'no branch'}.`,
    checks: constraints.map((item) => ({
      name: item.id,
      ok: item.type !== 'HARD',
      detail: `${item.type}: ${item.detail}`
    })),
    capabilities: path.join(p.base, 'capabilities.json'),
    constraints: path.join(p.base, 'constraints.json'),
    adapter
  };
}

export async function doctorProject(root) {
  const p = projectPaths(root);
  const checks = [];
  const check = async (name, file) => checks.push({ name, ok: await exists(file), detail: file });
  await check('config', p.config);
  await check('active build state', p.state);
  await check('prompt registry', p.registry);
  await check('canonical ZTE prompt', p.canonicalPrompt);
  for (const file of REQUIRED_ICM) await check(`ICM ${file}`, path.join(p.icm, file));

  if (checks.every((item) => item.ok)) {
    try {
      const config = await readJson(p.config);
      checks.push({
        name: 'configuration contract',
        ok: Array.isArray(config.protected_branches) && config.retry_limit === 3,
        detail: 'protected branches and retry limit'
      });
      const state = await readJson(p.state);
      checks.push({
        name: 'resumable state contract',
        ok: typeof state.current_stage === 'string' && Array.isArray(state.blockers),
        detail: state.current_stage
      });
      const registry = await readJson(p.registry);
      let hashes = true;
      let detail = `${registry.prompts?.length ?? 0} verified`;
      for (const item of registry.prompts ?? []) {
        const actual = sha256(await fs.readFile(path.join(path.dirname(p.registry), item.path)));
        if (actual !== item.sha256) {
          hashes = false;
          detail = `${item.id} hash mismatch`;
          break;
        }
      }
      checks.push({ name: 'canonical prompt hashes', ok: hashes, detail });
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

export async function verifyProject(root) {
  const result = await doctorProject(root);
  const p = projectPaths(root);
  await ensureDir(p.evidence);
  const evidence = path.join(p.evidence, 'latest.json');
  await writeJsonAtomic(evidence, {
    schema_version: '1.0.0',
    verified_at: now(),
    root,
    ...result
  });
  return {
    ...result,
    summary: `${result.summary} Evidence: ${evidence}`,
    evidence
  };
}

export async function statusProject(root) {
  const p = projectPaths(root);
  if (!await exists(p.state)) {
    return {
      ok: false,
      summary: 'Pauli Cloud is not initialized. Run: pauli-cloud init .',
      checks: []
    };
  }
  const state = await readJson(p.state);
  return {
    ok: true,
    summary: `Phase ${state.current_phase} | Stage ${state.current_stage} | Branch ${state.branch ?? 'unassigned'} | Blockers ${state.blockers.length}`,
    state,
    checks: []
  };
}
