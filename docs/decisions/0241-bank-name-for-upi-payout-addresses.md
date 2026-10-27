# 0241: The cage sees the bank's name for a UPI payout address, and decides

Date: 2026-10-27 · Task: #503 · Question: #496 item 2 (the owner's answer of 27 Oct)

**Why.** Automated payouts go to whatever UPI address a member added, once the cage verifies it. Someone who took over a member's account (a SIM swap) could add their own address and be paid. The cage never saw whose address it was.

**What.** When a KYC-verified member adds a UPI address, the `payout-name-check` function asks the payouts provider whose address it is. The function runs each minute from pg_cron with the scheduler's secret and uses Cashfree's VPA check through `@rivr/adapters`. The practice venue's fake answers with the member's own name. A real venue is asked only once Cashfree's keys are set; until then its addresses wait and spend no tries. The cage's list shows the member's KYC name and, beside it, one of:
- "Name at the bank: …";
- the bank knows the address but gave no name;
- the bank knows no such address;
- not checked yet.

Staff decide; nothing is refused automatically for a mismatch. Members never read the bank's name, so this is not a way to look up whose an address is.

**How.**
- `payout_account` keeps the bank's name and the outcome: `found`, `no_name` or `not_found`.
- The function claims addresses waiting for their name and records the answer. An address is claimed when it is pending and in use, its member is KYC verified, its venue is not frozen, it has no answer yet, it has had fewer than five tries, and it was not claimed in the last two minutes.
- The tries and claims live in `private.payout_name_check_claim`, so asking writes no audit rows. A problem asking leaves the address for the next run.
- Both calls are the service role's alone. Bank accounts are not asked.
- The member export's column list became `private.member_export_column`, so a later column is one row more.
