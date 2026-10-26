# 0231: The cage pays a withdrawal in cash, through Cashfree, or by typed UTR

Date: 2026-10-26 · Task: #475 (the owner's answers of 26 Oct: keep all three; a separate Cashfree account; a failure goes back to the cage)

- **Cash** (`pay_withdrawal_in_cash`): a cashier who approves withdrawals pays it at the counter, from the drawer, in an open shift.
- **Cashfree** (`pay_withdrawal_through_cashfree`): UPI addresses only. The withdrawal waits as `paying` with a fresh key. The `withdrawal-payout` function, run each minute by pg_cron with the scheduler's secret, pays it through the adapter (decision 0198) and asks again until Cashfree answers. Sent posts the money from `venue.cashfree`, the "Cashfree payout balance": a payment account treasury tops up from the bank with a transfer between accounts (#94).
- **Manual UPI** (`send_withdrawal`, as before): the UTR typed in, from the bank. It stays as the fallback when Cashfree is down.

**Only Cashfree's own answer moves money.**
- **Following payouts.** Each run claims the payouts due and stops taking more after 45 seconds, so a payout's slowest asks finish inside the two minutes a claim holds it. A paying one is asked again in two minutes; one sent less than thirty days ago, which Cashfree may still reverse, every thirty minutes.
- **When money goes out.** A payout is sent only while the venue, the member and withdrawals are not stopped and its account is still verified, checked again at the moment of sending. Money Cashfree has already paid is recorded whatever the kill switch says; a freeze holds that record until it is released.
- **Failures.** Once a send has been tried, a transfer may exist. It is looked up by its id, made from the attempt's key, before anything else, whatever the account, the keys or the kill switch say. A payout returns to the cage as waiting, with the reason shown, only when no transfer can exist: a refusal before sending, or Cashfree saying there is none. It also returns on Cashfree's own "failed" or "reversed"; a reversal also undoes its posting. Any trouble asking means ask again later, never failed. A payout paying half an hour, or one the function could not record, alerts the owner (`withdrawal.payout_stuck`).
- **While paying.** A paying withdrawal waits for Cashfree. The cage cannot pay it another way meanwhile, so it is never paid twice.
- **Retries.** Each attempt has its own key, so a second try is a new transfer. An answer for an old attempt changes nothing, but a *sent* one alerts the owner (`withdrawal.payout_orphaned`) to put it right.

The practice venue pays through the fake. A real venue without the four Cashfree secrets fails each attempt straight back, as "Cashfree payouts are not set up". The member's app shows a paying withdrawal as pending.
