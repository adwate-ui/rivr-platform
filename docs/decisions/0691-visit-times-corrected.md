# 0691 A super admin corrects a visit's times from Reports, in the call Bonus approvals uses

Date: 18 Nov 2026. Issue #1075. The owner: allow editing a player's session details in Reports (in, out and away times), and keep the player's session edits in sync.

- **One call.** `correct_visit` moves a visit's check-in and check-out, and each seat's end and time away, with one reason. Bonus approvals' correction (decision 0687) now goes through it too; `correct_seat_sessions` stays as a wrapper for a console open across the release.
- **Super admins only**, never on their own record, and not while the member or venue is frozen, as 0687.
- **What fits.** Check-in stays on its club day (the report's row is the club day), not ahead of now and not after the first seat starts. Check-out only for a visit that is over: after check-in, not ahead of now, not before the last seat ends, and not past the club day's end (06:00 IST the next morning) unless the visit already ran past it. A visit runs into none of the member's other visits. A seat's start is not corrected.
- **Synced.** Every screen reads the same visit and seat rows: the Door, the Reports, History, Bonus approvals and the player's app show the corrected times. The visit's play-time Bonus is weighed again as 0687 says.
- **The panel.** The Players report's Visits row lists the club day's visits for a super admin; with more than one, the panel offers a choice and corrects one visit per save. Times are typed as 24-hour IST clock times: check-in on the visit's club day, check-out the first such time after check-in; a check-out typed as the minute the last seat ended keeps that seat's end to the second. Choosing another visit drops what was typed for the first.
