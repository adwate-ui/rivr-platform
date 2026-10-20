/** Sample props for the paper templates' tests: placeholders, as venue configuration will hold the real ones. */
export const ISSUER = {
  legalName: 'RIVR Hospitality LLP',
  address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018',
  gstin: '06AAAAA0000A1Z5',
};

export const CASH_OUT = {
  issuer: ISSUER,
  isPractice: false,
  title: 'Cash-out',
  // 03:40 IST on Saturday 13 February 2027.
  at: '2027-02-12T22:10:00Z',
  lines: [
    { label: 'Table', value: 'Table 2, seat 4' },
    { label: 'Stake', value: '100/200' },
    { label: 'Buy-in', value: 2_000_000n },
    { label: 'Cash-out', value: 4_650_000n },
  ],
  total: { label: 'Paid to cash', paise: 4_650_000n },
  reference: 'RV-0213-0418',
};

export const INVOICE = {
  issuer: ISSUER,
  isTaxInvoice: true,
  number: 'RIVR/S26/41',
  issuedAt: '2026-11-15T13:30:00Z',
  buyer: { name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' },
  lines: [{ description: 'Poker Academy, beginners course, 22 Nov 2026', amountPaise: 169_492n }],
  totals: [
    { label: 'Taxable value', paise: 169_492n },
    { label: 'CGST at 9%', paise: 15_254n },
    { label: 'SGST at 9%', paise: 15_254n },
    { label: 'Total', paise: 200_000n },
  ],
};

export const STATEMENT = {
  issuer: ISSUER,
  holder: 'Meera Kapoor',
  from: '2026-11-01',
  to: '2026-11-30',
  openingPaise: 50_000_000n,
  movements: [
    { at: '2026-11-15T12:00:00Z', description: 'Capital contribution', amountPaise: 10_000_000n, balancePaise: 60_000_000n },
    { at: '2026-11-30T12:00:00Z', description: 'Distribution', amountPaise: -2_500_000n, balancePaise: 57_500_000n },
  ],
  closingPaise: 57_500_000n,
};
