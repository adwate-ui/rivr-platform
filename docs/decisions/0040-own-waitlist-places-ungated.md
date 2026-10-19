# 0040 A member always sees and may leave their own waitlist places

Date: 19 Oct 2026. Task #38.

Joining a waitlist from the app is gated by tier (`waitlist.join`), and so is seeing the floor: tables, games and how many wait (`floor.live_view`), in the database and in the app. A member's own places are not: the "members see their own waitlist places" policy, `my_waitlist()` and leaving skip `has_feature`. A place is the member's own claim, often made for them by the floor; a tier change must not hide it or stop them giving it up. This follows decision 0033 for Academy bookings.

Leaving is also allowed while the venue or the member is frozen. It only gives up a claim and moves no money or seat, so it is exempt from `assert_writable`, like recording consent. The floor's removal of someone else's place is not exempt: it waits for the release.

Refusing an excluded member (self-exclusion, #56) is not built yet; `put_on_waitlist` is where that check goes once `member_restrictions` exists.
