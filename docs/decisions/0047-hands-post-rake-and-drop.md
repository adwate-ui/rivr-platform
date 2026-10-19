# 0047 A hand posts its rake and drop out of chips in play; the jackpot is live while a drop is set

Date: 19 Oct 2026. Task #42.

A logged hand moves money. The rake and the jackpot drop are chips the dealer pulls from the pot, so they leave play: each posts as its own balanced ledger transaction, debiting `venue.chips_outstanding` (chips in play, a liability) and crediting `venue.rake` (revenue) or `venue.jackpot.main` (the bad-beat jackpot, players' money). Keys are the hand's (`hand:<id>:rake`, `hand:<id>:drop`), so a replayed hand posts nothing twice; nothing posts for a nought. The jackpot's sub-pools take their shares of the drop with #48; lane A owns the chart of accounts and may move these legs, but not their sum.

The rules come from the effective-dated settings at the hand's own time (`played_at`, which the tablet sends and an offline tablet sends late): `rake.config` for the table's game and `jackpot.drop` for the venue. The spec drops into the jackpot "once the bad-beat jackpot is live" and no setting says when that is, so the jackpot is live while the venue sets a drop above zero; setting it to zero stops the drop. A hand also records whether the cap applied: the rate's share of the pot was more than the cap (a share exactly at the cap is not capped), as @rivr/domain's `potTake` and its SQL twin `private.pot_take` both say, proved on `packages/testing/golden/rake.json`.

A hand is logged only during a dealer's down, from the tablet fixed to the table, with a pot of whole ₹50 chips, played within the last day, and not while the venue is frozen.
