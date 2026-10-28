import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { glazaPayable } from './payable.ts';

const comps = fc.bigInt({ min: 0n, max: 100_000_000_00n }).map(fromPaise);
const margin = fc.bigInt({ min: -100_000_000_00n, max: 100_000_000_00n }).map(fromPaise);

describe('glazaPayable', () => {
  it('splits the margin within a paisa, the odd paisa to Glaza, and the share and payable add back to the comps', () => {
    fc.assert(fc.property(comps, margin, (comp, alcohol) => {
      const { rivrShare, payable } = glazaPayable(comp, alcohol);
      const glazaShare = alcohol - rivrShare;
      expect(glazaShare - rivrShare === 0n || glazaShare - rivrShare === (alcohol > 0n ? 1n : -1n)).toBe(true);
      expect(payable + rivrShare).toBe(comp);
    }));
  });
});
