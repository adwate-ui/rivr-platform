import { isRequestLate, type RequestTargets } from '@rivr/domain/floorRequests';
import type { FloorRequest } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';

/** A request as the panel words it: what is asked, where, and how long it has waited, late past its target. */
export interface RequestWords {
  readonly kind: string;
  readonly detail: string;
  readonly age: string;
  readonly isLate: boolean;
}

/** What is asked, in a word or two. */
function kindOf(request: FloorRequest): string {
  switch (request.kind) {
    case 'join': return t('console.floor.requests.join');
    case 'top_up': return t(request.isStarted ? 'console.floor.requests.topUpStarted' : 'console.floor.requests.topUp');
    case 'time': return t('console.floor.requests.time', { time: formatDuration(request.minutes * 60) });
    case 'leaving': return t('console.floor.requests.leaving');
    case 'left_owing': return t('console.floor.requests.leftOwing');
  }
}

/** A player leaving: their seat, and the call time they still owe or that it is met. */
function leavingDetail(seat: number, left: number, table: string): string {
  return left > 0
    ? t('console.floor.requests.leavingDetail', { table, seat, time: formatDuration(left) })
    : t('console.floor.requests.leavingMet', { table, seat });
}

/** Where: the list asked for, the seat, and the call time that matters to the ask. */
function detailOf(request: FloorRequest, table: string): string {
  switch (request.kind) {
    case 'join': return t('console.floor.requests.joinDetail', { table });
    case 'top_up': return t('console.floor.requests.seatDetail', { table, seat: request.seat });
    case 'time': return t('console.floor.requests.timeDetail', { table, seat: request.seat, time: formatDuration(request.callTimeLeft ?? 0) });
    case 'leaving': return leavingDetail(request.seat, request.callTimeLeft ?? 0, table);
    case 'left_owing': return t('console.floor.requests.owedDetail', { table, time: formatDuration(request.owedSeconds) });
  }
}

/** Whole seconds a request has waited, never below nothing. */
export const waitedSeconds = (since: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 1000));

/** How long it has waited: now, or whole minutes. */
function ageOf(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 ? t('console.floor.requests.now') : t('console.floor.requests.age', { minutes });
}

/** A request in words at `now`, with the table it is at and the club's targets for lateness (decision 0479). */
export function wordsOf(request: FloorRequest, table: string, now: Date, targets: RequestTargets): RequestWords {
  const seconds = waitedSeconds(request.since, now);
  return { kind: kindOf(request), detail: detailOf(request, table), age: ageOf(seconds), isLate: isRequestLate(request.kind, seconds, targets) };
}
