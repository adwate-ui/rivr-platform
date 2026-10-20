# 0112: High-hand claims are corrected before a decision and reversed after one

Date: 2026-10-20 · Task: #324 (the owner's answer to question #315; decision 0050)

**Correcting a claim.** Before a claim is decided, staff who approve jackpots (never the hand's dealer) may correct its hand, rank and seat. Only to a hand that pays, at a seat the table has. The dealer's claim is kept on the row (`original_category`, `original_rank`, `original_seat`, the first time) and in the audit log, with who corrected it. The console shows it as corrected, and the tablet says "Corrected by the floor".

**Reversing a decision.** A decided claim, approved or rejected, is reversed by the same staff with a reason, and the new status `reversed` is final.
- An approved claim's payout is posted back with `private.reverse_ledger_transaction`, linked to the payout and keyed by the claim, so it happens once, as a bad-beat reversal does. The high-hand cost and the chips in play return to what they were before the payout.
- `high_hand.reversed` goes out, and the TVs are told, since tonight's best may change.
- A claim still waiting is rejected, not reversed.
- The hand may then be claimed again: a hand has one live claim (a partial unique index), not one claim ever.

The enum value has a migration of its own, because Postgres can't use a new enum value in the migration that adds it.
