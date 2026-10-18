/** Turns visible control_state rows into what the kill-switch banner and write screens need. */
import type { Database } from '../database.types.ts';

type ControlRow = Pick<
  Database['public']['Tables']['control_state']['Row'],
  'venue_id' | 'level' | 'feature' | 'member_id' | 'released_at'
>;

export type KillableFeature = Database['public']['Enums']['killable_feature'];

/** The kill-switch state an app shows. */
export interface ControlState {
  /** Every money movement, seating and hand write is refused; show the fixed banner. */
  readonly isVenueFrozen: boolean;
  /** Features switched off one by one. */
  readonly killedFeatures: readonly KillableFeature[];
  /**
   * In a member's app: the signed-in member cannot transact or join a waitlist (row-level
   * security shows a member only their own freeze). Staff apps see every frozen member, so they
   * read member freezes per member instead of this flag.
   */
  readonly isMemberFrozen: boolean;
}

export const NOTHING_ENGAGED: ControlState = { isVenueFrozen: false, killedFeatures: [], isMemberFrozen: false };

/** Summarises the engaged controls, optionally for one venue. Released rows are ignored. */
export function toControlState(rows: readonly ControlRow[], venueId?: string): ControlState {
  const engaged = rows.filter((row) => row.released_at === null && (venueId === undefined || row.venue_id === venueId));
  return {
    isVenueFrozen: engaged.some((row) => row.level === 'venue_freeze'),
    killedFeatures: engaged.flatMap((row) => (row.level === 'feature_kill' && row.feature ? [row.feature] : [])),
    isMemberFrozen: engaged.some((row) => row.level === 'member_freeze'),
  };
}
