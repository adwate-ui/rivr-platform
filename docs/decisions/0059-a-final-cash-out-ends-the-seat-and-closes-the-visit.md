# 0059 A final cash-out ends the seat and closes the visit

Date: 20 Oct 2026. Task: #76.

- The cashier marks a cash-out final when the member is leaving the club. In one transaction it ends their open seat, if they still have one, and closes their open visit (`close_reason` `cash_out`), emitting `seat.left` and `visit.closed`.
- Why not refuse while seated: the seat session already allows `end_reason` `cash_out` (#77), and additions flow 13 has a player cashing out before call time, so still at the table. Making the floor press "leaves" first would add a step, and a chance to forget it.
- Call time: `private.call_time_shortfall` reads the open visit, so it is 0 once the visit closes. #79 therefore checks the shortfall inside `private.cage_cash_out`, before the seat ends and the visit closes.
- Whether a cash-out was final is kept on its cage transaction (`is_final`). A retried request id does the cash-out and the leaving once; the same id with Final changed is refused, so nothing is paid twice and a late retry never closes a later visit.
- A buy-in the member asked for from that seat is withdrawn, as when they leave the table.
- After a final cash-out, the member has no open visit, so a further cash-out is refused (`RVOUT`) until they are checked in again.
- `private.close_visit(member, at, reason)` is the lane C contract's function. The door's check-out (#82) uses it too.
