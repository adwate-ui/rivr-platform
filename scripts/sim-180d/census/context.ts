/** What one census run knows: the checkpoint, the simulation's time, who signs in on which number, and where it writes. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Person } from '../src/census/plan.ts';
import { SIM_HOME } from '../src/paths.ts';

export const contextSchema = z.object({
  /** 'night-30': the snapshot, played on to 22:00 of the next night (night 0 stays the empty launch morning). */
  checkpoint: z.string(),
  /** The simulation's time the browser clock starts from. */
  simNow: z.string(),
  /** Where captures, sessions and pictures go. */
  dir: z.string(),
  /** Every size of every app, or the first size of each. */
  sizes: z.enum(['all', 'first']),
  /** Each person's ten-digit test number. */
  numbers: z.record(z.string(), z.string()),
  /** The dealer who signs in on the tablet, and the table it is fixed to. */
  dealer: z.string(),
  table: z.string(),
  /** Values for addresses with parameters: sessionId, sourceKey, slug. */
  params: z.record(z.string(), z.string()),
  /** Every published page of the website, each visited at /$slug. */
  slugs: z.array(z.string()),
});
export type CensusContext = z.infer<typeof contextSchema>;

export function readContext(): CensusContext {
  const file = process.env['CENSUS_CONTEXT'];
  if (file === undefined || file === '') throw new Error('CENSUS_CONTEXT is not set: run the census through `pnpm census`');
  return contextSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export function sessionFile(context: CensusContext, person: Person): string {
  return join(context.dir, 'sessions', `${person}.json`);
}

const screenSchema = z.object({ app: z.enum(['player', 'console', 'tablet', 'door', 'display', 'web']), path: z.string(), kind: z.enum(['menu', 'tab', 'route', 'hidden']), anyOf: z.array(z.string()), source: z.string() });

/** The screens of catalogue.json, as `pnpm catalogue` wrote them. */
export function readScreens(): z.infer<typeof screenSchema>[] {
  const catalogue = z.object({ screens: z.array(screenSchema) }).parse(JSON.parse(readFileSync(join(SIM_HOME, 'catalogue.json'), 'utf8')));
  return catalogue.screens;
}
