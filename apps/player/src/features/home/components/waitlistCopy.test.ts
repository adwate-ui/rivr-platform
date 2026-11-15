import { describe, expect, it } from 'vitest';
import { stakeOf } from './waitlistCopy.ts';

const STAKE = { tableTypeName: 'NLH 100/200', game: 'nlh' as const, smallBlind: 10_000n, bigBlind: 20_000n, straddle: null };

describe('the stake of a place or a seat (issue 990)', () => {
  it('is its name, as before, while the stake has no straddle', () => {
    expect(stakeOf(STAKE)).toBe('NLH 100/200');
    expect(stakeOf({ ...STAKE, tableTypeName: 'Private Room' })).toBe('Private Room');
  });

  it('is written with the straddle once the stake has one', () => {
    expect(stakeOf({ ...STAKE, straddle: 50_000n })).toBe('NLH 100/200/500');
    expect(stakeOf({ ...STAKE, tableTypeName: 'Private Room', straddle: 50_000n })).toBe('Private Room · NLH 100/200/500');
  });
});
