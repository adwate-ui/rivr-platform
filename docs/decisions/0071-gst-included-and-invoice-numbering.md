# 0071: GST is taken out of what is collected, and invoices are numbered per series and year

Date: 2026-10-20 · Task: #23 · Question: #378

`gst.config` holds the rate and basis (the rake or a table fee) of the club's own supply, effective-dated.
Every venue starts on 18% of the rake, a placeholder until the owner's ruling. GST is taken out of what is
collected, never added on, so no pot or fee changes. Each half (CGST, SGST) is rounded to the nearest
paisa, and the taxable value is the rest, so an invoice always adds up to what was paid. Only CGST and
SGST are built: a buyer registered in another state, who is charged IGST, is refused until #380 builds it.

Invoices are numbered as `RIVR/S26/41`: the venue's prefix, the series, the financial year it began in,
and the next number in that year. GST rule 46 allows sixteen characters, so a prefix is now at most six.
Issues in a series wait for one another, so numbers follow the time of issue, and a failed issue rolls its
number back with it, so there are no gaps. Invoices are never changed. A repeat issue for the same source
returns the same invoice, and one with other details is refused.

`private.issue_invoice` is the one way to issue. It takes the rate from its caller, since the Academy (#249)
may be taxed differently from the rake. The owner confirmed these readings on #378. The rake will be
invoiced once per business day on a consolidated invoice (#379), and other-state buyers will get IGST
(#380). A venue without a GSTIN cannot issue a tax invoice, so the local and staging seed gives the club
a made-up one. The practice venue's invoices are marked as not tax invoices, and the outbox never offers
their events.

Amended by decision 0102 (#380): a buyer registered in another state is charged IGST, not refused.
