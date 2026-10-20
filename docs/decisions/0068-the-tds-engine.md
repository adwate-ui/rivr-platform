# 0068: TDS on a cash-out is the rate of the period's net winnings, shadow while switched off

Date: 2026-10-20 · Task: #22 · Question: #369

`tds.config` (effective-dated, per venue) holds the switch, section, rate, threshold, basis (session,
day or financial year), whether a PAN is required, and the rate without one. So that shadow TDS runs
from day one, every venue, and every new one, starts switched off under 194B at 30% of a financial
year's net winnings above ₹10,000; the owner changes them with a later setting. Every cash-out records
a `tds_withholding` row with the parameters it used.

Winnings are the period's chips cashed out, this cash-out included, less chips bought with cash, UPI or
the wallet, and markers; a bonus buy-in is not the member's money in. A session is the member's visit, a
day the venue's calendar day, a financial year from 1 April, on the venue's clock; a visit that began
before the period counts whole. Nothing is due until winnings exceed the threshold; then the rate
applies to all of them, rounded down to the rupee (`@rivr/domain` `tdsOnCashOut`, twin
`private.tds_amount`, golden `tds.json`).

A cash-out bears what the period owes less what is already recorded in it, withheld or shadow, never
below nothing (no refund) and never more than it pays after markers. Switched on, that is withheld into
`venue.tds_payable`, the member gets the rest, and the cashier is told what was withheld. Switched off,
it is shadow. `private.tds_for` gives lane B the same rule on a prize alone.
