import { describe, expect, it } from 'vitest';
import { fieldsOf, setAt } from './blockFields.ts';

const CARDS = { heading: 'What\u2019s on', cards: [{ title: 'Tournament nights', link: { label: 'Full calendar', page: 'tournaments' } }, { title: 'On the house', points: ['Tea', 'Coffee'] }] };

describe('the block editor\u2019s fields', () => {
  it('offers the words, each with its place in a list, and leaves links and pictures alone', () => {
    expect(fieldsOf({ heading: 'House rules', image: '/media/a.webp', action: { label: 'Join', to: 'sign-up' } })).toEqual([
      { path: ['heading'], key: 'heading', value: 'House rules', number: null },
      { path: ['action', 'label'], key: 'label', value: 'Join', number: null },
    ]);
    expect(fieldsOf(CARDS).map((field) => [field.key, field.value, field.number])).toEqual([
      ['heading', 'What\u2019s on', null], ['title', 'Tournament nights', 1], ['label', 'Full calendar', 1], ['title', 'On the house', 2],
      ['points', 'Tea', 1], ['points', 'Coffee', 2],
    ]);
  });

  it('changes the words at one place and nothing else', () => {
    const changed = setAt(CARDS, ['cards', 1, 'points', 0], 'Masala chai');
    expect(changed).toEqual({ ...CARDS, cards: [CARDS.cards[0], { title: 'On the house', points: ['Masala chai', 'Coffee'] }] });
    expect(setAt(CARDS, ['missing', 'place'], 'x')).toEqual(CARDS);
    expect(setAt('text', [0], 'x')).toBe('text');
  });
});
