import { clockTimeSchema } from '@rivr/contracts/staff';
import { istMoment, istParts } from '@rivr/contracts/tournaments';
import type { SeatCorrection, WaitingSession } from '@rivr/db';
import { formatTime } from '@rivr/i18n';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a player who sat down at `seatedAt` left, typed as a 24-hour IST clock time (`23:40`): the first such moment after
 * they sat, so a time past midnight is the next day. Null when what is typed is not a clock time.
 */
export function leftAtFrom(seatedAt: Date, typed: string): Date | null {
  const clock = clockTimeSchema.safeParse(typed);
  if (!clock.success) return null;
  const sameDay = istMoment(istParts(seatedAt).day, clock.data);
  return sameDay > seatedAt ? sameDay : new Date(sameDay.getTime() + DAY_MS);
}

/** One seat as the panel types it: when they left (blank for a seat still taken) and whole minutes away (null while blank). */
export interface SeatDraft {
  readonly leftAt: string;
  readonly awayMinutes: number | null;
}

/** A seat as it is now, typed as the panel first shows it. */
export const draftOf = (session: WaitingSession): SeatDraft => ({
  leftAt: session.endedAt === null ? '' : formatTime(new Date(session.endedAt)),
  awayMinutes: Math.round(session.awaySeconds / 60),
});

/** The end to send: null to keep it as it is (or for a seat still taken), undefined when what is typed is not a time. */
export function endOf(session: WaitingSession, typed: string): string | null | undefined {
  if (typed.trim() === draftOf(session).leftAt) return null;
  return leftAtFrom(new Date(session.startedAt), typed)?.toISOString();
}

/** What one seat sends: nothing when it is as it was, 'invalid' when what is typed cannot be read, else its end and time away. */
export function correctionOf(session: WaitingSession, draft: SeatDraft): SeatCorrection | 'invalid' | null {
  const first = draftOf(session);
  if (draft.leftAt.trim() === first.leftAt && draft.awayMinutes === first.awayMinutes) return null;
  const endedAt = endOf(session, draft.leftAt);
  if (endedAt === undefined || draft.awayMinutes === null) return 'invalid';
  // Time away left as it was keeps its seconds; typed anew, it is whole minutes.
  const awaySeconds = draft.awayMinutes === first.awayMinutes ? session.awaySeconds : draft.awayMinutes * 60;
  return { sessionId: session.sessionId, endedAt, awaySeconds };
}
