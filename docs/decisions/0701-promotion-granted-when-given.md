# 0701 promotion.granted when a grant is given

Date: 19 Nov 2026. Follows decision 0670 (#1019).

- `promotion.granted` was emitted when a grant was calculated, so a Bonus waiting for a super admin, and one later refused, was told of as given. A consumer counting the event would count refused Bonus.
- **Now** it is emitted when a grant is given: at once for a perk and the high hand's Bonus, as before, and by `decide_promotion_bonus` on approval for a Bonus that waited, under the same key `promotion.granted:<grant>` and payload (status `given`).
- **A refusal emits nothing.** The member is told nothing of it (decision 0670), and the decision's row and Activity line keep it; no consumer needs a `promotion.refused` until one is built.
- The events already written for a Bonus waiting or refused, which no consumer had been handed (nothing reads the event yet), were deleted by the migration, so an approval writes the grant's one event.
