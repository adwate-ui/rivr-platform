# 0250: Tournament satellites and their tickets

Date: 2026-10-28 · Task: #117 · Question: #489 (answered "as recommended"), #517 (TDS on a ticket, open)

- **A satellite** is a tournament the floor points at a target event at the same venue, before its clock starts (`set_tournament_satellite`). It has no bounty, and its places' shares are not used.
- **Seats.** The prize pool (with any overlay its guarantee needs) divided by the target's buy-in, rounded down, never more than its runs (`satelliteSeats`, twin `private.tournament_satellite_seats`, golden `tournamentPayouts.json`). The floor finishes it played out, once no more players are left than the seats (one when there are none); there is no deal.
- **What the finish pays.** Each run that finished in a seat gets a ticket worth the target's buy-in, and the seats' value moves from `venue.tournament_pool` to `venue.tournament_tickets` (players' money). What is left is paid in cash to the next finisher, as a prize. When every run has a seat there is no next finisher, so the last seat is paid it: our reading of the owner's alternative.
- **A ticket** pays one entry into the target, its fee included, from the tickets held: from the app by the member, or at the cage by a cashier with no cash taken. It has no cash value and never moves to another member. A member who wins two (two runs in the seats, or two satellites) uses one; the other lapses.
- **Lapse.** A ticket still held when the target's registration closes, or the target finishes, is refunded to the wallet within the minute. An alternate who entered with a ticket and is refunded gets the ticket back. A held ticket blocks erasure, as an unfinished tournament does.
- **TDS.** Until #517 is answered a ticket carries no TDS (TDS is switched off everywhere, so nothing is under-withheld today). The leftover cash is taxed as any prize.
- **Not yet built.** The console's satellite setting and the app's ticket screens come with the tournament screens; a target that never starts keeps its tickets held.
