import { describe, expect, it } from 'vitest';
import { gamesFrom, rulesFrom } from './siteLive.ts';

/** A row of public_table_status for a table of game `code`, with a buy-in of 100 small blinds. */
const row = (code: string, name: string, small: number) => ({
  table_type_code: code, table_type_name: name, small_blind_paise: small, big_blind_paise: small * 2,
  buy_in_min_paise: small * 100, straddle_paise: null,
});

describe('gamesFrom', () => {
  it('lists each game once, in the floor order of its first table, with its stakes only', () => {
    const rows = [row('nlh_50_100', 'NLH 50/100', 5000), row('nlh_100_200', 'NLH 100/200', 10000), row('nlh_100_200', 'NLH 100/200', 10000)];
    expect(gamesFrom(rows)).toEqual([
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, straddle: null },
      { name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, straddle: null },
    ]);
  });

  it('gives a game the least of its tables\' own minimum buy-ins, wherever that table stands on the floor (redesign RD-16)', () => {
    const table = (buyIn: number) => ({ ...row('nlh_100_200', 'NLH 100/200', 10000), buy_in_min_paise: buyIn });
    expect(gamesFrom([table(1000000), table(735000), table(2500000)]).map((game) => game.buyInMin)).toEqual([735000n]);
    expect(gamesFrom([table(735000), table(1000000)]).map((game) => game.buyInMin)).toEqual([735000n]);
  });

  it('leaves out a row the view could not fill', () => {
    expect(gamesFrom([{ ...row('x', 'X', 5000), table_type_name: null }])).toEqual([]);
  });
});

describe('rulesFrom', () => {
  it('has no rule set when there are no rows', () => {
    expect(rulesFrom([])).toEqual({ rakebackBasisPoints: [], cabVisits: null });
  });

  it('reads each table type’s rule by its name, and leaves out one it cannot read, one for no table and a rate of nothing', () => {
    const rules = rulesFrom([
      { key: 'rakeback.rate', subject_name: 'Private Room', value: { basis_points: 500 } },
      { key: 'rakeback.rate', subject_name: 'NLH 50/100', value: { basis_points: 'some' } },
      { key: 'rakeback.rate', subject_name: null, value: { basis_points: 500 } },
      { key: 'rakeback.rate', subject_name: 'NLH 100/200', value: { basis_points: 0 } },
    ]);
    expect(rules.rakebackBasisPoints).toEqual([{ table: 'Private Room', value: 500 }]);
  });
});
