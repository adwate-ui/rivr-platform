import { err, ok, type Result } from '@rivr/contracts/result';
import type { CreditLimitState } from '@rivr/domain/credit';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A member's credit line (#73): the limit in force, their open markers, and a limit waiting for a super admin, with who proposed it and why. */
export interface CreditLine {
  readonly lineId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly limit: Paise;
  readonly outstanding: Paise;
  readonly proposed: { readonly limit: Paise; readonly reason: string; readonly by: string } | null;
}

/** The room: every member's open markers against the cap, the approval threshold and the visits needed. */
export interface CreditRoom {
  readonly exposure: Paise;
  readonly cap: Paise;
  readonly threshold: Paise;
  readonly minimumVisits: number;
}

/**
 * Why a limit did not go through: not allowed, no member with that number, no finished identity
 * check, too few visits, not whole chips, credit switched off, the member or venue frozen, nothing
 * of someone else's waiting to decide, or anything else.
 */
export type CreditFailure = 'not_allowed' | 'no_member' | 'kyc_needed' | 'too_few_visits' | 'not_chips' | 'switched_off' | 'stopped'
  | 'paused' | 'changed' | 'not_set_up' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, CreditFailure>> = {
  '42501': 'not_allowed', RVNOM: 'no_member', RVKYC: 'kyc_needed', RVVIS: 'too_few_visits', RVCHP: 'not_chips', RVKIL: 'switched_off',
  RVMBR: 'stopped', RVFRZ: 'paused', RVSTL: 'changed', RVCFG: 'not_set_up', '22023': 'invalid',
};

/** The venue's credit lines with a limit or one waiting, waiting ones first. */
export function useCreditLines(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.creditLines(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<CreditLine[]> => {
      const { data, error } = await client.rpc('credit_lines', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        lineId: row.line_id, memberId: row.member_id, fullName: row.full_name, limit: toPaise(row.limit_paise),
        outstanding: toPaise(row.outstanding_paise),
        proposed: row.proposed_limit_paise === null ? null
          : { limit: toPaise(row.proposed_limit_paise), reason: row.proposal_reason ?? '', by: row.proposed_by ?? '' },
      }));
    },
  });
}

/** The room's exposure against its cap; null for staff who may not see it. */
export function useCreditRoom(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.creditRoom(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<CreditRoom | null> => {
      const { data, error } = await client.rpc('credit_room', { p_venue_id: venueId });
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : {
        exposure: toPaise(row.exposure_paise), cap: toPaise(row.exposure_cap_paise), threshold: toPaise(row.approval_threshold_paise),
        minimumVisits: row.minimum_visits,
      };
    },
  });
}

/** `setLimit` sets a member's limit by mobile number (in force, or waiting for approval); `decide` approves or declines a waiting one. Each is a Result. */
export function useCreditActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.creditLines(userId ?? 'signed-out', venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.creditRoom(userId ?? 'signed-out', venueId) }),
  ]);
  const setLimit = useMutation({
    mutationFn: async ({ phone, limit, reason }: { phone: string; limit: Paise; reason: string }): Promise<Result<CreditLimitState, CreditFailure>> => {
      const { data, error } = await client.rpc('set_credit_limit', { p_venue_id: venueId, p_phone: phone, p_limit_paise: Number(limit), p_reason: reason });
      await reload();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data === 'needs_approval' ? 'needs_approval' : 'active');
    },
  });
  const decide = useMutation({
    mutationFn: async ({ lineId, isApproved, expected }: { lineId: string; isApproved: boolean; expected: Paise }): Promise<Result<null, CreditFailure>> => {
      const { error } = await client.rpc('decide_credit_limit', { p_line_id: lineId, p_is_approved: isApproved, p_expected_limit_paise: Number(expected) });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { setLimit, decide };
}
