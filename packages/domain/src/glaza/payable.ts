import { fromPaise, type Paise } from '../money/index.ts';

/** What a month of Glaza's lines comes to (#109): RIVR's half of the alcohol margin, and NewCo's payable to Glaza. */
export interface GlazaPayable {
  readonly rivrShare: Paise;
  /** Below nothing when Glaza owes RIVR. */
  readonly payable: Paise;
}

/**
 * The Glaza statement (#109; scope-v1 module 13; question #580; decision 0265): what RIVR comped (food, soft drinks
 * and alcohol) is owed to Glaza at cost, and the margin on alcohol sold (price less cost) is split 50:50, RIVR's half
 * rounded toward nothing to the paisa, so Glaza keeps an odd paisa. NewCo pays Glaza the comps less RIVR's half. The
 * database's private.glaza_payable is proved equal on packages/testing/golden/glaza.json.
 */
export function glazaPayable(comps: Paise, alcoholMargin: Paise): GlazaPayable {
  if (comps < 0n) throw new RangeError('Comps at cost are never negative');
  // Division of a bigint rounds toward nothing.
  const rivrShare = alcoholMargin / 2n;
  return { rivrShare: fromPaise(rivrShare), payable: fromPaise(comps - rivrShare) };
}
