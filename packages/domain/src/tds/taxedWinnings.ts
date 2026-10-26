import { isNegative, subtract, ZERO, type Paise } from '../money/index.ts';

/**
 * The winnings one deduction was taxed on, as the quarterly TDS return reports it (#93; owner's answer
 * on question #455). TDS is worked out on the period's net winnings so far (decision 0068), so this is
 * the period's winnings at this cash-out above the most already taxed earlier in the period, never
 * below nothing: a period's deductions then add up to what it won. `taxedBefore` is that most, or
 * nothing for the period's first deduction. The database's private.tds_taxed_winnings is proved equal on
 * packages/testing/golden/tdsReturn.json.
 */
export function tdsTaxedWinnings(winnings: Paise, taxedBefore: Paise): Paise {
  const more = subtract(winnings, taxedBefore);
  return isNegative(more) ? ZERO : more;
}
