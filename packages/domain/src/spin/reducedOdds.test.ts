import { describe, expect, it } from 'vitest';
import { reducedOdds } from './index.ts';

describe('a prize\u2019s odds in lowest terms (F-139)', () => {
  it('reduces them', () => {
    expect(reducedOdds(20, 70)).toEqual({ weight: 2, total: 7 });
    expect(reducedOdds(50, 70)).toEqual({ weight: 5, total: 7 });
  });

  it('leaves what will not reduce', () => {
    expect(reducedOdds(3, 7)).toEqual({ weight: 3, total: 7 });
  });

  it('is sure of a prize that is the whole wheel', () => {
    expect(reducedOdds(70, 70)).toEqual({ weight: 1, total: 1 });
  });

  it('leaves nothing as nothing', () => {
    expect(reducedOdds(0, 0)).toEqual({ weight: 0, total: 0 });
  });
});
