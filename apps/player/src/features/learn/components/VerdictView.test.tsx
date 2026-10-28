import { NEUTRAL_FALLBACK, type ErrorClass } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { feedbackLabel, feedbackText } from './VerdictView.tsx';

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

  it('gives the book’s own feedback, and RIVR Academy’s from the catalogue where the book wrote none', () => {
    expect(feedbackText({ authored: true, text: 'Fold the bottom of the range.' }, 'too_loose')).toBe('Fold the bottom of the range.');
    expect(feedbackText({ authored: false, text: 'engine words' }, 'too_loose')).toBe('This source plays a narrower hand here than the one you chose.');
  });

  it('has the catalogue’s words for every class the engine falls back on', () => {
    const classes = Object.keys(NEUTRAL_FALLBACK).filter((klass): klass is ErrorClass => klass in NEUTRAL_FALLBACK);
    for (const klass of classes) expect(t(`player.learn.fallback.${klass}`)).toBe(NEUTRAL_FALLBACK[klass]);
  });
});
