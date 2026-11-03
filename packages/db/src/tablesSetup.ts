import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The game a stake made before 2 Nov plays, as table_type.game has it; a stake made since has none (decision 0299). */
export type TableGame = 'nlh' | 'plo';

const gameOf = (value: string | null): TableGame | null => (value === 'plo' || value === 'nlh' ? value : null);

/** A stake the club runs (#642): a table type, with its blinds and any straddle in paise, and the game of an older one. */
export interface SetupStake {
  readonly id: string;
  readonly name: string;
  readonly game: TableGame | null;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly straddle: bigint | null;
}

/** A table (#642): its name, stake and seats, whether it plays now, and whether it is active (decision 0432). */
export interface SetupTable {
  readonly id: string;
  readonly name: string;
  readonly stakeId: string;
  readonly seats: number;
  readonly isOpen: boolean;
  /** False once deactivated: hidden from everything live, kept for history; reactivating brings it back closed. */
  readonly isActive: boolean;
  /** The players seated at it now, and the places waiting on its list or called to it: @rivr/domain's TableInPlay. */
  readonly seated: number;
  readonly waiting: number;
}

/**
 * Why a setup change was refused. `players_seated` and `players_waiting` are @rivr/domain's tableRetireRefusal reasons
 * (decision 0432); a stake change refused for players seated or waiting is `players_seated`.
 */
export type TablesFailure = 'not_allowed' | 'invalid' | 'players_seated' | 'players_waiting' | 'seats_taken' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TablesFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23505': 'invalid', '23514': 'invalid', RVSTD: 'players_seated', RVWTG: 'players_waiting',
  RVOCC: 'seats_taken', RVFRZ: 'paused',
};

/**
 * The venue's stakes, smallest first, and its tables in floor order, for the super admin's Tables setup (#642): the inactive
 * ones too, marked, and never a deleted one (decision 0432).
 */
export function useTablesSetup(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tablesSetup(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<{ stakes: SetupStake[]; tables: SetupTable[] }> => {
      const [types, tables, inPlay] = await Promise.all([
        client.from('table_type').select('id, name, game, small_blind_paise, big_blind_paise, straddle_paise').eq('venue_id', venueId)
          .order('small_blind_paise').order('name'),
        client.from('game_table').select('id, name, table_type_id, seats, is_open, active').eq('venue_id', venueId).is('deleted_at', null)
          .order('position'),
        readInPlay(client, venueId),
      ]);
      if (types.error) throw types.error;
      if (tables.error) throw tables.error;
      return {
        stakes: types.data.map((row) => ({
          id: row.id, name: row.name, game: gameOf(row.game), smallBlind: BigInt(row.small_blind_paise), bigBlind: BigInt(row.big_blind_paise),
          straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise),
        })),
        tables: tables.data.map((row) => ({
          id: row.id, name: row.name, stakeId: row.table_type_id, seats: row.seats, isOpen: row.is_open, isActive: row.active,
          seated: countOf(inPlay.seated, row.id), waiting: countOf(inPlay.waiting, row.id),
        })),
      };
    },
  });
}

const countOf = (tableIds: readonly (string | null)[], tableId: string) => tableIds.filter((id) => id === tableId).length;

/**
 * Who keeps each table in play, for setup to say why a table cannot go before it is asked (decision 0432): the open seat
 * sessions' tables, and each waiting place's table and the table it is called to. Rows the role does not read count as
 * none; the database refuses on its own count either way.
 */
async function readInPlay(client: RivrClient, venueId: string): Promise<{ seated: (string | null)[]; waiting: (string | null)[] }> {
  const [seats, places] = await Promise.all([
    client.from('seat_session').select('table_id').eq('venue_id', venueId).is('ended_at', null),
    client.from('waitlist_entry').select('table_id, call_table_id').eq('venue_id', venueId).eq('status', 'waiting'),
  ]);
  if (seats.error) throw seats.error;
  if (places.error) throw places.error;
  // A place called to another table waits for that one too.
  const waiting = places.data.flatMap((place) => (place.call_table_id === null || place.call_table_id === place.table_id
    ? [place.table_id] : [place.table_id, place.call_table_id]));
  return { seated: seats.data.map((seat) => seat.table_id), waiting };
}

/** A stake as the setup screen saves it: a new one has no id; no straddle is null. */
export interface StakeOrder {
  readonly stakeId: string | null;
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly straddle: bigint | null;
}

/** A table as the setup screen saves it: a new one has no id. */
export interface TableOrder {
  readonly tableId: string | null;
  readonly name: string;
  readonly stakeId: string;
  readonly seats: number;
}

/**
 * Adds or changes stakes and tables, and deactivates, reactivates or deletes a table (tables.manage; decision 0432); each a
 * Result, and everything the person reads reloads, as a table leaving or coming back changes the live floor and the lists.
 */
export function useTablesSetupActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, TablesFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const saveStake = useMutation({
    mutationFn: async (order: StakeOrder) => {
      const blinds = {
        p_name: order.name.trim(), p_small_blind_paise: Number(order.smallBlind), p_big_blind_paise: Number(order.bigBlind),
      };
      // A new stake with no straddle has none; a changed stake's 0 takes its straddle off (decision 0299).
      const { error } = order.stakeId === null
        ? await client.rpc('add_table_type', { p_venue_id: venueId, ...blinds, ...(order.straddle === null ? {} : { p_straddle_paise: Number(order.straddle) }) })
        : await client.rpc('set_table_type', { p_type_id: order.stakeId, ...blinds, p_straddle_paise: Number(order.straddle ?? 0n) });
      return settle(error);
    },
  });
  const saveTable = useMutation({
    mutationFn: async (order: TableOrder) => {
      const table = { p_name: order.name.trim(), p_table_type_id: order.stakeId, p_seats: order.seats };
      const { error } = order.tableId === null
        ? await client.rpc('add_game_table', { p_venue_id: venueId, ...table })
        : await client.rpc('set_game_table', { p_table_id: order.tableId, ...table });
      return settle(error);
    },
  });
  const deactivate = useMutation({
    mutationFn: async (tableId: string) => settle((await client.rpc('deactivate_game_table', { p_table_id: tableId })).error),
  });
  const reactivate = useMutation({
    mutationFn: async (tableId: string) => settle((await client.rpc('reactivate_game_table', { p_table_id: tableId })).error),
  });
  const remove = useMutation({
    mutationFn: async (tableId: string) => settle((await client.rpc('delete_game_table', { p_table_id: tableId })).error),
  });
  return { saveStake, saveTable, deactivate, reactivate, remove };
}

/** One table on one club day (#643): how many times it opened and how long it ran, in whole seconds. */
export interface GamesDay {
  readonly clubDay: string;
  readonly tableId: string;
  readonly tableName: string;
  readonly game: TableGame | null;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly runs: number;
  readonly seconds: number;
}

/** The games run on each club day from `from` to `to` (ISO dates), newest first, for the super admin (tables.manage). */
export function useGamesHistory(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.gamesHistory(userId ?? 'signed-out', venueId, from, to),
    enabled: userId !== null,
    queryFn: async (): Promise<GamesDay[]> => {
      const { data, error } = await client.rpc('games_history', { p_venue_id: venueId, p_from: from, p_to: to });
      if (error) throw error;
      return data.map((row) => ({
        clubDay: row.club_day, tableId: row.table_id, tableName: row.table_name, game: gameOf(row.game), smallBlind: BigInt(row.small_blind_paise),
        bigBlind: BigInt(row.big_blind_paise), runs: row.runs, seconds: row.seconds,
      }));
    },
  });
}
