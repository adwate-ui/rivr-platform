import type { Paise } from '@rivr/domain/money';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Database } from './database.types.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

type HighHandCategory = Database['public']['Enums']['high_hand_category'];

/** A place on the TV's waitlist board (#65): the player as a first name and initial. */
export interface TvPlace {
  readonly place: number;
  readonly name: string;
  /** The table the player is called to, if called. */
  readonly calledTo: string | null;
  readonly isAway: boolean;
}

/** One stake on the TV's waitlist board, with the tables open at it and its places in order. */
export interface TvStake {
  readonly tableTypeId: string;
  readonly name: string;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  readonly openTables: number;
  readonly places: readonly TvPlace[];
}

/** The TV's jackpot: the main pool, and tonight's best high hand (null before one is paid). */
export interface TvJackpot {
  readonly main: Paise;
  readonly highHand: {
    readonly category: HighHandCategory;
    /** The rank of a four of a kind (Q for Queens); null otherwise. */
    readonly rank: string | null;
    readonly tableName: string;
    readonly playedAt: string;
    readonly payout: Paise;
  } | null;
}

// Realtime tells the TV when a board changes; it also asks again every half minute, in case a
// signal is missed while the connection drops.
const BOARD_CHECK = 30_000;

/** Reads a board again whenever its venue's signal moves (tv_signal, through Realtime). */
function useBoardSignal(board: 'waitlist' | 'jackpot') {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return undefined;
    const key = board === 'waitlist' ? queryKeys.tvWaitlistBoard(userId) : queryKeys.tvJackpot(userId);
    const channel = client.channel(`tv-${board}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_signal', filter: `board=eq.${board}` }, () => {
        void queryClient.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId, board]);
}

interface BoardRow {
  table_type_id: string;
  table_type_name: string;
  small_blind_paise: number;
  big_blind_paise: number;
  open_tables: number;
  place: number | null;
  display_name: string | null;
  call_table_name: string | null;
  is_away: boolean | null;
}

/** The board's rows, a stake at a time in the order they come, each stake's places in order. */
export function toTvStakes(rows: readonly BoardRow[]): TvStake[] {
  const stakes: { stake: Omit<TvStake, 'places'>; places: TvPlace[] }[] = [];
  for (const row of rows) {
    let last = stakes.at(-1);
    if (last?.stake.tableTypeId !== row.table_type_id) {
      last = {
        stake: { tableTypeId: row.table_type_id, name: row.table_type_name, smallBlind: toPaise(row.small_blind_paise),
          bigBlind: toPaise(row.big_blind_paise), openTables: row.open_tables },
        places: [],
      };
      stakes.push(last);
    }
    if (row.place !== null && row.display_name !== null) {
      last.places.push({ place: row.place, name: row.display_name, calledTo: row.call_table_name, isAway: row.is_away === true });
    }
  }
  return stakes.map(({ stake, places }) => ({ ...stake, places }));
}

interface JackpotRow {
  main_paise: number;
  high_hand_category: HighHandCategory | null;
  high_hand_rank: string | null;
  high_hand_table_name: string | null;
  high_hand_played_at: string | null;
  high_hand_payout_paise: number | null;
}

/** The jackpot row: the main pool, and tonight's high hand when every part of it is there. */
export function toTvJackpot(row: JackpotRow): TvJackpot {
  const { high_hand_category: category, high_hand_table_name: tableName, high_hand_played_at: playedAt, high_hand_payout_paise: payout } = row;
  const highHand = category === null || tableName === null || playedAt === null || payout === null ? null
    : { category, rank: row.high_hand_rank, tableName, playedAt, payout: toPaise(payout) };
  return { main: toPaise(row.main_paise), highHand };
}

/** The signed-in TV's waitlist board, live. */
export function useTvWaitlistBoard() {
  const { client, userId } = useRivrData();
  useBoardSignal('waitlist');
  return useQuery({
    queryKey: queryKeys.tvWaitlistBoard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvStake[]> => {
      const { data, error } = await client.rpc('tv_waitlist_board');
      if (error) throw error;
      return toTvStakes(data);
    },
  });
}

/** The signed-in TV's jackpot and tonight's high hand, live. */
export function useTvJackpot() {
  const { client, userId } = useRivrData();
  useBoardSignal('jackpot');
  return useQuery({
    queryKey: queryKeys.tvJackpot(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvJackpot | null> => {
      const { data, error } = await client.rpc('tv_jackpot');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : toTvJackpot(row);
    },
  });
}
