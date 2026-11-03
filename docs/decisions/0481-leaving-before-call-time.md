# 0481: Leaving before call time takes one of four reasons, and is not undone

Date: 3 Nov 2026. Console v3 brief, phase 2: leaving with call time owed needs one of Emergency, Unwell, Table broke or Floor decision, and the reason is written to the member's record.

- **Who.** As decision 0306: staff with `call_time.override` (the floor, cashiers, admins, super admins) pick a reason and press Let go early; other floor staff (hosts) see no reasons and press Leave owing, which frees the seat with the call time still owed, with Undo. With the call time met or none given, Leave is "Yes, they leave", with Undo.
- **The record.** The reason's words go to `let_leave_early` as today, so the early departure on the member's record reads "Table broke" with the staff member's name. The database still takes any reason of 3 to 500 characters, as the Leaving list and the cage's forms did (#79); the four words are the floor's only choices. Then the seat is freed (`end_seat`), as `EarlyLeaveForm` did.
- **No Undo.** An early departure is the cage's authority to cash a player out without their call time, and its rows are never changed or deleted (`early_departure_never_changed`). Undo would leave the waiver standing on a seat taken again, so this one change shows its toast without Undo. The red Let go early button and the reason it needs are the confirmation. The same holds for Record on a player who already left owing.
- **Question for the owner:** whether a mistaken early departure should be withdrawable by a super admin (a new append-only withdrawal the cage reads). Not built.
