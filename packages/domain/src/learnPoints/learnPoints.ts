/** A venue's Learn points (#135): a completed session's, each principle mastered for the first time, and the day's cap. */
export interface LearnPointRates {
  readonly perSession: bigint;
  readonly perPrinciple: bigint;
  readonly dailyCap: bigint;
}

/**
 * The points a completed drill session earns (#135; scope-v1 module 9): the session's, and each principle newly mastered
 * in it, but no more than the day's cap less what Learn already gave the member that IST day, and never below nothing.
 * A negative count, total or rate is a bug and throws. The database's private.learn_points is proved equal on
 * packages/testing/golden/learnPoints.json.
 */
export function learnPoints(mastered: bigint, earnedToday: bigint, rates: LearnPointRates): bigint {
  if (mastered < 0n || earnedToday < 0n) throw new RangeError('Counts and points earned are never negative');
  if (rates.perSession < 0n || rates.perPrinciple < 0n || rates.dailyCap < 0n) throw new RangeError('Rates are never negative');
  const earned = rates.perSession + mastered * rates.perPrinciple;
  const left = rates.dailyCap - earnedToday;
  if (left <= 0n) return 0n;
  return earned < left ? earned : left;
}
