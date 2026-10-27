#!/usr/bin/env node
/**
 * pnpm verify | verify:quick | verify:all, and CI's parallel parts (decision 0243)
 *   quick      typecheck, lint (ESLint, dependency rules, stylesheets), unit and property tests
 *   changed    quick, plus: mutation tests on the changed money modules, pgTAP when supabase/ or a golden
 *              file changed, the generated-tokens check, the drill gates, Storybook build and visual tests
 *   all        every step for every package
 *   code       CI: quick, the generated-tokens check and the drill gates, for every package
 *   database   CI: pgTAP and the generated types
 *   storybook  CI: Storybook build and visual tests
 *   mutation <n>/<count>   CI: the n-th of `count` shares of the money modules' files to mutate. With
 *              MUTATION_SINCE=<ref> (a pull request) only the modules it changes, else every one (decision 0242).
 *              Each module must score 80 or more on its own, not only the run as a whole.
 * quick and changed cover packages changed since this branch left main, uncommitted work included, plus the
 * packages that depend on them. Stops at the first failure and prints a summary to paste into the PR.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import strykerConfig from '../packages/domain/stryker.config.mjs';

const MODE = process.argv[2] ?? 'changed';
// The money modules are the folders Stryker mutates (packages/domain/stryker.config.mjs): one list for both.
const MONEY_MODULES = strykerConfig.mutate.filter((glob) => !glob.startsWith('!')).map((glob) => glob.split('/')[1]);
// Shared tooling can break any package, so a change to it verifies everything.
const TOOLING = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|eslint\.config\.js|tsconfig\.json|\.dependency-cruiser\.cjs|stylelint\.config\.mjs|packages\/config\/|scripts\/)/;
// Tooling that can move any money module's mutation score.
const MUTATION_TOOLING = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.json|packages\/config\/)/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** Whether any file under `folder` contains `text`. */
function mentions(folder, text) {
  return spawnSync('git', ['grep', '-q', '--fixed-strings', text, '--', folder]).status === 0;
}

/** The commit this branch left main at, or null when there is nothing to compare with (decision 0243). */
function baseCommit() {
  for (const ref of ['origin/main', 'main']) {
    try {
      return git('merge-base', 'HEAD', ref);
    } catch {
      // That ref does not exist here; try the next.
    }
  }
  return null;
}

function changedFiles(base) {
  const committed = git('diff', '--name-only', base, 'HEAD').split('\n');
  const working = git('status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .map((line) => line.slice(3).split(' -> ').pop());
  return [...new Set([...committed, ...working].filter(Boolean))];
}

/** What to verify: the changed packages measured from `base` (quick and changed), else every package. */
function scopeFor(mode) {
  const base = baseCommit();
  if (!['quick', 'changed'].includes(mode) || !base) return { everything: true, base, files: [] };
  const files = changedFiles(base);
  return { everything: files.some((file) => TOOLING.test(file)), base, files };
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  return result.status ?? 1;
}

function step(name, command, args, env) {
  return { name, run: () => run(command, args, env) };
}

const moduleFolder = (module) => `packages/domain/src/${module}`;
const inMoneyModule = (file) => MONEY_MODULES.some((module) => file.startsWith(`${moduleFolder(module)}/`));

/**
 * Shared code every money module's tests run on: tooling, domain code outside the money modules and the testing
 * helpers (golden files aside: they count for the modules whose tests import them). Prose does not count.
 */
const movesEveryScore = (file) =>
  !file.endsWith('.md') &&
  (MUTATION_TOOLING.test(file) ||
    (file.startsWith('packages/domain/') && !inMoneyModule(file)) ||
    (file.startsWith('packages/testing/') && !file.startsWith('packages/testing/golden/')));

/** A money module's own files changed, or a golden file its tests import (`@rivr/testing/golden/<name>.json`). */
function moduleChanged(module, files) {
  return files.some(
    (file) =>
      file.startsWith(`${moduleFolder(module)}/`) ||
      (file.startsWith('packages/testing/golden/') && mentions(moduleFolder(module), file.replace('packages/testing/', ''))),
  );
}

/**
 * The money modules to mutate. With MUTATION_SINCE (CI on a pull request) only those it changes, every one when it
 * changes shared code (decision 0242). A changed module's tests also kill the mutants of the modules it imports, nearly
 * always money, so a change to them can move money's score; mutating money on every such pull request took longer than
 * the rest of CI together. The push to main mutates every module, and a release needs that run green (release.yml).
 */
function moneyModulesToMutate(scope) {
  const since = process.env.MUTATION_SINCE;
  const files = since ? changedFiles(git('merge-base', 'HEAD', since)) : scope.files;
  const everything = since ? files.some(movesEveryScore) : scope.everything;
  const modules = MONEY_MODULES.filter((module) => existsSync(moduleFolder(module)));
  return everything ? modules : modules.filter((module) => moduleChanged(module, files));
}

/** A money module's files Stryker mutates (as `module/file.ts`): not its tests or its index. */
function moduleFiles(module) {
  return readdirSync(moduleFolder(module), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !/(^|\/)index\.ts$/.test(file))
    .map((file) => `${module}/${file}`)
    .sort();
}

/**
 * The n-th of `count` shares of the modules' files ("2/6"), every file in exactly one share. Files, not modules: the
 * tournament module alone took 20 minutes (#515). The largest file goes to the lightest share, then the next; a file's
 * size follows its number of mutants closely enough.
 */
function mutationShare(modules, share) {
  const [n, count] = (share ?? '').split('/').map(Number);
  if (!(Number.isInteger(n) && Number.isInteger(count) && n >= 1 && n <= count)) throw new Error(`mutation needs <n>/<count>, not ${share}`);
  const files = modules.flatMap(moduleFiles).map((file) => ({ file, size: statSync(`packages/domain/src/${file}`).size }));
  files.sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));
  const shares = Array.from({ length: count }, () => ({ size: 0, files: [] }));
  for (const { file, size } of files) {
    const lightest = shares.reduce((least, next) => (next.size < least.size ? next : least));
    lightest.files.push(file);
    lightest.size += size;
  }
  return shares[n - 1].files.sort();
}

const DETECTED = new Set(['Killed', 'Timeout']);
const SCORED = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);

/**
 * Fails when any one module scores under Stryker's break threshold. Stryker's own check is for the run as a whole, so
 * in a run of several modules a weak one could pass behind strong ones; the money rules set the floor per module.
 */
function perModuleScoreStep(modules) {
  const floor = strykerConfig.thresholds.break;
  return {
    name: `mutation score of each module, ${floor} or more`,
    run: () => {
      const report = JSON.parse(readFileSync('packages/domain/reports/mutation/mutation.json', 'utf8'));
      const tally = new Map(modules.map((module) => [module, { detected: 0, scored: 0 }]));
      for (const [file, { mutants }] of Object.entries(report.files)) {
        const counts = tally.get(file.match(/(?:^|\/)src\/([^/]+)\//)?.[1] ?? '');
        for (const { status } of counts ? mutants : []) {
          counts.detected += DETECTED.has(status) ? 1 : 0;
          counts.scored += SCORED.has(status) ? 1 : 0;
        }
      }
      const scores = [...tally].map(([module, { detected, scored }]) => [module, scored === 0 ? 100 : (100 * detected) / scored]);
      for (const [module, score] of scores) process.stdout.write(`  ${module}: ${score.toFixed(2)}\n`);
      return scores.every(([, score]) => score >= floor) ? 0 : 1;
    },
  };
}

/** Mutates the given money files (`module/file.ts`), then checks each of their modules' scores. */
function mutationSteps(files) {
  const modules = [...new Set(files.map((file) => file.split('/')[0]))];
  const globs = files.map((file) => `src/${file}`);
  return [
    step(`mutation tests (${modules.join(', ')})`, 'pnpm', ['--filter', '@rivr/domain', 'exec', 'stryker', 'run', '--mutate', globs.join(',')]),
    perModuleScoreStep(modules),
  ];
}

/**
 * Resets the local database to migrations plus seed, runs pgTAP, regenerates the database types
 * and fails if they differ from the committed file, then stops the stack if it was not running.
 */
function pgtapStep() {
  return {
    name: 'database tests (pgTAP) and generated types',
    run: () => {
      const wasRunning = spawnSync('pnpm', ['-s', 'supabase', 'status'], { stdio: 'ignore' }).status === 0;
      if (!wasRunning && run('pnpm', ['-s', 'db:start']) !== 0) return 1;
      const status =
        run('pnpm', ['-s', 'db:reset']) ||
        run('pnpm', ['-s', 'supabase', 'test', 'db']) ||
        run('pnpm', ['-s', 'db:types']) ||
        run('git', ['diff', '--exit-code', '--', 'packages/db/src/database.types.ts']);
      if (!wasRunning) run('pnpm', ['-s', 'db:stop']);
      return status;
    },
  };
}

const tokensStep = () => step('generated tokens are current', 'pnpm', ['--filter', '@rivr/tokens', 'check:generated']);
const drillsStep = () => step('drill gates', 'pnpm', ['--filter', '@rivr/drills', 'gates']);
const storybookStep = () =>
  step('Storybook build and visual tests', 'node', ['scripts/turbo.mjs', 'run', 'build-storybook', 'visual', '--filter', 'ui']);

function quickSteps(scope) {
  const turboScope = scope.everything ? [] : ['--affected'];
  const turboEnv = scope.base ? { TURBO_SCM_BASE: scope.base } : {};
  return [
    step('typecheck, lint, unit and property tests', 'node', ['scripts/turbo.mjs', 'run', 'typecheck', 'lint', 'test', ...turboScope], turboEnv),
    step('root scripts and e2e lint', 'pnpm', ['-s', 'lint:root']),
    step('Edge Function import maps', 'node', ['scripts/ci/check-function-imports.mjs']),
    step('migration versions', 'node', ['scripts/ci/check-migration-versions.mjs']),
    step('dependency rules', 'pnpm', ['-s', 'lint:deps']),
    step('stylesheets', 'pnpm', ['-s', 'lint:css']),
  ];
}

function stepsFor(mode, scope) {
  const touched = (prefix) => scope.everything || scope.files.some((file) => file.startsWith(prefix));
  const steps = quickSteps(scope);
  if (mode === 'quick') return steps;
  const money = moneyModulesToMutate(scope);
  if (money.length > 0) steps.push(...mutationSteps(money.flatMap(moduleFiles)));
  // A golden file is proved in SQL too (decision 0037).
  if (['supabase/', 'packages/testing/golden/'].some(touched)) steps.push(pgtapStep());
  if (touched('packages/tokens/')) steps.push(tokensStep());
  if (touched('packages/drills/')) steps.push(drillsStep());
  if (touched('packages/ui/') || touched('packages/tokens/')) steps.push(storybookStep());
  return steps;
}

/** CI's parallel parts, one job each (decision 0243). */
const CI_PARTS = {
  code: (scope) => [...quickSteps(scope), tokensStep(), drillsStep()],
  database: () => [pgtapStep()],
  storybook: () => [storybookStep()],
  mutation: (scope) => {
    const files = mutationShare(moneyModulesToMutate(scope), process.argv[3]);
    return files.length > 0 ? mutationSteps(files) : [];
  },
};

function main() {
  const scope = scopeFor(MODE);
  const what = scope.everything ? 'every package' : `packages changed since ${scope.base?.slice(0, 8)}`;
  process.stdout.write(`\nverify (${MODE}): ${what}\n\n`);
  const steps = Object.hasOwn(CI_PARTS, MODE) ? CI_PARTS[MODE](scope) : stepsFor(MODE, scope);
  if (steps.length === 0) process.stdout.write('nothing to run here\n');
  const results = [];
  for (const { name, run: runStep } of steps) {
    const started = Date.now();
    const status = runStep();
    results.push({ name, ok: status === 0, seconds: Math.round((Date.now() - started) / 1000) });
    if (status !== 0) break;
  }
  process.stdout.write(`\nverify (${MODE}) summary\n`);
  for (const { name, ok, seconds } of results) process.stdout.write(`  ${ok ? 'pass' : 'FAIL'}  ${name} (${seconds}s)\n`);
  process.exit(results.every((result) => result.ok) ? 0 : 1);
}

main();
