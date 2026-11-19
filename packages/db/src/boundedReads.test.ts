// @vitest-environment node
/**
 * No table read in this package comes back without a bound (redesign RD-31; limits.ts): a later change that drops one
 * fails here, not in a venue whose list has outgrown the API's thousand rows. Every chain that starts `.from(table)` and
 * selects rows must end in a limit, a range, a single row or a head-only count. Writes that select what they wrote are
 * one row each and are left alone.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = dirname(fileURLToPath(import.meta.url));
const WRITES = new Set(['insert', 'update', 'upsert', 'delete']);
const BOUNDS = new Set(['limit', 'range', 'single', 'maybeSingle']);

/** The index just past the parenthesis that closes the one at `open`. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === '(') depth += 1;
    if (text[at] === ')') depth -= 1;
    if (depth === 0) return at + 1;
  }
  return text.length;
}

/** The calls chained after `.from(` at `start`: each method's name and what it was given. */
function chainAt(text: string, start: number): { name: string; args: string }[] {
  const calls: { name: string; args: string }[] = [];
  const step = /^\s*\.\s*([A-Za-z]+)\s*(?:<[^()]*>)?\s*\(/;
  let at = start;
  for (let found = step.exec(text.slice(at)); found !== null; found = step.exec(text.slice(at))) {
    const open = at + found[0].length - 1;
    const end = closing(text, open);
    calls.push({ name: found[1] ?? '', args: text.slice(open + 1, end - 1) });
    at = end;
  }
  return calls;
}

/** Each unbounded read in a file, as `file: the chain's methods`. */
function unboundedReads(file: string): string[] {
  const text = readFileSync(join(SOURCE, file), 'utf8');
  return [...text.matchAll(/\.from\(/g)].flatMap((match) => {
    const calls = chainAt(text, match.index);
    const names = calls.map((call) => call.name);
    const isRead = names.includes('select') && !names.some((name) => WRITES.has(name));
    const isHeadCount = calls.some((call) => call.name === 'select' && /head:\s*true/.test(call.args));
    const isBounded = names.some((name) => BOUNDS.has(name)) || isHeadCount;
    return isRead && !isBounded ? [`${file}: ${names.join('.')}`] : [];
  });
}

describe('table reads in @rivr/db', () => {
  const files = readdirSync(SOURCE).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== 'database.types.ts');

  it('finds the reads it guards', () => {
    expect(files.some((file) => readFileSync(join(SOURCE, file), 'utf8').includes(".from('device').select("))).toBe(true);
  });

  it('bounds every one with a limit, a range, a single row or a head-only count', () => {
    expect(files.flatMap(unboundedReads)).toEqual([]);
  });
});
