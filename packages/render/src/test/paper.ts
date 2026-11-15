/** Sample props for the paper templates' tests: placeholders, as venue configuration will hold the real ones. */
export const ISSUER = {
  legalName: 'RIVR Hospitality LLP',
  address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018',
  gstin: '06AAAAA0000A1Z5',
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
