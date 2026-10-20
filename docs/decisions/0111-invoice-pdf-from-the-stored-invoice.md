# 0111: The invoice PDF is drawn from the stored invoice alone

Date: 2026-10-20 · Task: #68 (tech plan item 20)

`@rivr/render`'s `renderInvoicePdf(invoice)` draws a stored invoice with the `document.invoice` template (`DocumentPage` and `DocumentTable` from `@rivr/ui`) as a one-page A4 PDF.

`storedInvoiceFromRow` reads the invoice row (#23, #379, #380), and `InvoiceDocument` (in `@rivr/ui` since #249) draws it and nothing else:
- the supplier's legal name, GSTIN and address as they stood when the invoice was issued;
- the number in the venue's series, which carries the venue's prefix;
- the buyer, and their GSTIN for a company;
- the taxable value, CGST and SGST at half the rate each, or IGST alone for another state, and the total.

Every amount is the stored paise, so a reprint years later matches the invoice that was filed, whatever venue configuration says since. A practice-venue invoice prints as a practice invoice, never a tax invoice.

`src/invoice.test.ts` checks the mapping and compares the page with `baselines/document-invoice-stored.png`.

**Still open, in question #412:** where the renderer runs in production (it needs headless Chromium, which Edge Functions can't host), and which further GST fields the CA wants (SAC, place of supply, reverse charge, signature). Until then nothing renders invoices in production; #249's download waits on that answer.
