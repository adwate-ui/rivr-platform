import { requestTargets, type RequestTargets } from '@rivr/domain/floorRequests';
import {
  useFloorNight, useFloorRequests, useFloorRequestTargets, useFloorSeats, useFloorSignals, useFloorTables, useHeldSeats, type FloorNight,
  type FloorRequest, type FloorTable, type HeldSeat, type SeatedPlayer,
} from '@rivr/db';
import { useEffect, useState } from 'react';

/** Everything the Live floor shows once read: the venue's active tables, who sits where, held seats and the requests. */
export interface FloorData {
  readonly tables: readonly FloorTable[];
  readonly seats: readonly SeatedPlayer[];
  readonly held: readonly HeldSeat[];
  readonly night: FloorNight | undefined;
  /** Undefined until read, and for staff who are not the floor. */
  readonly requests: readonly FloorRequest[] | undefined;
  readonly targets: RequestTargets;
}

/** The time now, moved on every half minute: a request's age and a call time's bar. */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * The Live floor's reads, kept live by the venue's floor topic (decision 0446): `loading` until the tables and seats are
 * read, `error` when one cannot be, then the data. Requests are the floor's (waitlist.manage) alone.
 */
export function useFloorData(venueId: string, permissions: readonly string[]) {
  const isFloor = permissions.includes('waitlist.manage');
  useFloorSignals(venueId, isFloor);
  const reads = { tables: useFloorTables(), seats: useFloorSeats(venueId), held: useHeldSeats(venueId) };
  const night = useFloorNight(venueId).data;
  const requests = useFloorRequests(venueId, isFloor).data;
  const targets = requestTargets(useFloorRequestTargets(venueId, isFloor).data);
  const retry = () => void Promise.all(Object.values(reads).map((read) => read.refetch()));
  const { tables, seats, held } = { tables: reads.tables.data, seats: reads.seats.data, held: reads.held.data };
  if (tables === undefined || seats === undefined || held === undefined) {
    return Object.values(reads).some((read) => read.isError) ? { status: 'error', retry } as const : { status: 'loading', retry } as const;
  }
  const data: FloorData = { tables: tables.filter((table) => table.venueId === venueId), seats, held, night, requests, targets };
  return { status: 'ready', data, retry } as const;
}
