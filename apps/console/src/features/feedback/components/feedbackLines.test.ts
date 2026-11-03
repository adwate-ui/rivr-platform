import type { FeedbackItem } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { kindLine, ratingsLine, whoLine } from './feedbackLines.ts';

const ITEM: FeedbackItem = {
  id: 'f1', memberId: 'm1', fullName: 'Mihir Shah', memberNumber: 1213, visitClosedAt: null, score: null, note: 'Quick and fair', isTicket: true,
  resolvedAt: null, resolvedBy: null, resolution: null, createdAt: '2026-10-29T06:00:00Z', topic: null, ratings: null, nps: null,
};

describe('a feedback card’s lines', () => {
  it('names the member and their number', () => {
    expect(whoLine(ITEM)).toBe('Mihir Shah · No. 1213');
  });

  it('names a note from the app, a quick note by its topic, and detailed feedback by its recommendation, each with its day', () => {
    expect(kindLine(ITEM)).toBe('A note from the app · 29 Oct');
    expect(kindLine({ ...ITEM, topic: 'check_in_out' })).toBe('Check-in and check-out · 29 Oct');
    expect(kindLine({ ...ITEM, note: null, ratings: { gameplay: 5, cashier: 3, service: 4, ambience: 5 }, nps: 9 }))
      .toBe('Detailed feedback, would recommend 9 of 10 · 29 Oct');
  });

  it('names a visit’s rating by its score and the visit’s day', () => {
    expect(kindLine({ ...ITEM, score: 2, visitClosedAt: '2026-10-25T18:00:00Z' })).toBe('2 of 5 · visit 25 Oct');
  });

  it('puts the detailed form’s four ratings in a line', () => {
    expect(ratingsLine({ gameplay: 5, cashier: 4, service: 3, ambience: 4 })).toBe('Gameplay 5 · Cashier 4 · Service 3 · Ambience 4');
  });
});
