# 0044 Step away and I'm back are a member's own place, but stop during a freeze

Date: 19 Oct 2026. Task #63, from the review of PR #285.

Decision 0040 lets a member see and leave their own waitlist places whatever their tier and even while frozen. Step away and I'm back are about the member's own place too, often one the floor added for them, so they are not gated by tier (`waitlist.join`): a tier change must not strand a member who is away.

They are not exempt from a freeze, unlike leaving. Leaving only gives up a claim; I'm back asserts one again, and stepping away changes when a place runs out. So both go through `assert_writable` for the venue and the member, as joining does. While the venue is frozen nothing runs out either: holds and time away pause (question #286), so a member who cannot come back during a freeze does not lose their place for it.

The floor's Skip and Back on someone else's place check the venue only, as the floor's other waitlist actions do.
