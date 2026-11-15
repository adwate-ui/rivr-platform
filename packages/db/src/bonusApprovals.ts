import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useListPage, type ListView } from './lists.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * A Bonus a promotion calculated, waiting for a super admin (decision 0670): the member, the promotion, the amount, and why
 * (the event that set it off: its kind, its moment, its table and, for play time, its step).
 */
export interface WaitingBonus {
  readonly grantId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly promotionName: string;
  readonly amount: Paise;
  /** What set it off, by the engine's word: `signup`, `referral`, `check_in`, `seated`, `hours_step`, or an older rule's. */
  readonly trigger: string;
  readonly eventAt: string;
  /** For play time, the step's minutes: 240 for the Bonus after four hours. */
  readonly stepMinutes: number | null;
  readonly tableName: string | null;
}

/** A page row as the database gives it. */
interface WaitingRow {
  readonly total: number;
  readonly grant_id: string;
  readonly member_id: string;
  readonly full_name: string;
  readonly member_number: number;
  readonly promotion_name: string;
  readonly amount_paise: number;
  readonly trigger: string;
  readonly event_at: string;
  readonly step_minutes: number | null;
  readonly table_name: string | null;
}

function waitingOf(row: WaitingRow): WaitingBonus {
  return {
    grantId: row.grant_id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, promotionName: row.promotion_name,
    amount: toPaise(row.amount_paise), trigger: row.trigger, eventAt: row.event_at, stepMinutes: row.step_minutes, tableName: row.table_name,
  };
}

/**
 * One page of Bonus to approve, the oldest first unless the view says otherwise, sorted, searched and filtered on the server
 * (`bonus_waiting_page`), with how many wait in all. A super admin's alone; their own record's are not listed.
 */
export function useWaitingBonusPage(venueId: string, view: ListView | null) {
  const { client } = useRivrData();
  return useListPage({
    list: 'bonus_waiting', venueId, view,
    read: (asked) => client.rpc('bonus_waiting_page', { p_venue_id: venueId, p_view: asked }),
    rowOf: waitingOf,
  });
}

/**
 * Why a decision was refused: not a super admin, a Bonus for one's own record, nothing chosen or no reason to refuse, the venue
 * frozen, promotions switched off, or anything else. A frozen member's Bonus is left waiting, not refused (`leftWaiting`).
 */
export type BonusDecisionFailure = 'not_allowed' | 'own_record' | 'invalid' | 'paused' | 'switched_off' | 'unavailable';

const DECISION_FAILURE_BY_CODE: Readonly<Record<string, BonusDecisionFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', '22023': 'invalid', RVFRZ: 'paused', RVKIL: 'switched_off',
};

/**
 * What a decision did: how many it decided and their total, none when another super admin had decided them all; and how
 * many an approval left waiting, a frozen member's.
 */
export interface BonusDecision {
  readonly grants: number;
  readonly amount: Paise;
  readonly leftWaiting: number;
}

/** A decision as the database answers it; none when nothing was decided. */
function decisionOf(row: { grants: number; amount_paise: number; left_waiting: number } | undefined): BonusDecision {
  return { grants: row?.grants ?? 0, amount: toPaise(row?.amount_paise ?? 0), leftWaiting: row?.left_waiting ?? 0 };
}

/** The Bonus chosen, the request id that makes a second press the same decision, and a refusal's reason or null to approve. */
export interface BonusChoice {
  readonly grantIds: readonly string[];
  readonly requestId: string;
  readonly refusal: string | null;
}

/**
 * A super admin's decision on the Bonus chosen (decision 0670): approve posts each to the member, refuse needs a reason and
 * posts nothing. Resolves to a Result; the queue and the rail's count read again.
 */
export function useDecideBonus(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ grantIds, requestId, refusal }: BonusChoice): Promise<Result<BonusDecision, BonusDecisionFailure>> => {
      const { data, error } = refusal === null
        ? await client.rpc('approve_promotion_bonus', { p_venue_id: venueId, p_grant_ids: [...grantIds], p_request_id: requestId })
        : await client.rpc('refuse_promotion_bonus', { p_venue_id: venueId, p_grant_ids: [...grantIds], p_reason: refusal.trim(), p_request_id: requestId });
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bonusWaiting(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffQueueCounts(user, venueId) }),
      ]);
      if (error) return err(DECISION_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(decisionOf(data[0]));
    },
  });
}
