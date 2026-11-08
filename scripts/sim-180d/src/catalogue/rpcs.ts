/** Every database function and Edge Function the apps call, read from packages/db, the only code that talks to Supabase. */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { REPO_ROOT } from '../paths.ts';
import type { Rpc } from './types.ts';

const DB_SRC = join(REPO_ROOT, 'packages', 'db', 'src');

// client.rpc('door_scan', …)
const CALL = /\.rpc\(\s*['"]([a-z_0-9]+)['"]/g;
// A call through a variable typed as a union of names: `rpc: 'mark_tournament_registered' | 'unmark_tournament_registered'`.
const UNION = /\brpc:\s*((?:'[a-z_0-9]+'\s*\|\s*)+'[a-z_0-9]+')/g;
// client.functions.invoke('device-pair', …), counted as 'edge:device-pair'.
const EDGE = /functions\.invoke\(\s*['"]([a-z_0-9-]+)['"]/g;

export function scanRpcs(text: string, module: string, source: string): Rpc[] {
  const names = new Set<string>();
  for (const match of text.matchAll(CALL)) names.add(match[1] ?? '');
  for (const match of text.matchAll(UNION)) for (const name of (match[1] ?? '').matchAll(/'([a-z_0-9]+)'/g)) names.add(name[1] ?? '');
  for (const match of text.matchAll(EDGE)) names.add(`edge:${match[1] ?? ''}`);
  return [...names].sort().map((name) => ({ name, module, source }));
}

/** Each name once, with the first module that calls it. */
export function readRpcs(dir = DB_SRC): Rpc[] {
  const byName = new Map<string, Rpc>();
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('database.types.ts')) continue;
    const module = basename(file, '.ts');
    for (const rpc of scanRpcs(readFileSync(join(dir, file), 'utf8'), module, `packages/db/src/${file}`)) {
      if (!byName.has(rpc.name)) byName.set(rpc.name, rpc);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
