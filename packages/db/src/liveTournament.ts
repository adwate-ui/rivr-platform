import { blindLevelsSchema } from '@rivr/contracts/blindLevels';
import { elapsedNow, type ClockReading, type Stage } from '@rivr/domain/tournament';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A running tournament as a TV or a member sees it (#119): its name, its levels and its clock as read. */
export interface LiveTournament {
  readonly name: string;
  readonly stages: readonly Stage[];
  readonly clock: ClockReading;
}

interface LiveRow {
  name: string;
  levels: unknown;
  elapsed_seconds: number;
  is_paused: boolean;
}

/** The first row as a live tournament, its clock read now; none when nothing runs. */
export function toLiveTournament(rows: readonly LiveRow[], readAtMs: number): LiveTournament | null {
  const row = rows[0];
  if (row === undefined) return null;
  return {
    name: row.name, stages: blindLevelsSchema.parse(row.levels),
    clock: { elapsedSeconds: row.elapsed_seconds, isRunning: !row.is_paused, readAtMs },
  };
}

// The card ticks on its own between reads; a read every half minute catches the floor's pauses and moves.
const LIVE_CHECK = 30_000;

/** The tournament running at the member's venue, for Home (feature tournaments.register); null when none runs. */
export function useLiveTournament() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.liveTournament(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE_CHECK,
    queryFn: async (): Promise<LiveTournament | null> => {
      const { data, error } = await client.rpc('live_tournament');
      if (error) throw error;
      return toLiveTournament(data, Date.now());
    },
  });
}

/** The signed-in TV's tournament clock: the venue's running tournament, live while the TV's screen listens (useTvSignals). */
export function useTvTournamentClock() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvTournamentClock(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE_CHECK,
    queryFn: async (): Promise<LiveTournament | null> => {
      const { data, error } = await client.rpc('tv_tournament_clock');
      if (error) throw error;
      return toLiveTournament(data, Date.now());
    },
  });
}

/**
 * A clock's elapsed seconds now, from the server's reading (`ClockReading`, decision 0201), read again every
 * second while it runs: the console, the TV and Home count down with it. Nothing read yet, or not started, is 0.
 */
export function useElapsedNow(reading: ClockReading | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const isTicking = reading?.isRunning === true;
  useEffect(() => {
    if (!isTicking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTicking]);
  return reading ? elapsedNow(reading, now) : 0;
}
