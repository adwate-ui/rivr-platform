import type { FeedbackItem } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { feedbackLine } from './FeedbackScreen.tsx';

const ITEM: FeedbackItem = {
  id: 'f1', memberId: 'm1', fullName: 'Mihir Shah', memberNumber: 1213, visitClosedAt: null, score: null, note: 'Quick and fair', isTicket: true,
  resolvedAt: null, resolvedBy: null, resolution: null, createdAt: '2026-10-29T06:00:00Z', topic: null, ratings: null, nps: null,
};

describe('a feedback line', () => {
  it('names a note from the app, a quick note by its topic, and detailed feedback by its recommendation', () => {
    expect(feedbackLine(ITEM)).toBe('Mihir Shah · No. 1213 · a note from the app · 29 Oct');
    expect(feedbackLine({ ...ITEM, topic: 'check_in_out' })).toBe('Mihir Shah · No. 1213 · a quick note on Check-in and check-out · 29 Oct');
    expect(feedbackLine({ ...ITEM, note: null, ratings: { gameplay: 5, cashier: 3, service: 4, ambience: 5 }, nps: 9 }))
      .toBe('Mihir Shah · No. 1213 · detailed feedback, would recommend 9 of 10 · 29 Oct');
  });

  it('names a visit’s rating by its score and the visit’s day', () => {
    expect(feedbackLine({ ...ITEM, score: 2, visitClosedAt: '2026-10-25T18:00:00Z' })).toBe('Mihir Shah · No. 1213 · 2 of 5 · visit 25 Oct');
  });
});
