/** The console's TDS screen (#93): the withholding ledger and the quarterly return extract. */
export const tds = {
  title: 'TDS',
  notAllowed: 'Your role does not see TDS. Cashiers, duty managers and the owner do.',
  ledger: 'Withholding ledger',
  ledgerLabel: 'TDS by member',
  from: 'From',
  to: 'To, including',
  member: 'Member',
  pan: 'PAN',
  /** The PAN's last four characters: `••522C`. */
  panEnding: '••{last4}',
  noPan: 'No PAN',
  cashOuts: 'Cash-outs',
  paid: 'Paid',
  withheld: 'Withheld',
  shadow: 'Shadow',
  shadowHint: 'Shadow TDS is what would have been withheld while TDS was switched off. It was not deducted and is never in a return.',
  empty: 'No TDS in this period.',
  extract: 'Quarterly return extract',
  extractHint: 'Every deduction in the quarter with each member’s PAN, for the TDS return. Each extract taken is recorded in the audit log.',
  quarter: 'Quarter',
  take: 'Take the extract',
  /** After an extract: `3 deductions in Oct–Dec 2026.` */
  ready: '{count} deductions in {quarter}.',
  download: 'Download {file}',
  failures: {
    not_allowed: 'Only staff who export tables take the return extract.',
    invalid: 'The practice venue files no return.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
  /** The extract's column headings, as the file has them. */
  columns: {
    deductedAt: 'Date of deduction',
    name: 'Deductee name',
    pan: 'PAN',
    section: 'Section',
    taxedWinnings: 'Amount paid or credited: winnings taxed (₹)',
    rate: 'Rate (%)',
    tds: 'TDS (₹)',
  },
};
