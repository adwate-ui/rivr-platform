import { isRequestLate, type RequestTargets } from '@rivr/domain/floorRequests';
import type { FloorRequest, SeatAlert } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';

/** A request as the panel words it: what is asked, where, and how long it has waited, late past its target. */
export interface RequestWords {
  readonly kind: string;
  readonly detail: string;
  readonly age: string;
  readonly isLate: boolean;
}

const ALERT_KIND = {
  seat: 'console.floor.requests.toSeat', seat_check: 'console.floor.requests.checkFirst', seat_wait: 'console.floor.requests.waitingSeat',
} as const;

/** What is asked, in a word or two. */
function kindOf(request: FloorRequest): string {
  switch (request.kind) {
    case 'join': return t('console.floor.requests.join');
    case 'top_up': return t(request.isStarted ? 'console.floor.requests.topUpStarted' : 'console.floor.requests.topUp');
    case 'time': return t('console.floor.requests.time', { time: formatDuration(request.minutes * 60) });
    case 'leaving': return t('console.floor.requests.leaving');
    case 'left_owing': return t('console.floor.requests.leftOwing');
    default: return t(ALERT_KIND[request.kind]);
  }
}

/** Where an approved player is to sit: the seat held for their call, else their table's list, or that it is full or not open. */
function seatAlertDetail(alert: SeatAlert, table: string, isTableOpen: boolean): string {
  if (alert.seat !== null) return t('console.floor.requests.heldDetail', { table, seat: alert.seat });
  if (alert.kind !== 'seat_wait') return t('console.floor.requests.joinDetail', { table });
  return t(isTableOpen ? 'console.floor.requests.fullDetail' : 'console.floor.requests.closedDetail', { table });
}

/** A player leaving: their seat, and the call time they still owe or that it is met. */
function leavingDetail(seat: number, left: number, table: string): string {
  return left > 0
    ? t('console.floor.requests.leavingDetail', { table, seat, time: formatDuration(left) })
    : t('console.floor.requests.leavingMet', { table, seat });
}

/** Where: the list asked for, the seat, and the call time that matters to the ask. */
function detailOf(request: FloorRequest, table: string, isTableOpen: boolean): string {
  switch (request.kind) {
    case 'join': return t('console.floor.requests.joinDetail', { table });
    case 'top_up': return t('console.floor.requests.seatDetail', { table, seat: request.seat });
    case 'time': return t('console.floor.requests.timeDetail', { table, seat: request.seat, time: formatDuration(request.callTimeLeft ?? 0) });
    case 'leaving': return leavingDetail(request.seat, request.callTimeLeft ?? 0, table);
    case 'left_owing': return t('console.floor.requests.owedDetail', { table, time: formatDuration(request.owedSeconds) });
    default: return seatAlertDetail(request, table, isTableOpen);
  }
}

/** Whole seconds a request has waited, never below nothing. */
export const waitedSeconds = (since: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 1000));

/** How long it has waited: now, or whole minutes. */
function ageOf(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 ? t('console.floor.requests.now') : t('console.floor.requests.age', { minutes });
}

/**
 * A request in words at `now`, with the table it is at (its name, and whether it is open) and the club's targets for
 * lateness (decision 0479).
 */
export function wordsOf(request: FloorRequest, table: { readonly name: string; readonly isOpen: boolean }, now: Date, targets: RequestTargets): RequestWords {
  const seconds = waitedSeconds(request.since, now);
  return {
    kind: kindOf(request), detail: detailOf(request, table.name, table.isOpen), age: ageOf(seconds), isLate: isRequestLate(request.kind, seconds, targets),
  };
}
