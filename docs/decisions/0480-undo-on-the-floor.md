# 0480: Undo on the floor is a compensating function

Date: 3 Nov 2026. Console v3 brief, phase 2: every mutating action shows a toast with Undo for 5 s; Undo calls a compensating RPC, never a client-side rollback.

- **Five seconds on screen, two minutes in the database.** A toast with Undo stays 5 s (`motion.duration.toastUndo`). Each compensating function takes back a change made in the last two minutes (`private.is_undoable`), by staff who may make it, never while the venue or member is frozen, and refuses (22023, or RVOCC/RVONE) once anything has moved on.
- **New functions.** `undo_seat` deletes a seat taken and not moved since, and puts the member back, uncalled, on the lists seating took them off; a call already rolled on stays rolled. `undo_leave` takes a seat left again unless the seat, the player or the room has moved on. `undo_call_time` restores the call time before an approval or the floor's addition (kept as `call_time_request.minutes_before`); a member's request waits again, a floor addition becomes `undone`. `undo_top_up` reopens a top-up done or reset, or takes a start back. `undo_waitlist_decision` makes an approved join a request again, or brings a declined one back.
- **Their own inverse.** A move is undone by moving back, Open/Close by the opposite, Must move to by what it was, Not leaving by marking leaving again.
- **What is not undone.** Messages already sent (a seat call, a seat released) stay sent. Letting a player go early is not undone at all (decision 0481).
- **Outbox.** Only `undo_call_time` writes an event, `call_time.updated` with the call time restored; the practice venue's never reach a consumer (`claim_outbox_deliveries`).
