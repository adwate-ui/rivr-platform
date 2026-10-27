/** The whole tip pool, in basis points. */
export const WHOLE_POOL = 10_000;

/**
 * Each dealer's share of the tip pool by the time they dealt (#124; decision 0252; tips belong to dealers): their
 * seconds at the tables over everyone's, in basis points adding up to the whole pool. Each share is rounded down and
 * the points left go one each to the largest remainders, the earlier dealer first on a tie, so more time never earns
 * less. With no time dealt, every share is nothing. Time below nothing or not whole seconds is a bug and throws.
 */
export function hourShares(seconds: readonly number[]): number[] {
  if (!seconds.every((each) => Number.isInteger(each) && each >= 0)) throw new RangeError('Whole seconds, nothing or more');
  const total = seconds.reduce((sum, each) => sum + each, 0);
  if (total === 0) return seconds.map(() => 0);
  const exact = seconds.map((each) => (BigInt(each) * BigInt(WHOLE_POOL)));
  const shares = exact.map((each) => Number(each / BigInt(total)));
  const left = WHOLE_POOL - shares.reduce((sum, share) => sum + share, 0);
  const byRemainder = exact.map((each, index) => ({ index, remainder: each % BigInt(total) }))
    .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));
  byRemainder.slice(0, left).forEach(({ index }) => { shares[index] = (shares[index] ?? 0) + 1; });
  return shares;
}
