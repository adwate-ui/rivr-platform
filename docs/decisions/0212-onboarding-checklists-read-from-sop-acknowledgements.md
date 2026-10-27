# 0212 Onboarding checklists are read from the SOP library, not stored

Date: 27 Oct 2026. Task: #107 (scope-v1 module 10: "Onboarding checklist per hire linked to SOP acknowledgements").

- **A hire's checklist is the SOPs whose version in force asks their role.** An item ticks once the hire acknowledges that version. `private.onboarding_checklists(venue)` gives every active staff member's checklist, to staff with `staff.manage` (42501 otherwise). A hire turned off has none. An SOP whose first day is still to come is on no checklist yet.
- **No `onboarding_item` table**, though the lane contract planned one. Each SOP version already names the roles that must acknowledge it, and `sop_ack` already records each acknowledgement. A stored copy would drift whenever a hire's role changed, a hire was added, or a version asked other roles. Read from the library, the checklist follows all three without a trigger.
- **Only through lane B's contract.** The function composes `public.sop_library` (each SOP's version in force) with `public.sop_acknowledgements` (the active staff a version asks, and when each acknowledged). It reads none of lane B's tables, so who a version asks is decided in one place. That function also needs `sops.manage`, which every role with `staff.manage` holds today.
- **A new version reopens its item** until the hire acknowledges it. That is the library's own rule for "4 of 9 staff acknowledged", and the safest reading: a manager never reads a hire as ready on rules they have not seen. Question #483 asks whether a tick should stay once given.
- **Where it shows.** On Team → Staff, each active hire's row shows "Onboarding: 3 of 9 SOPs acknowledged." and opens their checklist with when they acknowledged each SOP. The hire uses the SOP library as before, which already shows what their role must acknowledge.
- **Out of scope:** items that are not SOPs, such as documents collected or a uniform issued, which the acceptance does not ask for.
