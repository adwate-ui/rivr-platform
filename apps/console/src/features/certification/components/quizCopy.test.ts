import type { Quiz, QuizAttempt } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { quizFailureText, resultText, standingText } from './quizCopy.ts';

const QUIZ: Quiz = { quizId: 'q1', role: 'cashier', title: 'Cashier certification', passPercent: 80, questions: [] };
const TRY: QuizAttempt = {
  attemptId: 'a1', quizId: 'q1', quizTitle: 'Cashier certification', staffId: 's1', staffName: 'Sana Qureshi',
  correctCount: 4, questionCount: 6, isPassed: false, takenAt: '2026-10-20T18:45:00Z',
};

describe('what the Certification screen says', () => {
  it('gives the staff member a pass before a later failed try, else their last try, else not taken', () => {
    const pass = { ...TRY, attemptId: 'a2', correctCount: 5, isPassed: true, takenAt: '2026-10-19T10:00:00Z' };
    expect(standingText(QUIZ, [TRY, pass])).toBe('You passed on 19 Oct 2026 with 5 of 6. It is on your staff record.');
    expect(standingText(QUIZ, [TRY])).toBe('Your last try, on 21 Oct 2026: 4 of 6, not a pass yet.');
    expect(standingText(QUIZ, [{ ...TRY, quizId: 'q2' }])).toBe('Not taken yet.');
  });

  it('says how an attempt was marked, and why one was not recorded', () => {
    expect(resultText({ correctCount: 5, questionCount: 6, isPassed: true }, 80)).toBe('Passed: 5 of 6. It is on your staff record.');
    expect(resultText({ correctCount: 4, questionCount: 6, isPassed: false }, 80))
      .toBe('Not a pass: 4 of 6. A pass needs 80% right. Read the procedures again and try once more.');
    expect(quizFailureText('paused')).toBe('The venue is frozen. Quizzes are taken again once it is released.');
  });
});
