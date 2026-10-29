import { describe, expect, it } from 'vitest';
import { promotionWords } from './promotionWords.ts';

describe('promotionWords', () => {
  it('takes a rule from each line with words on it', () => {
    expect(promotionWords(' New members only \n\nOnce a member\n', '').rules).toEqual(['New members only', 'Once a member']);
  });

  it('takes each question with the answer on the lines after it, a blank line between questions', () => {
    const text = 'Do I claim it?\nNo: it is added\nat the cage.\n\n  \nCan I combine it?\nNo.\n\nA question with no answer';
    expect(promotionWords('', text).questions).toEqual([
      { question: 'Do I claim it?', answer: 'No: it is added at the cage.' },
      { question: 'Can I combine it?', answer: 'No.' },
    ]);
  });

  it('has none of either from empty boxes', () => {
    expect(promotionWords('', '   ')).toEqual({ rules: [], questions: [] });
  });
});
