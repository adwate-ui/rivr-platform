# 0194: A night's invoice is dated the night; tax invoices carry SAC, place of supply and signatory

Date: 2026-10-26 · Tasks: #422 (owner's answer to #398, point 2), #423 (owner's answer to #412, point 2), #469 (owner's answer to #465)

**Dated the night.** The consolidated rake invoice for a business night is issued at 07:00 IST the morning after (decision 0106), but dated 06:00 IST when the night began, and numbered in that moment's financial year. The night of 31 March goes in March's GST return and the old year's series. The GST rate is still the one in force when the night began (#398, point 1). `issue_invoice` takes the moment as an optional last argument; every other invoice is dated when issued, as before. A night refused and invoiced after its month's GSTR-1 is due (the 11th of the next month) is dated when issued instead, so a filed return never changes (the owner's answer to #471).

**SAC codes.** Venue configuration holds a SAC code for each invoice series: club services (S) and the Academy (A), from the club's CA, set on the Settings screen. A tax invoice is refused without its series' code, as without the venue's GSTIN; a nightly invoice refused this way raises the rake-invoice alert and is issued on a later morning once the code is set.

**Place of supply.** The venue's state from its GSTIN, or the buyer's state from theirs when it differs (IGST, even at a nil rate), by name (`Haryana`). A tax invoice whose state code names no state is refused.

**Signatory.** Venue configuration names the authorised signatory and designation; every tax invoice prints "Authorised signatory: name, designation" at its foot, in place of "Computer-generated." when one is named. It is not required: an invoice issued before one is named still goes out, computer-generated.

**Rollout.** Production's Settings must hold the GSTIN and both SAC codes before the first Academy payment is confirmed or the first nightly invoice is due (docs/runbooks/create-a-venue.md, step 5).

**Tournament fees (#469).** The owner's answer to #465 was "like the nightly rake": a night's invoice covers the entry fees credited to `venue.tournament_fees` that business day, less any reversed (`private.day_tournament_fees`), with its rake, and GST is taken out of the total at the rate in force when the night began. A night with fees and no rake has its invoice; its description names the tournament fees. A night whose rake and fees come to less than nothing raises the existing `invoice.rake_negative` alert. The practice venue's fees go on its practice invoice, never a tax invoice, as its rake does. While `gst.config` charges GST on a table fee instead of the rake, there is no nightly invoice, so none for fees either, as before. No new money rule: the GST split is the existing golden-tested one, applied to the sum.

**Stored as issued.** Each invoice keeps its SAC code, place of supply and signatory as they stood, so a later change of configuration never alters an invoice already issued. A practice invoice carries none of them.
