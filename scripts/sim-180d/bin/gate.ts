/** `pnpm --filter @rivr/sim-180d gate [-- --dry]`: refuses unless the gate holds, and prints both commits. */
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { GATE_PRS, gateLines, type GateFacts } from '../src/cli/gate.ts';
import { say } from '../src/log.ts';
import { REPO_ROOT } from '../src/paths.ts';

const REPO = 'adwate-ui/rivr-platform';
const BRANCH = 'chore/sim-180d';
const prSchema = z.object({ number: z.number(), title: z.string(), state: z.string() });
const openSchema = z.array(z.object({ number: z.number(), title: z.string(), headRefName: z.string() }));

const run = (command: string, args: readonly string[], cwd = REPO_ROOT): string => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim();
const lines = (text: string): string[] => text.split('\n').filter((line) => line !== '');
const succeeds = (args: readonly string[]): boolean => {
  try {
    run('git', args);
    return true;
  } catch {
    return false;
  }
};

/** Every worktree of the repository but this one. */
function otherWorktrees(): { path: string; dirty: string[] }[] {
  const here = run('git', ['rev-parse', '--show-toplevel']);
  return lines(run('git', ['worktree', 'list', '--porcelain']))
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
    .filter((path) => path !== here)
    .map((path) => ({ path, dirty: lines(run('git', ['status', '--porcelain'], path)) }));
}

function facts(): GateFacts {
  run('git', ['fetch', '-q', 'origin']);
  const open = openSchema.parse(JSON.parse(run('gh', ['pr', 'list', '--repo', REPO, '--state', 'open', '--json', 'number,title,headRefName'])));
  return {
    harnessDirty: lines(run('git', ['status', '--porcelain'])),
    harnessPushed: succeeds(['rev-parse', `origin/${BRANCH}`]) && run('git', ['rev-parse', 'HEAD']) === run('git', ['rev-parse', `origin/${BRANCH}`]),
    harnessOnMain: succeeds(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']),
    prs: GATE_PRS.map((number) => prSchema.parse(JSON.parse(run('gh', ['pr', 'view', String(number), '--repo', REPO, '--json', 'number,title,state'])))),
    openPrs: open.filter((pr) => pr.headRefName !== BRANCH),
    worktrees: otherWorktrees(),
  };
}

const mode = process.argv.includes('--dry') ? 'dry' : 'full';
const results = gateLines(facts(), mode);
for (const line of results) say(`${line.ok ? 'pass' : 'FAIL'}  ${line.check}: ${line.detail}`);
say(`main ${run('git', ['rev-parse', '--short=8', 'origin/main'])}, harness ${run('git', ['rev-parse', '--short=8', 'HEAD'])}`);
if (results.some((line) => !line.ok)) {
  say(`the gate is closed: the ${mode === 'dry' ? 'dry run' : 'run'} waits`);
  process.exit(1);
}
