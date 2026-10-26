# 0184: An interest list is the waitlist of a game not running

Date: 2026-10-26 · Task: #113

The spec asks for interest lists that open a new table "when enough players are waiting". The waitlist already holds members per game and stake, in order, with priority, calls and holds (#38, #54).

We built the interest list as that same waitlist, while none of the game's tables is open. There is no `interest_list` table.

- **Members.** On Home, a closed table's Join registers interest in its game, and the line under it says how many are interested.
- **Floor.** The floor adds members by number, as for any list.
- **Opening.** The venue sets `waitlist.interest_to_open`: how many waiting tell the floor to open a table. The seed sets 4; with none set, the floor is never told.
- **Console.** Waitlist shows "Not running · N interested". Once enough wait, a floor manager (`floor.manage`) opens one of the game's tables there.
- **Order.** When the table opens, the list is the waitlist again. Whoever registered first is called first.

Why one list: a second list would need its own priority, calls and a move onto the waitlist when the table opened. That is two ways of doing one thing (CLAUDE.md rule 6).
