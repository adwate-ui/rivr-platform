import { siteBlockSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { fieldsOf, setAt, type Content } from './blockFields.ts';
import { ADDABLE_KINDS, moved, newSection, retyped } from './sections.ts';

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

  it('drops a field the new kind reads differently', () => {
    // A heading of 100 characters is too long for a hero; a statement's lines are not a marquee's phrases.
    expect(retyped({ kind: 'text', content: { heading: 'x'.repeat(100), body: 'b' } }, 'hero').content).toEqual({ eyebrow: '', heading: '', text: '' });
    expect(retyped({ kind: 'statement', content: { lines: ['Not luck.'] } }, 'marquee').content).toEqual({ phrases: ['', ''] });
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
