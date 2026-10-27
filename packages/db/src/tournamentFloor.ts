import { err, ok, type Result } from '@rivr/contracts/result';
import type { Purchase } from '@rivr/domain/tournament';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { toBuyFailure, toFinishFailure, tournamentFailure, type BuyFailure, type FinishFailure, type TournamentFailure } from './tournamentFailures.ts';

/** Where a player's run stands (decision 0204). */
export type EntryStatus = 'seated' | 'alternate' | 'busted' | 'refunded';

/** One player's run on the floor's list: who, which entry, where they sit or finished, and the chips they bought. */
export interface TournamentSeatRow {
  readonly entryId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly entryNumber: number;
  readonly status: EntryStatus;
  readonly table: number | null;
  readonly seat: number | null;
  readonly place: number | null;
  readonly chips: number;
}

/** A balancing prompt: one player from table `from` to table `to`. */
export interface BalancePrompt {
  readonly from: number;
  readonly to: number;
}

const STATUSES: readonly EntryStatus[] = ['seated', 'alternate', 'busted', 'refunded'];
const toStatus = (status: string): EntryStatus => STATUSES.find((each) => each === status) ?? 'busted';

/** The floor's list of a tournament's players (tournaments.manage or cage.transact): seated, alternates, then busted by place. */
export function useTournamentSeating(tournamentId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentSeating(userId ?? 'signed-out', tournamentId),
    enabled: userId !== null,
    refetchInterval: 30_000,
    queryFn: async (): Promise<TournamentSeatRow[]> => {
      const { data, error } = await client.rpc('tournament_seating', { p_tournament_id: tournamentId });
      if (error) throw error;
      return data.map((row) => ({
        entryId: row.entry_id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, entryNumber: row.entry_number,
        status: toStatus(row.status), table: row.table_number, seat: row.seat_number, place: row.place, chips: row.chips,
      }));
    },
  });
}

/** The balancing prompts for a tournament's tables (decision 0204): none when every table is within one player of the others. */
export function useTournamentBalance(tournamentId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentBalance(userId ?? 'signed-out', tournamentId),
    enabled: userId !== null,
    refetchInterval: 30_000,
    queryFn: async (): Promise<BalancePrompt[]> => {
      const { data, error } = await client.rpc('tournament_balance', { p_tournament_id: tournamentId });
      if (error) throw error;
      return data.map((row) => ({ from: row.from_table, to: row.to_table }));
    },
  });
}

/** A change on the floor, by entry: bust (in a bounty tournament, by the run that knocked them out), move to a table, refund an alternate. */
export type FloorChange =
  | { readonly change: 'bust'; readonly entryId: string; readonly eliminatorId?: string }
  | { readonly change: 'refund'; readonly entryId: string }
  | { readonly change: 'move'; readonly entryId: string; readonly table: number };

/** Every read a floor change moves: the list, the prompts and the tournaments' fields. */
function useFloorReload(venueId: string, tournamentId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  const person = userId ?? 'signed-out';
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tournamentSeating(person, tournamentId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tournamentBalance(person, tournamentId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.venueTournaments(person, venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tournamentPayouts(person, tournamentId) }),
  ]);
}

/** Busts, moves or refunds an entry, sets the room, and takes a buy in cash at the cage; each a Result, and the floor's reads reload. */
export function useTournamentFloorActions(venueId: string, tournamentId: string) {
  const { client } = useRivrData();
  const reload = useFloorReload(venueId, tournamentId);
  const floor = useMutation({
    mutationFn: async (order: FloorChange): Promise<Result<null, FinishFailure>> => {
      const entry = { p_entry_id: order.entryId };
      const { error } = order.change === 'move' ? await client.rpc('move_tournament_entry', { ...entry, p_table: order.table })
        : order.change === 'bust' ? await client.rpc('bust_tournament_entry', order.eliminatorId === undefined ? entry : { ...entry, p_eliminator_id: order.eliminatorId })
        : await client.rpc('refund_tournament_alternate', entry);
      await reload();
      return error ? err(toFinishFailure(error)) : ok(null);
    },
  });
  const room = useMutation({
    mutationFn: async (order: { tables: number; seatsPerTable: number }): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('set_tournament_room', { p_tournament_id: tournamentId, p_tables: order.tables, p_seats_per_table: order.seatsPerTable });
      await reload();
      return error ? err(tournamentFailure(error.code)) : ok(null);
    },
  });
  const cash = useMutation({
    mutationFn: async (order: { memberId: string; purchase: Purchase; requestId: string }): Promise<Result<string, BuyFailure>> => {
      const { data, error } = await client.rpc('cage_tournament_entry', {
        p_tournament_id: tournamentId, p_member_id: order.memberId, p_purchase: order.purchase, p_idempotency_key: order.requestId,
      });
      await reload();
      return error ? err(toBuyFailure(error)) : ok(data);
    },
  });
  // A ticket pays the member's entry, with no cash taken (#519).
  const ticket = useMutation({
    mutationFn: async (order: { memberId: string; requestId: string }): Promise<Result<string, BuyFailure>> => {
      const { data, error } = await client.rpc('use_tournament_ticket', {
        p_tournament_id: tournamentId, p_member_id: order.memberId, p_idempotency_key: order.requestId,
      });
      await reload();
      return error ? err(toBuyFailure(error)) : ok(data);
    },
  });
  return { floor, room, cash, ticket };
}
