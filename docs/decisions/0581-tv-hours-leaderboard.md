# 0581. An hours leaderboard on the TVs

The owner, 12 Nov (#907): "a leaderboard view on TV that shows the name and hours played for members (top x or meeting a cutoff), the setting in console". The owner's answers: the period is chosen on the console, and a member who hid their name shows as "Member #17".

- **The board:** a TV mode, `leaderboard` ("Hours leaderboard"), for a TV's main board or its rotation, titled "Most hours played". An empty board in a rotation passes on (D-03).
- **The setting:** `tv.leaderboard`, under Settings, Floor, for whoever changes floor settings:
  - the period: tonight, this week, this month or all time;
  - the top N places (1 to 12, which fill the board's two columns of six), those past a number of hours (1 to 500), or the top N of those.
  - None set is tonight's top 10. Past a cutoff with no top, the board shows what fits and "+N more".
- **Hours:** a seat's time less its time away (`private.minutes_played`), whole minutes. A seat counts in the period it began, and a seat still going counts to now. Periods run in the club's days from 06:00 IST: the week from Monday, as `weekOf`; the month from the first, as `league_month`.
- **Ranking:** most minutes first, ties sharing a place (1, 2, 2, 4).
- **Who:** erased and self-excluded members are left out. Names are a first name and initial. A member who hid their name shows by member number, the one exception to the TVs never showing a number (`tv_boards.sql`), at the owner's word.
- **Reads:** the TV reads `tv_leaderboard` every half minute, as hours grow while members play; it sends no signal of its own. Only a TV showing the board reads it (`tv_showing`); the ranking function itself is closed to every caller.
