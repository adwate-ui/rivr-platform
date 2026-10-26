import { subtract, type Paise } from '../money/index.ts';

/**
 * What one buy of a tournament puts in its prize pool (#115, decision 0200): its price less the fee the
 * club keeps, so RIVR Sunday's ₹10,000 with a ₹1,000 fee puts ₹9,000 in. A fee below nothing, or not below
 * the price, is a bug and throws: the database refuses both.
 */
export function poolShare(price: Paise, fee: Paise): Paise {
  if (fee < 0n || fee >= price) throw new RangeError('A fee is part of the price, below it');
  return subtract(price, fee);
}
