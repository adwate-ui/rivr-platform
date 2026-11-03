# 0465: A simulation replays last week as if the promotion had run then

Date: 2026-11-03 · Console v3, phase 7, step 3 · Corrects decision 0463's simulation

**Why.** A version's schedule has a first day, and a new promotion's is today or later. The replay weighed last week's time played inside the whole schedule, first and last days included, and `@rivr/domain` `simulate` checked them again, so every new promotion's simulation gave nothing: the approver read zero for what it would have given.

**What.** The simulation answers "last week, if it had run": its days of the week and its times count, its first and last days do not.
- `promotion_version_replay` weighs time played with a copy of the schedule that starts on the replay's first club day and has no last day (migration `20261107170000`). The version keeps its own schedule.
- `usePromotionVersionActions().simulate` replays with the same copy, and stores the result with the version's own terms, which submitting checks.
- pgTAP `303_promotion_version_replay` proves an hours bonus starting next week still replays a visit four club days ago; it failed on the replay before this change.
