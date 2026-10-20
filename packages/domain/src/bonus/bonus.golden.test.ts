import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import bonusJson from '@rivr/testing/golden/bonus.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { bonusExpired, bonusSpend, type BonusGrant } from './bonus.ts';

const golden = readGolden(bonusJson);

/** Reads a fixture amount such as "₹4,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** Reads a fixture list such as "₹3,000 | ₹2,000"; empty is none. */
function amounts(text: string): Paise[] {
  return text === '' ? [] : text.split(' | ').map(amount);
}

/** Reads fixture grants such as "₹4,000 @ 2026-11-23T06:00:00+05:30 | …"; empty is none. */
function grants(text: string): BonusGrant[] {
  return text === '' ? [] : text.split(' | ').map((grant) => {
    const [remaining = '', end = ''] = grant.split(' @ ');
    return { remaining: amount(remaining), expiresAt: new Date(end) };
  });
}

describe('Bonus golden fixtures (packages/testing/golden/bonus.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['spend', 'expire'])).not.toThrow();
  });

  it.each(casesFor(golden, 'spend'))('%s', (_description, goldenCase) => {
    const result = bonusSpend(amount(goldenInput(goldenCase, 'amount')), grants(goldenInput(goldenCase, 'grants')), new Date(goldenInput(goldenCase, 'at')));
    const expected = goldenExpected(goldenCase, 'taken');
    expect(result).toEqual(expected === 'not_chips' || expected === 'bonus_short' ? { ok: false, error: expected } : { ok: true, value: amounts(expected) });
  });

  it.each(casesFor(golden, 'expire'))('%s', (_description, goldenCase) => {
    expect(bonusExpired(grants(goldenInput(goldenCase, 'grants')), new Date(goldenInput(goldenCase, 'at'))))
      .toEqual(amounts(goldenExpected(goldenCase, 'expired')));
  });
});
