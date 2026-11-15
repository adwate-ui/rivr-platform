# 0609 One member's counted hours, reset

Date: 15 Nov 2026. Issue 979 (redesign RD-36; the owner, 15 Nov: "option to reset hours by players", one member, everywhere).

- The member keeps one moment, `member.hours_counted_from` (null: from the beginning). A super admin moves it to now from the record's Visits, with a reason of 3 to 200 characters, asked twice (`reset_member_hours`). No new table and no new permission: the check is the staff member's role, as for a change of number. The audit log has `member.hours_reset` with the moments before and after and the reason, so Activity shows who, when and why.
- The rule (`@rivr/domain` `countedSeconds`, twin `private.counted_seconds`, golden `hours.json`): time played before the moment counts for nothing; a stint that straddles it counts for the share of its played time that came after, by the clock, rounded down. It is the share rule a session that moved tables already uses, since time away is not known by the minute.
- What counts from the moment: the TV's hours leaderboard (`hours_leaderboard`), a play-time Bonus (`visit_hours`, `visit_schedule_time`, `visit_schedule_time_at`, `visit_window_time`) and the Members list's Hours (`members_of_tier`).
- What does not change: every visit on the record with its own time, the member's own session history in the app, and every report by date. Nothing is deleted or rewritten.
- A play-time Bonus already paid is not taken back: no grant is touched. A step reached before the reset is not paid again: a step is settled once a visit, whatever the hours then read. The reset first weighs the open visit, so a step reached in the last minute is paid before the count starts again.
- Taken as the safest reading, for the owner to confirm in a question issue: the member's own app keeps its session history and its month's totals as they were, by date. Only the leaderboard, the Bonus and the console's list start again.
- The promotion simulation replays past visits through the same functions, so after a reset it counts that member's earlier hours as nothing too.
