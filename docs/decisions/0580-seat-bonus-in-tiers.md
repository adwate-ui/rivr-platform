# 0580: A seat bonus in tiers

The owner, 12 Nov 2026 (#909): the seat (buy-in) bonus can pay in tiers. The first X claims get A chips, the next Y get B, and more tiers can be added. Asked what is counted, the owner chose "over the promotion's life".

- **The reward:** `{ kind: 'seat_bonus', tiers: [{ count, chips }, …] }`, with 1 to 10 tiers, each of 1 to 10,000 claims and whole 50s of chips. It sits beside the fixed seat bonus and the first-N one, which are unchanged.
- **Who gets it:** each member once, on their first seat of a visit. The terms must say once a member and must not count afresh each month. The builder sets both when tiers are chosen.
- **How a tier is chosen:**
  - The claim's tier comes from the promotion's grants so far (`grantsGiven`), across all its versions.
  - Once every tier is claimed, the promotion pays nothing (`tiers_used_up`).
  - A budget counts the tier's chips, not the first tier's.
- **Twins:** `@rivr/domain` `tierChips` and `checkLimits` are the twins of `private.promo_tier_chips` and `promo_check_limits`, proved on `promotionRewards.json`.
- **Payment:** the engine pays the tier's chips. The seat bonus sweep weighs seats one at a time, earliest first, so the order of claims is the order seats were taken.
