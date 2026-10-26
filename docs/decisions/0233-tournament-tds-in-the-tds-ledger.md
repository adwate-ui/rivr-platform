# 0233: Tournament prize and bounty TDS go in the TDS ledger

Date: 2026-10-27 · Task: #477 (lane B's ask from #121, decision 0205)

**What.** Tournaments pay each prize and bounty after TDS on that payment alone (0205), and kept the TDS on `tournament_payout` only, so the withholding ledger, the quarterly return and members' certificates (0169) left it out. Every payout now also records its TDS in `tds_withholding`, the one TDS ledger, with `tournament_payout_id` in place of a cash-out. The row holds the section, whether the member had a PAN, the rate, the winnings (prize plus bounty), and what was withheld, or shadow while TDS is switched off.

**How.** A trigger on `tournament_payout` writes the row (`private.record_tournament_payout_tds`) with the parameters in force when it was paid, the same that `private.tournament_prize_tds` used. So lane B's payout functions are unchanged, and no payout can miss its row. A practice reset reloads both tables from the seed, so the trigger stands aside then. Payouts made before this were recorded once by the migration, with the member's PAN as it is now.

**A prize is taxed on its own.** Its row's basis is `payment`, with no period. A cash-out's period counts only cash-outs' TDS, as before (`tds_on_cash_out`), and the return extract takes a prize's taxed winnings as what it won.

**Reports.** The ledger and certificates count payments (cash-outs and tournament payouts) instead of cash-outs, so their column is `payments`. What a payment paid is the chips cashed out, or the prize and bounty won.
