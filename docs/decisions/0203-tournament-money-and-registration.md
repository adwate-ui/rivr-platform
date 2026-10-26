# 0203: Tournament money, and registering from the app or the cage

Date: 2026-10-26 · Task: #118 · Question: #465 (answered) · Follow-up: #469

Every venue has three tournament accounts: `venue.tournament_pool` (liability, players' money until the prizes are paid), `venue.tournament_fees` (revenue) and `venue.tournament_overlay` (expense, for #117). Every venue gets them from the bootstrap, and the practice venue's seed keeps them.

- **A buy** (entry, re-entry, rebuy, add-on) costs the buy-in or the add-on's price, with the fee inside it. The pool gets the price less the fee (`poolShare`, twin `private.tournament_pool_share`, golden `tournamentMoney.json`), and the fee goes to revenue. One balanced ledger transaction per request id.
- **From the app**, the wallet pays through `private.debit_wallet`. That is lane A's contracted function, built here at lane A's word, with the buy-in path's checks: frozen, identity check, break or self-exclusion (`RVBRK`), not enough cash (`RVSHT`). The member needs `tournaments.register`.
- **At the cage**, cash goes into the drawer, with the same checks, a cashier (`cage.transact`), and an open shift (`RVNSH`).
- **Rules** (decision 0202) refuse with `RVTRN`, the reason in the hint. The `tournament_registration` kill switch stops every buy.
- **GST.** The owner answered question #465: fees go into the nightly rake's consolidated GST invoice (series S, GST taken out at the `gst.config` rate), as the rake does. They are booked in `venue.tournament_fees` with no invoice of their own, and #469 (lane A) extends the nightly invoice to cover them.
- **Events.** An entry or re-entry emits `tournament.entered`.
- **Refunds.** An alternate who never sat is refunded by reversing their buys: a wallet buy by the floor, a cash buy only by a cashier.
- **Request ids.** The app and the cage keep one request id until the server answers, so a retry after a lost reply never charges twice. `private.debit_wallet` replays only the same transaction (`private.find_ledger_replay`).
- **Not yet built.** `private.credit_wallet` comes with prizes (#121).
