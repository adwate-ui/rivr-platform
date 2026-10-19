/**
 * Every bare import an Edge Function reaches must be in that function's deno.json import map, or the
 * function fails to boot after deploy (BOOT_ERROR), as sign-in would have when a shared package
 * gained an import (#283). Walks each function's import graph from index.ts, through the local
 * packages its map points at, and lists every bare specifier the map does not resolve.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const FUNCTIONS = resolve('supabase/functions');
// At the start of a line (never a comment's text): a side-effect import, or an import or export
// statement's `from`, however many lines its braces take.
const SPECIFIER = /^\s*(?:import\s+['"]([^'"]+)['"]|(?:import|export)\b[^;'"]*?\bfrom\s+['"]([^'"]+)['"])/gm;
const REMOTE = /^(npm:|jsr:|https?:|node:)/;

/** The local file a specifier names: a relative path, or a bare one through the import map. */
function target(specifier, fromFile, imports, functionDir) {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier);
  const mapped = imports[specifier];
  if (mapped !== undefined) return REMOTE.test(mapped) ? null : resolve(functionDir, mapped);
  const prefix = Object.keys(imports).find((key) => key.endsWith('/') && specifier.startsWith(key));
  if (prefix !== undefined) return resolve(functionDir, imports[prefix] + specifier.slice(prefix.length));
  return undefined;
}

/** One file's imports: the local files they lead to, and the bare specifiers the map does not resolve. */
function scan(file, imports, functionDir) {
  const next = [];
  const missing = [];
  for (const [, sideEffect, fromClause] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
    const specifier = sideEffect ?? fromClause;
    if (specifier === undefined || REMOTE.test(specifier)) continue;
    const local = target(specifier, file, imports, functionDir);
    if (local === undefined) missing.push(`${specifier} (imported by ${file.replace(`${resolve('.')}/`, '')})`);
    else if (local !== null) next.push(local);
  }
  return { next, missing };
}

/** The bare specifiers one function reaches that its import map does not resolve. */
function unmapped(functionDir) {
  const mapFile = join(functionDir, 'deno.json');
  const imports = existsSync(mapFile) ? (JSON.parse(readFileSync(mapFile, 'utf8')).imports ?? {}) : {};
  const queue = [join(functionDir, 'index.ts')];
  const seen = new Set();
  const missing = [];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const found = scan(file, imports, functionDir);
    queue.push(...found.next);
    missing.push(...found.missing);
  }
  return missing;
}

const functions = readdirSync(FUNCTIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && existsSync(join(FUNCTIONS, entry.name, 'index.ts')));
const problems = functions.flatMap((entry) => unmapped(join(FUNCTIONS, entry.name)).map((what) => `${entry.name}: ${what}`));
if (problems.length > 0) {
  process.stderr.write(`Edge Function imports missing from their deno.json import maps:\n${problems.map((line) => `  ${line}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Edge Function import maps cover every import (${String(functions.length)} functions).\n`);
