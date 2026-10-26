/** Copy on the receipts, invoices and statements @rivr/render draws (#67). Amounts and names come with the document. */
export const documents = {
  /** When something happened, in IST: `13 Feb 2027, 03:40`. */
  at: '{date}, {time}',
  receipt: {
    /** At the foot of a receipt: `{number}` is its reference, as in `Receipt RV-0213-0418`. */
    reference: 'Receipt {number}',
    /** Beneath when, on every receipt the practice venue prints. */
    practice: 'Practice receipt. No money changed hands.',
  },
  invoice: {
    taxInvoice: 'Tax invoice',
    /** The practice venue's invoices are never tax invoices (decision 0071). */
    practice: 'Practice invoice, not a tax invoice',
    number: 'Invoice number',
    date: 'Date',
    billedTo: 'Billed to',
    buyerGstin: 'Buyer GSTIN',
    caption: 'What the invoice is for',
    description: 'Description',
    amount: 'Amount',
    /** Beneath the lines of a stored invoice (#68). `{rate}` is as `9%`. */
    taxableValue: 'Taxable value',
    cgst: 'CGST at {rate}',
    sgst: 'SGST at {rate}',
    igst: 'IGST at {rate}',
    total: 'Total',
    /** In the player app, above the invoice (#249): the browser's print saves it as a PDF. */
    save: 'Save as PDF',
    /** Beside Save as PDF: back to where the invoice was opened from. */
    back: 'Back',
  },
  statement: {
    title: 'Statement',
    holder: 'Account holder',
    period: 'Period',
    /** `{from}` and `{to}` are dates, as in `1 Nov 2026 to 30 Nov 2026`. */
    between: '{from} to {to}',
    caption: 'Movements in the period',
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    balance: 'Balance',
    opening: 'Opening balance',
    closing: 'Closing balance',
  },
  /** A partner's or investor's monthly statement (#98): the club's result for the month and their share. */
  partnerStatement: {
    title: { partner: 'Partner statement', investor: 'Investor statement' },
    holder: 'Holder',
    month: 'Month',
    holding: 'Holding',
    /** `{share}` as `12.5%`, `{day}` the month's last day. */
    holdingOn: '{share} on {day}',
    status: 'Status',
    provisional: 'Provisional: the month’s figures are final once stored on the 1st.',
    caption: 'The club’s result for the month',
    item: 'Revenue and expenses',
    amount: 'Amount',
    /** An expense line: `Less: Bonus issued`. */
    less: 'Less: {name}',
    revenue: 'Revenue',
    expenses: 'Expenses',
    net: 'Net result',
    /** `{share}` as `12.5%`. */
    share: 'Share at {share}',
  },
  /** At the foot of every A4 document. */
  computerGenerated: 'Computer-generated.',
} as const;
