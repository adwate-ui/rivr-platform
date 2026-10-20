import { describe, expect, it } from 'vitest';
import { quizAnswersSchema, quizQuestionsSchema } from './training.ts';

describe('Certification quizzes', () => {
  it('reads questions with at least two choices each', () => {
    expect(quizQuestionsSchema.safeParse([{ prompt: 'When?', choices: ['Now', 'Later'] }]).success).toBe(true);
    expect(quizQuestionsSchema.safeParse([{ prompt: 'When?', choices: ['Now'] }]).success).toBe(false);
    expect(quizQuestionsSchema.safeParse([]).success).toBe(false);
  });

  it('takes answers only when every question has one', () => {
    expect(quizAnswersSchema.safeParse({ answers: [1, 0, 2] }).success).toBe(true);
    expect(quizAnswersSchema.safeParse({ answers: [1, -1, 2] }).success).toBe(false);
    expect(quizAnswersSchema.safeParse({ answers: [] }).success).toBe(false);
  });
});
