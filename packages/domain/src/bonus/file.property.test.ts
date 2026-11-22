import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, ZERO } from '../money/index.ts';
import { bonusFileRun, bonusFileTotals, type BonusFileLine, type BonusHolding } from './file.ts';

const MEMBERS = ['ritika', 'kunal', 'neel'] as const;
const chips = fc.bigInt({ min: 1n, max: 2_000n }).map((count) => fromPaise(count * 5_000n));
const paise = fc.bigInt({ min: 0n, max: 5_000_000n }).map((amount) => fromPaise(amount));
const line = fc.record({ memberId: fc.constantFrom(...MEMBERS), kind: fc.constantFrom('add' as const, 'use' as const), amount: chips });
const file = fc.array(line, { maxLength: 12 });
const held = fc.array(fc.tuple(fc.constantFrom(...MEMBERS), fc.record({ inForce: paise, owed: paise })), { maxLength: 3 })
  .map((pairs) => new Map<string, BonusHolding>(pairs));

/** A member's Bonus as one figure: what is in force less what is owed. */
const net = (holding: BonusHolding | undefined) => (holding?.inForce ?? ZERO) - (holding?.owed ?? ZERO);

describe('Bonus file properties', () => {
  it('never leaves Bonus in force or owed below nothing', () => {
    fc.assert(fc.property(file, held, (lines, before) => {
      for (const holding of bonusFileRun(lines, before).held.values()) {
        expect(holding.inForce >= 0n && holding.owed >= 0n).toBe(true);
      }
    }));
  });

  it('moves each member by their Adds less the Uses that went, and never takes a line refused', () => {
    fc.assert(fc.property(file, held, (lines, before) => {
      const run = bonusFileRun(lines, before);
      for (const member of MEMBERS) {
        const moved = lines.reduce((sum, one, index) => {
          if (one.memberId !== member) return sum;
          if (one.kind === 'add') return sum + one.amount;
          return run.refusals[index] === null ? sum - one.amount : sum;
        }, 0n);
        expect(net(run.held.get(member)) - net(before.get(member))).toBe(moved);
      }
    }));
  });

  it('never refuses an Add', () => {
    fc.assert(fc.property(file, held, (lines, before) => {
      const run = bonusFileRun(lines, before);
      lines.forEach((one: BonusFileLine, index) => {
        if (one.kind === 'add') expect(run.refusals[index]).toBeNull();
      });
    }));
  });

  it('leaves what it is given as it was', () => {
    fc.assert(fc.property(file, held, (lines, before) => {
      const copy = new Map(before);
      bonusFileRun(lines, before);
      expect(before).toEqual(copy);
    }));
  });

  it('totals every line once, by its kind', () => {
    fc.assert(fc.property(file, (lines) => {
      const { added, used } = bonusFileTotals(lines);
      expect(added + used).toBe(lines.reduce((sum, one) => sum + one.amount, 0n));
    }));
  });
});
