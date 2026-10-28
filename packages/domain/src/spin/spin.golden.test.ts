import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import spinJson from '@rivr/testing/golden/spin.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { spinPrize, type SpinPrize } from './spin.ts';

const golden = readGolden(spinJson);

/** Reads a fixture amount such as "₹499.99". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** "100 points ×3; ₹500 bonus ×1; nothing ×1": the wheel's prizes in order, each with its weight. */
function wheelOf(text: string): SpinPrize[] {
  return text.split(';').filter((part) => part.trim() !== '').map((part) => {
    const [prize = '', weight = ''] = part.trim().split(' ×');
    const [value = '', kind = ''] = prize.split(' ');
    if (prize === 'nothing') return { kind: 'nothing', amount: 0n, weight: BigInt(weight) };
    return kind === 'points' ? { kind: 'points', amount: BigInt(value), weight: BigInt(weight) }
      : { kind: 'bonus', amount: amount(value), weight: BigInt(weight) };
  });
}

describe('spin wheel golden fixtures (packages/testing/golden/spin.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['draw'])).not.toThrow();
  });

  it.each(casesFor(golden, 'draw'))('%s', (_description, goldenCase) => {
    const place = spinPrize(wheelOf(goldenInput(goldenCase, 'prizes')), amount(goldenInput(goldenCase, 'budgetLeft')), BigInt(goldenInput(goldenCase, 'roll')));
    expect(place === null ? 'none' : String(place + 1)).toBe(goldenExpected(goldenCase, 'prize'));
  });
});

describe('spinPrize', () => {
  const wheel: SpinPrize[] = [{ kind: 'points', amount: 100n, weight: 2n }];
  it('refuses a roll off the odds, a weight below 1 and an amount below nothing', () => {
    expect(() => spinPrize(wheel, fromPaise(0n), 2n)).toThrow(new RangeError('A roll is from 0 to the odds less one'));
    expect(() => spinPrize(wheel, fromPaise(0n), -1n)).toThrow(new RangeError('A roll is from 0 to the odds less one'));
    expect(() => spinPrize([{ kind: 'nothing', amount: 0n, weight: 0n }], fromPaise(0n), 0n))
      .toThrow(new RangeError('Weights are at least 1 and amounts never negative'));
    expect(() => spinPrize([{ kind: 'points', amount: -1n, weight: 1n }], fromPaise(0n), 0n))
      .toThrow(new RangeError('Weights are at least 1 and amounts never negative'));
  });
});
