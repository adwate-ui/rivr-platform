import type { PlayLevel, Stage } from './stages.ts';

/**
 * Where a tournament's clock stands: the stage it is in (from 0), the level it counts as (a break
 * counts as the level before it), whether that stage is a break, and the seconds left in it.
 */
export interface ClockPosition {
  readonly stage: number;
  readonly level: number;
  readonly isBreak: boolean;
  readonly secondsLeft: number;
}

/** What the server said about a clock when it was read: its elapsed seconds then, and whether it was running. */
export interface ClockReading {
  readonly elapsedSeconds: number;
  readonly isRunning: boolean;
  /** When it was read, by this device's clock, in milliseconds. */
  readonly readAtMs: number;
}

const SECONDS_PER_MINUTE = 60;

/** The seconds from the clock's start to the start of `stage`: every stage before it run in full. */
export function stageStartSeconds(stages: readonly Stage[], stage: number): number {
  return stages.slice(0, Math.max(0, stage)).reduce((total, each) => total + each.minutes * SECONDS_PER_MINUTE, 0);
}

/**
 * Where the clock stands `elapsedSeconds` after it started, pauses and moves taken out (decision 0201):
 * the stage whose time holds that second, counting whole seconds, and the seconds left in it. Before
 * the start it is the first level in full; after the last stage runs out, the last stage with nothing
 * left, for the floor to finish. A structure with no stages is a bug and throws. The database's
 * private.tournament_clock_at is proved equal on packages/testing/golden/tournamentClock.json.
 */
export function clockAt(stages: readonly Stage[], elapsedSeconds: number): ClockPosition {
  if (stages.length === 0) throw new RangeError('A blind structure has a level');
  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  let end = 0;
  let level = 0;
  for (const [index, stage] of stages.entries()) {
    if (stage.kind === 'level') level += 1;
    end += stage.minutes * SECONDS_PER_MINUTE;
    if (elapsed < end || index === stages.length - 1) {
      return { stage: index, level, isBreak: stage.kind === 'break', secondsLeft: Math.max(0, end - elapsed) };
    }
  }
  throw new RangeError('A blind structure has a level');
}

/** The first level of play after `stage`, or undefined on the last: what the clock shows as next. */
export function nextLevelAfter(stages: readonly Stage[], stage: number): PlayLevel | undefined {
  return stages.slice(stage + 1).find((each): each is PlayLevel => each.kind === 'level');
}

/** The level of play at `stage`, or for a break the one that follows it: the blinds the floor is about. */
export function levelAtOrAfter(stages: readonly Stage[], stage: number): PlayLevel | undefined {
  const here = stages[stage];
  return here?.kind === 'level' ? here : nextLevelAfter(stages, stage);
}

/**
 * The clock's elapsed seconds at `nowMs`, from what the server said when it was read: a running clock has
 * run on since, a paused one has not. Devices tick from the server's reading, never their own start.
 */
export function elapsedNow(reading: ClockReading, nowMs: number): number {
  if (!reading.isRunning) return reading.elapsedSeconds;
  return reading.elapsedSeconds + Math.max(0, Math.floor((nowMs - reading.readAtMs) / 1000));
}
