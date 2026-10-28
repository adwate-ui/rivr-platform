import { ENGLISH_WORDS } from '@rivr/drills';
import { describe, expect, it } from 'vitest';
import { drillWords } from './words.ts';

describe('the drill engine\'s words from the catalogue', () => {
  it('has a word for every one the engine speaks, matching its English', () => {
    const words = drillWords();
    for (const group of ['ranks', 'suits', 'streets', 'streetWords', 'positions', 'stacks', 'spr', 'raiseSizes', 'pots', 'counts', 'preflopFacing',
      'postflopFacing', 'runouts', 'past'] as const) {
      expect(words[group]).toEqual(ENGLISH_WORDS[group]);
    }
  });

  it('builds the sentences from the catalogue', () => {
    const { say } = drillWords();
    expect(say.card('ace', 'hearts')).toBe('ace of hearts');
    expect(say.opening({ street: 'Flop', position: 'the button', stack: 'a deep stack', pot: 'a single-raised pot', count: 'heads up' }))
      .toBe('Flop. You are on the button with a deep stack in a single-raised pot, heads up.');
    expect(say.middle('about 6bb')).toBe('About 6bb in the middle.');
    expect(say.actions([say.stepOn(say.step('hero', 'bet'), 'flop'), say.step('villain', 'called')])).toBe('Action so far: you bet the flop, then they called.');
    expect(say.hand('ace of hearts', true)).toBe('Your opponent\u2019s hand: ace of hearts.');
  });
});
