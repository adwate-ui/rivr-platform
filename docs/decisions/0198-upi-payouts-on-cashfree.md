# 0198: UPI payouts on Cashfree Payouts, idempotent by looking first

Date: 2026-10-26 · Task: #475 (the owner: use Cashfree "for payouts as well", with the KYC keys)

`createCashfreePayouts` (`@rivr/adapters/upi-payouts`) implements the payout adapter on Cashfree Payouts v2 with the same keys and signing as KYC (decision 0197). Our idempotency key becomes Cashfree's transfer id (`rivr_<key without dashes>`).

**Never twice.** Cashfree only rejects a repeated transfer id as a duplicate; it does not return the first. So `pay` looks the transfer up first, and sends only when Cashfree has never seen it. If the lookup itself fails, it sends nothing. A retry after a timeout or a server error therefore returns the first transfer. Cashfree's own guidance is the same: check the status before sending again.

**Never refused when it may have gone.** A failed lookup other than Cashfree's "not found" is reported as unavailable, not refused, because the transfer may have gone. A repeated send that Cashfree rejects as a duplicate is read back, or reported as unavailable. Amounts outside UPI's ₹1 to ₹1,00,000 are refused before any call, and so is the nil key.

**States.** `SUCCESS` is sent, with its UTR. `FAILED`, `REJECTED`, `REVERSED` and `MANUALLY_REJECTED` are not paid. Anything else is still on its way. `verifyVpa` uses Payouts' `validatePayout` for the holder's name. `sent` is not final: Cashfree can reverse a transfer later. The flow that wires this must poll after `sent`, or take Cashfree's signed reversal webhook, and undo the withdrawal's ledger entry on `failed`.

**Not wired yet.** No flow calls the adapter: the cage still pays withdrawals by hand and enters the UTR. Paying withdrawals automatically moves players' money, so it waits for the owner's decision. On 26 Oct the sandbox account also refused transfers (`ERROR_SELECTING_FUND_SOURCE`) and validation ("feature not enabled") until Cashfree configures it.
