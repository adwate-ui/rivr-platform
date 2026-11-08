# 0508: The MIS Tables view in Reports, and filters on every table

Date: 8 Nov 2026 · The owner's requests of 8 Nov (table-level details in an MIS tab; filters on all console tables) and answer (an MIS tab with only a money-free Tables view)

**Tables view.** Reports is back on the rail for staff who read reports, investors (`owner_view`) included. It shows one view, Tables, with no tab strip because it is the only one.
- **Content:** each table over tonight, the last 7 or the last 30 club days, with hours run, members, the most at once, player hours and seat use.
- **Source:** `table_metrics`, which runs through `assert_reports` like every report.
- **Money reports:** they stay hidden. Their addresses (`?tab=mis`) open Tables.

**Games history.** Settings keeps Games history (runs and hours by club day and table). It counts a run on the day it opened; the Tables view clips runs to the span. Whether to retire it is the owner's call.

**Filters.** Every visible table has Filters, opened from a button beside its search with how many are in force.
- **Text and choice:** a column of few values filters by choice, any of them; names filter by text. A cell holding several values (a player's tables, a post's channels) is found under each.
- **Exports:** an export records the filters in force, cut to the audit log's 1,000 characters.
- **Placement:** the panel follows the bar, unlike the prototype's always-visible chips. A filter for every table would crowd every screen.
