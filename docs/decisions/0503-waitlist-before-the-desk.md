# 0503: Waiting before the desk's identity check

Date: 5 Nov 2026 · The owner's answer of 5 Nov (3) · Builds on decision 0502

**Why.** While the club checks identity at the desk (decision 0502), a member let in by their selfie may join a waitlist from the app before their first visit. The floor must check their ID before seating them.

**What.**
- **`private.may_wait(member)`.** True if the identity check is finished, or if the record is `started` with `at_club_from` set. A refused or erased check may not wait.
- **Uses `may_wait`.** `put_on_waitlist` (the app's join and the floor's add, so the join requests too) and `put_call`, which also covers `roll_call_on`'s calls.
- **Stays on `is_kyc_complete`.** `seat_from_waitlist`, `assign_from_waitlist` (through it) and `start_seat_session`, so nobody sits before the desk's check (RVKYC).
- **The floor's lists.** `waitlist_board.needs_id_check` marks the place "ID check needed", first in its line. Its button is **Check ID** instead of Seat, even once called. It opens `/kyc-review?check=<name>`: the check in person with the member searched. Seat comes back once they are verified.
- **The app.** The waiting member's place says "Your ID is checked at the desk before you sit."
- **Not changed.** The cage and money stay on `is_kyc_complete`.
