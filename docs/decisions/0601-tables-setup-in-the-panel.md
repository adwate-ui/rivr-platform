# 0601. Tables setup in the panel

Redesign RD-17 (#960), owner 15 Nov. Decided while building.

- **New and Change open the right-hand panel** (`Sheet place="console"`), for a stake and for a table; the forms under the rows are gone. A save says so in a toast ("Table 6 added, closed.") and closes the panel; a refusal stays in the panel.
- **A row has one button, Change, and a menu.** A table's menu: Open or Close for tonight (the floor's `set_table_open`), Deactivate or Reactivate (decision 0466 stands: the render shows fewer steps, which removes none), and Delete. A stake's menu: Delete.
- **A stake is deleted for good, and only when nothing points at it.** `delete_table_type` refuses a stake a table plays, a deleted table's history included (RVUSE). Delete is dimmed for a stake a listed table plays; the history case is told after the database refuses, as setup does not list deleted tables. Its settings stay under its code, which no later stake takes (decision 0600).
- **The call time is typed in minutes**, 1 to 1,440, the unit the setting `call_time.minutes` holds, so a stake at 90 minutes can be kept. The list shows it as a length ("3 h").
- **The minimum buy-in is typed in rupees, a whole ₹50** (decision 0600), behind a ₹, the one rupee sign on the console (owner, 15 Nov). It is filled in at 50 big blinds when a stake is chosen, until the admin types their own; a table keeps its own figure while its stake stays.
- **The forms keep the feature's plain state**, as before and as every console panel form on main, not React Hook Form as `.claude/rules/apps.md` asks: a `question` issue asks which is right. One save at a time: a second press while the first is on its way sends nothing. A refusal stays until a field is edited.
- **Staff who set up tables but do not change settings** see "Call time: not in your role. Ask an admin." in place of the field, and their stake is saved without one (decision 0600).
- **With no stakes yet the New stake panel is open**, as the form was before.
- **The console's sheet gives the focus back** to what had it when it opened, such as a row's Change, for every console sheet.
- **The straddle in a stake's name.** Where blinds are written from figures the straddle is written with them (setup's list, the player's rows and join sheet, the Live floor, the Waitlist). Where a stake is shown by the name the admin typed (the seat screen, the TVs, the Tables report, past sessions, the tablet) it is that name, and those reads carry no straddle: changing them is a database change of its own.
