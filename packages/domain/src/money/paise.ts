import { paiseSchema, type Paise } from '@rivr/contracts';

export type { Paise };

const PAISE_PER_RUPEE = 100n;

/** Money from a count of paise: `fromPaise(250_000n)` is ₹2,500. */
export function fromPaise(paise: bigint): Paise {
  return paiseSchema.parse(paise);
}

/** Money from whole rupees: `fromRupees(2_500n)` is ₹2,500. For text a person typed, use `parseRupees`. */
export function fromRupees(rupees: bigint): Paise {
  return fromPaise(rupees * PAISE_PER_RUPEE);
}

/** No money: ₹0. */
export const ZERO: Paise = fromPaise(0n);
