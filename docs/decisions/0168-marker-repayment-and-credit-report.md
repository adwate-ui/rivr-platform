# 0168: A repayment settles markers as a cash-out does, and the credit report can be rebuilt for any day

Date: 2026-10-26 · Task: #92 (scope-v1 module 5)

**Repayment.** A cashier takes a repayment by cash or by UPI (with its 12-digit UTR, used once). It must be in whole ₹50 chips and settles the member's open markers oldest first, each as far as it goes: the same split a cash-out's chips make (@rivr/domain `repayment` over `cashOut`, SQL twin `private.repayment_split`, golden `creditAgeing.json`). Paying more than the member owes is refused, because the cage hands back no change on a repayment. The cash goes into the drawer, or the UPI payment to the bank, and the member's receivable comes down by the same amount. Settling the past-due marker lifts the past-due block on new markers (#74).

**Ageing.** A marker's age is the whole days since it was issued, counted down: 0 to 7 days, 8 to 30, 31 to 60, and over 60 (@rivr/domain `ageingBucket`, twin `private.credit_age_bucket`).

**The daily report.** The report gives what each member owed at the end of a chosen day in India time (the next midnight). That is each marker's amount less the settlements made by then, so what was owed on a past day stands as it was. The limit shown beside it is the one in force today, and is labelled so: limits keep no history of their own beyond the audit log. The report sits on the Markers screen, for staff who see credit.

**Retries.** A retried tap with the same key gives the same repayment. The same key with another amount, method or UTR is refused.
