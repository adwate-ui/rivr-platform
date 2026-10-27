import { err, ok, type Result } from '@rivr/contracts/result';
import type { CommissionBasis } from '@rivr/contracts/creators';
import { fromPaise, type Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/creators).
const keys = { dashboard: (userId: string, venueId: string) => ['user', userId, 'creator-dashboard', venueId] as const };

/** One creator on their dashboard (#163): their code and commission, how far their sign-ups got, and what they are owed. */
export interface CreatorRow {
  readonly creatorId: string;
  readonly name: string;
  readonly code: string;
  readonly basis: CommissionBasis;
  readonly commission: Paise;
  readonly signedUp: number;
  readonly kycDone: number;
  readonly visited: number;
  readonly boughtIn: number;
  readonly owed: Paise;
}

/** Why a creator was not added: the role, out of bounds, a code another creator has, the venue frozen, or anything else. */
export type CreatorFailure = 'not_allowed' | 'invalid' | 'taken' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, CreatorFailure>> = { '42501': 'not_allowed', '22023': 'invalid', '23505': 'taken', RVFRZ: 'paused' };
const BASES: readonly CommissionBasis[] = ['kyc', 'first_visit', 'first_buy_in'];

/** The venue's creators and their dashboards, for staff who run promotions. */
export function useCreatorDashboard(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.dashboard(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<CreatorRow[]> => {
      const { data, error } = await client.rpc('creator_dashboard', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        creatorId: row.creator_id, name: row.name, code: row.code, basis: BASES.find((basis) => basis === row.commission_basis) ?? 'first_buy_in',
        commission: fromPaise(BigInt(row.commission_paise)), signedUp: row.signed_up, kycDone: row.kyc_done, visited: row.visited,
        boughtIn: row.bought_in, owed: fromPaise(BigInt(row.owed_paise)),
      }));
    },
  });
}

/** Adds a creator with their commission in paise; a Result, and the dashboard reloads. */
export function useAddCreator(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (creator: { name: string; code: string; basis: CommissionBasis; commission: Paise }): Promise<Result<string, CreatorFailure>> => {
      const { data, error } = await client.rpc('save_creator', {
        p_venue_id: venueId, p_name: creator.name, p_code: creator.code, p_basis: creator.basis, p_commission_paise: Number(creator.commission),
      });
      await queryClient.invalidateQueries({ queryKey: keys.dashboard(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}
