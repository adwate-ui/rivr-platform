import type { LiveTournament } from '@rivr/db';
import { elapsedNow } from '@rivr/domain/tournament';
import { useEffect, useState } from 'react';

/** What the overlay heard from the server, and when: the venue's running tournament, or null for none. */
interface Heard {
  readonly atMs: number;
  readonly tournament: LiveTournament | null;
}

/** What the stream shows: the tournament as it was then, with its clock's elapsed seconds then; null when none was running. */
export interface DelayedTournament {
  readonly tournament: LiveTournament | null;
  readonly elapsedSeconds: number;
}

const TICK_MS = 1000;

/**
 * The venue's tournament as it was `delaySeconds` ago, for the stream overlay (#125, decision 0256):
 * what the overlay had heard by then, its clock run on to then. Every change (a level moved, a pause,
 * a player out) reaches the stream exactly the delay after it reached the overlay, in step with the
 * video, which is held back by the same delay. Until the first reading is that old it is undefined,
 * so after a reload the stream shows nothing for the delay rather than anything ahead of the video.
 * `latest` is the query's data and `heardAtMs` when it came.
 */
export function useDelayedTournament(latest: LiveTournament | null | undefined, heardAtMs: number, delaySeconds: number): DelayedTournament | undefined {
  const [heard, setHeard] = useState<readonly Heard[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const shownAtMs = now - delaySeconds * 1000;
  if (latest !== undefined && heard.at(-1)?.atMs !== heardAtMs) {
    // What was heard before the reading the stream has reached is never shown again.
    const reached = heard.findLastIndex((each) => each.atMs <= shownAtMs);
    setHeard([...heard.slice(Math.max(0, reached)), { atMs: heardAtMs, tournament: latest }]);
  }
  const shown = heard.findLast((each) => each.atMs <= shownAtMs);
  if (shown === undefined) return undefined;
  return { tournament: shown.tournament, elapsedSeconds: shown.tournament === null ? 0 : elapsedNow(shown.tournament.clock, shownAtMs) };
}
