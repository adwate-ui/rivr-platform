# 0469: The console's Waitlist screen (console v3)

Date: 3 Nov 2026. The owner's console v3 brief, Phase 3, on the lists of decision 0467.

- **Cards.** One card for each open active table, and for a closed active table only while someone waits on it or asks to join it: its list is its interest in reopening (decision 0184), with Open table. The brief says "one card per active, open table"; hiding a closed table's places would hide members who are still waiting.
- **Rows.** A place shows its tick, number, name, how long it has waited and what to know (priority, added by the floor, called, place held), one Seat and a ⋯ menu with Hold place or Release, and Remove from list. Seat seats a called member at the seat held for them, and opens the seat sheet (a free seat at the list's own table and a call time) for anyone else.
- **Adding.** "Add: mobile or member no." finds the member as Seat a player does: ten digits a mobile, one to nine a membership number (`add_to_waitlist` gains `p_member_number`).
- **Undo.** Every step says its outcome in a toast. Undo is offered only where a step has an exact inverse: Hold place and Release undo each other (not for a called place, whose call Hold ends), and Mark registered is undone by `unmark_tournament_registered`, within ten minutes of marking. Approve, Decline, Remove and Seat have no exact inverse (a place added back goes to the list's end), so Remove asks first instead.
- **Bulk bar.** Hold and Remove over the places ticked, on any table; Remove asks first, then Clear.
- **Copy.** The prototype's "One list per open table." under the heading is left out: `.claude/rules/copy.md` allows no subtitle under a heading. Counts are written "Places held: 2", as the catalogue has no plurals.
- **Tabs.** Lists and Tournament interest, held by the frame's tabbed screen (decision 0476) in the address (`?tab=lists`, `?tab=interest`); `/tournament-interest` opens the second.
