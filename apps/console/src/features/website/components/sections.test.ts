import { siteBlockSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsOf, setAt, type Content } from './blockFields.ts';
import { ADDABLE_KINDS, kindsFor, LIST_RULES, listRule, moved, newSection, retyped } from './sections.ts';

/** A section with every word filled in, as an editor would before saving it. */
function filled(kind: string, content: Content): { kind: string; content: Content } {
  return { kind, content: fieldsOf(kind, content).reduce((each, field) => setAt(each, field.path, 'Words'), content) };
}

describe('newSection', () => {
  it('starts each kind it offers with empty words, which save once filled in', () => {
    for (const kind of ADDABLE_KINDS) {
      const section = newSection(kind);
      expect(section.kind).toBe(kind);
      expect(siteBlockSchema.safeParse(filled(kind, section.content)).success, kind).toBe(true);
    }
  });

  it('offers no kind that needs a picture, a map link, a table or a link into the app, which the editor cannot set', () => {
    for (const kind of ['gallery', 'feature', 'map', 'table', 'links']) expect(ADDABLE_KINDS).not.toContain(kind);
  });

  it('gives each new section its own content, never one shared with another', () => {
    const first = newSection('rules');
    const second = newSection('rules');
    expect(first.content).not.toBe(second.content);
  });
});

describe('retyped', () => {
  it('keeps the fields of the same name the new kind takes, and starts the rest empty', () => {
    expect(retyped({ kind: 'text', content: { heading: 'Our tables', body: 'Six of them.' } }, 'hero'))
      .toEqual({ kind: 'hero', content: { eyebrow: '', heading: 'Our tables', text: '' } });
    expect(retyped({ kind: 'rules', content: { heading: 'House rules', rules: ['One player to a hand.'] } }, 'faq'))
      .toEqual({ kind: 'faq', content: { heading: 'House rules', questions: [{ question: '', answer: '' }] } });
  });

  // A picture kept without its description could never save, as the editor has no field for it (review of #906).
  it('leaves a picture, a link or a button behind', () => {
    expect(retyped({ kind: 'statement', content: { lines: ['Not luck.'], image: '/media/chips.webp', action: { label: 'Join', to: 'sign-up' } } }, 'story').content)
      .toEqual({ eyebrow: '', heading: '', paragraphs: [''] });
  });

  it('drops a field the new kind reads differently', () => {
    // A heading of 100 characters is too long for a hero; a statement's lines are not a marquee's phrases.
    expect(retyped({ kind: 'text', content: { heading: 'x'.repeat(100), body: 'b' } }, 'hero').content).toEqual({ eyebrow: '', heading: '', text: '' });
    expect(retyped({ kind: 'statement', content: { lines: ['Not luck.'] } }, 'marquee').content).toEqual({ phrases: ['', ''] });
  });
});

// The database keeps one hero to a page (site_block_one_hero_idx): a second would save and never publish (review of #906).
describe('kindsFor', () => {
  const hero = { kind: 'hero', content: { heading: 'House rules' } };
  const rules = { kind: 'rules', content: { rules: ['One player to a hand.'] } };

  it('offers no second hero', () => {
    expect(kindsFor([hero, rules], null)).not.toContain('hero');
    expect(kindsFor([hero, rules], rules)).not.toContain('hero');
    expect(kindsFor([rules], null)).toContain('hero');
  });

  it('lets the hero itself keep its kind', () => {
    expect(kindsFor([hero, rules], hero)).toContain('hero');
  });
});

/** A list of `count` items, and the content of a block that holds it with every other field it needs. */
const SAMPLES: Readonly<Record<string, { item: Content; holding: (list: Content[]) => Content }>> = {
  'statement.lines': { item: 'Not luck.', holding: (list) => ({ lines: list }) },
  'gallery.items': { item: { image: '/media/room.webp', alt: 'The room', title: 'Tables' }, holding: (list) => ({ heading: 'The room', items: list }) },
  'feature.points': { item: 'Tea', holding: (list) => ({ heading: 'Food', image: '/media/food.webp', alt: 'Food', points: list }) },
  'rules.rules': { item: 'One player to a hand.', holding: (list) => ({ rules: list }) },
  'faq.questions': { item: { question: 'Open late?', answer: 'Yes.' }, holding: (list) => ({ questions: list }) },
  'careers.roles': { item: { title: 'Dealer', body: 'Deals the cards.' }, holding: (list) => ({ roles: list }) },
  'links.links': { item: { label: 'Join', to: 'sign-up' }, holding: (list) => ({ links: list }) },
  'story.paragraphs': { item: 'Six tables.', holding: (list) => ({ heading: 'Our story', paragraphs: list }) },
  'story.figures': { item: { value: '6', label: 'Tables' }, holding: (list) => ({ heading: 'Our story', paragraphs: ['Six tables.'], figures: list }) },
  'cards.cards': { item: { title: 'Play' }, holding: (list) => ({ cards: list }) },
  'cards.cards.points': { item: 'Tea', holding: (list) => ({ cards: [{ title: 'Eat', points: list }, { title: 'Play' }] }) },
  'marquee.phrases': { item: 'Members only', holding: (list) => ({ phrases: list }) },
  'timeline.items': { item: { when: '1996', title: 'A ruling' }, holding: (list) => ({ items: list }) },
};

describe('a list’s rule', () => {
  it('is there for every list, and for none other', () => {
    expect(Object.keys(LIST_RULES).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it.each(Object.entries(SAMPLES))('holds %s to as many items as the website takes', (key, sample) => {
    const [kind = '', ...path] = key.split('.');
    const rule = listRule(kind, path);
    const fits = (count: number) => siteBlockSchema.safeParse({ kind, content: sample.holding(Array.from({ length: count }, () => sample.item)) }).success;
    expect(rule).not.toBeNull();
    if (rule === null) return;
    expect(fits(rule.min)).toBe(true);
    expect(fits(rule.max)).toBe(true);
    expect(fits(rule.max + 1)).toBe(false);
    if (rule.min > 0) expect(fits(rule.min - 1)).toBe(false);
  });
});

describe('moved', () => {
  it('moves one place up or down, and stays put at either end', () => {
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moved(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
