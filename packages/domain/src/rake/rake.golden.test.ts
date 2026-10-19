import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import rakeJson from '@rivr/testing/golden/rake.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { potTake, type RakeRules } from './rake.ts';

const golden = readGolden(rakeJson);

/** Reads a fixture amount such as "₹1,40,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** Reads a fixture rate such as "5%" as basis points (500). */
function basisPoints(text: string): bigint {
  const match = /^(\d+)%$/.exec(text);
  if (!match?.[1]) throw new Error(`Golden rate "${text}" is not a whole percentage`);
  return BigInt(match[1]) * 100n;
}

function rulesOf(goldenCase: GoldenCase): RakeRules {
  const live = goldenInput(goldenCase, 'jackpotLive');
  if (live !== 'yes' && live !== 'no') throw new Error(`Golden jackpotLive "${live}" is neither yes nor no`);
  return {
    rateBasisPoints: basisPoints(goldenInput(goldenCase, 'rate')),
    cap: amount(goldenInput(goldenCase, 'cap')),
    isJackpotLive: live === 'yes',
    drop: amount(goldenInput(goldenCase, 'drop')),
    dropAbove: amount(goldenInput(goldenCase, 'dropAbove')),
  };
}

describe('Rake golden fixtures (packages/testing/golden/rake.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['rake'])).not.toThrow();
  });

  it.each(casesFor(golden, 'rake'))('%s', (_description, goldenCase) => {
    const capApplied = goldenExpected(goldenCase, 'capApplied');
    if (capApplied !== 'yes' && capApplied !== 'no') throw new Error(`Golden capApplied "${capApplied}" is neither yes nor no`);
    expect(potTake(amount(goldenInput(goldenCase, 'pot')), rulesOf(goldenCase))).toEqual({
      rake: amount(goldenExpected(goldenCase, 'rake')),
      drop: amount(goldenExpected(goldenCase, 'drop')),
      pull: amount(goldenExpected(goldenCase, 'pull')),
      isCapApplied: capApplied === 'yes',
    });
  });
});
