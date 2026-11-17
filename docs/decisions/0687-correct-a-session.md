# 0687 A super admin corrects a session from Bonus approvals

Date: 17 Nov 2026. Issue #1061. The owner: "Allow for editing the end time as well as add a column for absent from the table which is subtracted from the session length"; "Bonus already given stays; only waiting Bonus changes".

- **Who and what.** A super admin, never on their own record, corrects a visit's seats in one call (`correct_seat_sessions`): when the player left each seat that is over (one still taken ends at the table) and their time away. One reason of 3 to 200 characters goes in Activity for each seat (`seat.session_corrected`), with the old and new values.
- **Limits.** An end falls after they sat at that table, not ahead of now, not after the visit closed, and not into their next seat. Time away fits within the seat. If any seat does not fit, nothing is saved.
- **Time away still running** is part of the time away shown and typed; only the part already over is stored, so the running part is counted once, when they come back.
- **Time away comes off time played** on the door, in the Players report and its average session, and in play-time promotions.
- **Waiting Bonus.** The seats are saved together, then the visit's play-time Bonus is weighed once on the corrected time (at the visit's close if it is over). Waiting steps it no longer reaches are refused as "Session corrected"; steps it newly reaches wait for approval.
- **Bonus already given stays.** How many given steps the corrected time no longer reaches is said when it is saved and kept in each seat's Activity entry (`given_above`): that is the note the issue asks for, as given Bonus has no row in the queue.
- **Not covered.** A step refused by a correction is settled: a later correction that adds time back does not give it again; the super admin gives it by hand on Rewards. While promotions are switched off, a correction that would refuse a step is refused.
