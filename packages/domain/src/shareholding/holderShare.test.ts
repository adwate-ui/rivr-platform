import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import holderShareJson from '@rivr/testing/golden/holderShare.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, negate, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { holderShare } from './holderShare.ts';

const golden = readGolden(holderShareJson);

/** Reads a fixture amount such as "₹1,000.01" or "-₹10,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isLoss = text.startsWith('-');
  const parsed = parseRupees(isLoss ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isLoss ? negate(parsed.value) : parsed.value;
}

describe('a holder\'s share of a month\'s net result (packages/testing/golden/holderShare.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['share'])).not.toThrow();
  });

  it.each(casesFor(golden, 'share'))('%s', (_description, goldenCase) => {
    const share = holderShare(amount(goldenInput(goldenCase, 'net')), BigInt(goldenInput(goldenCase, 'basisPoints')));
    expect(share).toBe(amount(goldenExpected(goldenCase, 'share')));
  });

  const net = fc.bigInt({ min: -10_000_000_000n, max: 10_000_000_000n }).map(fromPaise);
  const holding = fc.bigInt({ min: 0n, max: 10_000n });

  it('has the sign of the result, and is never more of it than the holding', () => {
    fc.assert(fc.property(net, holding, (result, basisPoints) => {
      const share = holderShare(result, basisPoints);
      const size = (paise: bigint) => (paise < 0n ? -paise : paise);
      expect(share === 0n || share < 0n === result < 0n).toBe(true);
      expect(size(share) * 10_000n <= size(result) * basisPoints).toBe(true);
      expect(size(result) * basisPoints < (size(share) + 1n) * 10_000n).toBe(true);
    }));
  });

  it('shares a loss as it shares a profit of the same size', () => {
    fc.assert(fc.property(net, holding, (result, basisPoints) => {
      expect(holderShare(negate(result), basisPoints)).toBe(negate(holderShare(result, basisPoints)));
    }));
  });

  it('refuses a holding outside 0% to 100%', () => {
    expect(() => holderShare(fromPaise(100n), 10_001n)).toThrow(RangeError);
    expect(() => holderShare(fromPaise(-100n), -1n)).toThrow(RangeError);
  });
});
