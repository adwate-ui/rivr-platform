# 0467: One waitlist per table

Date: 3 Nov 2026. The owner (#777): each table has its own list with its own order and priority, and the TV shows a list per table. This replaces 0321's list per stake; 0321's join from a table's sheet and "I'm on my way" stand.

- **The list.** A waiting place is on `waitlist_entry.table_id`'s list; a waiting place without one is refused (check). `table_type_id` stays for priority, events and the website. `ranked_waitlist` numbers each table's list from 1, by the weight at the table's stake, then join time (the golden `waitlist.json` is unchanged).
- **Joining.** `join_waitlist_at(table)` from the app and `add_to_waitlist(table, phone)` by the floor, an active table at the venue only. `join_waitlist(table_type)` is dropped: an old player build gets "unavailable". One list at a time (RVONE): to switch tables the floor removes the place and adds it to the other list, at its end.
- **Calls.** A call or Assign goes to the list's own table only (22023); a call that ends unseated rolls on along that table's list only.
- **Stake.** A table's stake does not change while its list has places (RVSTD).
- **Closed tables.** A closed table's list stays and is its interest list (`interest_lists`, a row per closed active table); reopened, its order is kept.
- **Reads.** `waitlist_lengths`, `waitlist_requests`, `interest_lists` and `tv_waitlist_board` are a row per table; the offline pack names each place's table. `public_waitlist_length` stays one count per stake. `waitlist.moved` is unchanged (it reaches everyone at the stake, more than needed).
- **TV.** One column per table: every open table and a closed one somebody waits for, three to a screen, a page every ten seconds as the call-time board. It has no "Tables 1 to 3 of 5" line yet: `TvWaitlistBoard` has no page prop (follow-up).
- **Console.** A card per table on the v3 Waitlist screen (decision 0469).
