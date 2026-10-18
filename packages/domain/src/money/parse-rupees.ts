import { err, ok, type Result } from '@rivr/contracts';
import { fromPaise, type Paise } from './paise.ts';

/** Why typed text is not an amount: nothing typed, a minus sign, more than two decimals, or not a number. */
export type ParseRupeesError = 'empty' | 'negative' | 'too_many_decimals' | 'invalid';

const RUPEE_SIGN = /^₹\s*/;
// Hyphen or the minus sign formatMoney writes.
const MINUS = /^[-−]/;
// Plain digits or Indian grouping (1,20,000), then optional decimals.
const AMOUNT = /^(\d+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.(\d+))?$/;
const PAISE_PER_RUPEE = 100n;

/**
 * Reads rupees a person typed, `1,20,000`, `120000` or `₹2,449.50`, into paise. Expected mistakes
 * come back as an error to show the person; nothing is rounded.
 */
export function parseRupees(text: string): Result<Paise, ParseRupeesError> {
  const amount = text.trim().replace(RUPEE_SIGN, '');
  if (amount === '') return err('empty');
  if (MINUS.test(amount)) return err('negative');
  const match = AMOUNT.exec(amount);
  if (match === null) return err('invalid');
  const [, rupees = '', decimals = ''] = match;
  if (decimals.length > 2) return err('too_many_decimals');
  const paise = BigInt(rupees.replaceAll(',', '')) * PAISE_PER_RUPEE + BigInt(decimals.padEnd(2, '0'));
  return ok(fromPaise(paise));
}
