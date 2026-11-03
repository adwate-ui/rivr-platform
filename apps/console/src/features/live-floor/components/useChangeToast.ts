import type { Result } from '@rivr/contracts/result';
import type { SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { useToast } from '@rivr/ui';
import { useCallback } from 'react';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';

/** A change's outcome: done, or refused for a reason the floor is told, or one it is not. */
export type Outcome = Result<unknown, SeatFailure | string>;

/** The compensating call Undo makes (decision 0447): a function in the database, never a rollback here. */
export type Compensate = () => Promise<Result<unknown, unknown>>;

const isSeatFailure = (error: string): error is SeatFailure => error in SEAT_FAILURE_COPY;

/**
 * Says how a floor change went, at the foot of the screen: done, with Undo for five seconds where it can be taken back
 * (decision 0447), then Undone or why not; or why it was refused.
 */
export function useChangeToast() {
  const toast = useToast();
  return useCallback((outcome: Outcome, text: string, compensate?: Compensate) => {
    if (!outcome.ok) {
      toast(isSeatFailure(outcome.error) ? t(SEAT_FAILURE_COPY[outcome.error]) : t('console.floor.toast.notDone'));
      return;
    }
    if (compensate === undefined) {
      toast(text);
      return;
    }
    toast(text, {
      onUndo: () => void compensate().then((undone) => toast(t(undone.ok ? 'console.floor.toast.undone' : 'console.floor.toast.notUndone'))),
    });
  }, [toast]);
}
