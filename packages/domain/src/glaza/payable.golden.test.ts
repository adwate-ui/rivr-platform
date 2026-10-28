import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import glazaJson from '@rivr/testing/golden/glaza.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { glazaPayable } from './payable.ts';
import { glazaStatement, type GlazaKind, type GlazaStatementLine } from './statement.ts';

const golden = readGolden(glazaJson);

/** Reads a fixture amount such as "₹499.99" or "-₹400". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isBelowNothing = text.startsWith('-');
  const parsed = parseRupees(isBelowNothing ? text.slice(1) : text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isBelowNothing ? fromPaise(-parsed.value) : parsed.value;
}

const LINE = /^(\d+) × (food|soft_drink|alcohol) (₹[\d,.]+) cost (₹[\d,.]+) price( comp)?$/;
const kindOf = (text: string): GlazaKind => (text === 'soft_drink' || text === 'alcohol' ? text : 'food');

/** "2 × soft_drink ₹20 cost ₹60 price comp; 3 × alcohol ₹150 cost ₹400 price": a month's lines. The fixture is wrong if one does not read. */
function linesOf(text: string): GlazaStatementLine[] {
  return text.split(';').filter((part) => part.trim() !== '').map((part) => {
    const match = LINE.exec(part.trim());
    if (match === null) throw new Error(`Golden line "${part}" does not read`);
    const [, quantity = '', kind = '', unitCost = '', unitPrice = '', comp] = match;
    return { kind: kindOf(kind), quantity: BigInt(quantity), unitCost: amount(unitCost), unitPrice: amount(unitPrice), isComp: comp !== undefined };
  });
}

const FIGURES = ['foodComps', 'softDrinkComps', 'alcoholComps', 'comps', 'alcoholSales', 'alcoholCost', 'alcoholMargin', 'rivrShare', 'payable'] as const;

describe('Glaza statement golden fixtures (packages/testing/golden/glaza.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['payable', 'statement'])).not.toThrow();
  });

  it.each(casesFor(golden, 'statement'))('%s', (_description, goldenCase) => {
    const result = glazaStatement(linesOf(goldenInput(goldenCase, 'lines')));
    expect(result).toEqual(Object.fromEntries(FIGURES.map((figure) => [figure, amount(goldenExpected(goldenCase, figure))])));
  });

  it.each(casesFor(golden, 'payable'))('%s', (_description, goldenCase) => {
    const result = glazaPayable(amount(goldenInput(goldenCase, 'comps')), amount(goldenInput(goldenCase, 'alcoholMargin')));
    expect(result).toEqual({ rivrShare: amount(goldenExpected(goldenCase, 'rivrShare')), payable: amount(goldenExpected(goldenCase, 'payable')) });
  });
});

describe('glazaPayable and glazaStatement', () => {
  it('refuses comps below nothing, a quantity below 1 and an amount below nothing', () => {
    expect(() => glazaPayable(fromPaise(-1n), fromPaise(0n))).toThrow(new RangeError('Comps at cost are never negative'));
    const line: GlazaStatementLine = { kind: 'food', quantity: 1n, unitCost: fromPaise(100n), unitPrice: fromPaise(200n), isComp: true };
    for (const bad of [{ ...line, quantity: 0n }, { ...line, unitCost: fromPaise(-1n) }, { ...line, unitPrice: fromPaise(-1n) }]) {
      expect(() => glazaStatement([bad])).toThrow(new RangeError('Quantities are at least 1 and amounts never negative'));
    }
  });
});
