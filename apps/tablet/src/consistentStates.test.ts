import { describe, expect, it } from 'vitest';

// Consistent states (#607, F-164): every feature's source, as text.
const SOURCES = import.meta.glob<string>(['./features/**/*.tsx', '!./features/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true });

const OWN_STATES: readonly string[] = [];

describe('the dealer tablet\'s states', () => {
  it('shows a load and a failed load with its Retry only through LoadState or Screen, never a block of its own', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5);
    const own = Object.entries(SOURCES).filter(([, source]) => source.includes("'common.retry'") || source.includes("'common.loading'")).map(([file]) => file).sort();
    expect(own).toEqual(OWN_STATES);
  });
});
