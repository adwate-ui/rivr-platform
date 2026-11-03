import { useEffect, useRef } from 'react';

/** What the Live floor's keys do: `A` approves and `D` declines the oldest request, `S` seats a player. */
export interface FloorShortcuts {
  readonly approve: () => void;
  readonly decline: () => void;
  readonly seat: () => void;
}

const KEYS: ReadonlyMap<string, keyof FloorShortcuts> = new Map([['a', 'approve'], ['d', 'decline'], ['s', 'seat']]);

/** A key pressed while typing, with a modifier, or while a sheet or the palette is open is not a shortcut. */
function isTyping(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return true;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.isContentEditable === true || target?.closest('input, textarea, select') != null) return true;
  return document.querySelector('[role="dialog"]') !== null;
}

/**
 * The Live floor's keys (console v3): `A`, `D` and `S`, ignored while typing or with a sheet open. The console's
 * shortcut registry (Helper 1's, on feat/cv3-shell) is to take these over: this one function is all that moves.
 */
export function useFloorShortcuts(shortcuts: FloorShortcuts) {
  const current = useRef(shortcuts);
  useEffect(() => {
    current.current = shortcuts;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const name = KEYS.get(event.key.toLowerCase());
      if (name === undefined || isTyping(event)) return;
      event.preventDefault();
      current.current[name]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
