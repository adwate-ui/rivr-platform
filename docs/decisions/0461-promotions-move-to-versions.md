# 0461: Promotions move to versions; the old rule path stays until the console moves

Date: 2026-11-03 · Console v3, phase 7, step 2 (database) · Builds on decisions 0437 and 0438

**Why.** The brief puts promotions in versions with their own tables. The existing four tables, the engine's triggers and every reader of `promotion` already work, and the old builder on the console stays until step 3.

**What.**
- **One new table.** `promotion_version` holds each version's typed terms, status, author, approver, simulation and card words. `promotion` keeps its row and copies its current version's status (a waiting one reads `pending` there), words, link and submitter. Only `private.sync_promotion` writes them, and a trigger refuses any other status change on a versioned promotion (RVVER).
- **Converted, not duplicated.** Every promotion run by one rule the model can say became version 1, in its old status. Founders' Circle priority and the cab home, cards until now, became waitlist priority and a cab home from the fourth visit. Every venue gained Double and Triple points as points-multiplier drafts, and new venues get all of these. Grants already given got period keys, so a once-only limit holds.
- **Unchanged.** Cards that are only words (high hands, the bad beat, RIVR Rewards, Ladies' Night, the League, RIVR Sunday) stay as cards. So do rules the model cannot say (a hand, call time, visits so far, a new player). Their rules stay as history.
- **Two paths for a while.** `evaluate_promotions` weighs promotions with no version as before, then the live versions. The old builder's functions still make rule promotions and refuse versioned ones. Step 3 moves the console to the version functions and then drops the rule path, its functions and its tests.
- **Budget for the old readers.** Approving a version writes `promotion_budget` from its limits (chips × 100 paise), so the spin wheel's cap and the reports keep reading it.
