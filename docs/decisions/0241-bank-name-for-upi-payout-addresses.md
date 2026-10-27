# 0241: The cage sees the bank's name for a UPI payout address, and decides

Date: 2026-10-27 · Task: #503 · Question: #496 item 2 (the owner's answer of 27 Oct)

**Why.** Automated payouts go to whatever UPI address a member added, once the cage verifies it. Someone who took over a member's account (a SIM swap) could add their own address and be paid. The cage never saw whose address it was.

**What.** When a member adds a UPI address, the `payout-name-check` function (pg_cron, each minute, with the scheduler's secret) asks the payouts provider whose it is: Cashfree's VPA check, through `@rivr/adapters`. The practice venue's fake answers with the member's own name; a real venue without Cashfree's keys gets no answer, and the address waits. The cage's list shows "Name at the bank: …" beside the member's KYC name, or that the bank knows no such address, or that it is still asking. Staff decide; nothing is refused automatically for a mismatch.

**How.** `payout_account` keeps the bank's name and the outcome (`found`, `not_found`). The function claims addresses waiting for their name (pending, in use, not answered, fewer than five tries, not claimed in the last two minutes) and records the answer; a trouble asking leaves the address for the next run. Both calls are the service role's alone. Bank accounts are not asked.
