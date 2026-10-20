# 0109: Check-out at the door closes the visit, under the cage's call-time rule

Date: 2026-10-20 · Task: #82 (additions flow 14)

The front desk checks a member out from the door's room list, or by the number on the membership card
(typed until the card's QR scans, #71). `private.check_out` closes the visit with close reason `door`
through `private.close_visit`, the one way a visit closes, so its hours are fixed and its points earned
(#89) as at a final cash-out. A member still seated is refused (RVSTD): their chips are on the table, so
the floor ends the seat or the cage cashes them out first. That is the safest reading, and question #410
asks the owner to confirm it.

Before call time the cage's rule applies, by the same function (`private.call_time_owed`): a member who
owes call time on the last seat they left this visit is refused (RVCTS), and the door shows how much is
owed, until an admin lets them leave early (#79). A close is a write, refused while the member or the
venue is frozen. A member not checked in is refused (RVOUT). Only the front desk, floor managers and
admins (`waitlist.manage`) check members out, as they check them in.
