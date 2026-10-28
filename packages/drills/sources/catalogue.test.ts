import { describe, expect, it } from 'vitest';
import { parsePayload } from '../src/index.ts';
import { BUILT_IN_SOURCES, builtInSource } from './catalogue.ts';

describe('the books that ship with RIVR', () => {
  it.each(BUILT_IN_SOURCES)('loads $title as a valid encoding whose source id is its own', async (book) => {
    const { payload, findings } = parsePayload(await book.load());
    expect(findings).toEqual([]);
    expect(payload?.source.id).toBe(book.id);
    expect(payload?.source.title).toBe(book.title);
  });

  it('finds a book by its id, and nothing for another', () => {
    expect(builtInSource('src_read_hands')?.author).toBe('Ed Miller');
    expect(builtInSource('src_example')).toBeUndefined();
  });
});
