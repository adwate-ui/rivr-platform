import { SITE_BLOCK_KINDS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { fieldGroups, fieldsOf, itemAdded, itemRemoved, listAt, setAt } from './blockFields.ts';

const CARDS = { heading: 'What\u2019s on', cards: [{ title: 'Tournament nights', link: { label: 'Full calendar', page: 'tournaments' } }, { title: 'On the house', points: ['Tea', 'Coffee'] }] };

const ACTION = { label: 'a', to: 'sign-up' };

/** Each kind's words as the database keeps them, by the length of their keys, and the order its `<Kind>Block` draws them (F-040). */
const PAGE_ORDERS: readonly (readonly [string, Record<string, unknown>, readonly string[]])[] = [
  ['hero', { note: 'n', text: 't', action: ACTION, eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading', 'text', 'label', 'note']],
  ['statement', { note: 'n', text: 't', lines: ['l'], action: ACTION, eyebrow: 'e' }, ['eyebrow', 'lines', 'text', 'label', 'note']],
  ['gallery', { note: 'n', intro: 'i', items: [{ alt: 'a', text: 't', title: 'ti' }], eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading', 'intro', 'alt', 'title', 'text', 'note']],
  ['feature', { alt: 'a', text: 't', action: ACTION, points: ['p'], eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading', 'text', 'points', 'label', 'alt']],
  ['story', { alt: 'a', action: ACTION, eyebrow: 'e', figures: [{ label: 'l', value: 'v' }], heading: 'h', paragraphs: ['p'] },
    ['eyebrow', 'heading', 'paragraphs', 'label', 'alt', 'value', 'label']],
  ['cards', { cards: [{ link: { label: 'l', page: 'p' }, text: 't', label: 'l', title: 'ti', points: ['p'] }], intro: 'i', quote: 'q', action: ACTION, eyebrow: 'e', heading: 'h' },
    ['eyebrow', 'heading', 'intro', 'label', 'title', 'text', 'points', 'label', 'quote', 'label']],
  ['careers', { apply: 'a', roles: [{ body: 'b', title: 't' }], heading: 'h' }, ['heading', 'title', 'body', 'apply']],
  ['timeline', { items: [{ link: { href: 'https://indiankanoon.org/x', label: 'l' }, text: 't', when: 'w', title: 'ti' }], intro: 'i', eyebrow: 'e', heading: 'h' },
    ['eyebrow', 'heading', 'intro', 'when', 'title', 'text', 'label']],
  ['faq', { heading: 'h', questions: [{ answer: 'a', question: 'q' }] }, ['heading', 'question', 'answer']],
  ['text', { body: 'b', heading: 'h' }, ['heading', 'body']],
  ['rules', { rules: ['r'], heading: 'h' }, ['heading', 'rules']],
  ['map', { email: 'e', hours: 'h', phone: 'p', address: 'a', heading: 'he' }, ['heading', 'address', 'hours', 'phone', 'email']],
  ['links', { links: [{ href: 'x', label: 'l' }], heading: 'h' }, ['heading', 'label']],
  ['table', { note: 'n', intro: 'i', heading: 'h' }, ['heading', 'intro', 'note']],
  ['marquee', { phrases: ['p'] }, ['phrases']],
  ['promotions', { eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading']],
  ['outstation', { eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading']],
  ['jackpot', { eyebrow: 'e', heading: 'h' }, ['eyebrow', 'heading']],
  ['games', { heading: 'h' }, ['heading']],
  ['calendar', { heading: 'h' }, ['heading']],
  ['social_wall', { heading: 'h' }, ['heading']],
  ['league', { heading: 'h' }, ['heading']],
  ['rewards', { heading: 'h' }, ['heading']],
];

describe('the block editor\u2019s fields', () => {
  it('offers the words, each with its place in a list, and leaves links and pictures alone', () => {
    expect(fieldsOf('hero', { heading: 'House rules', image: '/media/a.webp', action: { label: 'Join', to: 'sign-up' } })).toEqual([
      { path: ['heading'], key: 'heading', value: 'House rules', number: null },
      { path: ['action', 'label'], key: 'label', value: 'Join', number: null },
    ]);
    expect(fieldsOf('cards', CARDS).map((field) => [field.key, field.value, field.number])).toEqual([
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

  it.each(PAGE_ORDERS)('lists %s\u2019s words in the order its block draws them (F-040)', (kind, content, keys) => {
    expect(fieldsOf(kind, content).map((field) => field.key)).toEqual(keys);
  });

  it('has that order for every kind of block', () => {
    expect(PAGE_ORDERS.map(([kind]) => kind).sort()).toEqual([...SITE_BLOCK_KINDS].sort());
  });

  it('keeps a word it has no place for, after those it has (F-040)', () => {
    expect(fieldsOf('hero', { text: 'b', quote: 'new', heading: 'a' }).map((field) => field.key)).toEqual(['heading', 'text', 'quote']);
    expect(fieldsOf('a new kind', { heading: 'a', text: 'b' }).map((field) => field.key)).toEqual(['heading', 'text']);
  });

  it('puts each item of a list under its own heading, and leaves a list of plain words as it is (F-040)', () => {
    const groups = fieldGroups(fieldsOf('a new kind', { heading: 'FAQ', questions: [{ question: 'Open?', answer: 'Yes' }, { question: 'Food?', answer: 'Yes' }], points: ['One', 'Two'] }));
    expect(groups.map((group) => [group.list, group.number, group.fields.map((field) => field.key)])).toEqual([
      [null, null, ['heading']],
      ['questions', 1, ['question', 'answer']],
      ['questions', 2, ['question', 'answer']],
      [null, null, ['points', 'points']],
    ]);
  });
});

// The owner, 12 Nov: points of the house rules, and any other list, gain and lose items in the editor.
describe('a block’s lists', () => {
  it('adds an empty word to a list of words', () => {
    expect(itemAdded({ heading: 'House rules', rules: ['One player to a hand.'] }, ['rules'], ''))
      .toEqual({ heading: 'House rules', rules: ['One player to a hand.', ''] });
    expect(itemAdded(CARDS, ['cards', 1, 'points'], '')).toEqual({ ...CARDS, cards: [CARDS.cards[0], { title: 'On the house', points: ['Tea', 'Coffee', ''] }] });
  });

  // A copy of the last ruling would have carried its link, which the editor cannot show or change (review of #906).
  it('adds the new item’s own empty words, never a copy of another item', () => {
    const rulings = { items: [{ when: '2024', title: 'Varun Gumber', link: { label: 'Read it', href: 'https://indiankanoon.org/doc/1/' } }] };
    expect(listAt(itemAdded(rulings, ['items'], { when: '', title: '', text: '' }), ['items'])?.at(-1)).toEqual({ when: '', title: '', text: '' });
  });

  it('adds to a list with no item yet', () => {
    expect(itemAdded({ heading: 'Careers', roles: [] }, ['roles'], { title: '', body: '' })).toEqual({ heading: 'Careers', roles: [{ title: '', body: '' }] });
  });

  it('removes the item at a place and nothing else', () => {
    expect(itemRemoved({ rules: ['a', 'b', 'c'] }, ['rules'], 1)).toEqual({ rules: ['a', 'c'] });
    expect(itemRemoved(CARDS, ['cards'], 0)).toEqual({ ...CARDS, cards: [CARDS.cards[1]] });
  });

  it('reads the list at a place, and nothing where there is none', () => {
    expect(listAt(CARDS, ['cards', 1, 'points'])).toEqual(['Tea', 'Coffee']);
    expect(listAt(CARDS, ['heading'])).toBeNull();
    expect(itemAdded(CARDS, ['heading'], '')).toEqual(CARDS);
  });
});
