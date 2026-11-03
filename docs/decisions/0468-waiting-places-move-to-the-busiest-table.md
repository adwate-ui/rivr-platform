# 0468: Waiting places move to the busiest table of their stake

Date: 3 Nov 2026. Moving to one list per table (decision 0467) needs a table for every place already waiting. The lead's ruling: the busiest active table of the same stake.

- **The rule** (`20261107010000_waitlist_per_table.sql`). Among the stake's tables at the venue: active first, then the most players seated now, then the first in floor order (`position`), then the table the place was called to, then the one it asked for (0321).
- **No active table, safest reading.** The ruling's "active closed table" is already covered: an active table counts whether open or closed. With none active, the place goes to the stake's first table in floor order (not deleted first), so nobody loses their place; the floor removes and adds them elsewhere. When the migration runs no table is inactive yet, so this cannot happen on the day.
- **No table at all.** A place whose stake has no table has no list to be on and leaves it (`left`). None exist in the seed or, as far as the data shows, on production.
- **Left and seated places** are not touched; their `table_id` keeps 0321's meaning (the table asked for).
- **Practice venue.** The migration recaptures its seed, so a practice reset reloads places with their table.
