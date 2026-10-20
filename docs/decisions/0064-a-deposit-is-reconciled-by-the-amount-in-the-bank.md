# 0064: A deposit is reconciled by the amount in the bank, and a UTR pays one thing

Date: 2026-10-20 · Task: #29

A UPI deposit credits withdrawable cash, so the cage's check has to be one the member cannot fake:

- **The amount is reconciled.** The cashier finds the deposit's UTR in the bank statement, checks the
  payer against the member's verified UPI account the deposit names (#19), and types the amount the bank
  shows. It must equal the member's (`RVAMT`); the cage's list does not show the member's figure. Typing
  the UTR back, as Academy payments do, proves nothing here: the fee is not fixed by a booking.
- **A UTR pays one thing.** A trigger on every table that records a UTR (buy-ins, Academy payments and
  their turn-downs, withdrawals, deposits) refuses one another table holds (`RVUTR`), under a lock on the
  UTR. A deposit's UTR stays taken once turned down, so a genuine UTR the cage wrongly turned down can
  never be confirmed for someone else; the member asks at the cage.
- **Dual control.** From `cage.second_approver_threshold` up, a second approver approves a deposit
  first, as a withdrawal (decision 0063, question #360).
- **Reads.** A member's own deposits stay readable whatever their tier: it is their money's history.
  Only asking for one is gated by `balance.deposits`.
