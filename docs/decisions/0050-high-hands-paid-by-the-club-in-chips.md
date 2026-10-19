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
- One claim per hand, for a hand of the down open on the tablet, while its dealer may still deal.
- It names the category, a seat the table has, and for four of a kind its rank.
- The rank comes from a fixed list (A to 2), never free text, because it reaches the public view and the TV.
- A category that pays nothing is not claimed.

**The decision.**
- The floor's decision (approve, or reject with a reason) is final.
- Nobody decides a claim on a hand they dealt: a duty manager covering a down does not approve their own claim.
  The check compares staff records. A super admin could add a dealer record of their own and approve its claim; super admins are fully trusted, and every step is in the audit log, so that risk is accepted.
- Only staff who approve jackpots or read the ledger see the claims; the tablet sees its own.
- A mistake has no correction yet. Question #315 asks how one is put right.
- Not while the venue is frozen, and no payout while promotions are switched off.

**On the tablet and the console (#316).**
- The claim goes with the hand, as in the prototype: the High hand switch on hand entry opens the type of hand, the seat and a four of a kind's rank, and Log hand sends both.
- If the hand is logged but its claim is not, the tablet says so and offers Send again.
- The floor sees each claim with its seat, not the player, because seats are not linked to members yet (#77).
- The prompt that reaches the floor on any console screen is #317; until then, the High hands screen lists waiting claims.

**Tonight.** The TV and the app show tonight's best: the highest category approved for a hand played since 06:00 IST, and the latest of those. 06:00 is long after the last table closes, so a night's play stays one night.

Rejected:
- Funding high hands from a pot drop, which the design prompt does not describe.
- Paying to a member's account: the player at the seat is paid in chips, as the floor does today, and seats are not yet linked to members (#77).
