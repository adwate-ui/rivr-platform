# 0552: Feedback triage, and hosts' offers honoured by hand

Date: 9 Nov 2026 · From the 180-day audit of 8 Nov (I-64, I-65, I-66).

**Open tickets are never cut.** Each tab's count comes from the server, so it is true past the old limit of 500. Resolved holds tickets resolved in the last 90 days, however old the ticket, and Other the ratings of those days that never were tickets, each read fifty at a time.

**An open ticket's target is two days.** The audit asked for age against a target without naming one, so we chose it: `FEEDBACK_AGE_TARGET_SECONDS` in `@rivr/domain/feedback`. Past it, the age is gold and says overdue, as it needs staff and colour is never the only sign (0463).

**A visit's wait runs from check-in to the first seat.** Nothing links a waitlist place to a visit, so this is the wait the data can show.

**What makes a ticket is unchanged:** a rating of 3 or below, or a note. The audit suggested only 1 or 2 stars or a written note. That decides which members get an answer, so it is left for the owner.

**A host's offer is honoured by hand.** The owner's answer on #598 stands: "record only, honoured by hand; no money or points move without a person." The audit's automatic grant is not built. An offer shows on the member's record and at the Door while it is out and on the night the member comes back, for the floor to give. Nothing records that it was given.

**A bonus by amount needs no expiry** (`promotionEffectSchema`, `private.is_promotion_rule`), so a host's offer carries none: bonus chips never expire. Promotions keep the field they already send.
