/** Members joining the club over the 180 nights, each with a way of playing (persona) and the way they found it. */
import { createRandom } from '../calendar/random.ts';

const START = 150;
const END = 800;
// Faster at first: about 58% of the growth lands in the first 60 nights.
const RATE = 0.012;

/** Grinders play most nights; regulars weekly; casuals now and then; walk-ins first come to the desk; event players
 * come for events; lapsed members stop after a few weeks and come back near the end. */
export const PERSONA_SHARES = { grinder: 0.15, regular: 0.3, casual: 0.35, walk_in: 0.1, event: 0.05, lapsed: 0.05 } as const satisfies Record<string, number>;
export type Persona = keyof typeof PERSONA_SHARES;

const SOURCE_SHARES = { creator_code: 0.3, referral: 0.25, walk_in: 0.25, website: 0.2 } as const satisfies Record<string, number>;
export type Source = keyof typeof SOURCE_SHARES;

export interface Joiner {
  persona: Persona;
  source: Source;
}

/** Members on the books after night n (0 is launch day, before the first night). */
export function membersOn(n: number): number {
  const fraction = (1 - Math.exp(-RATE * n)) / (1 - Math.exp(-RATE * 180));
  return Math.round(START + (END - START) * fraction);
}

function pick<K extends string>(shares: Readonly<Record<K, number>>, keys: readonly K[], roll: number): K {
  let left = roll;
  for (const key of keys) {
    left -= shares[key];
    if (left < 0) return key;
  }
  const last = keys[keys.length - 1];
  if (last === undefined) throw new Error('no keys to pick from');
  return last;
}

const PERSONAS: readonly Persona[] = ['grinder', 'regular', 'casual', 'walk_in', 'event', 'lapsed'];
const SOURCES: readonly Source[] = ['creator_code', 'referral', 'walk_in', 'website'];

/** Who joins on night n: the same people every run. */
export function joinersOn(n: number): Joiner[] {
  const random = createRandom(1000 + n);
  return Array.from({ length: membersOn(n) - membersOn(n - 1) }, () => ({
    persona: pick(PERSONA_SHARES, PERSONAS, random()),
    source: pick(SOURCE_SHARES, SOURCES, random()),
  }));
}
