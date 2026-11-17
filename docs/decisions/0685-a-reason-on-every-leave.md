# 0685 A reason on every leave

Date: 17 Nov 2026. Issue #1060. The owner's ruling of 17 Nov: ask a reason on every leave, with "Call time met" picked already when the time is met.

The floor's leave sheet asked a reason only to let a player go before their call time, and kept it as words on the early departure. Now every staff action that ends a seat asks why, from one list (`LEAVE_REASONS` in `@rivr/contracts`, words in `common.leaveReasons`): Call time met, Busted, Emergency, Unwell, Table broke, Floor decision. "Call time met" is picked already when nothing is owed; owing, nothing is picked. The dealer tablet's Player left asks the same before its confirmation.

The reason is kept on the seat as a code, `seat_session.leave_reason`, through a third argument of `end_seat` (optional, so an app not yet updated still works). The early departure keeps its words as before. A member who leaves from the app owing nothing gets `call_time_met`, as staff screens pick it for a seat owing nothing. Nothing ends a seat by itself any more (a table with players is not closed). Undo of a leave forgets the reason. The member record's Visits shows why they left each table of a visit, in order.
