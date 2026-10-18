#!/usr/bin/env node
/**
 * pnpm verify | verify:quick | verify:all
 *   quick    typecheck, lint (ESLint, dependency rules, stylesheets), unit and property tests
 *   changed  quick, plus: mutation tests on changed money modules, pgTAP when supabase/ changed,
 *            the generated-tokens check, the drill gates, Storybook build and visual tests
 *   all      every step for every package
 * quick and changed cover packages changed against origin/main (or main), uncommitted work
 * included, plus the packages that depend on them. Stops at the first failure and prints a
 * summary to paste into the PR.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const MODE = process.argv[2] ?? 'changed';
const MONEY_MODULES = ['money', 'rake', 'callTime', 'tds', 'gst', 'markers', 'payouts'];
// Shared tooling can break any package, so a change to it verifies everything.
const TOOLING = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|eslint\.config\.js|tsconfig\.json|\.dependency-cruiser\.cjs|stylelint\.config\.mjs|packages\/config\/|scripts\/)/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** The commit this branch started from, or null when there is no main to compare with. */
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

/** What to verify: every package, or the changed ones measured from `base`. */
function scopeFor(mode) {
  const base = baseCommit();
  if (mode === 'all' || !base) return { everything: true, base, files: [] };
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

function moneyModulesToMutate(scope) {
  return MONEY_MODULES.filter(
    (module) =>
      existsSync(`packages/domain/src/${module}`) &&
      (scope.everything || scope.files.some((file) => file.startsWith(`packages/domain/src/${module}/`))),
  );
}

function mutationStep(modules) {
  const globs = modules.flatMap((module) => [`src/${module}/**/*.ts`, `!src/${module}/**/*.test.ts`]);
  return step(`mutation tests (${modules.join(', ')})`, 'pnpm', [
    '--filter', '@rivr/domain', 'exec', 'stryker', 'run', '--mutate', globs.join(','),
  ]);
}

/** Resets the local database to migrations plus seed, runs pgTAP, and stops it again if it was not running. */
function pgtapStep() {
  return {
    name: 'database tests (pgTAP)',
    run: () => {
      const wasRunning = spawnSync('pnpm', ['-s', 'supabase', 'status'], { stdio: 'ignore' }).status === 0;
      if (!wasRunning && run('pnpm', ['-s', 'db:start']) !== 0) return 1;
      const status = run('pnpm', ['-s', 'db:reset']) || run('pnpm', ['-s', 'supabase', 'test', 'db']);
      if (!wasRunning) run('pnpm', ['-s', 'db:stop']);
      return status;
    },
  };
}

function stepsFor(mode, scope) {
  const touched = (prefix) => scope.everything || scope.files.some((file) => file.startsWith(prefix));
  const turboScope = scope.everything ? [] : ['--affected'];
  const turboEnv = scope.base ? { TURBO_SCM_BASE: scope.base } : {};
  const steps = [
    step('typecheck, lint, unit and property tests', 'node', ['scripts/turbo.mjs', 'run', 'typecheck', 'lint', 'test', ...turboScope], turboEnv),
    step('root scripts and e2e lint', 'pnpm', ['-s', 'lint:root']),
    step('dependency rules', 'pnpm', ['-s', 'lint:deps']),
    step('stylesheets', 'pnpm', ['-s', 'lint:css']),
  ];
  if (mode === 'quick') return steps;
  const money = moneyModulesToMutate(scope);
  if (money.length > 0) steps.push(mutationStep(money));
  if (touched('supabase/')) steps.push(pgtapStep());
  if (touched('packages/tokens/')) steps.push(step('generated tokens are current', 'pnpm', ['--filter', '@rivr/tokens', 'check:generated']));
  if (touched('packages/drills/')) steps.push(step('drill gates', 'pnpm', ['--filter', '@rivr/drills', 'gates']));
  if (touched('packages/ui/') || touched('packages/tokens/')) {
    steps.push(step('Storybook build and visual tests', 'node', ['scripts/turbo.mjs', 'run', 'build-storybook', 'visual', '--filter', 'ui']));
  }
  return steps;
}

function main() {
  const scope = scopeFor(MODE);
  const what = scope.everything ? 'every package' : `packages changed since ${scope.base?.slice(0, 8)}`;
  process.stdout.write(`\nverify (${MODE}): ${what}\n\n`);
  const results = [];
  for (const { name, run: runStep } of stepsFor(MODE, scope)) {
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
