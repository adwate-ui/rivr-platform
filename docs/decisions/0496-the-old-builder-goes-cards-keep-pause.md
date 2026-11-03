# 0496: The old builder goes; cards run by a rule keep Pause and Resume

Date: 2026-11-03 · Console v3, phase 7, step 3 · Completes decision 0491's move to versions

**What.**
- **Removed.** The console's old builder, templates list, waiting list and sent-back list; their `@rivr/db` hooks (`usePromotions`, `usePromotionTemplates`, `usePromotionsAwaitingApproval`, `usePromotionsSentBack`, `usePromotionSimulation`, `usePromotionDecisions`, and `submit` and `submitTemplate`); the builder's contracts (`promotionBuilderSchema`, `promotionReplaySchema`, `promotionLinkSchema`, `promotionRulesSchema`); and `@rivr/domain` `promotionDraft` and `simulatePromotion` with `promotionSimulation.json`. Nothing else used them.
- **Kept.** `promotionApplies`, `promotionReward`, `promotionsToGive` and the window twins: the engine still weighs promotions run by a rule with their SQL twins, proved in `024_golden_twins`. `promotionRefusalSchema` is the approver's reason. `usePromotionStakes` names the builder's stakes.
- **Cards run by a rule** (high hands, Ladies' Night and the other word-only cards) show on the list as "Card only" with Pause and Resume (`set_promotion_live`, `usePromotionActions().setLive`). A draft of one is not sent for approval from the console any more, and one still waiting from the old builder is not approved there: whether to keep these cards is the owner's open question (decision 0491).
- **Not dropped yet.** The database's old functions (`submit_promotion`, `submit_promotion_template`, `approve_promotion`, `refuse_promotion`, `promotions_awaiting_approval`, `promotions_sent_back`, `promotion_replay`) stay until a migration drops them with their tests.
