# 0680 Busted, leaving with a check-out, and the door's matches as typed

Date: 16 Nov 2026. The owner asked for these on the Live floor and at the door. Amends decision 0481's four reasons.

- **Busted** is a fifth reason to let a player go before their call time, written to their record like the others.
- **Leaving with a check-out.**
  - The leave sheet's footer offers the action and the same with a check-out of the club: "Let go early and check out" beside Let go early, "Leave and check out" beside Yes, they leave. Staff choose; Cancel stays.
  - The owner named the option and asked for all three in the footer, so its words stand over the copy rule's three-word buttons. The console sheet's footer now wraps whole buttons onto a second line rather than their words.
  - It is offered to staff with the door's permission (waitlist.manage), the one `check_out` asks.
  - Freeing a seat owing call time keeps the member in the club, so "Leave owing" has none: the check-out would be refused.
  - It checks out as the door does. A refused check-out (the venue frozen, say) keeps the seat change and says to check them out at the door. Neither has Undo.
- **The door's matches as typed.**
  - The members matching what is typed show as it is typed, eight at most, ordered as Seat a player orders them (`topMatches` in @rivr/db, which both use).
  - Each offers the action that fits: Check out for a member in the club today (playing, waiting or in the room), Check in for anyone else.
  - Enter still acts at once on a single match or a whole mobile number.
