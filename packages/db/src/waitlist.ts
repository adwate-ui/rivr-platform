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
}

/** Why joining, adding or leaving did not go through: `stopped` is the member frozen, `paused` the whole venue. */
export type WaitlistFailure = 'not_open' | 'kyc_needed' | 'stopped' | 'paused' | 'no_member' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, WaitlistFailure>> = {
  '42501': 'not_open', RVKYC: 'kyc_needed', RVMBR: 'stopped', RVFRZ: 'paused', RVNOM: 'no_member', '22023': 'invalid',
};

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
        bigBlind: BigInt(row.big_blind_paise), joinedAt: row.joined_at, place: row.place,
      }));
    },
  });
}

/**
 * Joining a list from the app (`join_waitlist`, feature waitlist.join) and leaving it. `join` takes
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
  return { join, leave };
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
        place: row.place, addedByFloor: row.added_by_floor,
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
