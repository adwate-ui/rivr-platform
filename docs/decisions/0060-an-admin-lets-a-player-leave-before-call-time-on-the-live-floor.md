# 0060 An admin lets a player leave before call time, on the Live floor

Date: 20 Oct 2026. Task: #79.

- Flow 13 needs two people: the cashier sees the shortfall, and an admin's override with a reason lets the cash-out through. Cashiers hold `cage.transact` but not `call_time.override`; admins hold the reverse. So the override is its own step, `public.let_leave_early(venue, member, reason)`, on the Live floor's seat row ("Leave early"), where admins already work. It is not a field on the cage form.
- The override records the early departure at once. The record holds the seat that owed the time, the shortfall then, the reason and the admin. A cash-out, or later the door's check-out (#82), goes through while that seat's early departure exists. One record per seat session; a second override keeps the first.
- The owed seat is #78's: the open seat, or the last one left during this visit. A player who left the table early still owes the time at the cage.
- The check runs inside `private.cage_cash_out`, after the freeze and KYC checks and before any money moves, so a final cash-out can't close the visit first (decision 0059).
- `early_departure` is lane B's table (contract). #79 is its first writer and creates it. #80 shows the count to admins on the member record and makes completed call time a promotion condition.
