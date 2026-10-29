import { describe, expect, it } from 'vitest';
import { gamesFrom, rulesFrom } from './siteLive.ts';

/** A row of public_table_status for a table of game `code`, with a buy-in of 100 small blinds. */
const row = (code: string, name: string, small: number) => ({
  table_type_code: code, table_type_name: name, small_blind_paise: small, big_blind_paise: small * 2,
  buy_in_min_paise: small * 100, buy_in_max_paise: small * 100, straddle_paise: null,
});

describe('gamesFrom', () => {
  it('lists each game once, in the floor order of its first table, with its stakes only', () => {
    const rows = [row('nlh_50_100', 'NLH 50/100', 5000), row('nlh_100_200', 'NLH 100/200', 10000), row('nlh_100_200', 'NLH 100/200', 10000)];
    expect(gamesFrom(rows)).toEqual([
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null },
      { name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, buyInMax: 1000000n, straddle: null },
    ]);
  });

  it('leaves out a row the view could not fill', () => {
    expect(gamesFrom([{ ...row('x', 'X', 5000), table_type_name: null }])).toEqual([]);
  });
});

describe('rulesFrom', () => {
  it('has no rule set when there are no rows', () => {
    expect(rulesFrom([])).toEqual({
      pointsPerHour: [], rakebackBasisPoints: [], hotelNightHours: [], rewardsRakeShareBasisPoints: null, cabVisits: null,
      leaguePrizes: { month: null, season: null },
    });
  });

  it('reads each table type’s rule by its name, and leaves out one whose value it cannot read or a share of nothing', () => {
    const rules = rulesFrom([
      { key: 'accommodation.hours_per_night', subject_name: 'Private Room', value: { hours: 20 } },
      { key: 'accommodation.hours_per_night', subject_name: 'NLH 50/100', value: { hours: 'many' } },
      { key: 'points.per_hour', subject_name: null, value: { points: 5 } },
      { key: 'points.rewards_rake_share', subject_name: null, value: { basis_points: 0 } },
    ]);
    expect(rules.hotelNightHours).toEqual([{ table: 'Private Room', value: 20 }]);
    expect(rules.pointsPerHour).toEqual([]);
    expect(rules.rewardsRakeShareBasisPoints).toBeNull();
  });
});
