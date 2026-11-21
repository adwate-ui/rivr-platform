import { add, compare, isPositive, subtract, ZERO, type Paise } from '../money/index.ts';
import { bonusPayOff } from './bonus.ts';

/** A member's Bonus as a file finds it: what is in force, and what is owed. */
export interface BonusHolding {
  readonly inForce: Paise;
  readonly owed: Paise;
}

/** A line of a Bonus file as the rule reads it: whose, an Add or a Use, and how much (whole ₹50 chips, checked before). */
export interface BonusFileLine {
  readonly memberId: string;
  readonly kind: 'add' | 'use';
  readonly amount: Paise;
}

/** Why a file's Use is refused: some Bonus is owed, or it is more than the Bonus in force by then. */
export type BonusFileRefusal = 'owed' | 'bonus_short';

/** A file run in order: each line's refusal (null for none), and each member's Bonus after the lines that go. */
export interface BonusFileRun {
  readonly refusals: readonly (BonusFileRefusal | null)[];
  readonly held: ReadonlyMap<string, BonusHolding>;
}

const NOTHING: BonusHolding = { inForce: ZERO, owed: ZERO };

/** A member's Bonus after an Add: what is owed is paid first, and the member keeps the rest (`bonusPayOff`). */
function afterAdd(holding: BonusHolding, amount: Paise): BonusHolding {
  const { paid, kept } = bonusPayOff(amount, holding.owed);
  return { inForce: add(holding.inForce, kept), owed: subtract(holding.owed, paid) };
}

/**
 * A Bonus file's lines in the file's order (the owner, 22 Nov; decision 0707). An Add pays what the member owes first
 * and they keep the rest. A Use is refused while any is owed, or when it is more than what is in force by then, Adds above
 * it included. A refused line changes nothing, and the lines after it read on. A member with no holding given holds
 * nothing. The database's private.bonus_from_file runs a file the same way, and refuses it whole if any line is refused.
 */
export function bonusFileRun(lines: readonly BonusFileLine[], held: ReadonlyMap<string, BonusHolding>): BonusFileRun {
  const now = new Map(held);
  const refusals = lines.map((line): BonusFileRefusal | null => {
    const holding = now.get(line.memberId) ?? NOTHING;
    if (line.kind === 'add') {
      now.set(line.memberId, afterAdd(holding, line.amount));
      return null;
    }
    if (isPositive(holding.owed)) return 'owed';
    if (compare(line.amount, holding.inForce) > 0) return 'bonus_short';
    now.set(line.memberId, { inForce: subtract(holding.inForce, line.amount), owed: holding.owed });
    return null;
  });
  return { refusals, held: now };
}

/** A file's Bonus added and used, each line counted once. */
export function bonusFileTotals(lines: readonly BonusFileLine[]): { readonly added: Paise; readonly used: Paise } {
  const sum = (kind: BonusFileLine['kind']) => lines.filter((line) => line.kind === kind).reduce((total, line) => add(total, line.amount), ZERO);
  return { added: sum('add'), used: sum('use') };
}
