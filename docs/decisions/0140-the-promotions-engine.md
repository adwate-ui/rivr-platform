# 0140: The promotions engine weighs each event on the club's day and gives whole rewards

Date: 2026-10-20 · Task: #83 · Question: #392

Days, time windows, first N per day and per-player limits per day use the club's day, 06:00 to 06:00
IST, as high hands do: a Tuesday window of 22:00 to 04:00 is one window, from its start up to, not
including, its end. First N counts the promotion's own grants that club day, at the member's table or
anywhere, not buy-ins (another lane's records): either way a day costs at most N grants. A new player
has no visit before this one; a lapsed one's last visit began at least the given days ago; visits in
the month are lane C's `visits_this_month`, closed visits this IST month. Hours played and the hand
(a high hand or a bad beat) come with the event from the lane that fires it.

A bonus share is of the member's own money (none on a buy-in paid from bonus, #392), rounded down to
whole ₹50 chips, then held to its cap; a bonus or points of nothing is no grant. A grant is whole or
not at all, never part of a budget. In priority order, one that does not stack is given only alone.
The engine carries out a bonus itself; points (#89), a spin (#150), a ticket, a cab, a prize, a jackpot
payout (the floor, through lane B's payout: the pool is players' money) and a message are grants their
owners fulfil, each announced by `promotion.granted`. A date window weighs everyone with an open visit
each minute, once a club day. Promotions switched off, or the venue or member frozen: nothing is given.
