/** A member's seat tonight: none (browsing, or on a list), one called for them, or one they have taken. */
export type SeatStanding = 'none' | 'called' | 'taken';

/** A notice in force at the member's club, as the server lists it: when it started. */
export interface LiveNotice {
  readonly startsAt: Date;
}

/** What Home's one card above the offers shows: the ID check, a club notice, or nothing. */
export type HomeSlot<Notice extends LiveNotice> = { readonly kind: 'idCheck' } | { readonly kind: 'notice'; readonly notice: Notice } | null;

/** The notice that started last; of two that started together, the one listed first. */
function startedLast<Notice extends LiveNotice>(notices: readonly Notice[]): Notice | null {
  let last: Notice | null = null;
  for (const notice of notices) {
    if (last === null || notice.startsAt.getTime() > last.startsAt.getTime()) last = notice;
  }
  return last;
}

/**
 * Home's top slot (redesign of 15 Nov 2026, RD-20): one card above the offers. Nothing while a seat is called for the
 * member or taken: the seat is what matters then. Otherwise the ID check while it is not done, and once it is, the club's
 * notice in force that started last; nothing with none in force. `notices` are those in force now, as the server lists them.
 */
export function homeTopSlot<Notice extends LiveNotice>(input: {
  readonly seat: SeatStanding;
  readonly isIdCheckDone: boolean;
  readonly notices: readonly Notice[];
}): HomeSlot<Notice> {
  if (input.seat !== 'none') return null;
  if (!input.isIdCheckDone) return { kind: 'idCheck' };
  const notice = startedLast(input.notices);
  return notice === null ? null : { kind: 'notice', notice };
}
