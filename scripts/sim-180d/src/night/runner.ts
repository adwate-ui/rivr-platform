/**
 * One club night, step by step. The database moves the clock and the people act (sql/10_night.sql); after each
 * ten-minute step the real message consumers run at the simulation's time. On one step a night two people act at
 * the same moment, in two sessions (a race); on peak nights every race runs.
 */
import type { Night } from '../calendar/calendar.ts';

export const STEPS = 60;
/** 21:20 IST: the room is full, so every race has someone to race over. */
export const RACE_STEP = 20;

export const RACES = ['seat_same_member', 'double_order', 'double_top_up', 'double_redeem', 'approve_vs_leave'] as const;
export type Race = (typeof RACES)[number];

export interface Delivery {
  delivered: number;
  failed: number;
}

export interface NightDeps {
  /** Runs SQL in one session and returns psql's tab-separated output. */
  sql(text: string): string;
  /** Two statements in two sessions at once: both are sent before either result is read. */
  together(statements: readonly [string, string]): Promise<readonly [string, string]>;
  /** Runs the message consumers at `at`, leaving out any whose name contains a word in `down`. */
  messages(at: Date, down: readonly string[]): Promise<Delivery>;
}

export interface NightResult extends Delivery {
  n: number;
  races: Race[];
}

/** One race a night, in turn; all of them on peak nights. */
export function racesFor(night: Pick<Night, 'n' | 'peak'>): Race[] {
  if (night.peak) return [...RACES];
  const race = RACES[night.n % RACES.length];
  return race === undefined ? [] : [race];
}

/** The consumers that are down on a night: WhatsApp during the scripted outage. */
export function downOn(night: Pick<Night, 'events'>): string[] {
  return night.events.includes('whatsapp_outage') ? ['whatsapp'] : [];
}

function simNow(deps: NightDeps): Date {
  return new Date(Number(deps.sql('select extract(epoch from sim_clock.now())').trim()) * 1000);
}

async function race(deps: NightDeps, name: Race): Promise<void> {
  const [first, second] = deps.sql(`select a, b from sim.race_plan('${name}')`).trim().split('\t');
  // Nobody to race over tonight (no one waiting, say): the plan returns no row.
  if (first === undefined || second === undefined || first === '' || second === '') return;
  await deps.together([first, second]);
}

export async function runNight(night: Night, deps: NightDeps): Promise<NightResult> {
  const down = downOn(night);
  const total: Delivery = { delivered: 0, failed: 0 };
  const add = (outcome: Delivery): void => {
    total.delivered += outcome.delivered;
    total.failed += outcome.failed;
  };
  const races = racesFor(night);
  deps.sql(`select sim.open_night(${night.n})`);
  add(await deps.messages(simNow(deps), down));
  for (let step = 0; step < STEPS; step += 1) {
    deps.sql(`select sim.step(${night.n}, ${step})`);
    if (step === RACE_STEP) for (const name of races) await race(deps, name);
    add(await deps.messages(simNow(deps), down));
  }
  deps.sql(`select sim.close_night(${night.n})`);
  add(await deps.messages(simNow(deps), down));
  // The morning after an outage, WhatsApp is back and its backlog goes out.
  deps.sql(`select sim.morning(${night.n})`);
  add(await deps.messages(simNow(deps), []));
  return { n: night.n, races, ...total };
}
