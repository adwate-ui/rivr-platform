# 0470: Promotion stacking: one points multiplier, the one giving the most

Date: 2026-11-03 · Console v3, phase 7 (promotions rebuilt) · Replaces the `stacks` flag and priority order of decision 0140 for versioned promotions

**Why.** The brief: "at most one points multiplier applies, the highest; bonus chips from different promotions stack unless limits forbid it". Two readings of "the highest" differ when windows differ: double points all night (+300) against triple points 20:00 to 22:00 (+200).

**What.** `stackGrants` in `@rivr/domain/promotions`, twinned in SQL on `promotionRewards.json`:
- **Points multipliers.** Of the multipliers that pass their own limits for one event, only the one giving the most extra points is given; on a tie, the first (oldest promotion). A rule a player sees, so the safest reading: a member never gets less than the best single promotion would give.
- **Bonus chips and spins** from different promotions all stack. "Unless limits forbid it" means each promotion's own limits (per member, members a day, most grants, budget), checked before stacking; there is no separate "does not stack" switch.
- **Perks.** One of each kind for one event (two cab promotions on one visit give one cab).
- A multiplier that loses the stack is not given, so nothing is counted against its limits or budget.
