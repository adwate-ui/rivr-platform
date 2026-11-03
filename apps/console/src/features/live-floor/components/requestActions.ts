import type { FloorRequest } from '@rivr/db';
import { t } from '@rivr/i18n';
import type { RequestChanges } from './useRequestChanges.ts';

/** A request that opens the leave sheet: a player leaving, or one who left owing call time. */
export type LeaveRequest = Extract<FloorRequest, { kind: 'leaving' | 'left_owing' }>;

/** One action on a request: what it says and what it does. */
export interface RequestAction {
  readonly label: string;
  readonly run: () => Promise<void> | void;
}

/** What a request's actions need: the changes, its table's name, and the leave sheet. */
export interface RequestActionsFor {
  readonly changes: RequestChanges;
  readonly tableName: string;
  readonly onLeave: (request: LeaveRequest) => void;
}

/**
 * A request's one filled action and the one in words (console v3): Approve and Decline a join or more time, Start or Done
 * a top-up, Leave or Not leaving, Record one who left owing. The panel's buttons and the keys `A` and `D` both use these.
 */
export function requestActions(request: FloorRequest, { changes, tableName, onLeave }: RequestActionsFor): { primary: RequestAction; secondary?: RequestAction } {
  switch (request.kind) {
    case 'join': return {
      primary: { label: t('console.floor.requests.approve'), run: () => changes.approveJoin(request, tableName) },
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
  }
}
