# 0204: Tournament seating, alternates, balancing and bust-outs

Date: 2026-10-26 · Task: #120 (and #118's alternates)

A tournament is played in a room the floor sets: 1 to 30 tables of 2 to 10 seats each (default 6 of 9). Seats are numbered within the tournament, not tied to the cash tables.

- **Random seating.** A new entry gets a random free seat at one of the tables with the fewest players among those with a free seat (`eligibleSeats`, twin `private.tournament_eligible_seats`, golden `tournamentSeating.json`). Nobody picks a table.
- **Alternates.** With every seat taken, the entry is an alternate: paid, and waiting. When a player busts, the oldest alternate takes a seat at once. An alternate may be refunded (decision 0203). We chose to take payment at registration because the cage already has the money when a seat opens.
- **Balancing prompts.** While the fullest table has two or more players than the emptiest, the console asks the floor to move one player from the fullest to the emptiest, lowest-numbered first on a tie (`balancingMoves`, twin `private.tournament_balancing_moves`). The floor chooses the player, and the move takes a random free seat at the target. Breaking a table as the field shrinks is the floor's call and is not prompted yet.
- **Bust-outs.** Busts are kept in order. A run's place is worked out when it is read: the number of runs that were not refunded, minus the run's rank among the busts, plus one (`finishPlace`, twin `private.tournament_finish_place`). The first out of 58 is 58th. A late entry adds a run, so places never repeat. A re-entry is a new run, with its own place when it busts.
- **Rebuys and seats.** A busted player's rebuy (rebuy format) puts them back in a free seat. With none free, the rebuy is refused (`room_full`). An alternate is therefore always a run that never sat, and a refund only ever returns buys that were never played. A refunded run counts for nothing: it is not counted toward buys, and the member may enter again.
- **The field.** It counts entries, re-entries, players seated, the chips bought and the pool, leaving out refunded alternates. The average stack is the chips over the players left (`averageStack`).
- **Where it shows.** The console, the TVs and Home show the field. Home also shows the member their own seat, alternate status or bust-out, and offers what they may buy now.
