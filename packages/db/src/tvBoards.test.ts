import { describe, expect, it } from 'vitest';
import { toPaise } from './parse/hands.ts';
import { toTvJackpot, toTvStakes } from './tvBoards.ts';

const STAKE = { small_blind_paise: 10000, big_blind_paise: 20000, open_tables: 2 };

describe('the TV boards (#65)', () => {
  it('groups the waitlist a stake at a time, keeping an empty stake and each place in order', () => {
    const stakes = toTvStakes([
      { table_type_id: 'a', table_type_name: '50/100', ...STAKE, place: null, display_name: null, call_table_name: null, is_away: null },
      { table_type_id: 'b', table_type_name: '100/200', ...STAKE, place: 1, display_name: 'Kabir S.', call_table_name: 'Table 3', is_away: false },
      { table_type_id: 'b', table_type_name: '100/200', ...STAKE, place: 2, display_name: 'Naina K.', call_table_name: null, is_away: true },
    ]);
    expect(stakes.map((stake) => [stake.name, stake.places.length])).toEqual([['50/100', 0], ['100/200', 2]]);
    expect(stakes[1]?.places).toEqual([
      { place: 1, name: 'Kabir S.', calledTo: 'Table 3', isAway: false },
      { place: 2, name: 'Naina K.', calledTo: null, isAway: true },
    ]);
    expect(stakes[1]?.bigBlind).toBe(toPaise(20000));
  });

  it('gives the main pool, and tonight\'s high hand only when there is one', () => {
    const none = { high_hand_category: null, high_hand_rank: null, high_hand_table_name: null, high_hand_played_at: null, high_hand_payout_paise: null };
    expect(toTvJackpot({ main_paise: 34260000, ...none })).toEqual({ main: toPaise(34260000), highHand: null });
    expect(toTvJackpot({
      main_paise: 34260000, high_hand_category: 'four_of_a_kind', high_hand_rank: 'Q', high_hand_table_name: 'Table 2',
      high_hand_played_at: '2026-10-19T22:18:00+05:30', high_hand_payout_paise: 200000,
    }).highHand).toEqual({ category: 'four_of_a_kind', rank: 'Q', tableName: 'Table 2', playedAt: '2026-10-19T22:18:00+05:30', payout: toPaise(200000) });
  });
});
