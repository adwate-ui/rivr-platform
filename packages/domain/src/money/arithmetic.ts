import { fromPaise, type Paise } from './paise.ts';

/** `a + b`. */
export function add(a: Paise, b: Paise): Paise {
  return fromPaise(a + b);
}

/** `from − amount`; goes below zero when `amount` is larger. */
export function subtract(from: Paise, amount: Paise): Paise {
  return fromPaise(from - amount);
}

/** The same amount with the opposite sign: the other side of a ledger line. */
export function negate(amount: Paise): Paise {
  return fromPaise(-amount);
}

/** The total of a list; ₹0 for an empty list. */
export function sum(amounts: readonly Paise[]): Paise {
  return fromPaise(amounts.reduce<bigint>((total, amount) => total + amount, 0n));
}

/** `amount × count` for a whole number of items: 58 entries of ₹9,000. */
export function times(amount: Paise, count: bigint): Paise {
  return fromPaise(amount * count);
}

/** `-1` when `a` is less, `1` when more, `0` when equal: a comparator for `sort`. */
export function compare(a: Paise, b: Paise): -1 | 0 | 1 {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The smaller of two amounts: `min(rake, cap)`. */
export function min(a: Paise, b: Paise): Paise {
  return a < b ? a : b;
}

/** The larger of two amounts. */
export function max(a: Paise, b: Paise): Paise {
  return a > b ? a : b;
}

/** True for ₹0. */
export function isZero(amount: Paise): boolean {
  return amount === 0n;
}

/** True below ₹0. */
export function isNegative(amount: Paise): boolean {
  return amount < 0n;
}

/** True above ₹0. */
export function isPositive(amount: Paise): boolean {
  return amount > 0n;
}
