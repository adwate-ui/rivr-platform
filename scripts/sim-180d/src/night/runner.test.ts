import { describe, expect, it } from 'vitest';
import type { Night } from '../calendar/calendar.ts';
import { downOn, RACE_STEP, RACES, racesFor, runNight, STEPS, type NightDeps } from './runner.ts';

const night = (overrides: Partial<Night> = {}): Night => ({ n: 2, date: '2026-11-16', weekday: 1, expected: 40, peak: false, events: [], ...overrides });

function fakeDeps(racePlan = 'select 1\tselect 2') {
  const calls: string[] = [];
  const started: string[] = [];
  const downs: string[][] = [];
  const deps: NightDeps = {
    sql(text) {
      calls.push(text);
      if (text.startsWith('select extract(epoch')) return '1794729600\n';
      if (text.startsWith('select a, b from sim.race_plan')) return `${racePlan}\n`;
      return '';
    },
    async together(statements) {
      started.push(...statements);
      // Both were sent before either is read back.
      expect(started.slice(-2)).toEqual([...statements]);
      return Promise.resolve(['', ''] as const);
    },
    async messages(at, down) {
      expect(at.getTime()).toBe(1794729600 * 1000);
      downs.push([...down]);
      return Promise.resolve({ delivered: 2, failed: 1 });
    },
  };
  return { deps, calls, started, downs };
}

describe('racesFor', () => {
  it('runs one race a night in turn, and all of them on a peak night', () => {
    expect(racesFor({ n: 1, peak: false })).toEqual([RACES[1]]);
    expect(racesFor({ n: 5, peak: false })).toEqual([RACES[0]]);
    expect(racesFor({ n: 47, peak: true })).toEqual([...RACES]);
  });
});

describe('downOn', () => {
  it('takes WhatsApp down on the outage night only', () => {
    expect(downOn({ events: ['whatsapp_outage'] })).toEqual(['whatsapp']);
    expect(downOn({ events: ['launch'] })).toEqual([]);
  });
});

describe('runNight', () => {
  it('opens, runs every step in order, races once, closes and runs the morning', async () => {
    const { deps, calls, started } = fakeDeps();
    const result = await runNight(night(), deps);
    const acts = calls.filter((text) => text.startsWith('select sim.'));
    expect(acts[0]).toBe('select sim.open_night(2)');
    expect(acts.slice(1, STEPS + 1)).toEqual(Array.from({ length: STEPS }, (_, step) => `select sim.step(2, ${step})`));
    expect(acts.slice(-2)).toEqual(['select sim.close_night(2)', 'select sim.morning(2)']);
    expect(calls.indexOf(`select a, b from sim.race_plan('${RACES[2]}')`)).toBe(calls.indexOf(`select sim.step(2, ${RACE_STEP})`) + 1);
    expect(started).toEqual(['select 1', 'select 2']);
    // One delivery round after opening, after each step, after closing and in the morning.
    expect(result).toEqual({ n: 2, races: [RACES[2]], delivered: 2 * (STEPS + 3), failed: STEPS + 3 });
  });

  it('skips a race with nobody to race over', async () => {
    const { deps, started } = fakeDeps('');
    await runNight(night(), deps);
    expect(started).toEqual([]);
  });

  it('keeps WhatsApp down through the outage night and brings it back for the morning', async () => {
    const { deps, downs } = fakeDeps();
    await runNight(night({ events: ['whatsapp_outage'] }), deps);
    expect(downs.slice(0, -1).every((down) => down.join() === 'whatsapp')).toBe(true);
    expect(downs.at(-1)).toEqual([]);
  });
});
