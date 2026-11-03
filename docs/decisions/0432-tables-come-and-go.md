# 0432: Tables come and go: deactivate, reactivate, delete

Date: 3 Nov 2026. Console v3 brief, Phase 6 "Tables": a table can be deactivated (hidden from everything live, history kept), reactivated (back, closed) or deleted (refused while players are seated or waiting; history kept for reports).

- **Data.** `game_table.active` (default true) and `game_table.deleted_at`. A deleted table is inactive and an inactive one closed (checks), so nothing that needs an open table reaches either. Deleting is soft: hands, seats, runs and money rows keep their table.
- **Who.** `tables.manage` (the super admin and admins), not while the venue is frozen, audited by `game_table`'s audit trigger: `deactivate_game_table`, `reactivate_game_table`, `delete_game_table`. Each again is nothing; a deleted table is never reactivated, deactivated or changed (22023).
- **Refusals, safest reading.** Deactivating refuses like deleting: a player seated (RVSTD) first, then a place waiting on the table's list or called to it (RVWTG). @rivr/domain `tableRetireRefusal` is the rule; `private.assert_table_empty` its SQL twin. The brief named the refusal for Delete only; a deactivated table with players on it would hide them from the floor.
- **Live reads.** Members read active tables only (RLS); staff read every table not deleted, so setup lists inactive ones marked. `useFloorTables`, `floor_open_seats`, `floor_tonight`, `waitlist_lengths`, `interest_lists`, `tv_waitlist_board`, `public_table_status` and joining or adding to a list take active tables only. History (`games_history`, reports) keeps them.
- **Side effects.** Deactivating or deleting clears the table's must-move links both ways; opening an inactive table is refused (22023).
- **Not done.** A deleted table keeps its name (`game_table` names stay unique per venue); a dealer tablet fixed to an inactive table stays fixed. Both are follow-ups if the floor asks.
