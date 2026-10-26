# 0182: The RIVR League: hours at the tables and tournament finishes, by club month, seasons add up

Date: 2026-10-26 · Task: #147 · Question: #452 (the safest reading, until the owner answers)

**Cash.** A month's League points from cash play are what the member's visits earned for hours at the tables (`points.per_hour` by stake). They come from `points_earning`, so they reconcile to seat sessions. The RIVR Rewards rake share is rakeback, and promotion points are extras, so neither counts.

**Tournaments.** `private.award_league_points(tournament, member, place, at)` gives each finish its points once. The venue's `league.points` sets them:

- every finisher gets the points for taking part;
- first, second and third get their own points on top;
- fourth to ninth (the rest of the final table) get the final-table points.

Every tournament counts. Lane B calls this function when a tournament finishes (#149), instead of `private.credit_points`. League points are a leaderboard, not points to redeem.

**When.** Points belong to the month of the club's day, 06:00 to 06:00 IST (`leagueMonth` in `@rivr/domain/league`, proved equal to `private.league_month`).

**Seasons.** A season (`league_season`) is a run of whole months that overlaps no other. Its championship adds the months up. Ties share a place (1, 2, 2, 4), and the top place when the season ends is the champion. Standings are computed from `points_earning` and `league_finish`, not kept as a table.

**Who sees what.**

- The console shows full names to staff who read members or keep rewards.
- The TVs, the website (`public_league_table`, never the practice venue) and other members see a first name and initial, and no name for a member who hid theirs on the TVs (#326).
