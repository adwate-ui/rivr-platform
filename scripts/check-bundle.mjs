#!/usr/bin/env node
/**
 * Fails when the player app's initial JavaScript is over budget: 200 KB gzipped
 * (docs/spec/additions-2026-10-14.md, "Performance budgets"). "Initial" means the entry
 * script and every module it preloads, as listed in the built index.html.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 200 * 1024;
const DIST = 'apps/player/dist';

function initialScripts(html) {
  const entries = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  return [...new Set([...entries, ...preloads])].filter((src) => src !== undefined);
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const sizes = initialScripts(html).map((src) => ({
  src,
  gzipped: gzipSync(readFileSync(join(DIST, src.replace(/^\//, '')))).length,
}));
const total = sizes.reduce((sum, { gzipped }) => sum + gzipped, 0);

for (const { src, gzipped } of sizes) process.stdout.write(`${(gzipped / 1024).toFixed(1).padStart(8)} KB  ${src}\n`);
process.stdout.write(`${(total / 1024).toFixed(1).padStart(8)} KB  total (budget ${BUDGET_BYTES / 1024} KB gzipped)\n`);
if (sizes.length === 0 || total > BUDGET_BYTES) {
  process.stderr.write(sizes.length === 0 ? 'No entry script found in index.html.\n' : 'Player initial JavaScript is over budget.\n');
  process.exit(1);
}
