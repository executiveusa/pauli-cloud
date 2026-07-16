#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initProject,
  inspectProject,
  statusProject
} from '../src/project.mjs';
import { enterpriseDoctor, enterpriseVerify } from '../src/integrity.mjs';
import {
  compilePolicy,
  uninstallPolicy,
  evaluateGuard,
  approveAction
} from '../src/policy.mjs';
import {
  phaseStart,
  phaseAdvance,
  phaseBlock,
  phaseFail,
  checkpoint,
  fleetAdd,
  fleetList,
  fleetRemove,
  dailyReport
} from '../src/runtime.mjs';
import {
  registerPrompt,
  verifyPrompts,
  recordPromptRun,
  promotePrompt
} from '../src/prompts.mjs';
import { startServer } from '../src/server.mjs';

const raw = process.argv.slice(2);
const command = raw[0] ?? 'help';

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const inline = raw.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = raw.indexOf(`--${name}`);
  if (index >= 0 && raw[index + 1] && !raw[index + 1].startsWith('--')) {
    return raw[index + 1];
  }
  return fallback;
}

function flag(name) {
  return raw.includes(`--${name}`);
}

const positional = raw.slice(1).filter((value, index, values) =>
  !value.startsWith('--') &&
  (index === 0 || !values[index - 1]?.startsWith('--') || values[index - 1].includes('='))
);
const root = path.resolve(option('root', positional[0] ?? '.'));
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = flag('json');

const HELP = `Pauli Cloud\n\nCommands:\n  init [root] [--force]\n  inspect [root] --agent=name [--assigned-branch=name]\n  compile [root] --agent=name [--dry-run] [--force]\n  uninstall [root] [--dry-run] [--force]\n  guard [root] --action=command|write|push|commit|phase-commit [--value=text] [--target-path=path] [--branch=name] [--approval=id]\n  approve [root] --type=production|irreversible|financial|consequential_agent_action [--scope=text] [--expires-minutes=60]\n  phase [root] --operation=start|advance|block|fail --phase=name [--to=STAGE] [--reason=text]\n  checkpoint [root] [--pr=url]\n  prompt [root] --operation=register|verify|run|promote [options]\n  fleet [root] --operation=add|list|remove [options]\n  daily [root]\n  serve [root] [--host=127.0.0.1] [--port=4317] [--rate-limit=120]\n  doctor [root]\n  verify [root]\n  status [root]\n`;

function display(result) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.summary);
    for (const check of result.checks ?? []) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    }
  }
  if (result.ok === false) process.exitCode = 1;
}

function number(name, fallback) {
  const value = Number(option(name, fallback));
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric`);
  return value;
}

try {
  let result;
  if (command === 'init') {
    result = await initProject(root, packageRoot, { force: flag('force') });
  } else if (command === 'inspect') {
    result = await inspectProject(root, packageRoot, {
      agent: option('agent', 'generic'),
      assignedBranch: option('assigned-branch')
    });
  } else if (command === 'compile') {
    result = await compilePolicy(root, {
      agent: option('agent', 'generic'),
      dryRun: flag('dry-run'),
      force: flag('force')
    });
  } else if (command === 'uninstall') {
    result = await uninstallPolicy(root, {
      dryRun: flag('dry-run'),
      force: flag('force')
    });
  } else if (command === 'guard') {
    result = await evaluateGuard(root, {
      action: option('action'),
      value: option('value', ''),
      branch: option('branch'),
      approval: option('approval'),
      targetPath: option('target-path')
    });
  } else if (command === 'approve') {
    result = await approveAction(root, {
      type: option('type'),
      scope: option('scope', 'project'),
      expiresMinutes: number('expires-minutes', 60),
      actor: option('actor', 'human')
    });
  } else if (command === 'phase') {
    const operation = option('operation');
    if (operation === 'start') {
      result = await phaseStart(root, {
        phase: option('phase'),
        beadId: option('bead-id'),
        branch: option('branch')
      });
    } else if (operation === 'advance') {
      result = await phaseAdvance(root, {
        to: option('to'),
        note: option('note')
      });
    } else if (operation === 'block') {
      result = await phaseBlock(root, { reason: option('reason') });
    } else if (operation === 'fail') {
      result = await phaseFail(root, {
        reason: option('reason'),
        attempt: number('attempt', 1)
      });
    } else {
      throw new Error('phase operation must be start, advance, block, or fail');
    }
  } else if (command === 'checkpoint') {
    result = await checkpoint(root, { pr: option('pr') });
  } else if (command === 'prompt') {
    const operation = option('operation');
    if (operation === 'register') {
      result = await registerPrompt(root, {
        id: option('id'),
        version: option('version'),
        file: option('file'),
        status: option('status', 'experiment'),
        model: option('model', 'generic')
      });
    } else if (operation === 'verify') {
      result = await verifyPrompts(root);
    } else if (operation === 'run') {
      result = await recordPromptRun(root, {
        id: option('id'),
        version: option('version'),
        model: option('model', 'unknown'),
        score: option('score') === null ? null : number('score', 0),
        baselineScore: option('baseline-score') === null ? null : number('baseline-score', 0),
        passed: flag('passed'),
        notes: option('notes', '')
      });
    } else if (operation === 'promote') {
      result = await promotePrompt(root, {
        id: option('id'),
        version: option('version')
      });
    } else {
      throw new Error('prompt operation must be register, verify, run, or promote');
    }
  } else if (command === 'fleet') {
    const operation = option('operation');
    if (operation === 'add') {
      result = await fleetAdd(root, {
        name: option('name'),
        repoPath: option('repo-path'),
        remote: option('remote'),
        owner: option('owner')
      });
    } else if (operation === 'list') {
      result = await fleetList(root);
    } else if (operation === 'remove') {
      result = await fleetRemove(root, { name: option('name') });
    } else {
      throw new Error('fleet operation must be add, list, or remove');
    }
  } else if (command === 'daily') {
    result = await dailyReport(root);
  } else if (command === 'doctor') {
    result = await enterpriseDoctor(root);
  } else if (command === 'verify') {
    result = await enterpriseVerify(root);
  } else if (command === 'status') {
    result = await statusProject(root);
  } else if (command === 'serve') {
    const service = await startServer(root, {
      host: option('host', process.env.PAULI_CLOUD_HOST ?? '127.0.0.1'),
      port: number('port', process.env.PAULI_CLOUD_PORT ?? 4317),
      rateLimit: number('rate-limit', process.env.PAULI_CLOUD_RATE_LIMIT ?? 120)
    });
    console.log(service.summary);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => service.server.close(() => process.exit(0)));
    }
    await new Promise(() => {});
  } else if (['help', '--help', '-h'].includes(command)) {
    console.log(HELP);
    process.exit(0);
  } else {
    throw new Error(`unknown command: ${command}\n\n${HELP}`);
  }
  if (result) display(result);
} catch (error) {
  console.error(`pauli-cloud: ${error.message}`);
  process.exitCode = 1;
}
