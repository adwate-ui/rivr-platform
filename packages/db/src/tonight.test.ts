import { describe, expect, it } from 'vitest';
import { toMyTonight } from './tonight.ts';

const ROW = { is_kyc_complete: true, jackpot_paise: 51234500 };

describe('toMyTonight', () => {
  it('reads the identity check and the jackpot, money in paise as bigint', () => {
    expect(toMyTonight(ROW)).toEqual({ isKycComplete: true, jackpot: 51234500n });
  });

  it('leaves out what the member may not see', () => {
    expect(toMyTonight({ is_kyc_complete: false, jackpot_paise: null })).toEqual({ isKycComplete: false, jackpot: null });
  });
});
