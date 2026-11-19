import type { VisitTimes, WaitingSession } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { awayProblemOf, checkedInOf, checkedOutOf, correctionOf, draftOf, leftAtFrom, visitCorrectionOf, visitDraftOf, visitProblemsOf } from './sessionCorrection.ts';

// Sat at 21:40 IST on 15 Nov 2026, left at 23:40 after 5 minutes 30 seconds away.
const SAT = new Date('2026-11-15T16:10:00Z');
const seat: WaitingSession = { sessionId: 's1', tableName: 'Table 3', startedAt: SAT.toISOString(), endedAt: '2026-11-15T18:10:00Z', awaySeconds: 330 };
const open: WaitingSession = { ...seat, sessionId: 's2', endedAt: null };

describe('leftAtFrom', () => {
  it('is that clock time the same IST day when it comes after they sat, and the next day past midnight', () => {
    expect(leftAtFrom(SAT, '23:40')?.toISOString()).toBe('2026-11-15T18:10:00.000Z');
    expect(leftAtFrom(SAT, '01:15')?.toISOString()).toBe('2026-11-15T19:45:00.000Z');
    expect(leftAtFrom(SAT, '21:40')?.toISOString()).toBe('2026-11-16T16:10:00.000Z');
    expect(leftAtFrom(SAT, ' 23:40 ')?.toISOString()).toBe('2026-11-15T18:10:00.000Z');
  });

  it('is null for anything that is not a 24-hour clock time', () => {
    for (const typed of ['', '24:00', '9:30', '23:60', 'noon']) expect(leftAtFrom(SAT, typed)).toBeNull();
  });
});

describe('awayProblemOf', () => {
  it('finds nothing in a seat as it was, nor in time away as long as the seat', () => {
    expect(awayProblemOf(seat, draftOf(seat))).toBeNull();
    expect(awayProblemOf(seat, { leftAt: '23:40', awayMinutes: 120 })).toBeNull();
  });

  it('gives the seat\'s span when time away is longer, held to the end typed with it', () => {
    expect(awayProblemOf(seat, { leftAt: '23:40', awayMinutes: 121 })).toEqual({ from: seat.startedAt, to: '2026-11-15T18:10:00Z', minutes: 120 });
    expect(awayProblemOf(seat, { leftAt: '22:40', awayMinutes: 61 })).toEqual({ from: seat.startedAt, to: '2026-11-15T17:10:00.000Z', minutes: 60 });
  });

  it('runs a seat still taken to now, in whole minutes', () => {
    // 75 minutes 30 seconds after he sat.
    const now = new Date('2026-11-15T17:25:30Z');
    expect(awayProblemOf(open, { leftAt: '', awayMinutes: 75 }, now)).toBeNull();
    expect(awayProblemOf(open, { leftAt: '', awayMinutes: 76 }, now)).toEqual({ from: open.startedAt, to: null, minutes: 75 });
  });
});

describe('correctionOf', () => {
  it('sends nothing for a seat as it was', () => {
    expect(draftOf(seat)).toEqual({ leftAt: '23:40', awayMinutes: 6 });
    expect(correctionOf(seat, draftOf(seat))).toBeNull();
  });

  it('sends a new end with time away kept to the second, or new minutes away with the end kept', () => {
    expect(correctionOf(seat, { leftAt: '23:10', awayMinutes: 6 })).toEqual({ sessionId: 's1', endedAt: '2026-11-15T17:40:00.000Z', awaySeconds: 330 });
    expect(correctionOf(seat, { leftAt: '23:40', awayMinutes: 70 })).toEqual({ sessionId: 's1', endedAt: null, awaySeconds: 4200 });
  });

  it('corrects only the time away of a seat still taken', () => {
    expect(draftOf(open).leftAt).toBe('');
    expect(correctionOf(open, { leftAt: '', awayMinutes: 20 })).toEqual({ sessionId: 's2', endedAt: null, awaySeconds: 1200 });
  });

  it('is invalid when the time or the minutes cannot be read', () => {
    expect(correctionOf(seat, { leftAt: '11:40 pm', awayMinutes: 6 })).toBe('invalid');
    expect(correctionOf(seat, { leftAt: '23:40', awayMinutes: null })).toBe('invalid');
  });
});

// Checked in at 19:05 IST on 15 Nov 2026 and out at 23:40, with the seat above.
const VISIT: VisitTimes = { visitId: 'v1', openedAt: '2026-11-15T13:35:00Z', closedAt: '2026-11-15T18:10:00Z', sessions: [seat] };

describe('a visit\'s check-in and check-out (the owner, 18 Nov)', () => {
  it('keeps both as they were, and reads a check-in on the visit\'s own club day', () => {
    expect(visitDraftOf(VISIT)).toEqual({ checkedIn: '19:05', checkedOut: '23:40' });
    expect(checkedInOf(VISIT, '19:05')).toBeNull();
    expect(checkedInOf(VISIT, '18:30')).toBe('2026-11-15T13:00:00.000Z');
    // Past midnight is the club day's small hours, the next date.
    expect(checkedInOf(VISIT, '01:00')).toBe('2026-11-15T19:30:00.000Z');
    expect(checkedInOf(VISIT, '7 pm')).toBeUndefined();
  });

  it('reads a check-out as the first such time after check-in, and none while they are in', () => {
    expect(checkedOutOf(VISIT, { checkedIn: '19:05', checkedOut: '00:30' })).toBe('2026-11-15T19:00:00.000Z');
    expect(checkedOutOf(VISIT, { checkedIn: '19:05', checkedOut: '23:40' })).toBeNull();
    expect(checkedOutOf({ ...VISIT, closedAt: null }, { checkedIn: '19:05', checkedOut: '' })).toBeNull();
    expect(checkedOutOf(VISIT, { checkedIn: '19:05', checkedOut: 'late' })).toBeUndefined();
  });

  it('sends the visit\'s times with its changed seats, or says why not', () => {
    const seats = { s1: draftOf(seat) };
    expect(visitCorrectionOf(VISIT, visitDraftOf(VISIT), seats)).toBe('unchanged');
    expect(visitCorrectionOf(VISIT, { checkedIn: '18:30', checkedOut: '23:40' }, seats)).toEqual({ openedAt: '2026-11-15T13:00:00.000Z', closedAt: null, seats: [] });
    expect(visitCorrectionOf(VISIT, visitDraftOf(VISIT), { s1: { leftAt: '23:10', awayMinutes: 6 } }))
      .toEqual({ openedAt: null, closedAt: null, seats: [{ sessionId: 's1', endedAt: '2026-11-15T17:40:00.000Z', awaySeconds: 330 }] });
    expect(visitCorrectionOf(VISIT, { checkedIn: 'soon', checkedOut: '23:40' }, seats)).toBe('invalid');
  });

  it('sends the last seat\'s own end, microseconds and all, when check-out is typed as its minute', () => {
    const late = { ...seat, endedAt: '2026-11-15T17:40:30.123456+00:00' };
    const visit = { ...VISIT, sessions: [late] };
    expect(visitCorrectionOf(visit, { checkedIn: '19:05', checkedOut: '23:10' }, { s1: draftOf(late) })).toMatchObject({ closedAt: '2026-11-15T17:40:30.123456+00:00' });
    expect(visitCorrectionOf(visit, { checkedIn: '19:05', checkedOut: '23:20' }, { s1: draftOf(late) })).toMatchObject({ closedAt: '2026-11-15T17:50:00.000Z' });
  });
});

describe('what refuses a visit\'s times, said under the field (the review of the pull request for Edit visit)', () => {
  const seats = { s1: draftOf(seat) };
  const LATER = new Date('2026-11-19T12:00:00Z');
  const problems = (checkedIn: string, checkedOut: string, typed = seats, now = LATER) => visitProblemsOf(VISIT, { checkedIn, checkedOut }, typed, now);

  it('finds nothing in the visit as it was, nor in a time that cannot be read', () => {
    expect(problems('19:05', '23:40')).toEqual({ checkedIn: null, checkedOut: null });
    expect(problems('soon', 'late')).toEqual({ checkedIn: null, checkedOut: null });
  });

  it('holds check-in to the first seat\'s start and check-out to the last seat\'s end, as typed in the panel', () => {
    expect(problems('21:45', '23:40').checkedIn).toEqual({ rule: 'afterFirstSeat', at: seat.startedAt });
    expect(problems('19:05', '23:30').checkedOut).toEqual({ rule: 'beforeLastSeat', at: seat.endedAt });
    expect(problems('19:05', '23:30', { s1: { leftAt: '23:20', awayMinutes: 6 } }).checkedOut).toBeNull();
    expect(problems('19:05', '23:40', { s1: { leftAt: '23:50', awayMinutes: 6 } }).checkedOut).toEqual({ rule: 'beforeLastSeat', at: '2026-11-15T18:20:00.000Z' });
  });

  it('holds both to now', () => {
    const now = new Date('2026-11-15T18:00:00Z');
    expect(problems('23:45', '23:40', seats, now).checkedIn).toEqual({ rule: 'aheadOfNow', at: null });
    expect(problems('19:05', '23:50', seats, now).checkedOut).toEqual({ rule: 'aheadOfNow', at: null });
  });

  it('holds check-out to 06:00 the next morning, unless the visit already ran past it', () => {
    expect(problems('19:05', '06:30').checkedOut).toEqual({ rule: 'pastDayEnd', at: null });
    const night = { ...VISIT, closedAt: '2026-11-16T01:30:00Z' };
    expect(visitProblemsOf(night, { checkedIn: '19:05', checkedOut: '06:30' }, seats, LATER).checkedOut).toBeNull();
    expect(visitProblemsOf(night, { checkedIn: '19:05', checkedOut: '07:30' }, seats, LATER).checkedOut).toEqual({ rule: 'pastDayEnd', at: null });
  });
});
