# 0044 Step away and I'm back are a member's own place, but stop during a freeze

Date: 19 Oct 2026. Task #63, from the review of PR #285.

Decision 0040 lets a member see and leave their own waitlist places whatever their tier and even while frozen. Step away and I'm back are about the member's own place too, often one the floor added for them, so they are not gated by tier (`waitlist.join`): a tier change must not strand a member who is away.

They are not exempt from a freeze, unlike leaving. Leaving only gives up a claim; I'm back asserts one again, and stepping away changes when a place runs out. So both go through `assert_writable` for the venue and the member, as joining does. While the venue is frozen nothing runs out either: holds and time away pause (question #286), so a member who cannot come back during a freeze does not lose their place for it.

The floor's Skip and Back on someone else's place check the venue only, as the floor's other waitlist actions do.

## Follow-ups (#287, 28 Oct 2026)

- **A member freeze pauses time away.** A member frozen while away keeps their place: their time away pauses, as a venue freeze pauses everyone's, since they cannot come back until the freeze is lifted. A frozen member's seat call still runs out, so the seat rolls on to the next name instead of waiting on someone who cannot be seated.
- **The floor's Skip needs time away left.** Skip keeps a called place as away, so with none left it is refused (RVAWY), as a member's own step away is, rather than taking the place off at the next minute without a word.
- **Back says away too long.** A refused Back says the member was away too long, not that a hold ran out.
- **Kept as they are:**
  - **A called member who leaves during a venue freeze** rolls nothing on, and nothing re-rolls after the release. The seat waits for the floor to call the next name.
  - **Pauses ride on pg_cron's minute run.** A missed run is not paused, and the next run moves holds and time away on by its minute only.
  - **A seat call already sent** keeps the hold time it was sent with when a freeze moves the hold on. The place itself is held for the longer time. Only a WhatsApp delivery held past the old time by a messaging stop and a freeze together is dropped as stale.
  - **Whether a seat is free** when called belongs with seating (seat occupancy), not the waitlist.
