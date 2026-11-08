import { describe, expect, it } from 'vitest';
import { joinersOn, membersOn, PERSONA_SHARES } from './growth.ts';

describe('membersOn', () => {
  it('grows from 150 to about 800, faster in the first 60 nights', () => {
    expect(membersOn(0)).toBe(150);
    expect(Math.abs(membersOn(180) - 800)).toBeLessThanOrEqual(20);
    const early = membersOn(60) - membersOn(0);
    const late = membersOn(180) - membersOn(120);
    expect(early).toBeGreaterThan(2 * late);
  });
});

describe('joinersOn', () => {
  it('makes the growth one member at a time, each with a persona and a source', () => {
    const total = Array.from({ length: 180 }, (_, index) => joinersOn(index + 1).length).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(membersOn(180) - membersOn(0));
    const first = joinersOn(1);
    expect(first.length).toBeGreaterThan(0);
    for (const joiner of first) {
      expect(Object.keys(PERSONA_SHARES)).toContain(joiner.persona);
      expect(['creator_code', 'referral', 'walk_in', 'website']).toContain(joiner.source);
    }
  });

  it('is the same every run', () => {
    expect(joinersOn(42)).toEqual(joinersOn(42));
  });

  it('keeps the persona mix over the run', () => {
    const all = Array.from({ length: 180 }, (_, index) => joinersOn(index + 1)).flat();
    const share = (persona: string) => all.filter((joiner) => joiner.persona === persona).length / all.length;
    expect(share('casual')).toBeCloseTo(PERSONA_SHARES.casual, 1);
    expect(share('regular')).toBeCloseTo(PERSONA_SHARES.regular, 1);
  });
});
