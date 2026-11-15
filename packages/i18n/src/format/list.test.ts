import { describe, expect, it } from 'vitest';
import { formatList } from './list.ts';

describe('formatList', () => {
  it('joins tier names with "and"', () => {
    expect(formatList(['Black card'])).toBe('Black card');
    expect(formatList(['Black card', "Founders' Circle"])).toBe("Black card and Founders' Circle");
    expect(formatList(['Member', 'High roller', 'Black card'])).toBe('Member, High roller and Black card');
  });
});
