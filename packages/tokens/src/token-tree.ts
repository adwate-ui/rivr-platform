import { readFileSync } from 'node:fs';

/** One token from tokens.json with its value resolved through references. */
export interface FlatToken {
  path: string;
  type: string | undefined;
  value: unknown;
}

const REFERENCE = /^\{([^}]+)\}$/;

function isGroup(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

/** tokens.json, parsed. */
export function readTokenFile(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'));
  if (!isGroup(parsed)) throw new Error('tokens.json must hold an object');
  return parsed;
}

/** Every token as `color.green`-style paths, with `$type` inherited from its groups. */
export function flattenTokens(node: Record<string, unknown>, path: string[] = [], inherited?: string): FlatToken[] {
  const type = typeof node.$type === 'string' ? node.$type : inherited;
  if ('$value' in node) return [{ path: path.join('.'), type, value: node.$value }];
  return Object.entries(node)
    .filter(([key, child]) => !key.startsWith('$') && isGroup(child))
    .flatMap(([key, child]) => (isGroup(child) ? flattenTokens(child, [...path, key], type) : []));
}

/** Follows `{color.green}` references until it reaches a literal value. */
export function resolveValue(value: unknown, byPath: ReadonlyMap<string, unknown>): unknown {
  const reference = typeof value === 'string' ? REFERENCE.exec(value) : null;
  if (!reference?.[1]) return value;
  if (!byPath.has(reference[1])) throw new Error(`Unknown token reference ${value}`);
  return resolveValue(byPath.get(reference[1]), byPath);
}

/** Every token in tokens.json with references resolved. */
export function resolvedTokens(): FlatToken[] {
  const flat = flattenTokens(readTokenFile());
  const byPath = new Map(flat.map((token) => [token.path, token.value]));
  return flat.map((token) => ({ ...token, value: resolveValue(token.value, byPath) }));
}

/** The resolved value of one token path; throws when the path does not exist. */
export function tokenValue(path: string): unknown {
  const token = resolvedTokens().find((candidate) => candidate.path === path);
  if (!token) throw new Error(`No token at ${path}`);
  return token.value;
}
