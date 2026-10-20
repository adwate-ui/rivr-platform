# 0106: The rake is invoiced once per business day, by a daily job that catches up

Date: 2026-10-20 · Task: #379 (the owner's answer to #378, point 5) · Question: #398

Every day at 07:00 IST a job issues each venue one invoice in series S per business day: the club's night,
from 06:00 IST to 06:00 IST, as `private.tonight_began` has it, named by the date it began on. Every venue
is in India, so the business day is IST's. The amount is what `venue.rake` was credited by ledger
transactions posted in that window, net of reversals; a hand an offline tablet sends late counts in the
night it arrives in. The buyer is "Unregistered customers, consolidated", with no member and no GSTIN.

GST is taken out at the `gst.config` rate in force when the night began (#398 asks whether a change during a
night should split it). No invoice for a night without rake, or while GST is on a table fee. The source is
`rake:` and the day, so each run covers the last 35 nights and a night already invoiced gives the same
invoice: a night refused (no GSTIN yet) or a run missed is invoiced on a later run. A venue refused raises
`invoice.rake_refused` each run until it is put right; a night whose reversals exceed its rake raises
`invoice.rake_negative`. The practice venue's are practice invoices, and nothing about them leaves.
