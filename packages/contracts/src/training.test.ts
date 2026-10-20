import { describe, expect, it } from 'vitest';
import { quizAnswersSchema } from './training.ts';

describe('Certification quizzes', () => {
  it('takes answers only when every question has one', () => {
    expect(quizAnswersSchema.safeParse({ answers: [1, 0, 2] }).success).toBe(true);
    expect(quizAnswersSchema.safeParse({ answers: [1, -1, 2] }).success).toBe(false);
    expect(quizAnswersSchema.safeParse({ answers: [] }).success).toBe(false);
  });
});
