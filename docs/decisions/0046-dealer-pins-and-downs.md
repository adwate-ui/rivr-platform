# 0046 Dealer PINs are set by whoever may grant the dealer's role; a PIN sign-in starts the down

Date: 19 Oct 2026. Task #41.

A dealer signs in on the tablet fixed to their table by picking their name and entering a four-digit PIN (design prompt: "dealer PIN pad"). The PIN is kept as a bcrypt hash in lane 0's `staff_credential`, which no client role can read. Many dealers never sign in anywhere else (`staff.user_id` is null for them), so someone else sets their PIN: staff with `staff.manage` who may grant the dealer's role (`can_grant_role`). A dealer's role logs hands, which an admin's does not, so an admin cannot set a dealer's PIN: it would let them log hands as the dealer. In practice the owner and the general manager set PINs. A dealer changing their own PIN is a follow-up.

Five wrong PINs lock that dealer's PIN for 15 minutes; a new PIN unlocks it. The count is returned, not raised, so it is kept. Signing in starts the dealer's down at the tablet's table and ends the down before it there, and the dealer's own down at any other table: on and off times stamp themselves. End of down stamps the off time; its drop-box count is #44's. Nothing starts while the venue is frozen.

The tablet lists the dealers who have a PIN at its venue; their names are on the floor anyway.
