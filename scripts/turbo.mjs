#!/usr/bin/env node
/**
 * Runs Turborepo with the short filter names CLAUDE.md uses: `--filter domain` means
 * `@rivr/domain`. Apps are unscoped already (`--filter player`). Arguments after `--`
 * go to the task untouched, as in `pnpm test --filter domain -- waitlist`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { localBinary, portBlock, worktreeRoot } from '@rivr/config/worktree';

const root = worktreeRoot();
const SCOPED_PACKAGES = new Set(
  readdirSync(join(root, 'packages')).filter((name) => existsSync(join(root, 'packages', name, 'package.json'))),
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

// An app's build embeds this worktree's local Supabase (its port block), so the build's cache key
// must know the block: otherwise two worktrees with the same source share one build, and one
// lane's apps talk to another lane's database.
process.env.RIVR_PORT_BLOCK ??= String(portBlock(root));

const result = spawnSync(localBinary('turbo', root), expandArgs(process.argv.slice(2)), { stdio: 'inherit', cwd: root });
if (result.error) process.stderr.write(`turbo did not start: ${result.error.message}\n`);
process.exit(result.status ?? 1);
