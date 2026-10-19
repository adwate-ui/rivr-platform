/** A seat session's call-time clock (#78): the call time in force at seating, and when the player played. */
export interface CallTimeClock {
  /** The table type's call_time.minutes in force at seating; 0 when none is set. */
  readonly minutes: number;
  /** When the player was seated: the clock runs from here, across moves in the same session. */
  readonly seatedAt: Date;
  /** Time away from the table that is over, in whole seconds. */
  readonly awaySeconds: number;
  /** Away now, since then: the clock stands still. */
  readonly awaySince: Date | null;
  /** When the player left the table: the clock stopped there. */
  readonly leftAt: Date | null;
}

/** The time left in whole seconds, never below zero, and whether call time is complete. */
export interface CallTime {
  readonly secondsLeft: number;
  readonly isComplete: boolean;
}

/**
 * Call time (features, "Call time"; decision 0057): the minimum a player plays after being seated
 * before leaving. Time away does not count; after leaving, the time left is the shortfall when they
 * left. The database's private.call_time_left is proved equal on packages/testing/golden/callTime.json.
 */
export function callTime(clock: CallTimeClock, at: Date): CallTime {
  const end = clock.leftAt !== null && clock.leftAt < at ? clock.leftAt : at;
  const awayNow = clock.awaySince === null ? 0 : Math.max(0, end.getTime() - clock.awaySince.getTime());
  const playedMs = end.getTime() - clock.seatedAt.getTime() - clock.awaySeconds * 1000 - awayNow;
  const secondsLeft = Math.max(0, clock.minutes * 60 - Math.floor(playedMs / 1000));
  return { secondsLeft, isComplete: secondsLeft === 0 };
}
