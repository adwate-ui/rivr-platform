import type { TvWaitlistStake } from '@rivr/ui';
import { useEffect } from 'react';

/** Whether a board's columns hold nobody: what it would say is "Nothing yet." in every column. */
export const isEmptyBoard = (stakes: readonly TvWaitlistStake[]) => stakes.every((stake) => stake.places.length === 0);

/**
 * In a rotation, a board with nothing to show passes its half minute on (D-03), rather than a room reading "Nothing yet."
 * The main board is never passed over, so a rotation of empty boards still rests on it.
 */
export function useSkipWhenEmpty(isEmpty: boolean, onEmpty: (() => void) | undefined): void {
  useEffect(() => {
    if (isEmpty) onEmpty?.();
  }, [isEmpty, onEmpty]);
}
