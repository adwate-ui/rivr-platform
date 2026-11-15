# 0612 One way to read a list from the server

Date: 15 Nov 2026. Issue 973 (redesign RD-30; slice 12, "Lists at scale").

- The Door, Food and drink's orders, the ID checks' queue and open Feedback each loaded everything they had. Each now asks the server for one page of fifty, sorted, searched and filtered there, with how many rows the view leaves.
- One way for all four, and for the lists of RD-31. A list is named in `private.list_spec` with its rows as a statement, the columns a view may sort and filter by, the columns its search reads, its order and the columns counted for a menu or chips. `private.list_json` reads a page of it; `public.list_choices` gives the counts. In `@rivr/db`, `useListPage` and `useListChoices` are the two reads, and each list's hook is the call and its row.
- The view is the data table's own, with the screen's own choice beside it as `scope`: the day and state of orders, the door's list. Typed and chosen values go in as quoted literals or parameters (`private.list_filter_sql`, decision 0611); pgTAP 437 tries words that look like SQL and a list nobody named.
- Whether the caller may read a list is part of its statement, asked once, not once a row. `todays_players` asked it of every player; it asks once now.
- Members keeps its own statement (decision 0611): it is built so that fifty thousand rows are never all computed. These lists hold hundreds of rows a day, so each computes its day's rows and pages them.
- Food and drink is one table in place of the three lanes (the owner, 15 Nov). It opens on today's open orders, oldest first; delivered, void and older orders are behind the chips and the day. Void opens its reason under the row.
- The Door is one table, as the prototype has it: the field, then chips for In the room, Expected tonight and Left, each with its count, and Check in or Check out on the row. Today's players is the same list by status, and now lives in the check-in feature. The prototype's four figure tiles are not built: the chips carry the counts.
- The ID checks' queue stays a list beside the check open, now a page of it, found by name, with the pages control under it (`Pages`, exported from `@rivr/ui` for a list that is no table).
- Export, where a list had it, reads every row the view leaves (`readEvery`, a thousand at a time).
- Export has one loop, `readEveryRow` in `@rivr/db`, for every list, Members and Activity. Two reads page by their own offset and count and not by a view: `top_up_history`, a club day's requests with nothing to sort or filter, and `activity_page`, narrowed by the screen's own fields (person, kind, days) with the table's own filters off. A status that sorts by need, not by its code, names its order beside its column (`"status:sort"` on the door's list).
- Each live list's counts ask again as often as its pages, so a chip's count is the table's. On a phone Food and drink shows today's orders with no day to choose, so the orders come first.
