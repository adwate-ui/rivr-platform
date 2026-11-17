# 0684 The member sets their call time; the time set is owed

Date: 17 Nov 2026. Issue #1059. Owner's rulings of 17 Nov.

The player app's Add time was a request the floor approved. It is now Set call time: the member picks a length the club offers (`call_time.add_choices`), counted from now, and it is owed at once, with no approval. The owner: "The players owe the time that they set in addition to the original call time." So the seat's call time becomes the whole minutes played plus the length, and a length that would end before the call time already owed is greyed out in the app and refused by the server (`RVCTE`). My reading, as it changes what a player owes: a call time already set can be moved later, never earlier. Only a seat with a call time, set when the floor seated them, sets one, as only such a seat had Add time: a call time made from nothing would count as complete for a promotion that rewards it (security review). A length that changes nothing writes nothing and tells no one. Each refusal has its own code, so the app says which: `RVCTC` a length no longer offered, `RVCTN` no call time, `RVCTX` past a day, `RVCTE` before the call time owed.

The countdown ring is gone from the player app: the seat shows "Playing since" and the time they sat down, and "Call time until" only once the member has set one (`seat_session.call_time_set_at`). No leave option is greyed out anywhere; the door's rule for call time owed is unchanged.

Each set is kept as an approved `call_time_request` with no staff member, so the seat's history shows it. `request_call_time` stays for apps not yet updated, and the floor's Time requests screen serves those until none are left; removing both is a follow-up issue. The floor's own Add time is unchanged.

`private.set_call_time` is the twin of `@rivr/domain` `setCallTime`, proved on `packages/testing/golden/callTimeSet.json`.
