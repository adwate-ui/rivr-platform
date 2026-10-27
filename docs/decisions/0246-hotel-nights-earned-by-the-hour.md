# 0246: Hotel nights are a ledger balance, earned by the hour at each stake

Date: 2026-10-27 · Task: #146 · Question: #486 (the owner's answer of 27 Oct, 08:35 IST)

**Why.** The spec: "Points can be earned towards hotel stays at a configured hours-per-night rate by stake, and redeemed through the rewards catalogue." The owner chose a balance of nights, not hotel nights priced in points: hours at each stake build nights at that stake's rate, and a hotel-night reward costs nights.

**What.**
- **Earning.** When a visit closes (`private.close_visit`), the time played at each table earns its table type's `accommodation.hours_per_night` share of a night. That time is the call-time clock's, as points by the hour use it (`private.visit_table_time`). The rate is the one in force when the visit closed; a stake with none set earns none.
- **Thousandths.** Nights are kept in thousandths, rounded down per seat session at each table, as points by the hour are (`@rivr/domain` `nightsForTime`, golden `accommodation.json`). Hours at different stakes and on different visits add up: 10 hours at a 20-hour stake and 20 at a 40-hour stake make a night.
- **The ledger.** A new unit, `nights`. The member's `member.nights` stands against the venue's `venue.nights_issued`, as points stand against points issued. The accounts open the first time a member earns. Venue accounts are otherwise opened in `bootstrap_venue`, which lanes copy whole for each new account, and a copy here would race theirs. Reports that sum money already filter on `paise`.
- **Gated by tier.** Only members whose tier has the gateable feature `rewards.accommodation` earn nights (rule 8). `my_rewards` gives the member's nights next to their points.
- **Earning emits `nights.earned`.**
- **Spending.** A hotel-night reward in the catalogue is priced in whole nights (1 to 1,000), every other kind in points; the database holds each to its unit. `redeem_reward` takes the price the member was shown, points or nights, and a hotel night's nights leave their balance through `private.debit_nights` (never below nothing, RVNGT). A redemption records what it took. A hotel-night reward priced in points before is now one night.
- **Screens.** The player's Rewards shows the nights held (`formatNights`, `1.25`) behind `rewards.accommodation`, and prices and redemptions in points or nights; the console's reward form asks for nights for a hotel night, and its lists show either.
- **Erasure** forfeits a member's nights to the nights issued, as it does their points.
