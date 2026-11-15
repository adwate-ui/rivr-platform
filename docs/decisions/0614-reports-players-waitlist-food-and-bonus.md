# 0614 Reports: Players, Waitlist, Food and drink and Bonus

Date: 15 Nov 2026. Issue 970 (redesign RD-27; slice 10).

- Reports has five tabs: Tables as it was, and Players, Waitlist, Food and drink and Bonus in its pattern. One period control serves all five, so a change of report keeps the days. Each report is four figures, a chart and a table with the screen's Export. Tables keeps every column and gains the room's four figures and a chart of members seated.
- Each is computed on the server over 1 to 92 club days, behind the check Tables has (`private.assert_table_span`): staff who read reports, so super admins and admins; investors and the practice venue are refused. Rows are bounded: a chart is 24 bars for one club day or a bar a day, figures are four, and a table is a row a tier, a table, a staff member or a promotion, two hundred at most.
- No rupee figure. Bonus is summed in its own paise and shown as Bonus, as everywhere on the console.
- Players: check-ins, members who played, new members, the average seat session; then who played, by tier and on a first visit, each with its share, and the ID checks done. The prototype's "Lapsed won back" and "Vs last period" are not built: the club has no rule for who has lapsed, and the acceptance asks for neither.
- Waitlist: who joined a list, who got a seat (from the list, or seated another way while on it) and the average and longest wait to it; then each table's own list. A request the floor declined is no join. The chart is joins, not how many were waiting at each hour.
- Food and drink follows the issue, not the prototype's items: orders, items, and the time from placing an order to accepting and to serving it, by table and by staff member. The staff member is who accepted the order; orders nobody accepted have a line of their own. A void order counts as an order and in Void, never in the items.
- Bonus: what was given, how much of it by hand, what was used, and what members hold now whatever the period; then what was given by promotion, by hand, and by any other reason (a grant no promotion made, under its own reason). What was used is not split by promotion: a redemption draws on a member's Bonus, not on one grant.
- The chart is a new `BarChart` in `@rivr/ui`: nothing there drew bars. `StatRow` takes four stats for the figures.
