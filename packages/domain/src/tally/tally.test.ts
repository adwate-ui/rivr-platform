import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { tallyImportXml, tallyVouchers, type TallyPosting } from './tally.ts';

describe('tallyImportXml', () => {
  it('writes each voucher as a journal for the club day, debits deemed positive with negative amounts', () => {
    const xml = tallyImportXml('2026-11-15', [{
      number: 'RIVR-20261115-1', kind: 'buy_in',
      lines: [{ ledger: 'Cash & UPI', amount: fromPaise(3_000_050n) }, { ledger: 'Player deposits', amount: fromPaise(-3_000_050n) }],
    }]);
    expect(xml).toBe([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ENVELOPE>',
      '<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
      '<BODY><IMPORTDATA>',
      '<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>',
      '<REQUESTDATA>',
      '<TALLYMESSAGE xmlns:UDF="TallyUDF">',
      '<VOUCHER VCHTYPE="Journal" ACTION="Create">',
      '<DATE>20261115</DATE>',
      '<VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>',
      '<VOUCHERNUMBER>RIVR-20261115-1</VOUCHERNUMBER>',
      '<NARRATION>RIVR buy_in, club day 2026-11-15</NARRATION>',
      '<ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash &amp; UPI</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-30000.50</AMOUNT></ALLLEDGERENTRIES.LIST>',
      '<ALLLEDGERENTRIES.LIST><LEDGERNAME>Player deposits</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>30000.50</AMOUNT></ALLLEDGERENTRIES.LIST>',
      '</VOUCHER>',
      '</TALLYMESSAGE>',
      '</REQUESTDATA>',
      '</IMPORTDATA></BODY>',
      '</ENVELOPE>',
      '',
    ].join('\r\n'));
  });

  it('escapes every character XML reserves in a ledger name', () => {
    const xml = tallyImportXml('2026-11-15', [{
      number: 'RIVR-20261115-1', kind: 'expense',
      lines: [{ ledger: `<"Tea" & 'Snacks'>`, amount: fromPaise(5n) }, { ledger: 'Cash', amount: fromPaise(-5n) }],
    }]);
    expect(xml).toContain('<LEDGERNAME>&lt;&quot;Tea&quot; &amp; &apos;Snacks&apos;&gt;</LEDGERNAME>');
    expect(xml).toContain('<AMOUNT>-0.05</AMOUNT>');
    expect(xml).toContain('<AMOUNT>0.05</AMOUNT>');
  });

  it('writes an empty request for a day with no vouchers', () => {
    expect(tallyImportXml('2026-11-15', [])).not.toContain('<VOUCHER');
  });
});

describe('tallyVouchers properties', () => {
  /** Balanced postings: each kind's amounts sum to nothing, as each transaction's entries do. */
  const ledgers = ['Cash', 'Bank', 'Player deposits', 'Rake income'];
  const kindPostings = fc.tuple(fc.constantFrom('buy_in', 'cash_out', 'hand_rake'),
    fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.bigInt({ min: -1_000_000n, max: 1_000_000n })), { minLength: 1, maxLength: 6 }))
    .map(([kind, rows]): TallyPosting[] => {
      const total = rows.reduce((sum, [, amount]) => sum + amount, 0n);
      const balanced = [...rows, [0, -total] as const];
      return balanced.map(([ledger, amount], index) => ({ kind, accountCode: `venue.code_${String.fromCharCode(97 + index)}`, tallyLedger: ledgers[ledger] ?? 'Cash', amount: fromPaise(amount) }));
    });

  it('keeps every voucher balanced, with no line of nothing and no ledger twice', () => {
    fc.assert(fc.property(fc.array(kindPostings, { maxLength: 3 }), (groups) => {
      const made = tallyVouchers('2026-11-15', groups.flat());
      expect(made.ok).toBe(true);
      for (const voucher of made.ok ? made.value : []) {
        expect(voucher.lines.reduce((sum, line) => sum + line.amount, 0n)).toBe(0n);
        expect(voucher.lines.every((line) => line.amount !== 0n)).toBe(true);
        expect(new Set(voucher.lines.map((line) => line.ledger)).size).toBe(voucher.lines.length);
      }
    }));
  });
});
