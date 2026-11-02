import { describe, expect, it } from 'vitest';
import { formatOrdinal } from './ordinal.ts';

describe('a place in English', () => {
  it('says 1st, 2nd, 3rd, then th, and the teens with th', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(formatOrdinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th']);
  });
});
