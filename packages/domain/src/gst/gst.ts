import { fromPaise, subtract, type Paise } from '../money/index.ts';

const WHOLE = 10_000n;

/** An amount that includes GST, split for a tax invoice: the taxable value and the two equal halves of the tax. */
export interface GstSplit {
  readonly taxable: Paise;
  /** Central GST: half the tax. */
  readonly cgst: Paise;
  /** State GST: the other half, always equal to `cgst`. */
  readonly sgst: Paise;
}

/** An amount that includes GST, split for a tax invoice to a buyer registered in another state: the taxable value and the integrated tax. */
export interface IgstSplit {
  readonly taxable: Paise;
  /** Integrated GST: the whole tax, at the full rate. */
  readonly igst: Paise;
}

/**
 * GST included in an amount (#23; decision 0071): what the club collected already includes the tax, so the
 * tax is taken out of it, never added on. Each half (CGST, SGST) is the amount times half the rate over
 * one plus the rate, rounded to the nearest paisa (a half paisa up); the taxable value is what is left, so
 * the three always add up to the amount. Rates are in basis points: 1800 is 18%. A negative amount or a
 * rate outside 0 to 10,000 is a bug and throws. The database's private.gst_included is proved equal by
 * the same golden cases (packages/testing/golden/gst.json).
 */
export function gstIncluded(inclusive: Paise, rate: bigint): GstSplit {
  if (inclusive < 0n) throw new RangeError('GST is taken out of an amount of nothing or more');
  if (rate < 0n || rate > WHOLE) throw new RangeError('A GST rate is 0 to 10,000 basis points');
  // half = inclusive × rate / (2 × (10,000 + rate)), rounded: adding half the divisor first rounds a half up.
  const divisor = 2n * (WHOLE + rate);
  const half = fromPaise((inclusive * rate + divisor / 2n) / divisor);
  return { taxable: subtract(subtract(inclusive, half), half), cgst: half, sgst: half };
}

/**
 * IGST included in an amount (#380; decision 0102), for a buyer whose GSTIN is from another state than the
 * venue's: the tax is taken out of the amount at the full rate, as one figure. It is the amount times the
 * rate over one plus the rate, rounded once to the nearest paisa (a half paisa up), so it can differ by a
 * paisa from CGST and SGST added together; the taxable value is what is left. Same inputs and refusals as
 * `gstIncluded`, and the database's private.igst_included is proved equal on the same golden file.
 */
export function igstIncluded(inclusive: Paise, rate: bigint): IgstSplit {
  if (inclusive < 0n) throw new RangeError('IGST is taken out of an amount of nothing or more');
  if (rate < 0n || rate > WHOLE) throw new RangeError('An IGST rate is 0 to 10,000 basis points');
  // igst = inclusive × rate / (10,000 + rate), rounded: doubled, plus the divisor, over twice the divisor.
  const divisor = WHOLE + rate;
  const igst = fromPaise((2n * inclusive * rate + divisor) / (2n * divisor));
  return { taxable: subtract(inclusive, igst), igst };
}
