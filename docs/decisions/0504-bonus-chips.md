# 0504: Bonus chips players see, never expire, and redeem as they sit down

Date: 8 Nov 2026 · The owner's answers of 6 Nov · Builds on decisions 0472 and 0502

**Why.** Players could not see their bonus chips, which ended after 7 or 30 days. They could only be spent at the cage, which is hidden. The owner asked for a balance and history in Rewards, a toast and a push when chips come and go, and the floor redeeming chips with the buy-in as it seats the player.

**What.**
- **No expiry.** `bonus_grant.expires_at` is nullable, and every grant is now given with none. Open grants whose end was still to come lost it. Grants that had already expired stay expired, and the `bonus-expiry` sweep stays on for any a freeze held past its end. `bonus_draws` and `@rivr/domain bonusSpend` draw dated grants first, then those with no end, oldest first (golden `bonus.json`).
- **Sign-up at Home.** With `kyc.at_the_club` on, the sign-up promotion is weighed when the selfie lets the member in (`at_club_from` stamped now). Only live promotions pay, once (`signup:<member>`). That member's desk check gives nothing more, and nor does a reopened check stamped with the day it began. Members verified in the app are weighed at verification, as before.
- **Redeeming.** `seat_member` and `assign_from_waitlist` take `p_bonus_chips`. `private.redeem_bonus_at_seat` runs in the seating's transaction:
  - it needs `members.read`, and refuses the staff member's own record (RVOWN), anything but whole 50s (RVCHP) and more than the member holds (RVBON);
  - it posts `bonus_buy_in` from `member.bonus` to `venue.chips_outstanding`, records a `bonus_redemption`, and emits `bonus.redeemed`;
  - it stops while promotions are switched off at the kill switch, because chips given wrongly cannot be taken back;
  - it is limited like the cage's buy-ins: 30 a minute per staff member and 120 per venue, with an alert to the owner (RVRAT);
  - it runs no buy-in promotion (0472);
  - its idempotency is the seat's. The ledger key is the redemption's own id: a replayed seating is refused as already seated (RVSTD), and a replayed Assign finds the place no longer waiting, before anything is drawn.
- **Told.** `credit_bonus` emits `bonus.credited`. The push consumer sends both events as `push.bonus`, a switch in Profile. The app toasts a new line live.
- **Read.** `my_bonus` and `my_bonus_history` serve Rewards, `member_bonus` the seat sheets, and `member_bonus_history` the record's read-only Bonus chips tab. Features `rewards.bonus` and `push.bonus` are core.
- **Undo.** A seat with chips redeemed is not undone, so the sheet offers no Undo.
