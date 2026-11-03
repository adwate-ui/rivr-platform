# 0465: The console v3 frame and its parts

Date: 3 Nov 2026. The console v3 brief, phase 0. It changes decision 0282's frame.

- **One shell.** The brief's `AppShell` is `ConsoleShell`, reworked; `SideNav` is its rail. The rail is 224 px with labels or 64 px of icons. It folds to icons below 1200 px, and the staff member's own choice is kept on the device (`localStorage`, key `rivr.console.rail`). Below 768 px a tab bar holds the app's tabs and More, which opens every screen; the drawer and Go to are gone. The palette replaces Go to.
- **The header takes slots.** `search`, `pulse`, `clock` and `account`. The app builds the user menu; @rivr/ui has none yet.
- **Reuse before adding.** `NavItem` and `NavGroup` are SideNav's parts and stay inside it: the app passes data. `ChipGroup` is `ChoiceChips` `look="subtle"` with a `count`. `EmptyState` is `Screen`'s `emptyAction`, as ui.md keeps empty states in Screen. Pill tabs, the console sheet, the toast's place and the skeleton's rows and tiles are props on the parts that exist.
- **TableTile is new beside TableCard.** TableCard draws a seat ring with rake and pace, which decision 0284 took off the console, so a variant would share nothing. TableCard goes once the floor moves to TableTile.
- **DataTable keeps phone cards by default.** `narrowLayout="scroll"` is the brief's sideways scroll with the first column held. Today's screens keep cards until each is rebuilt.
- **Motion.** A new request's gold tint fades over 2.5 s; the console's sheet slides in from the right from 768 px.
