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
    sacCode: '999293',
    placeOfSupply: 'Haryana',
    signatory: { name: 'Rhea Kapoor', designation: 'Partner' },
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

/** A night's offline pack (#167): a table, the waitlist, two balances, two contacts and two SOPs, one long. */
export const OFFLINE_PACK = {
  issuer: ISSUER,
  venueName: 'RIVR Gurugram',
  // 17:00 IST on Sunday 15 November 2026.
  generatedAt: '2026-11-15T11:30:00Z',
  contacts: [
    { kind: 'escalation', name: 'Vikram Sethi', role: 'Owner', phone: '+91 98100 00001', note: null },
    { kind: 'glaza', name: 'Glaza front desk', role: null, phone: '+91 124 400 0000', note: 'Ask for the duty manager' },
  ],
  balances: [
    { name: 'Mihir Shah', memberNumber: '1042', walletPaise: 2_500_000n, markersPaise: 0n },
    { name: 'Yash Gupta', memberNumber: '1043', walletPaise: 0n, markersPaise: 5_000_000n },
  ],
  walletsPaise: 2_500_000n,
  markersPaise: 5_000_000n,
  chipsInPlayPaise: 48_600_000n,
  cageFloatPaise: 20_000_000n,
  tables: [{ name: 'Table 3', game: 'NLH 100/200', seats: [{ seat: 2, name: 'Mihir Shah', memberNumber: '1042' }] }],
  waitlist: [{ game: 'NLH 100/200', place: 1, name: 'Ritika Das', memberNumber: '1051' }],
  sops: [
    { title: 'Cash-out during an outage', version: 2, inForceFrom: '2026-11-01', body: 'Count the chips with the player.\nWrite the amount on the paper slip and have both sign it.' },
    { title: 'Closing the night on paper', version: 1, inForceFrom: '2026-10-20', body: Array.from({ length: 60 }, (_, step) => `Step ${String(step + 1)}: count, record and sign.`).join('\n') },
  ],
} as const;
