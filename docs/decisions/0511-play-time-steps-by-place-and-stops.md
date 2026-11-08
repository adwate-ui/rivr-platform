# 0511: A play-time step keeps its place across versions, and one reached during a stop is never paid

Date: 9 Nov 2026 · The owner's answers to the questions in #842

**By place, not by minutes.**
- **Before:** a step's grant was keyed by its period and its minutes (decision 0507). A version that moved a step from 2 h to 3 h made it a new step, which paid again.
- **Now:** a step is keyed by its place among the promotion's steps, the first 1, in `@rivr/domain` `periodKey` and in `private.promo_period_key` alike (golden cases), so an edit never pays a step twice.
- **No limit:** with no limit set, a step's period is its visit, as a step is paid once a visit.
- **Existing grants:** `private.rekey_hours_step_grants` keys them again the same way. A member already paid one step twice keeps both, numbered #2 in order. It keys only a key still '@' its minutes, so running it again changes nothing.
- **Once a visit, by place (money audit, 9 Nov):** `private.promo_step_settled` says whether a promotion has paid a member a step in a visit at that place, whatever its minutes, or skipped it. The sweep and every promotion's weighing ask it, so a limit of twice a day never pays a step twice in a visit, and another promotion's step at the same minutes never pays a skipped one.
- **Its grant's source** is `hours_step:<visit>:@<place>`, so the database refuses the step a second time in the visit. A step owed at minutes another step was paid at is paid.

**Lock step count (the owner, 9 Nov).**
- A live bonus's new version may change each step's hours and chips, and add or remove steps at the end only. To reorder them, end it and start a new promotion. The builder shows Remove on the last step alone and says so.
- The database cannot tell an edit from a reorder (any list is some edit of each place), so the rule lives in the builder. By place, nothing is paid twice either way.

**Stops.**
- **Before:** while the venue was frozen, promotions were stopped or the member was frozen, the minute's sweep paid nothing, then paid the steps reached meanwhile once released.
- **Now:** the owner chose "Never pay frozen steps". The sweep records each step reached since the stop began (the earliest venue freeze, promotions stop or member freeze in force), for the versions the member is for, in `promotion_step_skip`, and no promotion weighs it again. A member still seated is paid only the steps reached after the release. A step reached before the stop and not yet paid is paid once released.
- **Limits:** the sweep runs each minute, so two windows of a minute remain.
  - A step reached in a stop's last minute, after the sweep's last run in it, is paid once released.
  - The minutes played when the stop began are counted from the visit's seat time now, which takes off any time away since. So a step reached in the minute before a stop, and not yet paid, is skipped if the member then steps away (money audit). Both are accepted rather than adding a record per visit.
