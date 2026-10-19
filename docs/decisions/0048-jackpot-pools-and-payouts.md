# 0048 Jackpot drops split into three pools; a bad beat pays in chips, rounded down

Date: 19 Oct 2026. Task #48. Question #300.

Every jackpot drop splits between the main, season and freeroll pools, each its own ledger account (players' money), in the same balanced transaction as the drop (`hand:<id>:drop`). The venue's `jackpot.shares` sets the season and freeroll pools' shares (at most 50% each, so they never pass 100% together); they take their shares rounded down to the paisa and the main pool takes the rest, so the parts always add up to the drop. The shares in force when the hand was played apply. With no shares set the whole drop goes to the main pool, so the design prompt's flow 4 still reads ₹3,42,700.

A bad beat pays the payout rule's share of the main pool, split between the loser, the winner and the other players dealt in (equal shares). Each part rounds down to whole ₹50 chips because it is paid in chips at the table: the main pool is debited and chips in play credited, and TDS is taken at cash-out like any winnings (lane A's `credit_wallet` does not exist yet). What rounds away, and the table's part when nobody else was dealt in, stays in the pool. `@rivr/domain` `splitDrop` and `badBeatPayout` hold the rules, and `private.split_drop` and `private.bad_beat_payout` are their SQL twins, both proved on `packages/testing/golden/jackpot.json`.

`public_jackpot` gives the club's pools to the TVs and the player app as the ledger's balances, so a pool is always its seed and drops less its payouts. Payouts, reversing adjustments and the console's Jackpots screen are #48's second part.
