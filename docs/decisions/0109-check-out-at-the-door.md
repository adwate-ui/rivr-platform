# 0109: Check-out at the door closes the visit, under the cage's call-time rule

Date: 2026-10-20 · Task: #82 (additions flow 14)

The front desk checks a member out from the door's room list, or by the number on the membership card
(typed until the card's QR scans, #71). `private.check_out` closes the visit with close reason `door`
through `private.close_visit`, the one way a visit closes, so its hours are fixed and its points earned
(#89) as at a final cash-out. A member still seated leaves the seat as they go, as a final cash-out does.

Before call time the cage's rule applies, by the same function (`private.call_time_owed`): a member who
owes call time on their seat, or the last one they left this visit, is refused (RVCTS) until an admin
lets them leave early (#79). A member not checked in is refused (RVOUT). Only the front desk, floor
managers and admins (`waitlist.manage`) check members out, as they check them in.
