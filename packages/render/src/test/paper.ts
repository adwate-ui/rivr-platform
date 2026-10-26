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
  invoice: {
    number: 'RIVR/S26/41',
    isTaxInvoice: true,
    issuedAt: '2026-11-15T13:30:00Z',
    supplier: { legalName: ISSUER.legalName, gstin: ISSUER.gstin, address: ISSUER.address },
    buyer: { name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' },
    description: 'Poker Academy, beginners course, 22 Nov 2026',
    rateBasisPoints: 1800,
    taxablePaise: 169_492n,
    cgstPaise: 15_254n,
    sgstPaise: 15_254n,
    igstPaise: 0n,
    totalPaise: 200_000n,
  },
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

/** Kabir Malhotra's statement for November 2026: 12.5% of the club's ₹2,800 net result. */
export const PARTNER_STATEMENT = {
  statement: {
    issuer: ISSUER,
    holder: 'Kabir Malhotra',
    kind: 'partner',
    month: '2026-11-01',
    heldOn: '2026-11-30',
    basisPoints: 1250,
    revenue: [{ name: 'Rake', paise: 300_000n }],
    expenses: [{ name: 'Bonus issued', paise: 20_000n }],
    revenuePaise: 300_000n,
    expensePaise: 20_000n,
    netPaise: 280_000n,
    sharePaise: 35_000n,
    isProvisional: false,
  },
} as const;
