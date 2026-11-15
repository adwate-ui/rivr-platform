import { rewardSchema } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import type { HighHandHit as HitFacts, HighHandReward } from '@rivr/domain/promotions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A high hand the floor logged and paid (redesign RD-22): who, where, the hand as it was paid, its Bonus in chips, and who logged it. */
export interface HighHandHit {
  readonly id: string;
  readonly at: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly tableName: string;
  readonly seat: number;
  readonly hand: string;
  readonly rank: string | null;
  readonly chips: number;
  readonly loggedBy: string;
}

/** Tonight's high hands: how many were paid and how much Bonus in all, and the newest of them, newest first. */
export interface HighHandTonight {
  readonly handsPaid: number;
  readonly chipsPaid: number;
  readonly hits: readonly HighHandHit[];
}

interface HitRow {
  hit_id: string; logged_at: string; member_id: string; member_name: string; table_name: string; seat: number; hand: string; rank: string | null;
  chips: number; logged_by: string; paid_count: number; paid_chips: number;
}

/** The rows of high_hand_tonight as the console shows them; the night's totals ride on every row. */
export function toHighHandTonight(rows: readonly HitRow[]): HighHandTonight {
  return {
    handsPaid: Number(rows[0]?.paid_count ?? 0),
    chipsPaid: Number(rows[0]?.paid_chips ?? 0),
    hits: rows.map((row) => ({
      id: row.hit_id, at: row.logged_at, memberId: row.member_id, memberName: row.member_name, tableName: row.table_name, seat: row.seat, hand: row.hand,
      rank: row.rank, chips: Number(row.chips), loggedBy: row.logged_by,
    })),
  };
}

// The newest hits listed; the night's totals count every one.
const LISTED = 50;

/**
 * Tonight's high hands at a venue, for everyone who sees the Live floor and those who manage promotions
 * (`high_hand_tonight`): the whole venue's, or with `promotionId` that promotion's alone, as its record shows them.
 */
export function useHighHandTonight(venueId: string, promotionId: string | null = null, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.highHandTonight(userId ?? 'signed-out', venueId, promotionId),
    enabled: userId !== null && isEnabled,
    queryFn: async (): Promise<HighHandTonight> => {
      const only = promotionId === null ? {} : { p_promotion_id: promotionId };
      const { data, error } = await client.rpc('high_hand_tonight', { p_venue_id: venueId, p_limit: LISTED, ...only });
      if (error) throw error;
      return toHighHandTonight(data);
    },
  });
}

/** The high hand promotion that runs at a venue now: its name, and its hands and rules. */
export interface HighHandLive {
  readonly promotionId: string;
  readonly name: string;
  readonly reward: HighHandReward;
}

// A promotion going live or being paused is rare, and no signal tells of it: the strip asks again each minute.
const LIVE_EVERY_MS = 60_000;

/**
 * The high hand that runs at a venue now (`high_hand_live`, redesign RD-24), for the Live floor's strip and its logging
 * panel; null while none runs, or for someone who may not read it.
 */
export function useHighHandLive(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.highHandLive(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE_EVERY_MS,
    queryFn: async (): Promise<HighHandLive | null> => {
      const { data, error } = await client.rpc('high_hand_live', { p_venue_id: venueId });
      if (error) throw error;
      const row = data[0];
      const reward = rewardSchema.safeParse(row?.reward);
      if (row === undefined || !reward.success || reward.data.kind !== 'high_hand') return null;
      return { promotionId: row.promotion_id, name: row.name, reward: reward.data };
    },
  });
}

/**
 * A hit as the floor logs it: the table, the player seated at it, the hand, its rank and each rule confirmed (the domain's
 * hit), and the request id that makes a retry the same hit.
 */
export interface HighHandLog extends HitFacts {
  readonly tableId: string;
  readonly memberId: string;
  readonly requestId: string;
}

/**
 * Why a hit was not paid: not in the staff member's role; their own member record; no high hand runs; the player is not
 * seated at that table now; not for that table, player or time; the hand or a rule does not hold; the budget cannot pay it
 * (`left` says what it still has); the venue or member frozen, or promotions stopped; anything else.
 */
export type LogHighHandReason = 'not_allowed' | 'own_record' | 'none_live' | 'not_seated' | 'not_eligible' | 'rule' | 'over_budget' | 'paused' | 'unavailable';
export interface LogHighHandFailure {
  readonly reason: LogHighHandReason;
  /** What is left of the budget, in Bonus, when that is why. */
  readonly left: number | null;
}

const LOG_REASON_BY_CODE: Readonly<Record<string, LogHighHandReason>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVHHN: 'none_live', RVHHS: 'not_seated', RVHHE: 'not_eligible', RVHHR: 'rule', RVHHB: 'over_budget',
  RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused',
};

function logFailureOf(error: { code: string; details: string | null }): LogHighHandFailure {
  const reason = LOG_REASON_BY_CODE[error.code] ?? 'unavailable';
  const left = Number(error.details);
  return { reason, left: reason === 'over_budget' && Number.isFinite(left) ? left : null };
}

/**
 * Logs a high hand and pays its Bonus at once (`log_high_hand`): for those who add Bonus by hand. Resolves to a Result,
 * and reads tonight's hits, the promotions list and the member's Bonus again.
 */
export function useLogHighHand(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hit: HighHandLog): Promise<Result<null, LogHighHandFailure>> => {
      // A hand with no rank goes as a blank, which the database reads as none.
      const { error } = await client.rpc('log_high_hand', {
        p_table_id: hit.tableId, p_member_id: hit.memberId, p_hand: hit.hand, p_rank: hit.rank ?? '', p_confirmed: hit.confirmed, p_request_id: hit.requestId,
      });
      const user = userId ?? 'signed-out';
      const stale = [queryKeys.highHandTonights(user, venueId), queryKeys.promotionsOverview(user, venueId), queryKeys.memberBonus(user, venueId, hit.memberId)];
      await Promise.all(stale.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return error ? err(logFailureOf(error)) : ok(null);
    },
  });
}
