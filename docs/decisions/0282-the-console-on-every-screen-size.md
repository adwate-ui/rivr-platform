# 0282: The console on every screen size

Date: 28 Oct 2026. Issues #601 to #607; the owner's answers of 28 Oct: "Everything needs to be built immediately", "Phones can open everything since they are authenticated", "There is no club enrolled computer".

- **Every screen at 390, 768 and 1440 px.** The console was built for 1440 px. It now works on a phone and a portrait tablet as well. From the tablet breakpoint (1180 px) up, the rail sits beside the screen. Below it, a top bar names the screen, and its menu button opens the rail as a drawer. There is no bottom bar: it would need its own hand-picked screens for each role.
- **Phones open every screen the role allows.** Signed-in staff need no enrolled computer. The network and computer rules of decision 0110 switch on only when a venue sets staff networks in Settings, and no venue has. So nothing in the database changes.
- **Grouped by the job.** The groups are now Overview, Tonight, Cage, Players, Marketing, Money, Reports, Team and Admin, in the order of a club night.
  - Renamed: Owner is now Overview, Pot data is Hands, Accounts is Payment accounts, Tally is Tally export, Learn sources is Learn content.
  - Every screen keeps its address and its permissions.
- **The idle lock is marked on each screen.** It used to follow the Money group. Now each of the same 11 screens carries `locksWhenIdle`, and a test holds the list, so moving a screen between groups cannot change which ones lock.
- **Go to.** A field at the top of the rail finds a screen by name. Enter opens the first one found; Ctrl+K or / reaches it at a desk.
- **Checked by** the Console fits flow at three widths, and the shell's stories at phone and desk sizes.
