import { describe, expect, it } from 'vitest';

// Consistent states (#607): every feature's source, as text.
const SOURCES = import.meta.glob<string>(['./features/**/*.tsx', '!./features/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true });

describe('the console\'s states', () => {
  it('shows a failed load and its Retry only through LoadState or Screen, never a block of its own', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    const ownRetry = Object.entries(SOURCES).filter(([, source]) => source.includes("t('common.retry')")).map(([file]) => file);
    expect(ownRetry).toEqual([]);
  });
});
