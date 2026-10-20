# 0066: A cage shift opens with the float and a chip count; chips in play is the ledger's

Date: 2026-10-20 · Task: #24

The cage has one shift open at a time. A cashier opens it with the float counted into the drawer (whole
rupees) and the chips in the cage counted by the venue's denominations: every active chip once, as a
whole number, 0 allowed. During the shift the cashier may count again; the Treasury shows the latest
count. #45 closes the shift and sets the close against the counts.

Chips in play is not counted: it is the ledger's `venue.chips_outstanding`, every chip issued (buy-ins,
markers, bonus, payouts in chips) less every chip returned (cash-outs, rake and drops). The float is
recorded, not posted: the cash drawer's ledger account shows only what moved through it, so #45 sets
the closing cash against the float plus that movement.

The Treasury screen also shows the prototype's other rows that already exist in the ledger (member
wallets, withdrawals pending, bonus, markers, jackpots), read-only, since the float and chips in play
sit in that list; tournament pools wait for tournaments.

A count moves no money, so a freeze does not stop it. Opening and counting need `cage.transact`;
reading needs `ledger.read`. The float uses the cage's `Input` with a ₹ prefix, so no `MoneyInput`.
