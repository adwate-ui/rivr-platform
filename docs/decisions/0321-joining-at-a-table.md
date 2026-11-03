# 0321: Joining at a table, on the stake's list

Date: 3 Nov 2026. The player redesign's join sheet is a table's (brief 3.4 B: "The waitlist is per table"), while the waitlist, its order, priority and the console's lists, is one list per stake (`table_type`), and the console's Assign (decision 0299) runs on it. The owner chose the minimal path.

- **What changes.** A member joins from a table's sheet with `join_waitlist_at(table, request id)`: the place goes on the stake's list, as `join_waitlist` puts it, and keeps the table asked for in `waitlist_entry.table_id`. `my_waitlist` names it ("Waitlist · Table 1 · NLH 50/100"), and `waitlist_board` gives it to the floor, whose Assign starts from that table when it is open.
- **What does not.** Ranking, priority, the Join request the floor approves (#633), the TV's board and the console's lists stay per stake. "Any table at this stake" is gone from the app; the floor may still seat the member at another table of the stake.
- **The seat call's answers.** "I'm on my way" is `accept_seat_call`, which keeps when the member said so (`waitlist_entry.on_way_at`); the floor's list shows "On the way". An answer counts for the call in force only: called again, or skipped and called, the place shows no answer until the member gives one. Decline seat is leaving the list, as before, which rolls the call on to the next name.
- **From the push.** The Seat ready push's "I'm on my way" opens Tonight at `/?accept=<place>`, which answers at once and cleans the address. It cannot answer from the lock screen without opening the app: a notification holds no sign-in, and the brief's background answer would need a token in the push (phase 2's native shell can do it, decision 0323).
- **Open.** Whether lists should be a table's own, with their own order, is a question for the owner (#777). Until then a table's "Waiting" in the join sheet is the stake's count.

Superseded where it keeps the list per stake by 0433 (one waitlist per table).
