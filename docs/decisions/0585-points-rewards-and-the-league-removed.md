# 0585. Points, rewards and the League removed

From the redesign brief of 15 Nov (#945, #946); the owner on what goes: "Remove it all." One migration, generated from the database's own function definitions, takes out points (by the hour, from rake, at verification, by hand), the rewards catalogue and its redemptions, hotel nights and the League, with their settings, features, permissions, TV boards and website page.

- **The ledger keeps its points and night accounts and every entry in them.** The ledger is never rewritten. Nothing posts to them, and a member's own ledger lines are now those in paise alone. On 15 Nov no member on production held points or nights; an erased member who did would keep that balance, as erasure forfeits Bonus alone.
- **Learn's points figure stays** (`learn_session.points`, `private.learn_points`, the `learn.*` settings) until Learn goes (#947). It posts nothing.
- **Two values wait for their own slices:** `tv_mode` keeps `rewards` and `league` until the TV slice (#971), and `killable_feature` keeps `redemptions` until the kill switch goes (#951). A TV on either board went to the waitlist board, and the console no longer offers them.
- **Erasing a member:** the blocker `rewards` is now `bonus`, and `redemptions` is gone. Points and nights are no longer forfeited, as there are none.
- **A visit still cannot close while the club is frozen.** Posting points used to refuse it; `close_visit` now asks `assert_writable` itself.
- **The website:** the Leaderboard page and every League block are deleted at each venue. The rewards block shows rakeback by table, and the outstation block the cab. A line of the shipped copy that named points is replaced only where it is still word for word as shipped; a line the club edited is left for the club.
- **Promotions:** a grant is bonus chips or a perk. Promotions that gave only points are deleted; the migration stops if one of them ever gave bonus chips or a perk.
- **Bonus by hand on the floor:** floor managers added Bonus from the Rewards tab and cannot open Members, so a seated player's sheet on the Live floor now carries the member record's form, for staff who hold `bonus.give` (question #984; this is its default until the owner answers).
- **Played time, by a second or two:** a table's time is shared once for the visit, where it was shared for each points rate. A visit from before that sat at one table twice across a change of rate reads one or two seconds longer in a replay. Nothing was paid on the difference.
- **Activity keeps its words for points and the League** (`Gave points`, `Points earned`): a line from before 15 Nov still reads in words, with no figure and no kind of its own. The privacy notice keeps the word points too, as the ledger keeps what a member once held.
- **The practice venue's saved start is taken again** by the migration, without its points promotions, which a reset would now be refused.
- **Left behind:** reward photos in the public `item-photos` bucket. They hold no personal data.
