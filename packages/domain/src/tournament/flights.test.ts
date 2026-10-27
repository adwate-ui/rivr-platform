import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dayTwoField, type FlightRun } from './flights.ts';

describe('dayTwoField', () => {
  it('refuses a bag of no chips, a place outside its flight, a flight with no runs and a run with no player', () => {
    expect(() => dayTwoField([{ player: 'Mihir', chips: 0n }])).toThrow('Each run a player\'s, bagged with chips above nothing or out in a place of its flight');
    expect(() => dayTwoField([{ player: 'Yash', place: 0, flightRuns: 9 }])).toThrow(RangeError);
    expect(() => dayTwoField([{ player: 'Yash', place: 2.5, flightRuns: 9 }])).toThrow(RangeError);
    expect(() => dayTwoField([{ player: 'Yash', place: 1, flightRuns: 0 }])).toThrow(RangeError);
    expect(() => dayTwoField([{ player: '', chips: 100n }])).toThrow(RangeError);
  });

  it('keeps a bag over any run that was out, whichever came first', () => {
    expect(dayTwoField([{ player: 'Yash', chips: 100n }, { player: 'Yash', place: 1, flightRuns: 50 }])).toEqual({ through: [0], out: [] });
  });
});

/** Runs of a few players across flights: bagged, or out in a place of a flight of up to 60. */
const run: fc.Arbitrary<FlightRun> = fc.oneof(
  fc.record({ player: fc.constantFrom('Mihir', 'Yash', 'Ritika', 'Aditi'), chips: fc.bigInt({ min: 1n, max: 1_000_000n }) }),
  fc.integer({ min: 1, max: 60 }).chain((flightRuns) => fc.record({
    player: fc.constantFrom('Mihir', 'Yash', 'Ritika', 'Aditi'),
    place: fc.integer({ min: 1, max: flightRuns }),
    flightRuns: fc.constant(flightRuns),
  })),
);

describe('dayTwoField properties', () => {
  it('places every player once: through if any run was bagged, with their biggest bag, else out', () => {
    fc.assert(fc.property(fc.array(run, { maxLength: 30 }), (runs) => {
      const field = dayTwoField(runs);
      const chosen = [...field.through, ...field.out].map((index) => runs[index]?.player);
      expect(new Set(chosen).size).toBe(chosen.length);
      expect(new Set(chosen)).toEqual(new Set(runs.map((each) => each.player)));
      for (const index of field.through) {
        const kept = runs[index];
        if (kept === undefined || !('chips' in kept)) throw new Error('Through is a bag');
        for (const other of runs) if (other.player === kept.player && 'chips' in other) expect(other.chips <= kept.chips).toBe(true);
      }
      for (const index of field.out) {
        const player = runs[index]?.player;
        expect(runs.some((each) => each.player === player && 'chips' in each)).toBe(false);
      }
    }));
  });

  it('lists those out by players outlasted, the most first', () => {
    fc.assert(fc.property(fc.array(run, { maxLength: 30 }), (runs) => {
      const outlasted = dayTwoField(runs).out.map((index) => {
        const kept = runs[index];
        return kept !== undefined && 'place' in kept ? kept.flightRuns - kept.place : -1;
      });
      outlasted.slice(1).forEach((count, index) => expect(count).toBeLessThanOrEqual(outlasted[index] ?? 0));
    }));
  });
});
