# 0067: A cage shift closes against the ledger; any variance waits for a manager's reason

Date: 2026-10-20 · Task: #45 · Question: #367

A cashier closes the open shift (#24) by counting the cash in the drawer and the chips in the cage, with
the drop boxes brought in, and entering the UPI and bank receipts the statement shows and the signed
markers held. Cash, chips and receipts are counted blind: nothing the ledger expects is shown until the
close. Markers are checked against the register the Markers screen shows.

What the ledger expects: the float plus every cash-drawer entry since the shift opened; the opening chip
count plus every chips-in-play entry since; every positive bank entry since; and every marker still
owed. "Since" is every ledger entry after the last one when the shift opened. Every posting holds the
venue's ledger lock shared, and opening or closing a shift takes it alone, so nothing in flight is missed.

`@rivr/domain` `shiftClose` (twin `private.shift_close`, golden `eod.json`) sets each against what was
counted, with no threshold. The shift closes either way. A clean close emits `eod.closed`. An anomaly
raises the `eod.variance` alert, and emits `eod.closed` once a manager (`eod.review`: admins and super
admins) who neither opened nor closed the shift gives the reason. These readings are the safest; #367
asks the owner to confirm them. As with counting (0066), a freeze does not stop a close or a review:
neither moves money. End of day sits in `features/treasury`, beside the shift and the chip count it reuses.
