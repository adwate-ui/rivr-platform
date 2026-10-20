# 0069: Profile's stake comes from the club's table types, for every member, with Any

Date: 2026-10-20 · Task: #206

Profile's waitlist alerts take a stake from the stakes the member's club runs: every table type's blinds
at their own venue, each once, smallest first, through `public.my_stakes()`. Profile is core, so this
asks no tier, unlike reading `table_type` itself, which needs `floor.live_view`; and a login that is
also staff at another venue gets only its own club's stakes.

The prototype shows the stakes alone. An Any chip is added first, as the session reminder has None, so
a member who chose a stake can go back to alerts at every stake (both blinds null). A stake saved that
the club no longer runs keeps its chip, chosen, so the member can see it and change it.
