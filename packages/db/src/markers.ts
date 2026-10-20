import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** An open marker (#74): who owes it, how much is left of how much, how old it is, when it falls due, and their limit. */
export interface OpenMarker {
  readonly markerId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly amount: Paise;
  readonly outstanding: Paise;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly ageDays: number;
  readonly isPastDue: boolean;
  readonly limit: Paise;
}

/**
 * Why a marker was refused: above the member's limit or the room's cap, a marker past due, not whole
 * chips, unsigned, credit not set up or switched off, and the cage's own (frozen, KYC, a break, not seated).
 */
export type MarkerFailure = 'not_allowed' | 'above_limit' | 'above_exposure' | 'past_due' | 'not_chips' | 'unsigned' | 'not_set_up'
  | 'switched_off' | 'stopped' | 'paused' | 'kyc_needed' | 'under_age' | 'duplicate' | 'on_break' | 'not_seated' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, MarkerFailure>> = {
  '42501': 'not_allowed', RVLIM: 'above_limit', RVEXP: 'above_exposure', RVDUE: 'past_due', RVCHP: 'not_chips', RVSIG: 'unsigned',
  RVCFG: 'not_set_up', RVKIL: 'switched_off', RVMBR: 'stopped', RVFRZ: 'paused', RVKYC: 'kyc_needed', RVAGE: 'under_age', RVDUP: 'duplicate', RVBRK: 'on_break',
  RVNST: 'not_seated', '22023': 'invalid',
};

/** The venue's open markers, oldest first. */
export function useOpenMarkers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.openMarkers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<OpenMarker[]> => {
      const { data, error } = await client.rpc('open_markers', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        markerId: row.marker_id, memberId: row.member_id, fullName: row.full_name, amount: toPaise(row.amount_paise),
        outstanding: toPaise(row.outstanding_paise), issuedAt: row.issued_at, dueAt: row.due_at, ageDays: row.age_days,
        isPastDue: row.is_past_due, limit: toPaise(row.limit_paise),
      }));
    },
  });
}

/** A marker to issue: once per request id, with the member's signature. */
export interface MarkerOrder {
  readonly memberId: string;
  readonly amount: Paise;
  readonly signature: string;
  readonly requestId: string;
}

/** `issue` issues a marker at the cage; a Result with the marker's id, reloading the cage and the Markers screen. */
export function useMarkerActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const issue = useMutation({
    mutationFn: async (order: MarkerOrder): Promise<Result<string, MarkerFailure>> => {
      const { data, error } = await client.rpc('issue_marker', {
        p_venue_id: venueId, p_member_id: order.memberId, p_amount_paise: Number(order.amount), p_signature_svg: order.signature,
        p_idempotency_key: order.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  return { issue };
}
