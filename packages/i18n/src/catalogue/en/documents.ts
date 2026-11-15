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
  /** A kitchen order ticket (#123), printed at Glaza's bar by the cage agent. Plain ASCII: the bar printer's own font. */
  kot: {
    title: 'KOT {number}',
    seat: '{table}, seat {seat}',
    paid: 'PAID BY THE MEMBER',
    comp: 'COMP - RIVR',
    line: '{quantity} x {name}',
    wholeOrder: 'Whole order: {note}',
  },
  /** The offline pack (#167), printed at the cage when the system is down. */
  offlinePack: {
    title: 'Offline pack',
    venue: 'Venue',
    made: 'Made',
    intro: 'Use this pack while the system is down. Work from the paper forms, and enter everything once the system is back.',
    note: 'Made automatically each night. Shred the previous night’s copy.',
    contacts: 'Who to call',
    noContacts: 'No contacts are set.',
    who: 'Who',
    kind: 'For',
    phone: 'Phone',
    contactKind: {
      escalation: 'Escalation',
      vendor: 'Vendor',
      glaza: 'Glaza',
      police: 'Police',
      fire: 'Fire',
      electricity: 'Electricity',
    },
    member: 'Member',
    floor: 'The floor',
    /** `{game}` as `NLH 100/200`. */
    table: '{table} · {game}',
    seatsAt: 'Who sits at {table}',
    nobodySeated: 'Nobody seated.',
    noTables: 'No table was open.',
    seat: 'Seat',
    waitlist: 'Waitlist',
    nobodyWaiting: 'Nobody waiting.',
    /** The waitlist's first column: the table whose list the place is on (decision 0467). */
    waitingAt: 'Table',
    game: 'Game',
    place: 'Place',
  },
  /** At the foot of every A4 document. */
  computerGenerated: 'Computer-generated.',
} as const;
