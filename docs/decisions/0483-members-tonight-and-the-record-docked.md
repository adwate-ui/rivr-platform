# 0483: Members shows tonight and docks the record

Date: 3 Nov 2026. Console v3, phase 4 (Members), against `ConsolePlayers.dc.html` and `Rivr Console.dc.html`.

- **Tonight** comes from what the floor already reads: the floor's seats say where a player sits ("Table 2 · 3", in full "Table 2, seat 3"), the day's list says Waiting or Left, and a member not at the club shows a dash. No new read. Waiting is a gold dot, as on the door's list of today's players; a seat is cream and Left faint.
- **The record docks** in a 440 px panel at the right (`SplitView layout="docked"`), so the list keeps its share and names stay on one line (the screenshot index's "Kabir / Sethi"). The prototype's panel runs the full height to the screen's edge; ours sits inside the page's padding, as the frame gives every screen.
- **The record is in the address**: `/members?member=<id>&part=membership|account`. Back, a refresh, the floor's player sheet and the command palette open it. Its parts are tabs (links), no longer chips.
- **Show** on a seated member's record goes to `/?table=<table id>&seat=<n>`: the address the live floor reads to open that seat. The floor's rebuild (another helper's) must read it; until then Show lands on the floor.
- **The tier choice** is a row of chips (All tiers first), as `@rivr/ui` has no select (ui.md).
- **Every member is listed on open** (owner, 3 Nov, over this decision's first reading that the list waits for a search or a tier): the whole table, sortable, as in `ConsolePlayers.dc.html`. `members_of_tier` with no tier gives every member of the venue the console works in, at most 5,000, for staff who read members; the search (a name as typed, a member number, or four or more digits of the mobile) and the tier chips narrow it in the console. An export records "All members" when nothing narrows the list.
- **Export** is one quiet word beside the title, as the prototype has it, whose menu offers CSV and XLSX (`DataTable exportIn`).
- **Promotions given** show on Visits from `member_promotion_grants` (phase 7), newest first.
- Not built: the prototype's highlighted open row, and "Add to a waitlist" on the record.
