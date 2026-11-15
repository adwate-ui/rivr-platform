/** Copy on the receipts, invoices and statements @rivr/render draws (#67). Amounts and names come with the document. */
export const documents = {
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
    /** A tax invoice's SAC code and place of supply (#423). */
    sac: 'SAC',
    placeOfSupply: 'Place of supply',
    /** At the foot of an invoice, in place of "Computer-generated." when venue configuration names one (#423). */
    signedBy: 'Authorised signatory: {name}, {designation}',
    /** The same, when venue configuration names no designation. */
    signedByName: 'Authorised signatory: {name}',
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
  /** At the foot of every A4 document. */
  computerGenerated: 'Computer-generated.',
} as const;
