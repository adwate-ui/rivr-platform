import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// A waitlist place moves as others join and leave: positions refresh every ten seconds.
const LIVE = 10_000;

/** One table on tonight's floor, with its game and stakes and how many wait for that game. */
export interface FloorTable {
  readonly id: string;
  /** Staff read the tables of every venue they work at: the console shows the selected venue's. */
  readonly venueId: string;
  readonly name: string;
  readonly isOpen: boolean;
  readonly seats: number;
  readonly tableTypeId: string;
  readonly tableTypeName: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly buyIn: bigint;
  /** A compulsory straddle in paise, as in the Private Room; null where there is none. */
  readonly straddle: bigint | null;
  /** Members waiting for this table's game and stake. */
  readonly waiting: number;
}

/** One of the signed-in member's waitlist places. */
export interface WaitlistPlace {
  readonly entryId: string;
  readonly tableTypeId: string;
  readonly tableTypeName: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly joinedAt: string;
  /** 1 is next. */
  readonly place: number;
  /** While the member is called (#63): the table and seat, and when the hold runs out; null otherwise. */
  readonly callTableName: string | null;
  readonly callSeat: number | null;
  readonly holdUntil: string | null;
  /** While the member has stepped away: when their place goes; null otherwise. */
  readonly awayUntil: string | null;
}

/** One place on a list, as the floor sees it. */
export interface WaitlistBoardEntry {
  readonly entryId: string;
  readonly tableTypeId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly joinedAt: string;
  readonly place: number;
  readonly addedByFloor: boolean;
  /** Why the place is ahead of join time: the tier's name, "Black card"; null in join-time order. */
  readonly priorityReason: string | null;
  /** While called (#63): the table and seat, and when the hold runs out. */
  readonly callTableName: string | null;
  readonly callSeat: number | null;
  readonly holdUntil: string | null;
  /** While away (Skip, or the member stepped away): when the place goes. */
  readonly awayUntil: string | null;
}

/** Why joining, adding or leaving did not go through: `stopped` is the member frozen, `paused` the whole venue. */
export type WaitlistFailure =
  | 'not_open' | 'kyc_needed' | 'stopped' | 'paused' | 'no_member' | 'invalid' | 'unavailable'
  // The call-down (#63): the seat is held for another call; the hold or the time away ran out; no time away is left.
  | 'seat_held' | 'too_late' | 'no_time_away';

const FAILURE_BY_CODE: Readonly<Record<string, WaitlistFailure>> = {
  '42501': 'not_open', RVKYC: 'kyc_needed', RVMBR: 'stopped', RVFRZ: 'paused', RVNOM: 'no_member', '22023': 'invalid',
  RVHLD: 'seat_held', RVLAT: 'too_late', RVAWY: 'no_time_away',
};

/** The failure a refused waitlist call stands for. */
export function failureOf(error: { code: string }): WaitlistFailure {
  return FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

/** Tonight's tables at the venue the person belongs to, in floor order, with each game's waitlist length. */
export function useFloorTables() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorTables(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<FloorTable[]> => {
      const [tables, types, lengths] = await Promise.all([
        client.from('game_table').select('id, venue_id, name, is_open, seats, position, table_type_id').order('position'),
        client.from('table_type').select('id, name, small_blind_paise, big_blind_paise, buy_in_min_paise, straddle_paise'),
        client.rpc('waitlist_lengths'),
      ]);
      if (tables.error) throw tables.error;
      if (types.error) throw types.error;
      if (lengths.error) throw lengths.error;
      const waiting = new Map(lengths.data.map((row) => [row.table_type_id, row.waiting]));
      return tables.data.flatMap((table) => {
        const type = types.data.find((candidate) => candidate.id === table.table_type_id);
        if (!type) return [];
        return [{
          id: table.id, venueId: table.venue_id, name: table.name, isOpen: table.is_open, seats: table.seats, tableTypeId: type.id, tableTypeName: type.name,
          smallBlind: BigInt(type.small_blind_paise), bigBlind: BigInt(type.big_blind_paise), buyIn: BigInt(type.buy_in_min_paise),
          straddle: type.straddle_paise === null ? null : BigInt(type.straddle_paise), waiting: waiting.get(type.id) ?? 0,
        }];
      });
    },
  });
}

/** The signed-in member's waitlist places, with their place on each list. */
export function useMyWaitlist() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myWaitlist(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<WaitlistPlace[]> => {
      const { data, error } = await client.rpc('my_waitlist');
      if (error) throw error;
      return data.map((row) => ({
        entryId: row.entry_id, tableTypeId: row.table_type_id, tableTypeName: row.table_type_name, smallBlind: BigInt(row.small_blind_paise),
        bigBlind: BigInt(row.big_blind_paise), joinedAt: row.joined_at, place: row.place, callTableName: row.call_table_name,
        callSeat: row.call_seat, holdUntil: row.hold_until, awayUntil: row.away_until,
      }));
    },
  });
}

/**
 * Joining a list from the app (`join_waitlist`, feature waitlist.join), stepping away and back, and leaving it. `join` takes
 * the request id of the tap, so a retried tap joins once. Each resolves to a Result; both reload the
 * floor and the member's places.
 */
export function useWaitlistActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
  const join = useMutation({
    mutationFn: async ({ tableTypeId, requestId }: { tableTypeId: string; requestId: string }): Promise<Result<string, WaitlistFailure>> => {
      const { data, error } = await client.rpc('join_waitlist', { p_table_type_id: tableTypeId, p_idempotency_key: requestId });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  const leave = useMutation({
    mutationFn: async (entryId: string): Promise<Result<null, WaitlistFailure>> => {
      const { error } = await client.rpc('leave_waitlist', { p_entry_id: entryId });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const stepAway = useMutation({
    mutationFn: async ({ entryId, isAway }: { entryId: string; isAway: boolean }): Promise<Result<null, WaitlistFailure>> => {
      const { error } = await client.rpc('step_away', { p_entry_id: entryId, p_is_away: isAway });
      await reload();
      return error ? err(failureOf(error)) : ok(null);
    },
  });
  return { join, leave, stepAway };
}

/** The venue's lists for the floor (`waitlist_board`, waitlist.manage): each place in order, with names. */
export function useWaitlistBoard(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.waitlistBoard(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<WaitlistBoardEntry[]> => {
      const { data, error } = await client.rpc('waitlist_board', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        entryId: row.entry_id, tableTypeId: row.table_type_id, memberId: row.member_id, fullName: row.full_name, joinedAt: row.joined_at,
        place: row.place, addedByFloor: row.added_by_floor, priorityReason: row.priority_reason, callTableName: row.call_table_name,
        callSeat: row.call_seat, holdUntil: row.hold_until, awayUntil: row.away_until,
      }));
    },
  });
}

/** The floor adds a member found by their mobile number, or takes a place off a list. Both reload the board. */
export function useFloorWaitlistActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
  const add = useMutation({
    mutationFn: async (entry: { tableTypeId: string; phone: string; requestId: string }): Promise<Result<string, WaitlistFailure>> => {
      const { data, error } = await client.rpc('add_to_waitlist', {
        p_table_type_id: entry.tableTypeId, p_phone: entry.phone, p_idempotency_key: entry.requestId,
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  const remove = useMutation({
    mutationFn: async (entryId: string): Promise<Result<null, WaitlistFailure>> => {
      const { error } = await client.rpc('leave_waitlist', { p_entry_id: entryId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.waitlistBoard(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { add, remove };
}
