import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { FloorSheet } from './FloorSheets.tsx';
import { floorSearchFrom } from './floorSearch.ts';
import type { FloorData } from './useFloorData.ts';

/**
 * A member record's Show link (`/?table=<id>&seat=<n>`): the player's sheet, opened once; or, with nobody in that seat, the
 * table to bring into view with its seats shown, which this gives back.
 */
export function useFloorFocus(data: FloorData, onSheet: (sheet: FloorSheet) => void): string | undefined {
  const focus = floorSearchFrom(useSearch({ strict: false }));
  const handled = useRef<string | null>(null);
  const player = data.seats.find((one) => one.tableId === focus.table && one.seat === focus.seat);
  const key = focus.table === undefined ? null : `${focus.table}:${String(focus.seat)}`;
  useEffect(() => {
    if (key === null || player === undefined || handled.current === key) return;
    handled.current = key;
    onSheet({ kind: 'player', sessionId: player.sessionId });
  }, [key, player, onSheet]);
  return player === undefined ? focus.table : undefined;
}
