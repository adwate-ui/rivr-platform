import { useSyncExternalStore } from 'react';

function subscribeToResize(onResize: () => void): () => void {
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

/**
 * How much a fixed `width` by `height` stage shrinks or grows to fit the window without cropping.
 * It follows the window as it is resized.
 */
export function useFitScale(width: number, height: number): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => Math.min(window.innerWidth / width, window.innerHeight / height),
    () => 1,
  );
}
