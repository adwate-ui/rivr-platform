/** Loads the club into a freshly reset copy: the sim schema and its people, the calendar, the apps' calls, night 0. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCalendar } from '../src/calendar/calendar.ts';
import type { Catalogue } from '../src/catalogue/catalogue.ts';
import { joinerRows, nightRows } from '../src/night/rows.ts';
import { SIM_HOME } from '../src/paths.ts';
import { joinersOn } from '../src/people/growth.ts';
import { sql } from './stack/psql.ts';

const SQL_DIR = new URL('../sql/', import.meta.url).pathname;
const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

export interface RunIds {
  id: string;
  main: string;
  harness: string;
}

export function loadClub(catalogue: Catalogue, run: RunIds): void {
  // 00_clock.sql is applied as the copy's first migration by prepare; the rest load in name order.
  for (const name of readdirSync(SQL_DIR).filter((file) => file.endsWith('.sql') && !file.startsWith('00_')).sort()) {
    sql(readFileSync(join(SQL_DIR, name), 'utf8'));
  }
  const nights = buildCalendar();
  sql(nightRows(nights));
  sql(joinerRows(new Map(nights.map((night) => [night.n, joinersOn(night.n)]))));
  const names = [...new Set(catalogue.rpcs.map((rpc) => rpc.name))];
  sql(`insert into sim.rpc (name) values ${names.map((name) => `(${quote(name)})`).join(', ')}`);
  sql(`insert into sim.config values ('run', ${quote(run.id)}), ('main', ${quote(run.main)}), ('harness', ${quote(run.harness)})`);
  sql('select sim.day0()');
}

/** The newest run that has snapshots (run ids are the minute they started, YYYYMMDDHHMM). */
export function latestRun(): string {
  const runs = readdirSync(join(SIM_HOME, 'runs')).filter((name) => /^\d{12}$/.test(name)).sort();
  const latest = runs.at(-1);
  if (latest === undefined) throw new Error('no run yet: run `pnpm sim -- --reset --to=…` first');
  return latest;
}

/** The night the stack's club has reached (0 after night 0). */
export function nightReached(): number {
  return Number(sql('select sim.day()').trim());
}

export function runIdOf(): string {
  return sql("select v from sim.config where k = 'run'").trim();
}
