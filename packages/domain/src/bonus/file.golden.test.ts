import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import bonusFileJson from '@rivr/testing/golden/bonusFile.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { bonusFileRun, bonusFileTotals, type BonusFileLine, type BonusHolding } from './file.ts';

const golden = readGolden(bonusFileJson);

/** Reads a fixture amount such as "₹1,00,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** Reads fixture holdings such as "Ritika ₹1,000 owing ₹0 | Neel ₹0 owing ₹500"; empty is none. */
function holdings(text: string): Map<string, BonusHolding> {
  return new Map(text === '' ? [] : text.split(' | ').map((one) => {
    const [member = '', inForce = '', , owed = ''] = one.split(' ');
    return [member, { inForce: amount(inForce), owed: amount(owed) }];
  }));
}

/** Reads fixture lines such as "Ritika add ₹500 | Ritika use ₹1,500". */
function lines(text: string): BonusFileLine[] {
  return text.split(' | ').map((one) => {
    const [memberId = '', kind = '', paise = ''] = one.split(' ');
    if (kind !== 'add' && kind !== 'use') throw new Error(`Golden line "${one}" is neither an Add nor a Use`);
    return { memberId, kind, amount: amount(paise) };
  });
}

describe('Bonus file golden fixtures (packages/testing/golden/bonusFile.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['run', 'totals'])).not.toThrow();
  });

  it.each(casesFor(golden, 'run'))('%s', (_description, goldenCase) => {
    const run = bonusFileRun(lines(goldenInput(goldenCase, 'lines')), holdings(goldenInput(goldenCase, 'held')));
    const refusals = goldenExpected(goldenCase, 'refusals').split(' | ').map((refusal) => (refusal === 'none' ? null : refusal));
    expect(run.refusals).toEqual(refusals);
    expect(run.held).toEqual(holdings(goldenExpected(goldenCase, 'after')));
  });

  it.each(casesFor(golden, 'totals'))('%s', (_description, goldenCase) => {
    expect(bonusFileTotals(lines(goldenInput(goldenCase, 'lines'))))
      .toEqual({ added: amount(goldenExpected(goldenCase, 'added')), used: amount(goldenExpected(goldenCase, 'used')) });
  });
});
