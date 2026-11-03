import { tokens } from '@rivr/tokens';
import { useEffect, useState } from 'react';

/**
 * The widths a screen asks about: `medium`, 768 px, where a table's rows are lines; `tablet`, 1180 px, a desk, where a list
 * and its record sit side by side; `wide`, 1200 px, where the console's rail shows its labels (console v3).
 */
export type WideFrom = 'medium' | 'tablet' | 'wide';

/** Whether the window is at least this wide, kept as it is resized; true where the browser cannot say. */
export function useIsWide(from: WideFrom): boolean {
  const query = `(min-width: ${tokens.breakpoint[from]}px)`;
  const [isWide, setWide] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setWide(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return isWide;
}
