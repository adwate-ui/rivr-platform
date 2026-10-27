# 0245: Hourly rakeback is a rate by stake, given each Monday and caught up daily

Date: 2026-10-27 · Task: #108 · Questions: #485 (the owner's answer of 27 Oct, 08:35 IST) and #522 (the rate mid-week and a held week, as recommended, 27 Oct)

**Why.** The spec asks for "a share of rake attributable to a member's seated hours, at a configured rate by stake, credited to bonus or points on a schedule". The owner chose bonus, weekly on Monday 06:00 IST for the week before, and on top of RIVR Rewards' 5% rake-share points.

**What.**
- **The rake attributable to a member** is RIVR Rewards' share (decision 0161): each hand's rake split equally among the members seated at its table when it was played, rounded down to the paisa per hand, summed for the club week (Monday 06:00 to Monday 06:00 IST) by member and stake.
- **The rate is a setting, `rakeback.rate`, by table type**: basis points, an optional cap and the bonus's days. Settings already give it effective dates, a console form and a history. Only a super admin changes it, with a reason, and the owner is alerted, as for the other money settings (decision 0213). The rate in force when a week began applies to all of that week.
- **Not a promotion rule.** RIVR Rewards runs outside the engine too (decision 0142). Checked by a weekly job against a whole week, the engine's live window, day and time conditions and limits would be judged on Monday morning, not when the rake was earned.
- **Given as bonus** through `private.credit_bonus`: the rate's share rounded down to whole ₹50 chips, then held to the cap. The promotions kill switch and a member or venue freeze hold it.
- **Caught up daily.** The job runs every day at 06:00 IST and looks back five weeks. For each member, stake and week, it gives what is due less what was already given; the key ends with what was given before, so nothing is given twice. Monday's run gives the week just ended. A hand the tablet sends late is given the next day, and so is a week held by a freeze or the kill switch once it is released. A week still held after five weeks is not given, and the owner is alerted once (`rakeback.unpaid`). Rake later reversed is not taken back.
- **A venue refused** raises `rakeback.refused` to the owner and is tried again the next day; the other venues still run.
- **Gated by tier.** `rewards.rakeback` is a gateable feature (rule 8): a member is given rakeback only while their tier has it, so it is off until the owner turns it on for a tier in Tiers, as well as setting a rate. An erased member is never given it.
- **A rate of 0 stops it** from the week it is in force; a rate in force cannot be withdrawn.
- **Each grant emits `rakeback.given`** (member, week, stake, amount, bonus grant), as `points.earned` and `promotion.granted` do, for a later message to the member.
- **Across lanes.** Like RIVR Rewards (decision 0161), the share reads lane B's seats, moves and hands and lane D's `private.session_tables` and `private.rake_share` directly, so the split is the same one.
- **Out of scope.** A member-facing card explaining rakeback (a promotion template, as RIVR Rewards has) is a follow-up.
