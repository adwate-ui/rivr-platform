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
  /** Null for a member who hid their name on the TVs (#326): the TV shows their place instead. */
  readonly name: string | null;
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

/** A seated player on the TV's call-time board (decision 0163). */
export interface TvSeated {
  readonly seat: number;
  /** A first name and initial; null for a member who hid their name on the TVs (#326). */
  readonly name: string | null;
  /** Whole seconds of call time left when the board was read; null where the table's type has none. */
  readonly callTimeLeft: number | null;
  /** Away from the table: the clock stands still. */
  readonly isAway: boolean;
  /** The floor marked the player leaving: the seat opens once their call time is done. */
  readonly isLeaving: boolean;
}

/** A table on the call-time board, with its seated players by seat. */
export interface TvCallTimeTable {
  readonly tableId: string;
  readonly name: string;
  /** The table's game and stake: "NLH 100/200". */
  readonly stake: string;
  readonly seated: readonly TvSeated[];
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
// However many signals arrive, the board is read again at most once every two seconds.
const SIGNAL_SETTLE = 2_000;

// The query each board's signal reads again; promotions is the Promotions rotation's (#86). The TV's screen listens (useTvSignals).
const BOARD_KEYS = {
  waitlist: queryKeys.tvWaitlistBoard, call_time: queryKeys.tvCallTimeBoard, jackpot: queryKeys.tvJackpot, promotions: queryKeys.tvPromotions,
};

/**
 * Reads each of the TV's boards again when the database broadcasts on the venue's private topic
 * (tv:<venue id>, decision 0051) that it changed: once, two seconds after the first signal, however
 * many follow. One channel for the whole TV, opened once by the TV's screen: a board that comes round
 * in a rotation (decision 0163) would otherwise ask for the topic while the last board's channel is
 * still leaving it, and hear nothing.
 */
export function useTvSignals(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return undefined;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const channel = client.channel(`tv:${venueId}`, { config: { private: true } });
    for (const [board, key] of Object.entries(BOARD_KEYS)) {
      channel.on('broadcast', { event: board }, () => {
        if (pending.has(board)) return;
        pending.set(board, setTimeout(() => {
          pending.delete(board);
          void queryClient.invalidateQueries({ queryKey: key(userId) });
        }, SIGNAL_SETTLE));
      });
    }
    channel.subscribe();
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId, venueId]);
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
    if (row.place !== null) {
      last.places.push({ place: row.place, name: row.display_name, calledTo: row.call_table_name, isAway: row.is_away === true });
    }
  }
  return stakes.map(({ stake, places }) => ({ ...stake, places }));
}

interface CallTimeRow {
  table_id: string;
  table_name: string;
  stake_name: string;
  seat: number;
  display_name: string | null;
  call_time_left: number | null;
  is_away: boolean;
  leaving_at: string | null;
}

/** The call-time board's rows, a table at a time in the order they come (the room's), each table's players by seat. */
export function toTvCallTimeTables(rows: readonly CallTimeRow[]): TvCallTimeTable[] {
  const tables: { table: Omit<TvCallTimeTable, 'seated'>; seated: TvSeated[] }[] = [];
  for (const row of rows) {
    let last = tables.at(-1);
    if (last?.table.tableId !== row.table_id) {
      last = { table: { tableId: row.table_id, name: row.table_name, stake: row.stake_name }, seated: [] };
      tables.push(last);
    }
    last.seated.push({
      seat: row.seat, name: row.display_name, callTimeLeft: row.call_time_left, isAway: row.is_away, isLeaving: row.leaving_at !== null,
    });
  }
  return tables.map(({ table, seated }) => ({ ...table, seated }));
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

/** The signed-in TV's waitlist board at its venue, live while the TV's screen listens for signals (useTvSignals). */
export function useTvWaitlistBoard() {
  const { client, userId } = useRivrData();
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

/**
 * The signed-in TV's call-time board at its venue, live while the TV's screen listens for signals: every
 * seated player still on call time or leaving, by table, with the call time left when read (the query's `dataUpdatedAt` says when, for the TV to count down from).
 */
export function useTvCallTimeBoard() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvCallTimeBoard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvCallTimeTable[]> => {
      const { data, error } = await client.rpc('tv_call_time_board');
      if (error) throw error;
      return toTvCallTimeTables(data);
    },
  });
}

/** The signed-in TV's jackpot and tonight's high hand at its venue, live while the TV's screen listens for signals. */
export function useTvJackpot() {
  const { client, userId } = useRivrData();
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
