import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { leagueFinishPoints, leagueMonth, type LeagueFinishPoints } from './league.ts';

/** Up to 1,000 League points for each part of a finish; places in a field of up to 500. */
const points = fc.bigInt({ min: 0n, max: 1_000n });
const schedule: fc.Arbitrary<LeagueFinishPoints> = fc.record({ first: points, second: points, third: points, finalTable: points, entry: points });
const place = fc.bigInt({ min: 1n, max: 500n });
/** Any moment from 2026 to 2035. */
const moment = fc.date({ min: new Date('2026-01-01T00:00:00Z'), max: new Date('2035-12-31T23:59:59Z'), noInvalidDate: true });

const HOUR_MS = 60 * 60 * 1000;

describe('leagueFinishPoints properties', () => {
  it('gives every finisher at least the points for taking part', () => {
    fc.assert(fc.property(place, schedule, (finish, table) => {
      expect(leagueFinishPoints(finish, table) >= table.entry).toBe(true);
    }));
  });

  it('gives nothing beyond taking part below the final table', () => {
    fc.assert(fc.property(fc.bigInt({ min: 10n, max: 500n }), schedule, (finish, table) => {
      expect(leagueFinishPoints(finish, table)).toBe(table.entry);
    }));
  });

  it('gives the same points to every place from fourth to ninth', () => {
    fc.assert(fc.property(fc.bigInt({ min: 4n, max: 9n }), schedule, (finish, table) => {
      expect(leagueFinishPoints(finish, table)).toBe(table.entry + table.finalTable);
    }));
  });

  it('refuses a place below first or negative points', () => {
    const table = { first: 100n, second: 70n, third: 50n, finalTable: 20n, entry: 5n };
    expect(() => leagueFinishPoints(0n, table)).toThrow(RangeError);
    expect(() => leagueFinishPoints(1n, { ...table, entry: -1n })).toThrow(RangeError);
    expect(() => leagueFinishPoints(1n, { ...table, finalTable: -1n })).toThrow(RangeError);
  });
});

describe('leagueMonth properties', () => {
  it('is always the first of a month', () => {
    fc.assert(fc.property(moment, (at) => {
      expect(leagueMonth(at)).toMatch(/^\d{4}-(0[1-9]|1[0-2])-01$/);
    }));
  });

  it('is the month of the IST calendar day six hours before', () => {
    fc.assert(fc.property(moment, (at) => {
      // IST is UTC+05:30; six hours before in IST is UTC-00:30.
      const sixHoursBeforeInIst = new Date(at.getTime() + 5.5 * HOUR_MS - 6 * HOUR_MS).toISOString();
      expect(leagueMonth(at)).toBe(`${sixHoursBeforeInIst.slice(0, 7)}-01`);
    }));
  });
});
