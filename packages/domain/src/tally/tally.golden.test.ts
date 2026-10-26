import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import tallyJson from '@rivr/testing/golden/tally.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, negate, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { tallyVouchers, type TallyLine, type TallyPosting, type TallyVoucher } from './tally.ts';

const golden = readGolden(tallyJson);

/** Reads a fixture amount such as "₹30,000" or "₹-30,000". The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  const isDebit = !text.startsWith('₹-');
  const parsed = parseRupees(isDebit ? text : `₹${text.slice(2)}`);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return isDebit ? parsed.value : negate(parsed.value);
}

/** Reads "ledger amount": the amount is the last word, the ledger the rest. */
function line(text: string): TallyLine {
  const at = text.lastIndexOf(' ');
  return { ledger: text.slice(0, at), amount: amount(text.slice(at + 1)) };
}

/** Reads "kind code ledger amount" lines; a ledger of "-" is none. */
function postings(text: string): TallyPosting[] {
  return text.split('\n').filter((row) => row !== '').map((row) => {
    const [kind = '', accountCode = '', ...rest] = row.split(' ');
    const { ledger, amount: posted } = line(rest.join(' '));
    return { kind, accountCode, tallyLedger: ledger === '-' ? null : ledger, amount: posted };
  });
}

/** Reads "number kind: ledger amount, ..." vouchers, split by " | ". */
function vouchers(text: string): TallyVoucher[] {
  return text.split(' | ').map((voucher) => {
    const [head = '', body = ''] = voucher.split(': ');
    const [number = '', kind = ''] = head.split(' ');
    return { number, kind, lines: body.split(', ').map(line) };
  });
}

describe('Tally golden fixtures (packages/testing/golden/tally.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['vouchers'])).not.toThrow();
  });

  it.each(casesFor(golden, 'vouchers'))('%s', (_description, goldenCase) => {
    const made = tallyVouchers(goldenInput(goldenCase, 'day'), postings(goldenInput(goldenCase, 'postings')));
    const expected = goldenExpected(goldenCase, 'vouchers');
    if (expected.startsWith('unmapped ')) expect(made).toEqual({ ok: false, error: { unmapped: expected.slice('unmapped '.length).split(', ') } });
    else expect(made).toEqual({ ok: true, value: expected === 'none' ? [] : vouchers(expected) });
  });

  it('reads a fixture amount with its sign', () => {
    expect(amount('₹-1,500')).toBe(fromPaise(-150_000n));
  });
});
