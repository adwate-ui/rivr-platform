# 0499: Up to N times a member, and budgets each month

Date: 3 Nov 2026 · Owner's answer to a question in #829 · Builds on decisions 0471, 0472 and 0491

**Why.** Rule promotions with more than one grant a member in a period, or a budget by the month, stayed on the old engine path because the typed model could not say either (#829's money audit): a version would have loosened the first to no limit and spent the second for good.

**The rule in words.**
- **Inputs.** A version's limits: `perMember` (a visit, a club day, a club week, ever, or none), `timesPerMember` (2 to 20; left out, once; only with a period), `budgetChips` and `maxGrants`, and `budgetPeriod` `month` (only with one of the two). The promotion's grants so far, across its versions.
- **Up to N.** A member has it while their grants in the period number fewer than N. Their first in a period is keyed by the period (`day:2026-11-17`), the next `#2`, then `#3` (`slotKey`), so the unique (promotion, member, period key) index holds the Nth under concurrency: two racing grants write the same key and one is skipped.
- **Each month.** With `budgetPeriod` `month`, the budget and the most grants count only the grants of the event's calendar month of club days (06:00 IST on the first to 06:00 IST on the next first) and start again from nothing. A whole grant still fits what is left, never part of it. Approving such a version writes a monthly `promotion_budget`, so the spin wheel's cap and the reports read the same month.
- **Output.** A grant let through or the first limit broken, in the old order. No rounding enters: chips stay whole 50s. Effective from this migration; existing versions are unchanged (neither field set).
- **Twins.** `@rivr/domain` `periodKey`, `slotKey`, `tallyFor` and `checkLimits`, and their SQL twins `promo_period_key`, `promo_slot_key`, `promotion_tally` and `promo_check_limits`, are proved equal on `promotionRewards.json` (new `tally` and `periodKey` cases).

**Moved.** The rules left on the old path for either now convert into version 1: their old grants numbered in their periods and counting their chips (the old path wrote rupees only, so without them the budget would be spent again), up to N ever on a buy-in as a fixed bonus on any buy-in. Still not said exactly, so still on the old path: more than 20 a member, a budget under 50 chips (whole or monthly), and the first N grants a club day unless a member has it once (the model counts members a day, and a member given it twice would take two of the N).

**The old path stays.** It still weighs any rule the model cannot say (a hand, call time, a new player, a points or message effect, more than one rule, a graduation or a date window). No template or seed makes one, but one from before versions keeps granting, so removing the path would stop it silently. It goes once a data check shows none live; until then the console pauses and resumes such a promotion by its rule (decision 0498).
