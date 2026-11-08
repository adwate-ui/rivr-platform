import type { FloorRequest } from '@rivr/db';
import { FRESH_MS } from '@rivr/ui';
import { useEffect, useRef, useState } from 'react';

/** A request's own name across reads: its kind and what the floor acts on. */
export const requestKey = (request: FloorRequest) => `${request.kind}:${request.id}`;

/** An ID check first, or a wait for a seat: nothing for the floor to do yet, so it neither glows nor opens the panel. */
const isQuiet = (key: string) => key.startsWith('seat_check:') || key.startsWith('seat_wait:');

/** The requests the floor can act on now: all but the quiet ones. */
export const actionable = (requests: readonly FloorRequest[]) => requests.filter((request) => !isQuiet(requestKey(request)));

/**
 * Requests that arrived since the last read, each for as long as its gold tint fades (decision 0465); `onArrive` hears of
 * them, so a folded panel opens. The first read brings nothing new.
 */
function useFreshKeys(requests: readonly FloorRequest[] | undefined, onArrive: () => void): ReadonlySet<string> {
  const seen = useRef<ReadonlySet<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const keys = requests?.map(requestKey).join(' ');
  useEffect(() => {
    if (keys === undefined) return;
    const now = new Set(keys === '' ? [] : keys.split(' '));
    const before = seen.current;
    seen.current = now;
    const arrived = before === null ? [] : [...now].filter((key) => !before.has(key) && !isQuiet(key));
    if (arrived.length === 0) return;
    setFresh((current) => new Set([...current, ...arrived]));
    onArrive();
    timers.current.push(setTimeout(() => setFresh((current) => new Set([...current].filter((key) => !arrived.includes(key)))), FRESH_MS));
  }, [keys, onArrive]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return fresh;
}

/**
 * The requests in the order held when the pointer came in, as they are now: those gone since are dropped, and new ones
 * join the end, so nothing above them moves.
 */
function heldOrder(held: readonly FloorRequest[], latest: readonly FloorRequest[]): FloorRequest[] {
  const now = new Map(latest.map((request) => [requestKey(request), request]));
  const kept = held.flatMap((request) => now.get(requestKey(request)) ?? []);
  const keys = new Set(kept.map(requestKey));
  return [...kept, ...latest.filter((request) => !keys.has(requestKey(request)))];
}

/**
 * The floor's requests as the panel shows them (console v3): oldest first, never re-sorted under the pointer. While the
 * pointer is on the list its order holds, what was done goes and what arrives joins the end; once it leaves, oldest first
 * again. `fresh` marks those just arrived.
 */
export function useRequestQueue(requests: readonly FloorRequest[] | undefined, onArrive: () => void) {
  const [held, setHeld] = useState<readonly FloorRequest[] | null>(null);
  const fresh = useFreshKeys(requests, onArrive);
  const latest = requests ?? [];
  return {
    shown: held === null ? latest : heldOrder(held, latest),
    fresh,
    hold: (isOver: boolean) => setHeld(isOver ? latest : null),
  };
}
