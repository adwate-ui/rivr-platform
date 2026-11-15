import { useEffect } from 'react';

/**
 * In a rotation, a board with nothing to show passes its half minute on (D-03), rather than a room reading "Nothing yet."
 * The main board is never passed over, so a rotation of empty boards still rests on it.
 */
export function useSkipWhenEmpty(isEmpty: boolean, onEmpty: (() => void) | undefined): void {
  useEffect(() => {
    if (isEmpty) onEmpty?.();
  }, [isEmpty, onEmpty]);
}
