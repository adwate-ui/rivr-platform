# 0236: Rosters are shifts by job title, and attendance is one mark per shift

Date: 2026-10-27 · Task: #106 (scope-v1 module 10)

**Shifts.** A shift is one staff member on one club day (06:00 to 06:00 IST), from a start to an end, with the job title they held when it was rostered. A start before 06:00 is the small hours after the club day's evening; an end at or before the start is the morning after it (18:00 to 02:00). No shift runs past 16 hours. A staff member's shifts never overlap: adding one that would is refused whole (`RVOVL`), so the keeper sees the clash instead of half a roster, and roster changes at a venue take turns so two cannot both pass the check. Staff with `staff.manage` keep the roster; every staff member sees their own shifts and attendance.

**Adding a week.** The console adds shifts for the staff of one job title (all of them unless some are taken out) on the days chosen from today on, with one start and end: at most 200 staff and 14 days at once, and never a day already past. Copying brings the week before into the week shown, seven days on, skipping days already past, anyone no longer active and any shift that would overlap, and says how many it copied.

**Attendance.** Each shift is marked present, late or absent, with an optional note, once its club day has come; a later mark replaces the earlier one. The audit log keeps each mark's status before and after, never the note, which can say why someone was absent. A shift with attendance is not removed.

**Not here.** Onboarding checklists are #107. Pay, hours worked, swaps, and who may mark a manager's own attendance are not in #106's acceptance list.
