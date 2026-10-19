# 0050 High hands are claimed on the tablet, approved by the floor and paid by the club in chips

Date: 19 Oct 2026. Task #47.

The design prompt lists high hands among the promotions the club runs: royal flush ₹25,000, straight flush ₹10,000, four of a kind ₹2,000. In flow 6 the dealer claims one on the tablet, the floor approves it, and the TV shows it.

**The money.** The club funds high hands. No drop is taken from pots for them, unlike the bad-beat jackpot (decision 0048).
- Approval pays the amount for the category in `high_hand.payouts` (whole ₹50 chips), under the rule in force when the hand was played, as rake does.
- The chips are paid at the table: `venue.chips_outstanding` is credited and a new expense account, `venue.high_hand_expense` ("High hands paid"), is debited. This is one balanced ledger transaction, keyed by the claim.
- TDS is taken at cash-out, as for any winnings.
- The console pays only the amount it showed (`RVSTL` otherwise).
- Question #313 asks the owner to confirm the club funds them.

**The claim.**
- One claim per hand, for a hand of the down open on the tablet: the category, the seat and the rank (for example Queens).
- A category that pays nothing is not claimed.
- The floor's decision (approve, or reject with a reason) is final; a mistake would be put right by an adjustment, not an edit.
- Not while the venue is frozen, and no payout while promotions are switched off.

**Tonight.** The TV and the app show tonight's best: the highest category approved for a hand played since 06:00 IST, and the latest of those. 06:00 is long after the last table closes, so a night's play stays one night.

Rejected:
- Funding high hands from a pot drop, which the design prompt does not describe.
- Paying to a member's account: the player at the seat is paid in chips, as the floor does today, and seats are not yet linked to members (#77).
