import { useQuery } from '@tanstack/react-query';
import type { LeagueBoardRow } from './myRewards.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// The board's rows are the member's League's, which the player app reads from @rivr/db/myRewards.
export type { LeagueBoardRow } from './myRewards.ts';

/** A points leader on the TV's rewards ticker (#148): this League month's points earned at the tables. */
export interface TvPointsLeader {
  readonly place: number;
  /** A first name and initial; null for a member who hid their name on the TVs (#326). */
  readonly name: string | null;
  readonly points: bigint;
}

/** A redemption on the TV's rewards ticker: who (as a leader is named), what, and when. */
export interface TvRedemption {
  readonly name: string | null;
  readonly rewardName: string;
  readonly at: string;
}

/** The TV's rewards ticker (decision 0183): the five points leaders this month, and the week's last ten redemptions. */
export interface TvRewardsTicker {
  readonly leaders: readonly TvPointsLeader[];
  readonly redemptions: readonly TvRedemption[];
}

// A redemption or a finish tells the TV at once (useTvSignals); it also asks again every half minute.
const BOARD_CHECK = 30_000;

/** The paired TV's rewards ticker, while the board is its mode or in its rotation; empty otherwise. */
export function useTvRewardsTicker() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvRewardsTicker(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvRewardsTicker> => {
      const { data, error } = await client.rpc('tv_rewards_ticker');
      if (error) throw error;
      return {
        leaders: data.filter((row) => row.kind === 'leader').map((row) => ({ place: row.place, name: row.display_name, points: BigInt(row.points) })),
        redemptions: data.filter((row) => row.kind === 'redemption').map((row) => ({ name: row.display_name, rewardName: row.reward_name, at: row.at })),
      };
    },
  });
}

/** The paired TV's League leaderboard (decision 0182): this month's top ten and the season's, while the board is shown. */
export function useTvLeagueBoard() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvLeagueBoard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<LeagueBoardRow[]> => {
      const { data, error } = await client.rpc('tv_league_board');
      if (error) throw error;
      // Mapped here rather than through myRewards' mapper, so the player's first load never reaches that module (#344).
      return data.map((row) => ({
        standing: row.standing === 'season' ? 'season' : 'month', seasonName: row.season_name, firstMonth: row.first_month, lastMonth: row.last_month,
        place: row.place, name: row.display_name, points: BigInt(row.points), isMe: false,
      }));
    },
  });
}
