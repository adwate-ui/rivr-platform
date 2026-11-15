# 0611 Members on the server

Date: 15 Nov 2026. Issue 972 (redesign RD-29; slice 12, "Lists at scale").

- The Members table hands its view (order, words searched, each column's filter, page) to `members_page`, which gives one page of fifty and how many members the view leaves. Nothing is narrowed in the browser any more.
- The order and the filters vary, so the statement is put together for each view. A static statement that takes every order cannot use the member indexes for the view the screen opens on. The columns are a fixed list, each with its own SQL (`private.members_column_sql`); every value typed or chosen goes in as a quoted literal, never as SQL; pgTAP 436 tries words that look like SQL.
- `private.list_filter_sql` turns one column filter of the data table into SQL. It is the one such translation: the lists of RD-30 and RD-31 use it too. `ListView` and `ListFilter` in `@rivr/db` are the view's shape for every list.
- A column menu's counts come from `members_choices`, over every member the search, the tier and the other columns leave. A column's own filter is left out of its own counts, so its other values stay on offer. City offers its 200 commonest values.
- Status and Tonight are still drawn from the reads the screen already had. The server sorts, filters and counts them by the same two functions (`member_account_statuses`, `todays_players`), so the words agree.
- Export: in server mode the data table takes `exportRows`, the screen's read of every row the view leaves. The export is recorded first, with the total; then the rows are read a thousand at a time, which is the API's most.
- The search is the list's own, unchanged: a name by any part, a member number exactly, four or more digits of a mobile (anywhere in it for staff who read mobiles, its last four for everyone else).
- Indexes: the list by name, number and joining day; trigram indexes (`pg_trgm`) for a name or mobile by any part; a mobile's last four digits.
- Names now sort as the database collates them, not as the browser did. `members_of_tier` stays in the database, where its tests are the page's reference; the console no longer reads it.
- Twelve columns at 1440 px cut the headings "ID check" and "Tonight", and two shares for those two cut others. So a data table column may say its own share of the width (`share`); Members and the Door set one on every column, and no heading or cell is cut.
