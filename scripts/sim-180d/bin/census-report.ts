/** Turns a checkpoint's captures into flags (src/census/checks.ts): flags.json for the review, census.md to read. */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { checkCapture, type Flag } from '../src/census/checks.ts';

const recordSchema = z.object({
  app: z.enum(['player', 'console', 'tablet', 'door', 'display', 'web']),
  role: z.enum(['super_admin', 'admin', 'floor', 'host', 'cashier', 'dealer', 'marketing', 'service', 'owner_view', 'member', 'visitor', 'device']),
  person: z.string(),
  path: z.string(),
  size: z.string(),
  checkpoint: z.string(),
  expect: z.string(),
  outcome: z.string(),
  landed: z.string(),
  text: z.string(),
  consoleErrors: z.array(z.string()),
  failedRequests: z.array(z.string()),
  axe: z.array(z.object({ id: z.string(), impact: z.enum(['minor', 'moderate', 'serious', 'critical']).nullable(), nodes: z.number(), help: z.string() })),
  lcpMs: z.number().nullable(),
  overflowX: z.boolean(),
  tinyTargets: z.array(z.string()),
  smallTargets: z.array(z.string()),
  clipped: z.array(z.string()),
  fallbackFonts: z.array(z.string()),
  offCentre: z.array(z.string()).default([]),
  misaligned: z.array(z.string()).default([]),
  shot: z.string(),
});
type CaptureFile = z.infer<typeof recordSchema>;

function filesUnder(dir: string, ending: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'sessions' || name === 'playwright' ? [] : filesUnder(path, ending);
    return path.endsWith(ending) && !path.endsWith('.back.json') ? [path] : [];
  });
}

export interface FlaggedCapture {
  capture: Omit<CaptureFile, 'text'>;
  flags: Flag[];
}

export function writeCensusReport(dir: string): string {
  const captures = filesUnder(dir, '.json').filter((path) => !path.endsWith('context.json')).map((path) => recordSchema.parse(JSON.parse(readFileSync(path, 'utf8'))));
  const flagged: FlaggedCapture[] = captures.map((capture) => {
    const { text: _text, ...rest } = capture;
    return { capture: rest, flags: checkCapture(capture) };
  });
  writeFileSync(join(dir, 'flags.json'), `${JSON.stringify(flagged.filter((one) => one.flags.length > 0), null, 2)}\n`);
  const byCheck = new Map<string, number>();
  for (const one of flagged) for (const each of one.flags) byCheck.set(each.check, (byCheck.get(each.check) ?? 0) + 1);
  const lines = [
    `# Census ${captures[0]?.checkpoint ?? ''}`,
    '',
    `${String(captures.length)} captures, ${String(flagged.filter((one) => one.flags.length > 0).length)} with a flag.`,
    '',
    '| Check | Captures |',
    '| --- | --- |',
    ...[...byCheck].sort((a, b) => b[1] - a[1]).map(([check, count]) => `| ${check} | ${String(count)} |`),
    '',
  ];
  const file = join(dir, 'census.md');
  writeFileSync(file, lines.join('\n'));
  return file;
}
