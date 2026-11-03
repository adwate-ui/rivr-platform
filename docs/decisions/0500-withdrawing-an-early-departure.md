# 0500: A super admin withdraws an early departure recorded by mistake

Date: 3 Nov 2026 · Owner's answer to a question in #829

**Why.** An early departure (a member let go before their call time, #79) stays on the member's record and counts there. One recorded against the wrong member, or by mistake, could not be taken back.

**What.**
- **Who and why.** Only a super admin of the venue withdraws one (`withdraw_early_departure`), while the venue can be written, once, with a reason of three to 500 characters that has a letter in it: words, not a number. Anyone else is refused (42501); a missing, short or numbers-only reason (22023).
- **Kept, not deleted.** `early_departure` stays append-only. The withdrawal is a row of its own (`early_departure_withdrawal`, also never changed), audited on insert with who and when, and the reason as the audit row's why. The record's list shows the early departure marked withdrawn, with when, who and why; the record's count leaves it out. The floor, the cage and the door still read the early departure itself: a withdrawal corrects the record, not a night already closed.
- **Nothing leaves.** A withdrawal writes no outbox event, at the practice venue or any. The practice reset and a live purge take its rows with the venue's.
- **Console.** Withdraw sits on each standing line of the member record's Early departures, for super admins, and opens the reason under it.
