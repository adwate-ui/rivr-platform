#!/usr/bin/env node
/**
 * Runs Turborepo with the short filter names CLAUDE.md uses: `--filter domain` means
 * `@rivr/domain`. Apps are unscoped already (`--filter player`). Arguments after `--`
 * go to the task untouched, as in `pnpm test --filter domain -- waitlist`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const SCOPED_PACKAGES = new Set(
  readdirSync('packages').filter((name) => existsSync(`packages/${name}/package.json`)),
);

/** `domain` becomes `@rivr/domain`; anything else (an app, a glob, `...[origin/main]`) is kept. */
function expandFilter(value) {
  return SCOPED_PACKAGES.has(value) ? `@rivr/${value}` : value;
}

function expandArgs(args) {
  const passthroughAt = args.indexOf('--');
  const own = passthroughAt === -1 ? args : args.slice(0, passthroughAt);
  const rest = passthroughAt === -1 ? [] : args.slice(passthroughAt);
  const expanded = own.map((arg, i) => {
    if (own[i - 1] === '--filter' || own[i - 1] === '-F') return expandFilter(arg);
    if (arg.startsWith('--filter=')) return `--filter=${expandFilter(arg.slice('--filter='.length))}`;
    return arg;
  });
  return [...expanded, ...rest];
}

const result = spawnSync('turbo', expandArgs(process.argv.slice(2)), { stdio: 'inherit' });
process.exit(result.status ?? 1);
