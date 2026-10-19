import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import jackpotJson from '@rivr/testing/golden/jackpot.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { badBeatPayout, splitDrop } from './jackpot.ts';

const golden = readGolden(jackpotJson);

/** Reads a fixture amount such as "₹3,42,700". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** Reads a fixture share such as "20%" or "33.33%" as basis points (2000, 3333). */
function basisPoints(text: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?%$/.exec(text);
  if (!match?.[1]) throw new Error(`Golden share "${text}" is not a percentage with at most two decimals`);
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '0').padEnd(2, '0'));
}

function share(goldenCase: GoldenCase, name: string): bigint {
  return basisPoints(goldenInput(goldenCase, name));
}

describe('Jackpot golden fixtures (packages/testing/golden/jackpot.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['split', 'payout'])).not.toThrow();
  });

  it.each(casesFor(golden, 'split'))('%s', (_description, goldenCase) => {
    expect(splitDrop(amount(goldenInput(goldenCase, 'drop')), { season: share(goldenCase, 'seasonShare'), freeroll: share(goldenCase, 'freerollShare') }))
      .toEqual({
        main: amount(goldenExpected(goldenCase, 'main')),
        season: amount(goldenExpected(goldenCase, 'season')),
        freeroll: amount(goldenExpected(goldenCase, 'freeroll')),
      });
  });

  it.each(casesFor(golden, 'payout'))('%s', (_description, goldenCase) => {
    const rule = {
      poolShare: share(goldenCase, 'poolShare'),
      loser: share(goldenCase, 'loserShare'),
      winner: share(goldenCase, 'winnerShare'),
      table: share(goldenCase, 'tableShare'),
    };
    expect(badBeatPayout(amount(goldenInput(goldenCase, 'pool')), rule, Number(goldenInput(goldenCase, 'others')))).toEqual({
      loser: amount(goldenExpected(goldenCase, 'loser')),
      winner: amount(goldenExpected(goldenCase, 'winner')),
      eachAtTable: amount(goldenExpected(goldenCase, 'eachAtTable')),
      total: amount(goldenExpected(goldenCase, 'total')),
    });
  });
});
