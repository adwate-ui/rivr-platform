import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { splitDrop } from './jackpot.ts';

describe('jackpot rules a caller can get wrong', () => {
  // Each refusal is checked by its own words: shareOf and BigInt throw a RangeError too, so any RangeError would pass
  // with the guard gone.
  it('refuses shares of the drop below nought or above 100% together', () => {
    expect(() => splitDrop(fromPaise(10_000n), { season: -1n, freeroll: 0n }))
      .toThrow('The season and freeroll shares (-1 and 0 basis points) are not 0% to 100% together');
    expect(() => splitDrop(fromPaise(10_000n), { season: 0n, freeroll: -1n })).toThrow('(0 and -1 basis points)');
    expect(() => splitDrop(fromPaise(10_000n), { season: 5_000n, freeroll: 5_001n })).toThrow('(5000 and 5001 basis points)');
    expect(splitDrop(fromPaise(10_000n), { season: 5_000n, freeroll: 5_000n })).toEqual({ main: 0n, season: 5_000n, freeroll: 5_000n });
  });
});
