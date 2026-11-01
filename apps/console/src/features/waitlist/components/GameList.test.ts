import { describe, expect, it } from 'vitest';
import { nameGivesBlinds } from './GameList.tsx';

describe('a stake heading (UI polish audit A-10)', () => {
  it('shows the blinds once when the name says them, with or without the grouping commas', () => {
    expect(nameGivesBlinds('NLH 50/100', 5000n, 10000n)).toBe(true);
    expect(nameGivesBlinds('NLH 1000/2000', 100000n, 200000n)).toBe(true);
    expect(nameGivesBlinds('NLH 1,000/2,000', 100000n, 200000n)).toBe(true);
  });

  it('shows them beside a name that does not', () => {
    expect(nameGivesBlinds('Private Room', 10000n, 20000n)).toBe(false);
    expect(nameGivesBlinds('NLH 50/100', 10000n, 20000n)).toBe(false);
  });
});
