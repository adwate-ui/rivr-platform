import type { FloorRequest, SeatAlert } from '@rivr/db';
import { t } from '@rivr/i18n';
import type { RequestChanges } from './useRequestChanges.ts';

/** A request that opens the leave sheet: a player leaving, or one who left owing call time. */
export type LeaveRequest = Extract<FloorRequest, { kind: 'leaving' | 'left_owing' }>;

/** One action on a request: what it says and what it does. */
export interface RequestAction {
  readonly label: string;
  readonly run: () => Promise<void> | void;
}

/** What a request's actions need: the changes, its table's name, the leave sheet, and where an approved player's lead. */
export interface RequestActionsFor {
  readonly changes: RequestChanges;
  readonly tableName: string;
  readonly onLeave: (request: LeaveRequest) => void;
  /** An approved player's Seat (a seat free for them), Check ID or View list. */
  readonly onSeatAlert?: ((alert: SeatAlert) => void) | undefined;
  /** A join approved: its seat sheet follows once a seat is free for them (the owner, 8 Nov). */
  readonly onApproved?: ((entryId: string) => void) | undefined;
}

const ALERT_ACTION = {
  seat: 'console.floor.requests.seat', seat_check: 'console.floor.requests.checkId', seat_wait: 'console.floor.requests.viewList',
} as const;

/**
 * An approved player's one action (the owner, 8 Nov): Seat, at the seat held for their call at once, else in the seat
 * sheet; Check ID, the check in person, while their identity check is unfinished; View list while no seat is free.
 */
function seatAlertActions(alert: SeatAlert, { changes, tableName, onSeatAlert }: RequestActionsFor): { primary: RequestAction } {
  const run = alert.kind === 'seat' && alert.seat !== null ? () => changes.seatCalled(alert, tableName) : () => onSeatAlert?.(alert);
  return { primary: { label: t(ALERT_ACTION[alert.kind]), run } };
}

/**
 * A request's one filled action and the one in words (console v3): Approve and Decline a join or more time, Start or Done
 * a top-up, Leave or Not leaving, Record one who left owing, Seat an approved player. The panel's buttons and the keys `A`
 * and `D` both use these.
 */
export function requestActions(request: FloorRequest, actionsFor: RequestActionsFor): { primary: RequestAction; secondary?: RequestAction } {
  const { changes, tableName, onLeave, onApproved } = actionsFor;
  switch (request.kind) {
    case 'join': return {
      primary: {
        label: t('console.floor.requests.approve'),
        run: async () => { if (await changes.approveJoin(request, tableName)) onApproved?.(request.id); },
      },
      secondary: { label: t('console.floor.requests.decline'), run: () => changes.declineJoin(request) },
    };
    case 'top_up': return { primary: { label: t(request.isStarted ? 'console.floor.requests.done' : 'console.floor.requests.start'), run: () => changes.stepTopUp(request) } };
    case 'time': return {
      primary: { label: t('console.floor.requests.approve'), run: () => changes.decideTime(request, true) },
      secondary: { label: t('console.floor.requests.decline'), run: () => changes.decideTime(request, false) },
    };
    case 'leaving': return {
      primary: { label: t('console.floor.requests.leave'), run: () => onLeave(request) },
      secondary: { label: t('console.floor.requests.notLeaving'), run: () => changes.notLeaving(request) },
    };
    case 'left_owing': return { primary: { label: t('console.floor.requests.record'), run: () => onLeave(request) } };
    default: return seatAlertActions(request, actionsFor);
  }
}
