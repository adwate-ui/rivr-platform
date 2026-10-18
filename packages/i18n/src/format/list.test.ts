import { describe, expect, it } from 'vitest';
import { formatList } from './list.ts';

describe('formatList', () => {
  it('joins tier names with "and" in English', () => {
    expect(formatList(['Black card'], 'en')).toBe('Black card');
    expect(formatList(['Black card', "Founders' Circle"], 'en')).toBe("Black card and Founders' Circle");
    expect(formatList(['Member', 'Academy graduate', 'Black card'], 'en')).toBe('Member, Academy graduate and Black card');
  });

  it('joins with "और" in Hindi, following the Unicode (CLDR) list style', () => {
    expect(formatList(['A', 'B'], 'hi')).toBe('A और B');
    expect(formatList(['A', 'B', 'C'], 'hi')).toBe('A, B, और C');
  });
});
