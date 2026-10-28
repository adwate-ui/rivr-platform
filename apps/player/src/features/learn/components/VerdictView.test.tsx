import { t } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { feedbackLabel } from './VerdictView.tsx';

const SEVEN = ['correct', 'too_loose', 'too_tight', 'too_passive', 'too_aggressive', 'wrong_sizing', 'right_idea_wrong_spot'] as const;

describe('the verdict', () => {
  it('labels the engine\'s own feedback RIVR Academy, and a book\'s by its title', () => {
    expect(feedbackLabel(false, 'Schema Demonstration')).toBe('RIVR Academy');
    expect(feedbackLabel(true, 'Schema Demonstration')).toBe('Schema Demonstration');
  });

  it('names each of the seven verdict classes', () => {
    expect(SEVEN.map((klass) => t(`player.learn.verdicts.${klass}`))).toEqual([
      'Correct', 'Too loose', 'Too tight', 'Too passive', 'Too aggressive', 'Right action, wrong size', 'Right idea, wrong spot',
    ]);
  });
});
