import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

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
  /** The call time it has now, in minutes: 0 for a stake with none, which no table may play yet (redesign RD-16). */
  readonly callTimeMinutes: number;
}

/** A table (#642): its name, stake, seats and own minimum buy-in, whether it plays now, and whether it is active (decision 0466). */
export interface SetupTable {
  readonly id: string;
  readonly name: string;
  readonly stakeId: string;
  readonly seats: number;
  /** The table's own minimum buy-in in paise (redesign RD-16). */
  readonly minBuyIn: bigint;
  readonly isOpen: boolean;
  /** False once deactivated: hidden from everything live, kept for history; reactivating brings it back closed. */
  readonly isActive: boolean;
  /** The players seated at it now, and the places waiting on its list or called to it: @rivr/domain's TableInPlay. */
  readonly seated: number;
  readonly waiting: number;
}

/**
 * Why a setup change was refused. `players_seated` and `players_waiting` are @rivr/domain's tableRetireRefusal reasons
 * (decision 0466); a stake change refused for players seated or waiting is `players_seated`. `stake_without_call_time` is
 * its stakeTableRefusal (redesign RD-16): a table given a stake that has no call time yet. `stake_in_use`: a stake a table,
 * or a deleted table's history, still uses is not deleted (redesign RD-17).
 */
export type TablesFailure = 'not_allowed' | 'invalid' | 'players_seated' | 'players_waiting' | 'seats_taken' | 'stake_without_call_time' | 'stake_in_use'
  | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TablesFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23505': 'invalid', '23514': 'invalid', RVSTD: 'players_seated', RVWTG: 'players_waiting',
  RVOCC: 'seats_taken', RVNCT: 'stake_without_call_time', RVUSE: 'stake_in_use', RVFRZ: 'paused',
};

/**
 * The venue's stakes, smallest first, and its tables in floor order, for the super admin's Tables setup (#642): the inactive
 * ones too, marked, and never a deleted one (decision 0466).
 */
export function useTablesSetup(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tablesSetup(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    // Who sits at or waits for a table changes on the floor: setup's refusals follow it within 15 seconds.
    refetchInterval: 15_000,
    queryFn: async (): Promise<{ stakes: SetupStake[]; tables: SetupTable[] }> => {
      const [types, callTimes, tables, inPlay] = await Promise.all([
        client.from('table_type').select('id, name, game, small_blind_paise, big_blind_paise, straddle_paise').eq('venue_id', venueId)
          .order('small_blind_paise').order('name').limit(LIST_MOST),
        client.rpc('stake_call_times', { p_venue_id: venueId }).limit(LIST_MOST),
        client.from('game_table').select('id, name, table_type_id, seats, is_open, active, min_buy_in_paise').eq('venue_id', venueId).is('deleted_at', null)
          .order('position').limit(LIST_MOST),
        readInPlay(client, venueId),
      ]);
      if (types.error) throw types.error;
      if (callTimes.error) throw callTimes.error;
      if (tables.error) throw tables.error;
      const callTime = new Map(callTimes.data.map((row) => [row.table_type_id, row.call_time_minutes]));
      return {
        stakes: types.data.map((row) => ({
          id: row.id, name: row.name, game: gameOf(row.game), smallBlind: BigInt(row.small_blind_paise), bigBlind: BigInt(row.big_blind_paise),
          straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise), callTimeMinutes: callTime.get(row.id) ?? 0,
        })),
        tables: tables.data.map((row) => ({
          id: row.id, name: row.name, stakeId: row.table_type_id, seats: row.seats, minBuyIn: BigInt(row.min_buy_in_paise), isOpen: row.is_open,
          isActive: row.active, seated: countOf(inPlay.seated, row.id), waiting: countOf(inPlay.waiting, row.id),
        })),
      };
    },
  });
}

const countOf = (tableIds: readonly (string | null)[], tableId: string) => tableIds.filter((id) => id === tableId).length;

/**
 * Who keeps each table in play, for setup to say why a table cannot go before it is asked (decision 0466): the open seat
 * sessions' tables, and each waiting place's table and the table it is called to. Rows the role does not read count as
 * none; the database refuses on its own count either way.
 */
async function readInPlay(client: RivrClient, venueId: string): Promise<{ seated: (string | null)[]; waiting: (string | null)[] }> {
  const [seats, places] = await Promise.all([
    client.from('seat_session').select('table_id').eq('venue_id', venueId).is('ended_at', null).limit(LIST_MOST),
    client.from('waitlist_entry').select('table_id, call_table_id').eq('venue_id', venueId).eq('status', 'waiting').limit(LIST_MOST),
  ]);
  if (seats.error) throw seats.error;
  if (places.error) throw places.error;
  // A place called to another table waits for that one too.
  const waiting = places.data.flatMap((place) => (place.call_table_id === null || place.call_table_id === place.table_id
    ? [place.table_id] : [place.table_id, place.call_table_id]));
  return { seated: seats.data.map((seat) => seat.table_id), waiting };
}

/**
 * A stake as the setup screen saves it: a new one has no id; no straddle is null. Its call time in minutes (redesign RD-16):
 * null leaves a stake its own, and a new stake with none, which no table may play until it has one.
 */
export interface StakeOrder {
  readonly stakeId: string | null;
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly straddle: bigint | null;
  readonly callTimeMinutes: number | null;
}

/** A table as the setup screen saves it: a new one has no id; its own minimum buy-in in paise (redesign RD-16). */
export interface TableOrder {
  readonly tableId: string | null;
  readonly name: string;
  readonly stakeId: string;
  readonly seats: number;
  readonly minBuyIn: bigint;
}

/** Sends a stake: a new one is added, one with an id changed. A new stake with no straddle has none; a changed stake's 0 takes its straddle off (decision 0299). */
async function sendStake(client: RivrClient, venueId: string, order: StakeOrder) {
  const blinds = {
    p_name: order.name.trim(), p_small_blind_paise: Number(order.smallBlind), p_big_blind_paise: Number(order.bigBlind),
    ...(order.callTimeMinutes === null ? {} : { p_call_time_minutes: order.callTimeMinutes }),
  };
  const { error } = order.stakeId === null
    ? await client.rpc('add_table_type', { p_venue_id: venueId, ...blinds, ...(order.straddle === null ? {} : { p_straddle_paise: Number(order.straddle) }) })
    : await client.rpc('set_table_type', { p_type_id: order.stakeId, ...blinds, p_straddle_paise: Number(order.straddle ?? 0n) });
  return error;
}

/**
 * Adds or changes stakes and tables, deletes a stake no table uses (redesign RD-17), and deactivates, reactivates or deletes a
 * table (tables.manage; decision 0466); each a Result, and everything the person reads reloads, as a table leaving or coming
 * back changes the live floor and the lists.
 */
export function useTablesSetupActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, TablesFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const saveStake = useMutation({ mutationFn: async (order: StakeOrder) => settle(await sendStake(client, venueId, order)) });
  const saveTable = useMutation({
    mutationFn: async (order: TableOrder) => {
      const table = { p_name: order.name.trim(), p_table_type_id: order.stakeId, p_seats: order.seats, p_min_buy_in_paise: Number(order.minBuyIn) };
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
  const removeStake = useMutation({
    mutationFn: async (stakeId: string) => settle((await client.rpc('delete_table_type', { p_type_id: stakeId })).error),
  });
  return { saveStake, removeStake, saveTable, deactivate, reactivate, remove };
}
