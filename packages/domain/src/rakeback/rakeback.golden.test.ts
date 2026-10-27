import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import rakebackJson from '@rivr/testing/golden/rakeback.json';
import { describe, expect, it } from 'vitest';
import type { Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { rakebackBonus, weekRakeShares, type RakeHand } from './rakeback.ts';

const golden = readGolden(rakebackJson);

/** Reads a fixture amount such as "₹583.33". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** "₹1,000 among 3; ₹500 among 2": hands at one stake, each with the member and the others seated. */
function handsOf(text: string): RakeHand[] {
  return text.split(';').map((part, index) => {
    const [rake = '', seated = '1'] = part.trim().split(' among ');
    const others = Array.from({ length: Number(seated) - 1 }, (_, other) => `other-${index}-${other}`);
    return { stake: 'nlh_100_200', rake: amount(rake), seated: ['member', ...others] };
  });
}

describe('rakeback golden fixtures (packages/testing/golden/rakeback.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['week_share', 'rakeback'])).not.toThrow();
  });

  it.each(casesFor(golden, 'week_share'))('%s', (_description, goldenCase) => {
    const share = weekRakeShares(handsOf(goldenInput(goldenCase, 'hands'))).get('member')?.get('nlh_100_200');
    expect(share).toBe(amount(goldenExpected(goldenCase, 'share')));
  });

  it.each(casesFor(golden, 'rakeback'))('%s', (_description, goldenCase) => {
    const cap = goldenInput(goldenCase, 'cap');
    const bonus = rakebackBonus(amount(goldenInput(goldenCase, 'share')), Number(goldenInput(goldenCase, 'rate')),
      cap === '' ? undefined : Number(amount(cap)));
    expect(bonus).toBe(amount(goldenExpected(goldenCase, 'bonus')));
  });
});
