/**
 * `pnpm visual`: screenshots every Storybook story and compares it with its baseline in
 * visual/baselines/. Playwright runs inside the official container so a laptop and a CI
 * runner produce the same pixels (docs/decisions/0009). Needs the static Storybook from
 * `pnpm --filter @rivr/ui build-storybook`.
 *
 *   pnpm visual                 compare; fails on any changed pixel or missing baseline
 *   pnpm visual -- --update     rewrite changed and missing baselines, delete orphaned ones
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const IMAGE = 'mcr.microsoft.com/playwright:v1.64.1-noble';
const INDEX = 'storybook-static/index.json';
const BASELINES = 'visual/baselines';

const isUpdate = process.argv.includes('--update');
const passthrough = process.argv.slice(2).filter((arg) => arg !== '--update');

if (!existsSync(INDEX)) {
  process.stderr.write('No built Storybook. Run `pnpm --filter @rivr/ui build-storybook` first.\n');
  process.exit(1);
}

/** Runs the Playwright suite in the container, with the repository mounted at the same path. */
function runInContainer() {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const playwright = ['node', 'node_modules/@playwright/test/cli.js', 'test', '--config', 'visual/playwright.config.ts'];
  const update = isUpdate ? ['--update-snapshots=changed'] : [];
  const docker = [
    'run', '--rm', '--init', '--ipc=host',
    // Files written into the repository belong to the developer, not to root.
    '--user', `${process.getuid()}:${process.getgid()}`,
    '--env', 'HOME=/tmp', '--env', 'CI',
    '--volume', `${repo}:${repo}`, '--workdir', process.cwd(),
    IMAGE, ...playwright, ...update, ...passthrough,
  ];
  return spawnSync('docker', docker, { stdio: 'inherit' }).status ?? 1;
}

/** Deletes baselines whose story no longer exists, so a removed story leaves nothing behind. */
function pruneOrphanedBaselines() {
  const index = JSON.parse(readFileSync(INDEX, 'utf8'));
  const ids = new Set(Object.values(index.entries).map((entry) => `${entry.id}.png`));
  for (const file of existsSync(BASELINES) ? readdirSync(BASELINES) : []) {
    if (!ids.has(file)) rmSync(`${BASELINES}/${file}`);
  }
}

const status = runInContainer();
if (status === 0 && isUpdate) pruneOrphanedBaselines();
process.exit(status);
