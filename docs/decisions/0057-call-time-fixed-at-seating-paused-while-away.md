# 0057 Call time is fixed at seating and paused while away

Date: 19 Oct 2026. Task: #78. Owner question: #336.

- **When it starts.** Call time runs from seating (`seat_session.started_at`) and carries across table moves and seat changes, which keep the same session.
- **How long.** The minutes are the table type's `call_time.minutes` in force at seating, and they stay fixed for the session. A move to a table with a longer call time does not lengthen it. This is the safe reading until the owner answers #336. A table type with no setting has no call time.
- **Time away.** Time marked away on the tablet or the floor (#59) does not count: the clock stands still until the player is back. Without this, a player could step away and sit out their call time.
- **Shortfall.** After leaving, the time left is frozen at the moment they left. The cage (#76) and the door (#82) read it through `private.call_time_shortfall`, for the member's visit tonight only.
- **What the member sees.** Home always shows the member's own seat, as their waitlist places are never gated (decision 0040). The time left needs `call_time.view`: without it, the database leaves it out and Home shows the locked notice.
- **Completion and reminders.** A pg_cron job every minute emits `call_time.completed` once per session (also as a player leaves, should they complete within the minute), and `session.reminder` once a member has been seated as long as their reminder (#56, decision 0053). Seated time for the reminder counts from seating, away time included.
- **Seeds.** Local and staging seed an hour for the cash games and two hours for the Private Room. Production's minutes are set by the owner.
