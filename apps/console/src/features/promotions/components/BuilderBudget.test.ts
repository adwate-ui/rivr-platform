import { describe, expect, it } from 'vitest';
import { budgetOf, NO_BUDGET } from './BuilderBudget.tsx';

describe('a builder promotion\u2019s budget as typed', () => {
  it('is none when nothing is typed: no cap', () => {
    expect(budgetOf(NO_BUDGET)).toBeNull();
    expect(budgetOf({ amount: '  ', grants: '' })).toBeNull();
  });

  it('takes an amount in bonus chips, the most grants, or both', () => {
    expect(budgetOf({ amount: '50,000', grants: '' })).toEqual({ paise: 5_000_000n, count: null });
    expect(budgetOf({ amount: '', grants: '40' })).toEqual({ paise: null, count: 40 });
    expect(budgetOf({ amount: '50000', grants: '20' })).toEqual({ paise: 5_000_000n, count: 20 });
  });

  it('refuses an amount or a count that is no whole, positive figure, or more than the most a budget may be', () => {
    for (const typed of [
      { amount: 'lots', grants: '' }, { amount: '0', grants: '' }, { amount: '2500.50', grants: '' }, { amount: '1,00,00,001', grants: '' },
      { amount: '', grants: '2.5' }, { amount: '', grants: '0' }, { amount: '', grants: '3000000000' },
    ]) {
      expect(budgetOf(typed)).toBeUndefined();
    }
  });
});
