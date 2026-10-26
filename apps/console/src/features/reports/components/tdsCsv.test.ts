import type { TdsDeduction } from '@rivr/db/tds';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { recentQuarters, tdsCsv } from './tdsCsv.ts';

const DEDUCTION: TdsDeduction = {
  deductedAt: '2026-10-26T19:00:00Z', fullName: 'Ishaan Verma', pan: 'ABCPV2522C', section: '194B', taxedWinnings: fromPaise(2_000_000n),
  rateBasisPoints: 3000, tds: fromPaise(600_050n),
};

describe('the TDS return extract file (#93)', () => {
  it('gives a heading row, then each deduction dated in India, in rupees with two decimals', () => {
    expect(tdsCsv([DEDUCTION]).split('\r\n')).toEqual([
      '"Date of deduction","Deductee name","PAN","Section","Amount paid or credited: winnings taxed (₹)","Rate (%)","TDS (₹)"',
      '"2026-10-27","Ishaan Verma","ABCPV2522C","194B","20000.00","30.00","6000.50"',
      '',
    ]);
  });

  it('quotes every cell, quotes doubled, and keeps a name a spreadsheet would run as text', () => {
    const lines = tdsCsv([{ ...DEDUCTION, fullName: 'Verma, "Ishaan"' }, { ...DEDUCTION, fullName: '=HYPERLINK("x")' }, { ...DEDUCTION, fullName: 'Ravi;=1+1' }])
      .split('\r\n');
    expect(lines[3]).toContain(',"Ravi;=1+1",');
    expect(lines[1]).toContain(',"Verma, ""Ishaan""",');
    expect(lines[2]).toContain(',"\'=HYPERLINK(""x"")",');
  });

  it('gives just the headings for a quarter with no deductions', () => {
    expect(tdsCsv([]).split('\r\n')).toHaveLength(2);
  });
});

describe('the quarters to choose from', () => {
  it('lists this quarter and the three before it, across a year', () => {
    expect(recentQuarters('2026-10-26')).toEqual(['2026-10-01', '2026-07-01', '2026-04-01', '2026-01-01']);
    expect(recentQuarters('2027-02-14')).toEqual(['2027-01-01', '2026-10-01', '2026-07-01', '2026-04-01']);
  });
});
