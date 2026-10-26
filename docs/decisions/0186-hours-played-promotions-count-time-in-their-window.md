# 0186: Hours-played promotions count the time inside their window

Date: 2026-10-26 · Task: #457 · Question: #445

**Rule.** The owner answered #445: a playing-time promotion with days or times counts only the seated time inside its window, and pays on that whenever the visit closes. A player who plays 14:00 to 20:00 and scans out at 20:30 gets the window's 6 hours. Until now, such a rule was weighed at the moment of the close (decision 0164), so that player got nothing.

**How.** For the `hours_played` trigger only, a rule with days or times weighs the visit's seconds inside the window, by session, table and rate, as points count time (decision 0161). When the rule also names stakes or tables, only time at those counts: "double points at 100/200" in a window is time at 100/200 in the window, wherever the player sat longest. Its days, times, stakes and tables are then met and dropped; its other conditions, such as minimum hours, read the hours counted. No such time, no promotion.

**Time away.** No record says when time away was taken, so each table's time inside the window bears its share of it, rounded down, as `tablePlayedSeconds` shares it.

**Points.** "Double points" doubles the points earned in the time counted: each table's played seconds there, at that table's points an hour (`pointsForTime`), rounded down per table. Doubling all of a longer visit's points, or a time share of them, would pay for hours outside the window or at another stake's rate.

**Unchanged.** Rules without days or times, and every other trigger, are weighed as before. The twins are `@rivr/domain` `secondsInWindow` and `playedSecondsInWindow`, proved equal on `packages/testing/golden/promotionWindow.json`; the points are `pointsForTime`'s.
