# 0161: Points are earned when a visit closes, for hours by stake and for a share of rake

Date: 2026-10-20 · Task: #89 · Question: #395 (the safest reading, until the owner answers)

- **When:** once per visit, as `private.close_visit` closes it; a seat still open then counts to the close. Each earning is kept in `points_earning`, so points reconcile to the ledger and to seat sessions. A close is a write, refused while the venue or member is frozen.
- **Hours:** `points.per_hour` per table type (a table type is a stake; rake and call time are keyed the same way) for time played on the call-time clock, seating to leaving less time away. A moved session earns each table's rate for its time there; time away is not recorded by table, so each table bears its share. Rounded down once per table.
- **Rake:** the tablet does not record who was dealt in, so each hand's rake is shared equally among the members seated at its table when it was played, rounded down to the paisa. The member earns `points.rewards_rake_share` (500 basis points) of their share, one point a rupee, rounded down. A hand an offline tablet sends after the visit closed earns nothing (asked on #395).
- **Out:** only through `private.debit_points` (a redemption), never below nothing, never as cash. `venue.points_issued` nets redemptions until the catalogue (#145) needs its own account.
- **Lanes:** lane B's `private.seated_hours` and lane A's rake by member are not built, so points read seat sessions, moves and hands directly (`private.session_tables`); those functions should take this over when they arrive.
