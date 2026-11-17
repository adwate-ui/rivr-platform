import type { WaitingSession } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { correctionOf, draftOf, leftAtFrom } from './sessionCorrection.ts';

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
