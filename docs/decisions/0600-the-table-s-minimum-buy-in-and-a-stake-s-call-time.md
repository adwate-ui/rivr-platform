# 0600. The table's minimum buy-in, and a stake's call time

Redesign RD-16 (#959), owner 15 Nov. Decided while building; the first three are the issue's, the rest are mine.

- **The minimum buy-in is the table's.** `game_table.min_buy_in_paise`: integer paise, required, above zero, no maximum, no default. Existing tables took their stake's figure. It is a whole ₹50, as the stake's column was and as every buy-in on the floor is: the issue asks only for above zero, so this is the safest reading, taken while the owner is asked (the `question` issue named in the pull request).
- **50 big blinds is a suggestion, made in TypeScript only.** `@rivr/domain` `suggestedMinBuyIn` fills the form; the database stores what is saved and computes nothing, so there is no SQL twin. A console open on an older build that adds a table sends no minimum and is refused; one that changes a table keeps the table's own.
- **A stake has a call time or no table plays it.** `add_table_type` no longer writes three hours. It takes the call time; without one the stake has none, and `add_game_table` and `set_game_table` refuse it (RVNCT). The check is in those functions, not a trigger: the seed and the practice reset write tables before their settings.
- **The stake's two buy-in columns stay.** The cage's buy-in functions, the bonus redemption and `private.tablet_seats` before this read `table_type.buy_in_min_paise`; the cage is being removed in other pull requests, which can drop the columns once nothing reads them. The public view keeps `buy_in_max_paise`, never below the minimum, for a website built before this.
- **The website shows one figure a stake:** the least of its tables' minimums, as "Min buy-in".
- **A stake's code skips one any setting is kept under**, so a stake made after another was deleted never inherits its call time, rake, rakeback or anything else keyed by the code.
- **A call time is a setting, so writing one needs `settings.manage`**, with its staff-network and enrolled-computer rule, as in Settings: `tables.manage` alone adds and changes a stake but sends no call time. Every seeded role that sets up tables changes settings too.
- **The public table read gives no count of seats taken.** `public_table_status.seats_taken` stays in the view, empty: nobody signed out, and no player, sees how many are seated (owner, 8 Nov and 15 Nov), and nothing read it.
- **A blind or straddle is at most ₹1,00,00,000**, refused as any blind that does not fit, so a hundred big blinds never passes what a bigint holds.
