# 0579: Bonus chips can expire, and a visit redeems only part of them

The owner, 12 Nov 2026 (#908): bonus chips can expire on a rolling basis and are spent oldest first; only x% can be redeemed in one visit. Both are console settings. This reverses decision 0504's "bonus chips never expire" only where a venue sets an expiry.

- **`bonus.expiry_days`** (0 to 3,650; super admins only; none set is never):
  - Each grant ends N days after it is given (`private.credit_bonus` dates it).
  - Chips held when it is switched on end N days from then (the hourly sweep dates them).
  - Changing N changes only grants given after.
  - 0 takes the end off chips not yet ended.
- **Spending:** spending is unchanged: soonest end first, then the oldest. While N stands this is exactly oldest first. If N is shortened, a newer grant that ends sooner is spent first, so nothing lapses that could have been spent.
- **Logging:** each expiry is a `bonus_expiry` ledger entry and an activity-log line, and shows as Expired in the member's bonus history, as before.
- **`bonus.visit_cap`** (1% to 100% in basis points; super admins only; none set is all):
  - A visit redeems at most that share of the bonus held at its first seat, rounded down to whole ₹50 chips.
  - The first seat notes the balance on the visit, and `redeem_bonus_at_seat` refuses more (RVVCP).
  - The seat sheets show what is left this visit.
- **Twins:** `@rivr/domain` `bonusEnd`, `visitBonusCap` and `visitBonusLeft` are proved equal to their SQL twins on `packages/testing/golden/bonus.json`.
