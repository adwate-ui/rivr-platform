import { describe, expect, it } from 'vitest';
import { gamesFrom } from './siteLive.ts';

/** A row of public_table_status for a table of game `code`, with a buy-in of 100 small blinds. */
const row = (code: string, name: string, isOpen: boolean, small: number) => ({
  table_type_code: code, table_type_name: name, is_open: isOpen, small_blind_paise: small, big_blind_paise: small * 2,
  buy_in_min_paise: small * 100, buy_in_max_paise: small * 100, straddle_paise: null,
});

describe('gamesFrom', () => {
  it('lists each game once, in the floor order of its first table, counting its open tables', () => {
    const rows = [
      row('nlh_50_100', 'NLH 50/100', true, 5000),
      row('nlh_100_200', 'NLH 100/200', true, 10000),
      row('nlh_100_200', 'NLH 100/200', false, 10000),
      row('nlh_100_200', 'NLH 100/200', true, 10000),
    ];
    expect(gamesFrom(rows).map((game) => [game.name, game.tablesOpen, game.bigBlind])).toEqual([
      ['NLH 50/100', 1, 10000n],
      ['NLH 100/200', 2, 20000n],
    ]);
  });

  it('leaves out a row the view could not fill', () => {
    expect(gamesFrom([{ ...row('x', 'X', true, 5000), table_type_name: null }])).toEqual([]);
  });
});
