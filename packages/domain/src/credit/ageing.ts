import { add, ZERO, type Paise } from '../money/index.ts';

/** The credit report's age buckets (#92; scope-v1 module 5): 0 to 7 days, 8 to 30, 31 to 60, and over 60. */
export const AGEING_BUCKETS = ['0_7', '8_30', '31_60', 'over_60'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

const DAY_MS = 86_400_000;

/**
 * Which bucket a marker's age falls in at a moment: its age is the whole days since it was issued,
 * counted down (a marker issued 7 days and 23 hours ago is 7 days old), as the console's open markers
 * count it. Up to 7 days, then 8 to 30, 31 to 60, and over 60. A marker issued after the moment is 0
 * days old. The database's private.credit_age_bucket is proved equal on
 * packages/testing/golden/creditAgeing.json.
 */
export function ageingBucket(issuedAt: Date, at: Date): AgeingBucket {
  const days = Math.max(0, Math.floor((at.getTime() - issuedAt.getTime()) / DAY_MS));
  if (days <= 7) return '0_7';
  if (days <= 30) return '8_30';
  if (days <= 60) return '31_60';
  return 'over_60';
}

/** A member's open markers by age at a moment: what each bucket still owes, nothing where none is. */
export function creditAgeing(markers: readonly { readonly issuedAt: Date; readonly outstanding: Paise }[], at: Date): Readonly<Record<AgeingBucket, Paise>> {
  const totals: Record<AgeingBucket, Paise> = { '0_7': ZERO, '8_30': ZERO, '31_60': ZERO, over_60: ZERO };
  for (const marker of markers) {
    const bucket = ageingBucket(marker.issuedAt, at);
    totals[bucket] = add(totals[bucket], marker.outstanding);
  }
  return totals;
}
