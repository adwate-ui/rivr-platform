# 0449: The Live floor screen, built from what @rivr/ui has

Date: 3 Nov 2026. Console v3 brief, phase 2. Where the prototype and the library differ, the library wins and the difference is kept small.

- **Layout.** `DockedPanel` (new) holds the screen and the requests docked at 320 px, folding to a 52 px strip with its count. It is open from 1200 px and folded below until the staff member chooses; below 768 px there is no panel and `/requests` is its own screen. The frame passes `isFullBleed` on `/`, so the panel reaches the edges.
- **Choices are chips.** Names next on a list, tables, seats, call times and leave reasons are `ChoiceChips look="subtle"` (the prototype draws names and reasons as full-width rows; ChoiceChips is the lead's to change). The prototype's selects (move to a table, must move to) are chips too: the library has no Select (ui.md).
- **Gold.** Seat a player is the screen's one gold button; a sheet's confirm is gold, Let go early red. The call time's bar is cream (`ProgressBar tone="muted"`), as only what needs the floor is gold (decision 0429). A player's own ask in their sheet is `RequestItem look="ask"`.
- **Call time.** The sheet says the time left and "Since 19:20"; not the prototype's "3 h in all", as `floor_seats` gives no total. The floor's form that set a call time's total (#638) is not on the v3 floor; Add time is.
- **Leave** in the sheet's foot is a text button, not red text: Button has no red text variant.
- **Keys.** `A`, `D` and `S` go through the console's registry (`useShortcut`, decision 0445), each only while there is something to do; Seat a player's tooltip names S.
- **Toasts.** The frame's `ToastProvider place="console"`; a toast with Undo stays 5 s on the console only (the player app keeps 3.2 s).
- **Needs you** has its gold dot (`Button hasDot`). **Also waiting** shows only the lines with something waiting.
