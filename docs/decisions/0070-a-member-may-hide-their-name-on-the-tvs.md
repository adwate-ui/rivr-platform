# 0070: A member may hide their name on the TVs, and the board shows their place

Date: 2026-10-20 · Task: #326 · Owner's answer to #320

Profile has "Show my name on the club's TVs", on by default, under a Privacy heading after
Notifications; the prototype has no such row. It is part of Profile, which is core (`core.profile`), so
every tier has it: it protects the member, it is not a perk.

With it off, `tv_waitlist_board()` returns their place with no name, so their name never reaches a TV,
and the TV shows "Player N", N being that place. Changing it tells the venue's TVs to read the board
again, as a change to the list does. Only the TVs are affected: the console's waitlist and the floor
still name the member, as staff need to call them.
