import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import waitlistJson from '@rivr/testing/golden/waitlist.json';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { priorityOn, type PriorityInput, type Stake } from './priority.ts';

const golden = readGolden(waitlistJson);

/** Reads a fixture stake such as "100/200" (rupees) as blinds in paise. The fixture is wrong if it does not parse. */
function stake(text: string): Stake {
  const match = /^(\d+)\/(\d+)$/.exec(text);
  if (!match?.[1] || !match[2]) throw new Error(`Golden stake "${text}" is not small/big blinds`);
  return { smallBlind: fromPaise(BigInt(match[1]) * 100n), bigBlind: fromPaise(BigInt(match[2]) * 100n) };
}

function inputOf(goldenCase: GoldenCase): PriorityInput {
  const weight = goldenInput(goldenCase, 'weight');
  const qualifying = goldenInput(goldenCase, 'qualifyingStake');
  return {
    tier: weight === '' ? null : {
      reason: goldenInput(goldenCase, 'tier'),
      weight: Number(weight),
      onlyAtQualifyingStake: goldenInput(goldenCase, 'onlyAtQualifyingStake') === 'yes',
    },
    qualifyingStake: qualifying === '' ? null : stake(qualifying),
  };
}

describe('Waitlist priority golden fixtures (packages/testing/golden/waitlist.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['priority'])).not.toThrow();
  });

  it.each(casesFor(golden, 'priority'))('%s', (_description, goldenCase) => {
    const reason = goldenExpected(goldenCase, 'reason');
    expect(priorityOn(stake(goldenInput(goldenCase, 'list')), inputOf(goldenCase))).toEqual({
      weight: Number(goldenExpected(goldenCase, 'weight')),
      reason: reason === '' ? null : reason,
    });
  });
});
