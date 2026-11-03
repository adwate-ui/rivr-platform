import { useFloorSeats, useFloorTables, useTodaysPlayers } from '@rivr/db';
import { useMemo } from 'react';
import { tonightByMember, type Tonight } from '../components/tonight.ts';

/**
 * Where each member is tonight (console v3, Members' Tonight column and a record's seat), from the floor's seats and
 * tables and the day's list. An addition to the list: while these load, or if they fail, a member shows as not here.
 */
export function useTonight(venueId: string): ReadonlyMap<string, Tonight> {
  const seats = useFloorSeats(venueId);
  const tables = useFloorTables();
  const today = useTodaysPlayers(venueId);
  return useMemo(() => tonightByMember(seats.data ?? [], tables.data ?? [], today.data ?? []), [seats.data, tables.data, today.data]);
}
