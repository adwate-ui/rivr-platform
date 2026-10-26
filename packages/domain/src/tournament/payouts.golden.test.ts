import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import tournamentPayoutsJson from '@rivr/testing/golden/tournamentPayouts.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { chipChop, icmDeal } from './deals.ts';
import { BOUNTY_KINDS, bountyOnBust, payoutTable, prizePool, type BountyKind } from './payouts.ts';

const golden = readGolden(tournamentPayoutsJson);

/** A golden amount such as "₹1,60,100", in paise. */
const paise = (text: string): Paise => fromPaise(BigInt(text.replace(/[₹,]/g, '')) * 100n);
/** Paise as a golden amount. */
const rupees = (amount: bigint) => `₹${new Intl.NumberFormat('en-IN').format(amount / 100n)}`;
/** A golden list: "₹10,800 ₹7,200". */
const amounts = (text: string) => text.split(' ').filter(Boolean).map(paise);
const listed = (values: readonly bigint[]) => values.map(rupees).join(' ');
/** The answer, or 'refused' when the rule throws. */
function orRefused(work: () => string): string {
  try {
    return work();
  } catch (error) {
    if (error instanceof RangeError) return 'refused';
    throw error;
  }
}

function kind(goldenCase: GoldenCase): BountyKind {
  const found = BOUNTY_KINDS.find((each) => each === goldenInput(goldenCase, 'kind'));
  if (found === undefined) throw new Error('A golden bounty kind is a bounty kind');
  return found;
}

describe('Tournament payouts golden fixtures (packages/testing/golden/tournamentPayouts.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['pool', 'payouts', 'chop', 'icm', 'bounty'])).not.toThrow();
  });

  it.each(casesFor(golden, 'pool'))('%s', (_description, goldenCase) => {
    const guarantee = goldenInput(goldenCase, 'guarantee');
    const found = prizePool(paise(goldenInput(goldenCase, 'collected')), guarantee === '' ? null : paise(guarantee));
    expect({ pool: rupees(found.pool), overlay: rupees(found.overlay) })
      .toEqual({ pool: goldenExpected(goldenCase, 'pool'), overlay: goldenExpected(goldenCase, 'overlay') });
  });

  it.each(casesFor(golden, 'payouts'))('%s', (_description, goldenCase) => {
    // Percent to two places, as basis points: "62.5" is 6,250.
    const shares = goldenInput(goldenCase, 'shares').split(' ').map((percent) => Math.round(Number(percent) * 100));
    const prizes = () => listed(payoutTable(paise(goldenInput(goldenCase, 'pool')), shares, Number(goldenInput(goldenCase, 'runs'))));
    expect(orRefused(prizes)).toBe(goldenExpected(goldenCase, 'prizes'));
  });

  it.each([...casesFor(golden, 'chop'), ...casesFor(golden, 'icm')])('%s', (_description, goldenCase) => {
    const deal = goldenCase.operation === 'icm' ? icmDeal : chipChop;
    const stacks = goldenInput(goldenCase, 'stacks').split(' ').map(BigInt);
    expect(orRefused(() => listed(deal(stacks, amounts(goldenInput(goldenCase, 'prizes')))))).toBe(goldenExpected(goldenCase, 'amounts'));
  });

  it.each(casesFor(golden, 'bounty'))('%s', (_description, goldenCase) => {
    const split = () => bountyOnBust(paise(goldenInput(goldenCase, 'bounty')), kind(goldenCase));
    expect({ paid: orRefused(() => rupees(split().paid)), head: orRefused(() => rupees(split().toHead)) })
      .toEqual({ paid: goldenExpected(goldenCase, 'paid'), head: goldenExpected(goldenCase, 'head') });
  });
});
