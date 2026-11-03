# 0360: A waiting place on the lock screen is read when its list moves

Date: 3 Nov 2026. Decision 0323 left `waitlist.position_changed` open (#778): emit it per member, or derive it. Phase 2 derives it.

- **One event per list move.** A trigger on `waitlist_entry` emits `waitlist.moved` (`waitlistMovedSchema`: place, member, list) when a place joins, is approved, sits or leaves (`left_at`). A call moves no place; `waitlist.called` already says it. No waitlist function changed, and no per-member fan-out happens in the database.
- **The consumer reads, never trusts the event.** On `waitlist.moved` the live-status consumer refreshes everyone waiting on that list tonight; on any other event, the member alone. What each phone shows is read at send time (`live_status_of`), so a late, repeated or backfilled event never shows anything old.
- **Only a change goes.** The device row keeps what the phone shows (`shown`); a phone whose status is unchanged hears nothing, which keeps Apple's Live Activity budget for the seat call.
- **Ends.** Leaving or losing a place, or `seat.left`, reads as nothing to show and ends the status. A hold that runs out with no event counts down to nought on the phone and goes stale there; the next event of its list reads it as waiting again.
- **Not covered.** A place moved by priority alone, with no entry changing, waits for the list's next move.
