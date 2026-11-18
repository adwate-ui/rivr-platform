import { clockTimeSchema } from '@rivr/contracts/staff';
import { istMoment, istParts } from '@rivr/contracts/tournaments';
import type { SeatCorrection, VisitCorrection, VisitTimes, WaitingSession } from '@rivr/db';
import { clubDay, clubDayMoment } from '@rivr/domain/clubDay';
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

/** A visit's check-in and check-out as the panel types them (#1075): check-out blank while they are still in. */
export interface VisitDraft {
  readonly checkedIn: string;
  readonly checkedOut: string;
}

/** A visit as it is now, typed as the panel first shows it. */
export const visitDraftOf = (visit: VisitTimes): VisitDraft => ({
  checkedIn: formatTime(new Date(visit.openedAt)),
  checkedOut: visit.closedAt === null ? '' : formatTime(new Date(visit.closedAt)),
});

/** The check-in to send, on the visit's own club day: null to keep it, undefined when what is typed is not a time. */
export function checkedInOf(visit: VisitTimes, typed: string): string | null | undefined {
  if (typed.trim() === visitDraftOf(visit).checkedIn) return null;
  const clock = clockTimeSchema.safeParse(typed);
  return clock.success ? clubDayMoment(clubDay(new Date(visit.openedAt)), clock.data).toISOString() : undefined;
}

/**
 * The check-out to send, the first such time after check-in: null to keep it (or while they are in), undefined when what is
 * typed is not a time.
 */
export function checkedOutOf(visit: VisitTimes, draft: VisitDraft): string | null | undefined {
  if (visit.closedAt === null || draft.checkedOut.trim() === visitDraftOf(visit).checkedOut) return null;
  const checkedIn = checkedInOf(visit, draft.checkedIn) ?? visit.openedAt;
  return leftAtFrom(new Date(checkedIn), draft.checkedOut)?.toISOString();
}

/**
 * A check-out typed as the minute the last seat ended sends that seat's own end, as the server gave it, so it is not
 * refused as before it: a seat's end carries seconds and microseconds, a typed time neither (the review of the pull request).
 */
function closedAtFor(closedAt: string | null, visit: VisitTimes, seats: readonly SeatCorrection[]): string | null {
  if (closedAt === null) return null;
  const ends = visit.sessions.flatMap((session) => {
    const end = seats.find((one) => one.sessionId === session.sessionId)?.endedAt ?? session.endedAt;
    return end === null ? [] : [end];
  });
  const last = ends.reduce<string | null>((latest, end) => (latest === null || Date.parse(end) > Date.parse(latest) ? end : latest), null);
  const gap = last === null ? -1 : Date.parse(last) - Date.parse(closedAt);
  return last !== null && gap >= 0 && gap < 60_000 ? last : closedAt;
}

/** What one visit sends, all in one call: its times and changed seats, or what stops it: a time that cannot be read, or nothing changed. */
export function visitCorrectionOf(visit: VisitTimes, draft: VisitDraft, seats: Readonly<Record<string, SeatDraft>>)
  : Pick<VisitCorrection, 'openedAt' | 'closedAt' | 'seats'> | 'invalid' | 'unchanged' {
  const openedAt = checkedInOf(visit, draft.checkedIn);
  const closedAt = checkedOutOf(visit, draft);
  const each = visit.sessions.map((session) => correctionOf(session, seats[session.sessionId] ?? draftOf(session)));
  if (openedAt === undefined || closedAt === undefined || each.includes('invalid')) return 'invalid';
  const changed = each.flatMap((one) => (one === null || one === 'invalid' ? [] : [one]));
  return openedAt === null && closedAt === null && changed.length === 0 ? 'unchanged' : { openedAt, closedAt: closedAtFor(closedAt, visit, changed), seats: changed };
}
