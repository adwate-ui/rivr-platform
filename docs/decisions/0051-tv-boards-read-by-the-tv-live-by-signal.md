# 0051 A TV reads its venue's boards through its own functions, and a signal row keeps them live

Date: 19 Oct 2026. Task #65.

The TV's waitlist board shows players by name, so it cannot come from the `public_*` views, which are counts only and never the practice venue.

**Reads.** A paired TV reads two functions, for its own venue only (`current_tv_venue_id`):
- `tv_waitlist_board`: every stake, smallest first, with the tables open at it and each place in the floor's order, priority included. A player is a first name and the initial of the last ("Kabir S."), formed in the database, so a full name, number or member id never reaches a TV.
- `tv_jackpot`: the main pool and tonight's best high hand.

Staff, members, tablets and signed-out callers get nothing. A TV at the practice venue shows the practice venue's boards, so training uses its own TVs.

**Live.** Realtime delivers row changes only from tables the subscriber can read, and a TV reads no waitlist or ledger table. So `tv_signal` holds one row per venue and board. Triggers touch it when:
- a waitlist entry changes;
- the main jackpot pool moves (a drop, a payout or a reversal);
- a high hand is approved.

A TV subscribes to its venue's rows and reads the board again when one moves. It also reads every half minute, in case a signal is missed while its connection drops.

**Rejected:**
- Opening the waitlist table to TVs through row-level security, which would hand every TV full names and member ids.
- Polling alone, which the task's "live through Realtime" rules out.
