# 0051 A TV reads its venue's boards through its own functions, and a broadcast keeps them live

Date: 19 Oct 2026. Task #65.

The TV's waitlist board shows players by name, so it cannot come from the `public_*` views, which are counts only and never the practice venue.

**Reads.** A paired TV reads two functions, for its own venue only (`current_tv_venue_id`):
- `tv_waitlist_board`: only while the TV shows the waitlist board. It gives every stake, smallest first, with the tables open at it and each place in the floor's order, priority included.
  - A player is a first name and the initial of the last ("Kabir S."), formed in the database, so a full name, number or member id never reaches a TV.
  - Dots, hyphens and underscores split names as spaces do; a single name stays whole.
  - Showing names at all is question #320: the spec's rules keep personal data off public surfaces, while the design prompt and the task ask for names.
- `tv_jackpot`: the main pool and tonight's best high hand.

Staff, members, tablets and signed-out callers get nothing. A TV at the practice venue shows the practice venue's boards, so training uses its own TVs.

**Live.** The database broadcasts on the venue's private Realtime topic, `tv:<venue id>`, with `realtime.send`. A broadcast is sent when:
- a place joins, goes, is called or steps away;
- a table opens or closes;
- the main jackpot pool moves;
- a high hand is approved.

The message names the board and nothing else. A policy on `realtime.messages` lets only the venue's TVs subscribe. Being a message rather than a shared row, it puts no busy path in line behind another.

A TV reads the board again two seconds after a signal, however many follow, so a burst costs one read. It also reads every half minute, in case a signal is missed while its connection drops.

**Rejected:**
- Opening the waitlist table to TVs through row-level security, which would hand every TV full names and member ids.
- A signal row per venue published to Realtime. It made waitlist changes wait on one another (a deadlock in review), and its deletes and the signed-out channel leaked.
- Polling alone, which the task's "live through Realtime" rules out.
