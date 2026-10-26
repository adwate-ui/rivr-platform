import { describe, expect, it } from 'vitest';
import { formatBlinds } from './chips.ts';

describe('formatBlinds', () => {
  it('writes the blinds with Indian grouping', () => {
    expect(formatBlinds(500, 1000)).toBe('500/1,000');
    expect(formatBlinds(100000, 200000)).toBe('1,00,000/2,00,000');
  });

  it('adds an ante only when there is one', () => {
    expect(formatBlinds(400, 800, 800)).toBe('400/800 ante 800');
    expect(formatBlinds(400, 800, 0)).toBe('400/800');
  });
});
