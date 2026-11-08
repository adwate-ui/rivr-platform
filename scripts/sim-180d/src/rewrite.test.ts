import { describe, expect, it } from 'vitest';
import { findRealTimeCalls, rewriteTimeCalls } from './rewrite.ts';

describe('rewriteTimeCalls', () => {
  it.each([
    ['select now()', 'select sim_clock.now()'],
    ['default NOW()', 'default sim_clock.now()'],
    ['clock_timestamp() - x', 'sim_clock.clock_timestamp() - x'],
    ['statement_timestamp()', 'sim_clock.clock_timestamp()'],
    ['transaction_timestamp()', 'sim_clock.clock_timestamp()'],
    ['where d = current_date', 'where d = (sim_clock.now())::date'],
    ['at current_timestamp', 'at sim_clock.now()'],
  ])('rewrites %s', (input, output) => {
    expect(rewriteTimeCalls(input).text).toBe(output);
  });

  it('leaves qualified and longer names alone', () => {
    for (const text of ['pg_catalog.now()', 'sim_clock.now()', 'my_now()', 'current_date_x', 'x.current_date']) {
      expect(rewriteTimeCalls(text).text).toBe(text);
    }
  });

  it('counts each kind', () => {
    expect(rewriteTimeCalls('now(); now(); current_date; clock_timestamp()').counts).toEqual({
      now: 2,
      clock: 1,
      timestamp: 0,
      date: 1,
    });
  });

  it('is idempotent, so a second pass changes nothing', () => {
    const once = rewriteTimeCalls('select now(), current_date, current_timestamp').text;
    expect(rewriteTimeCalls(once).text).toBe(once);
  });
});

describe('findRealTimeCalls', () => {
  it('finds forms the rewrite does not handle', () => {
    expect(findRealTimeCalls("select 'now'::timestamptz, localtimestamp, current_time, current_timestamp(0)")).toEqual([
      "'now'::",
      'localtimestamp',
      'current_time',
      'current_timestamp(',
    ]);
  });

  it('finds nothing in rewritten text', () => {
    expect(findRealTimeCalls(rewriteTimeCalls('select now(), current_date').text)).toEqual([]);
  });
});
