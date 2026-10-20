import { describe, expect, it } from 'vitest';
import { toQuizQuestions } from './quizQuestions.ts';

describe('a quiz\'s questions', () => {
  it('reads each prompt with its choices', () => {
    expect(toQuizQuestions([{ prompt: 'When?', choices: ['Now', 'Later'], answer: 0 }])).toEqual([{ prompt: 'When?', choices: ['Now', 'Later'] }]);
  });

  it('reads none when any question is not as expected', () => {
    expect(toQuizQuestions([{ prompt: 'When?', choices: ['Now'] }])).toBeNull();
    expect(toQuizQuestions([{ prompt: '', choices: ['Now', 'Later'] }])).toBeNull();
    expect(toQuizQuestions([{ prompt: 'When?', choices: ['Now', 2] }])).toBeNull();
    expect(toQuizQuestions([{ prompt: 'When?', choices: ['Now', 'Later'] }, null])).toBeNull();
    expect(toQuizQuestions([])).toBeNull();
    expect(toQuizQuestions({ prompt: 'When?' })).toBeNull();
  });
});
