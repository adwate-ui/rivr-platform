# 0549: The website editor's actions, and published tournaments for staff

Date: 9 Nov 2026 · From the 180-day audit of 8 Nov (I-81, I-82, I-83).

**The editor's actions stay at the top of it,** with when it was last saved. The audit offered the preview beside the fields or behind a toggle. The page list already takes a column, so the preview is behind a toggle. Publishing later asks for a day and time only when wanted, which keeps the bar one line.

**Fields read as the page does.** Each kind of block has its own order, read from its `<Kind>Block`, and each list's items theirs; a key not listed goes after those that are, so none is dropped. Each item of a list of things has its own heading.

**A role with one tab of a screen keeps the rail's name as its title,** and the tab's own title is heard as the second level, as with several tabs.

**Staff and members read one list of tournaments,** `private.upcoming_published_tournaments(venue)`. Home shows its first twenty; staff see all of it, so a card and the badge never disagree. Staff see two more kinds besides. One that has started stays for a day, as the floor's list of who asked keeps it, so whoever pays late can be marked; it can no longer be edited or withdrawn. One withdrawn and still to come stays, marked Withdrawn, with who asked, and can be published again; `tournament.withdrawn_at` tells it from a draft. Nothing can be marked on a withdrawn tournament, which the database refuses, so the Waitlist badge does not count it. Withdrawing tells nobody: whether members who registered should be told is the owner's question.
