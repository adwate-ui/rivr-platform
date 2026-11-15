import type { TvLeaderboardPeriod } from '@rivr/contracts';
import type { Paise } from '@rivr/domain/money';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A place on the TV's waitlist board (#65): the player as a first name and initial. */
export interface TvPlace {
  readonly place: number;
  /** Null for a member who hid their name on the TVs (#326): the TV shows their place instead. */
  readonly name: string | null;
  /** The table the player is called to, if called. */
  readonly calledTo: string | null;
  readonly isAway: boolean;
}

/**
 * One table's list on the TV's waitlist board (decision 0467): an open table, or a closed one somebody waits for, with its
 * stake and its places in order.
 */
export interface TvTableList {
  readonly tableId: string;
  readonly name: string;
  /** The stake's name: "NLH 100/200". */
  readonly stake: string;
  /** The stake's game, as `nlh`, and its figures: the blinds, and the straddle or null with none (issue 990). */
  readonly game: string;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  readonly straddle: Paise | null;
  readonly isOpen: boolean;
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
  /** The stake's game, as `nlh`, and its figures: the blinds, and the straddle or null with none (issue 990). */
  readonly game: string;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  readonly straddle: Paise | null;
  readonly seated: readonly TvSeated[];
}

// Realtime tells the TV when a board changes; it also asks again every half minute, in case a
// signal is missed while the connection drops.
const BOARD_CHECK = 30_000;
// However many signals arrive, the board is read again at most once every two seconds.
const SIGNAL_SETTLE = 2_000;

// The query each board's signal reads again; promotions is the Promotions rotation's (#86). The TV's screen listens (useTvSignals).
const BOARD_KEYS = {
  waitlist: queryKeys.tvWaitlistBoard, call_time: queryKeys.tvCallTimeBoard, promotions: queryKeys.tvPromotions,
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
  table_id: string;
  table_name: string;
  table_type_name: string;
  game: string;
  small_blind_paise: number;
  big_blind_paise: number;
  straddle_paise: number | null;
  is_open: boolean;
  place: number | null;
  display_name: string | null;
  call_table_name: string | null;
  is_away: boolean | null;
}

/** A row's stake in figures: its game, its blinds and its straddle, or null with none. */
function figuresOf(row: { game: string; small_blind_paise: number; big_blind_paise: number; straddle_paise: number | null }) {
  return {
    game: row.game, smallBlind: toPaise(row.small_blind_paise), bigBlind: toPaise(row.big_blind_paise),
    straddle: row.straddle_paise === null ? null : toPaise(row.straddle_paise),
  };
}

/** The board's rows, a table at a time in the order they come (the floor's), each table's places in order. */
export function toTvTables(rows: readonly BoardRow[]): TvTableList[] {
  const tables: { table: Omit<TvTableList, 'places'>; places: TvPlace[] }[] = [];
  for (const row of rows) {
    let last = tables.at(-1);
    if (last?.table.tableId !== row.table_id) {
      last = {
        table: { tableId: row.table_id, name: row.table_name, stake: row.table_type_name, ...figuresOf(row), isOpen: row.is_open },
        places: [],
      };
      tables.push(last);
    }
    if (row.place !== null) {
      last.places.push({ place: row.place, name: row.display_name, calledTo: row.call_table_name, isAway: row.is_away === true });
    }
  }
  return tables.map(({ table, places }) => ({ ...table, places }));
}

interface CallTimeRow {
  table_id: string;
  table_name: string;
  stake_name: string;
  game: string;
  small_blind_paise: number;
  big_blind_paise: number;
  straddle_paise: number | null;
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
      last = { table: { tableId: row.table_id, name: row.table_name, stake: row.stake_name, ...figuresOf(row) }, seated: [] };
      tables.push(last);
    }
    last.seated.push({
      seat: row.seat, name: row.display_name, callTimeLeft: row.call_time_left, isAway: row.is_away, isLeaving: row.leaving_at !== null,
    });
  }
  return tables.map(({ table, seated }) => ({ ...table, seated }));
}

/** The signed-in TV's waitlist board at its venue, a list a table, live while the TV's screen listens for signals (useTvSignals). */
export function useTvWaitlistBoard() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvWaitlistBoard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvTableList[]> => {
      const { data, error } = await client.rpc('tv_waitlist_board');
      if (error) throw error;
      return toTvTables(data);
    },
  });
}

/**
 * A place on the TVs' hours leaderboard (decision 0581), in the period the club set: a first name and initial, or for a member
 * who hid their name on the TVs their member number, and the whole minutes played.
 */
export interface TvLeaderboardRow {
  readonly period: TvLeaderboardPeriod;
  readonly place: number;
  readonly name: string | null;
  readonly memberNumber: number | null;
  readonly minutes: number;
}

interface LeaderboardRecord {
  period: string;
  place: number;
  display_name: string | null;
  member_number: number | null;
  played_minutes: number;
}

/** The board's rows as the TV shows them; a period the app does not know reads as tonight, the board's own default. */
export function toTvLeaderboard(rows: readonly LeaderboardRecord[]): TvLeaderboardRow[] {
  return rows.map((row) => ({
    period: row.period === 'week' || row.period === 'month' || row.period === 'all' ? row.period : 'tonight',
    place: row.place, name: row.display_name, memberNumber: row.member_number, minutes: row.played_minutes,
  }));
}

/** The signed-in TV's hours leaderboard at its venue, in order; read every half minute, as hours grow while members play. */
export function useTvLeaderboard() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvLeaderboard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvLeaderboardRow[]> => {
      const { data, error } = await client.rpc('tv_leaderboard');
      if (error) throw error;
      return toTvLeaderboard(data);
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
