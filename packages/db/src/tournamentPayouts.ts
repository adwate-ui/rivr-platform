import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '@rivr/domain/money';
import type { DealMethod } from '@rivr/domain/tournament';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { toFinishFailure, type FinishFailure } from './tournamentFailures.ts';

/** One payment a tournament made (#117, #121): a run's prize by its place, or a bounty on a bust; the TDS on it, withheld or shadow. */
export interface TournamentPayout {
  readonly id: string;
  readonly kind: 'prize' | 'bounty';
  readonly place: number | null;
  readonly fullName: string;
  readonly entryNumber: number;
  readonly prize: Paise;
  readonly bounty: Paise;
  readonly tds: Paise;
  readonly isTdsShadow: boolean;
}

/** What a tournament paid (tournaments.manage, cage.transact or ledger.read): prizes by place, then bounties as paid. */
export function useTournamentPayouts(tournamentId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentPayouts(userId ?? 'signed-out', tournamentId),
    enabled: userId !== null,
    queryFn: async (): Promise<TournamentPayout[]> => {
      const { data, error } = await client.rpc('tournament_payouts', { p_tournament_id: tournamentId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.payout_id, kind: row.kind === 'bounty' ? 'bounty' : 'prize', place: row.place, fullName: row.full_name, entryNumber: row.entry_number,
        prize: fromPaise(BigInt(row.prize_paise)), bounty: fromPaise(BigInt(row.bounty_paise)), tds: fromPaise(BigInt(row.tds_paise)),
        isTdsShadow: row.is_tds_shadow,
      }));
    },
  });
}

/** A deal among the players left: its method and each one's chips, by their entry. */
export interface DealOrder {
  readonly method: DealMethod;
  readonly stacks: readonly { readonly entryId: string; readonly chips: bigint }[];
}

/** Every read a finish moves: the tournaments, the players and what was paid. */
function usePayoutReload(venueId: string, tournamentId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  const person = userId ?? 'signed-out';
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.venueTournaments(person, venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tournamentSeating(person, tournamentId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tournamentPayouts(person, tournamentId) }),
  ]);
}

/**
 * Sets each paid place's share of the pool in basis points, and finishes the tournament, played out (no
 * deal) or with a deal (tournaments.manage, #121); each a Result, and the tournament's reads reload.
 */
export function useTournamentPayoutActions(venueId: string, tournamentId: string) {
  const { client } = useRivrData();
  const reload = usePayoutReload(venueId, tournamentId);
  const shares = useMutation({
    mutationFn: async (basisPoints: readonly number[]): Promise<Result<null, FinishFailure>> => {
      const { error } = await client.rpc('set_tournament_payouts', { p_tournament_id: tournamentId, p_shares: [...basisPoints] });
      await reload();
      return error ? err(toFinishFailure(error)) : ok(null);
    },
  });
  const finish = useMutation({
    mutationFn: async (deal: DealOrder | null): Promise<Result<null, FinishFailure>> => {
      const { error } = await client.rpc('finish_tournament', deal === null ? { p_tournament_id: tournamentId } : {
        p_tournament_id: tournamentId, p_method: deal.method,
        p_stacks: Object.fromEntries(deal.stacks.map((stack) => [stack.entryId, Number(stack.chips)])),
      });
      await reload();
      return error ? err(toFinishFailure(error)) : ok(null);
    },
  });
  return { shares, finish };
}
