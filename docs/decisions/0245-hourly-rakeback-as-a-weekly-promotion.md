# 0245: Hourly rakeback is a weekly promotion

Date: 2026-10-27 · Task: #108 · Question: #485 (the owner's answer of 27 Oct, 08:35 IST)

**Why.** The spec asks for "a share of rake attributable to a member's seated hours, at a configured rate by stake, credited to bonus or points on a schedule". The owner chose bonus, weekly, and on top of RIVR Rewards' 5% rake-share points.

**What.**
- **The rake attributable to a member** is RIVR Rewards' share (decision 0161): each hand's rake split equally among the members seated at its table when it was played, rounded down to the paisa per hand, summed for the week by member and table (`private.week_rake_shares`, `@rivr/domain` `weekRakeShares`).
- **The week** is the club's: Monday 06:00 IST to Monday 06:00 IST. The cron job `rakeback-weekly` runs `private.give_rakeback_everywhere()` each Monday at 06:00 IST for the week just ended.
- **The rate by stake is a promotion rule**, trigger `rake_week`: its `stakes` condition picks the stakes, its percentage bonus (`percent_bps`, optional `cap_paise`) is the rate. So rakeback goes through the promotions engine: approval by a super admin (decision 0244), the budget, the per-player limit and the kill switch. There is no `rakeback.rate` setting.
- **One engine event per member and table**, the week's share there as its amount, keyed `rake_week:<Monday>:<table>`. A second run gives nothing twice. The bonus is rounded down to whole ₹50 chips and held to the cap (`rakebackBonus`, as `promotionReward` does).
- **A frozen member or venue** gets nothing that week; the engine gives nothing while the kill switch holds. A run after release gives what is still due for that week.
- **Out of scope.** A rakeback template and its console wording beyond the trigger's name; follow-up issue.
