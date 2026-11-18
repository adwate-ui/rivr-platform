import type { VisitTimes, WaitingSession } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { checkedInOf, checkedOutOf, correctionOf, draftOf, leftAtFrom, visitCorrectionOf, visitDraftOf } from './sessionCorrection.ts';

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
