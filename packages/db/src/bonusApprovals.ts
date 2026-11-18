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
  /** For play time (#1061): the visit's seats, when they sat and left (null while one is taken), time away and time played. */
  readonly visit: WaitingVisit | null;
}

/** One seat of a visit, as the correction shows it (#1061; from the Players report too, #1075). */
export interface WaitingSession {
  readonly sessionId: string;
  readonly tableName: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly awaySeconds: number;
}

/** A visit as the correction shows it (#1075): check-in, check-out (null while they are in) and its seats. */
export interface VisitTimes {
  readonly visitId: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly sessions: readonly WaitingSession[];
}

/** A play-time Bonus's visit (#1061): its times and seats, when they sat and left, and time away and played, net of time away. */
export interface WaitingVisit extends VisitTimes {
  readonly seatedAt: string;
  readonly leftAt: string | null;
  readonly awaySeconds: number;
  readonly playedSeconds: number;
}

/** The visit's seats as the database lists them, each read field by field; none that cannot be read. */
function sessionsOf(value: unknown): WaitingSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): WaitingSession[] => {
    if (typeof item !== 'object' || item === null) return [];
    const id: unknown = Reflect.get(item, 'id');
    const table: unknown = Reflect.get(item, 'table');
    const startedAt: unknown = Reflect.get(item, 'startedAt');
    const endedAt: unknown = Reflect.get(item, 'endedAt');
    const away: unknown = Reflect.get(item, 'awaySeconds');
    if (typeof id !== 'string' || typeof table !== 'string' || typeof startedAt !== 'string') return [];
    return [{ sessionId: id, tableName: table, startedAt, endedAt: typeof endedAt === 'string' ? endedAt : null, awaySeconds: Number(away ?? 0) }];
  });
}

/** A Players report row's visits as the database lists them (#1075), each read field by field; none that cannot be read. */
export function visitsOf(value: unknown): VisitTimes[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): VisitTimes[] => {
    if (typeof item !== 'object' || item === null) return [];
    const visitId: unknown = Reflect.get(item, 'visitId');
    const openedAt: unknown = Reflect.get(item, 'openedAt');
    const closedAt: unknown = Reflect.get(item, 'closedAt');
    if (typeof visitId !== 'string' || typeof openedAt !== 'string') return [];
    return [{ visitId, openedAt, closedAt: typeof closedAt === 'string' ? closedAt : null, sessions: sessionsOf(Reflect.get(item, 'sessions')) }];
  });
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
  readonly visit_id: string | null;
  readonly sessions: unknown;
  readonly seated_at: string | null;
  readonly left_at: string | null;
  readonly away_seconds: number | null;
  readonly played_seconds: number | null;
  readonly visit_opened_at: string | null;
  readonly visit_closed_at: string | null;
}

function waitingOf(row: WaitingRow): WaitingBonus {
  return {
    grantId: row.grant_id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, promotionName: row.promotion_name,
    amount: toPaise(row.amount_paise), trigger: row.trigger, eventAt: row.event_at, stepMinutes: row.step_minutes, tableName: row.table_name,
    visit: row.visit_id === null || row.seated_at === null || row.visit_opened_at === null ? null : {
      visitId: row.visit_id, openedAt: row.visit_opened_at, closedAt: row.visit_closed_at, sessions: sessionsOf(row.sessions), seatedAt: row.seated_at, leftAt: row.left_at,
      awaySeconds: Number(row.away_seconds ?? 0), playedSeconds: Number(row.played_seconds ?? 0),
    },
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

/** Why a correction was refused: not a super admin, one's own record, times that do not fit, frozen, promotions off, or anything else. */
export type SessionCorrectionFailure = 'not_allowed' | 'own_record' | 'invalid' | 'paused' | 'switched_off' | 'unavailable';

const CORRECTION_FAILURE_BY_CODE: Readonly<Record<string, SessionCorrectionFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'paused', RVKIL: 'switched_off',
};

/** One seat's corrected end (null to keep it, or for a seat still taken) and its whole time away, any still running included. */
export interface SeatCorrection {
  readonly sessionId: string;
  readonly endedAt: string | null;
  readonly awaySeconds: number;
}

/**
 * A visit corrected together (#1075): its check-in and check-out (null keeps either) and its seats, with one reason kept in
 * Activity. The member, so their History reads again.
 */
export interface VisitCorrection {
  readonly visitId: string;
  readonly memberId: string;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly seats: readonly SeatCorrection[];
  readonly reason: string;
}

/** What a correction did: waiting steps the corrected time no longer reaches, refused; and steps already given above it, which stay. */
export interface CorrectionDone {
  readonly refused: number;
  readonly givenAbove: number;
}

/** The call's arguments: check-in and check-out only when they change, so the database keeps them otherwise. */
const correctionArgs = ({ visitId, openedAt, closedAt, seats, reason }: VisitCorrection) => ({
  p_visit_id: visitId, p_seats: seats.map(({ sessionId, endedAt, awaySeconds }) => ({ sessionId, endedAt, awaySeconds })), p_reason: reason.trim(),
  ...(openedAt === null ? {} : { p_opened_at: openedAt }), ...(closedAt === null ? {} : { p_closed_at: closedAt }),
});

/**
 * A super admin corrects a visit, from Bonus approvals (#1061) or the Players report (#1075): its check-in and check-out,
 * when the player left each seat and their time away, in one call (`correct_visit`), so its play-time Bonus is weighed once
 * on the corrected time. Every screen showing the visit reads again: the queue and the rail's count, the door, the reports,
 * the Members list and the member's History.
 */
export function useCorrectVisit(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (correction: VisitCorrection): Promise<Result<CorrectionDone, SessionCorrectionFailure>> => {
      const { data, error } = await client.rpc('correct_visit', correctionArgs(correction));
      const { memberId } = correction;
      const user = userId ?? 'signed-out';
      const readAgain = [
        queryKeys.bonusWaiting(user, venueId), queryKeys.staffQueueCounts(user, venueId), queryKeys.doorBoard(user, venueId), queryKeys.playerVisits(user, venueId),
        queryKeys.memberVisitsAll(user, venueId, memberId), queryKeys.memberHoursPlayed(user, venueId, memberId), queryKeys.clubReportsAt(user, venueId),
        queryKeys.membersListAll(user),
      ];
      await Promise.all(readAgain.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (error) return err(CORRECTION_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const [done] = data ?? [];
      return ok({ refused: Number(done?.refused ?? 0), givenAbove: Number(done?.given_above ?? 0) });
    },
  });
}
