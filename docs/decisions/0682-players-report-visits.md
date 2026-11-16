# 0682 Reports › Players lists every visit, as the door does

Date: 16 Nov 2026. The owner: "In player reports, show the player data in the same format as door as well (including check in/out times, table, time played, etc.)." Asked how rows work over a span of days, the owner chose one row per visit.

- **A visit** is a member who came in on a club day: the door's Today's players for that day (`private.todays_players`), with their first check-in and last check-out, their wait, each table with its time, and the time played. A member who comes in twice in a night is one row, as at the door. One who joined a list from the app and never came in is no visit.
- **The table** sits under the report's summary, with the door's columns and the day first: Date, Player, Number, Tier, Checked in, Checked out, Waited, Table, Played, ID check. As at the door, the club's lowest tier is left unsaid. The tier and the ID check are as they stand now, not as they stood that day.
- **One way for lists** (decision 0612). It is the server list `player_visits`, a page at a time, sorted, searched and filtered on the server. The report's span is its scope: whole dates only, 92 club days at most from the first, and no date means no days. It has its own Export of every visit the view leaves.
- **Status is left out.** The door's Status is where a player stands now, which says nothing about a past night.
- **Who sees it:** staff who read reports and members, never at the practice venue, as the other reports. On staging's data, 90 days of the day's query took 0.15 s.
