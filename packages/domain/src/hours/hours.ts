import { tablePlayedSeconds } from '../shares/index.ts';

/** A stretch a member sat at the tables: when it began and ended, and the seconds played in it (the clock's, less time away). */
export interface PlayedStint {
  readonly from: Date;
  readonly to: Date;
  readonly playedSeconds: bigint;
}

const wholeSeconds = (from: Date, to: Date) => BigInt(Math.floor((to.getTime() - from.getTime()) / 1000));

/**
 * The seconds of a stint that still count towards a member's hours (redesign RD-36): the TV's hours leaderboard, a
 * play-time Bonus and the total on the Members list. A super admin resets one member's hours, and they count from that
 * moment (`countedFrom`; null for a member never reset). A stint that began at or after it counts whole; one that ended
 * by then counts for nothing; one that straddles it counts for the share of its played time that came after, in
 * proportion to the clock and rounded down to the second, as a session that moved tables shares its time
 * (`tablePlayedSeconds`): time away is not known by the minute. `private.counted_seconds` is its twin.
 */
export function countedSeconds(stint: PlayedStint, countedFrom: Date | null): bigint {
  if (stint.to.getTime() < stint.from.getTime()) throw new RangeError('A stint ends at or after it begins');
  if (countedFrom === null || countedFrom.getTime() <= stint.from.getTime()) return stint.playedSeconds;
  if (countedFrom.getTime() >= stint.to.getTime()) return 0n;
  return tablePlayedSeconds(wholeSeconds(countedFrom, stint.to), wholeSeconds(stint.from, stint.to), stint.playedSeconds);
}
