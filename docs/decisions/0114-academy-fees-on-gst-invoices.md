# 0114: Academy fees are invoiced on confirmation, and the member saves the invoice from the app

Date: 2026-10-20 · Task: #249 (the owner's answers to #217 and #412)

**The invoice.** When the cage confirms an Academy booking's payment, `issue_invoice` gives it an invoice:
- in the Academy's own series (`A`, made on first use; #378, reading 5);
- at the Academy's GST rate in force (`academy.gst`), kept apart from the rake's (`gst.config`) as decision 0071 foresaw. It is a placeholder of 18% for every venue until the owner answers question #431. Without that rate or the venue's GSTIN, the cage cannot confirm, and is told why (`RVGST`);
- to the member who booked, or to the company under the GSTIN staff gave when booking it;
- with IGST alone when that GSTIN is another state's (#380).

**The ledger** splits the inclusive fee exactly as the invoice does: the bank takes the fee, the Academy's revenue is the taxable value, and the tax is owed in `venue.gst_payable` (made on first use). The amounts come from the SQL twin of `@rivr/domain`'s `gstIncluded`, proved on the golden cases for ₹2,000 and for a company's ₹4,500 and, in IGST, ₹3,000. Confirming again issues nothing more.

**The member's copy.** `@rivr/ui`'s `InvoiceDocument` now draws a stored invoice for `@rivr/render`'s PDF and for the player app alike. The member, or the company's contact, opens it from a paid booking (a company's booking shows to its contact once paid) on a page with no app frame (signed out, it sends them to sign in; Back returns to the Academy), and Save as PDF uses the browser's print, as the owner chose in #412. The invoice isn't behind the Academy feature: a member keeps the invoice for what they paid.

**The practice venue.** A practice booking gets a practice invoice, whose `invoice.issued` never leaves.
