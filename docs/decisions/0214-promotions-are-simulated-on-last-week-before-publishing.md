# 0214: A promotion is simulated on last week before it is published

Date: 2026-10-27 · Task: #144 (scope-v1 module 7 controls and acceptance; the owner's answer to #507)

**What is replayed.** The seven whole club days before today's, 06:00 to 06:00 IST, through `promotion_replay`. For a buy-in rule, the replay gives each cage buy-in with its member's own money (₹0 when paid from bonus). For an hours-played rule, it gives each closed visit's hours and points; with days or times, only the time inside the window, as the engine weighs it (0186). The database gives these events, ids only, never names. Reading is allowed while the venue is frozen.

**Who replays.** `@rivr/domain` `simulatePromotion` weighs the events in time order with the engine's own `promotionApplies`, `promotionReward` and `promotionsToGive`, keeping its own first-N, per-player and budget counts. So the simulation and the live engine cannot disagree. It is proved on `packages/testing/golden/promotionSimulation.json`.
- The promotion is weighed alone. Others that would stack with it, or stop it, are not replayed, so its cost errs high.
- A rule that asks about past visits, call time or a hand is refused (`not_replayable`). The builder makes none.

**What it shows.** The buy-ins and visits replayed, the times given, the members, the bonus cost in rupees and the extra points as a count. A point has no rupee value (#507). It also shows what is left of a budget, and whether the budget would have run out. A builder promotion has none, so it says "No cap".

**Members.** A member is a number within one replay, enough for per-player limits. It is never an id: marketing manages promotions without reading members.

**Before publishing.** In the builder, Publish waits for a simulation of the choices as they stand, and any change clears it. A template from the deck is not simulated here. Many templates weigh facts the replay does not hold (a referral, a lapsed player, a hand). Templates, like every promotion, go live only once a super admin approves them, in the second half of #144 (#507).
