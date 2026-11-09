#!/usr/bin/env node
/** Says whether the keys named on the command line are set, as a release job's `present` output (decision 0577). */
import { appendFileSync } from 'node:fs';
import { keysState } from './storeKeys.mjs';

const names = process.argv.slice(2);
const { present, missing } = keysState(names, process.env);
if (missing.length > 0) {
  process.stdout.write(`::error::Some of a store build's keys are not set: ${missing.join(', ')}. See docs/runbooks/store-listing.md.\n`);
  process.exit(1);
}
if (!present) process.stdout.write(`::notice::${names.join(', ')} are not set, so this store build is skipped.\n`);
appendFileSync(process.env.GITHUB_OUTPUT, `present=${String(present)}\n`);
