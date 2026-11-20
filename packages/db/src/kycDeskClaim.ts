import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DESK_LIST_CHECK, type KycInPersonFailure } from './kycReview.ts';
import { LIST_MOST } from './limits.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Who is checking a member at the desk now, and since when (the owner, 20 Nov). */
export interface KycDeskHolder {
  readonly staffName: string;
  readonly since: Date;
}

/**
 * Where Start left a member's check in person (the owner, 20 Nov): claimed for the caller for 15 minutes, being checked by
 * another member of staff, or done already, with who checked them and when (null for a check no one reviewed).
 */
export type KycDeskClaim =
  | { readonly status: 'claimed' }
  | ({ readonly status: 'taken' } & KycDeskHolder)
  | { readonly status: 'decided'; readonly staffName: string | null; readonly at: Date | null };

const CLAIM_FAILURE_BY_CODE: Readonly<Record<string, KycInPersonFailure>> = {
  '42501': 'not_allowed', RVFRZ: 'stopped', RVMBR: 'stopped', RVKIL: 'stopped',
};

interface DeskClaimRow {
  status: string;
  staff_name: string | null;
  since: string | null;
}

/** claim_kyc_desk_check's one row, read as where the check stands; null for an answer it does not know, never a claim. */
function deskClaimOf(row: DeskClaimRow | undefined): KycDeskClaim | null {
  if (row?.status === 'claimed') return { status: 'claimed' };
  if (row?.status === 'taken' && row.staff_name !== null && row.since !== null) {
    return { status: 'taken', staffName: row.staff_name, since: new Date(row.since) };
  }
  if (row?.status === 'decided') return { status: 'decided', staffName: row.staff_name, at: row.since === null ? null : new Date(row.since) };
  return null;
}

/**
 * Start on a member at the desk (the owner, 20 Nov): `claim` holds them for this reviewer for 15 minutes, or says who is
 * checking them, or who checked them already; `release` lets the caller's own claim go when the check closes undone. A
 * release that fails changes nothing that matters: the claim lapses by itself.
 */
export function useKycDeskClaim(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const claim = useMutation({
    mutationFn: async (memberId: string): Promise<Result<KycDeskClaim, KycInPersonFailure>> => {
      const { data, error } = await client.rpc('claim_kyc_desk_check', { p_member_id: memberId });
      if (error) return err(CLAIM_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const rows: DeskClaimRow[] = data;
      const claimed = deskClaimOf(rows[0]);
      return claimed === null ? err('unavailable') : ok(claimed);
    },
  });
  const release = useMutation({
    mutationFn: async (memberId: string) => {
      await client.rpc('release_kyc_desk_check', { p_member_id: memberId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.kycDeskClaims(userId ?? 'signed-out', venueId) });
    },
  });
  return { claim, release };
}

/** Who other staff are checking at the desk now, by member (the owner, 20 Nov), asked again every 10 seconds. */
export function useKycDeskClaims(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycDeskClaims(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: DESK_LIST_CHECK,
    queryFn: async (): Promise<ReadonlyMap<string, KycDeskHolder>> => {
      const { data, error } = await client.rpc('kyc_desk_claims', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return new Map(data.map((row) => [row.member_id, { staffName: row.staff_name, since: new Date(row.since) }]));
    },
  });
}
