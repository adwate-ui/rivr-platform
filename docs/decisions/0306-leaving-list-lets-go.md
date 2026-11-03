# 0306: The Leaving list lets a player go, owing or not

Date: 3 Nov 2026. The owner, 3 Nov: the admin could not approve a leaving request, because the only option was Not leaving. This changes decision 0302's "Leave once the call time is done".

- **Leave on every row.** Each player on Live floor's Leaving list has Leave and Not leaving, for the floor (waitlist.manage). Leave works exactly as on the seat's row (decision 0299):
  - **With the call time done**, or none: Leave frees the seat, after a confirm.
  - **With time still owed, staff with the override** (call_time.override: the floor, cashiers, admins, super admins): Leave opens the early departure form. The reason is kept on the member's record with the staff member's name, and the seat is freed with nothing owed (#79).
  - **With time still owed, other floor staff** (hosts): Leave frees the seat, and the member leaves owing, on Left before call time, as on the seat's row.
- **Unchanged.** Not leaving takes the player off the list. Nothing in the database changes: the same functions let a player go from the seat's row.
