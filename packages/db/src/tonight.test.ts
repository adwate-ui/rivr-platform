import { describe, expect, it } from 'vitest';
import { toMyTonight } from './tonight.ts';

const ROW = {
  is_kyc_complete: true, jackpot_paise: 51234500, tournament_name: 'RIVR Sunday', tournament_starts_at: '2026-11-15T10:30:00+00:00',
  tournament_buy_in_paise: 1000000, tournament_guarantee_paise: 50000000,
};

describe('toMyTonight', () => {
  it('reads the identity check, the jackpot and the next tournament, money in paise as bigint', () => {
    expect(toMyTonight(ROW)).toEqual({
      isKycComplete: true, jackpot: 51234500n,
      nextTournament: { name: 'RIVR Sunday', startsAt: '2026-11-15T10:30:00+00:00', buyIn: 1000000n, guarantee: 50000000n },
    });
  });

  it('leaves out what the member may not see, or what is not coming', () => {
    expect(toMyTonight({ ...ROW, is_kyc_complete: false, jackpot_paise: null, tournament_name: null, tournament_starts_at: null,
      tournament_buy_in_paise: null, tournament_guarantee_paise: null })).toEqual({ isKycComplete: false, jackpot: null, nextTournament: null });
    expect(toMyTonight({ ...ROW, tournament_guarantee_paise: null }).nextTournament?.guarantee).toBeNull();
  });
});
