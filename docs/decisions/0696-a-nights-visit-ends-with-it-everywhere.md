# 0696: A night's visit ends with it, everywhere

Date: 19 Nov 2026. Issues #1095 (the owner's ruling) and #1096.

- **The morning sweep.** At 11:10 IST, `private.close_stale_visits` closes any visit from an earlier club day with nothing open in it, at its last seat's end. That holds even when the seat ended a little after 06:00. The owner, 19 Nov: "Close them". Before this, the sweep used `private.close_stale_visit`'s rule, which keeps a visit whose last seat ended after 06:00. Check-in and seating still use that narrower rule, so a member seated again in the morning carries on the same visit.
- **A forgotten seat.** When a seat is let go after 08:00 and stamped at 06:00 (`private.seat_end_stamp`), `end_seat` and `leave_my_seat` close its visit at once, also at 06:00. Before this, the visit waited for the member's next check-in or the next sweep. Meanwhile the door showed last night's player as in the room. When a stop is in force, the visit is left to the sweep and the seat still ends.
- **Exactly 06:00 is last night's.** The door's list (`todays_players`) and the top-ups list (`top_ups_tonight`) now compare with `>`. A visit that closed at 06:00, or a top-up whose seat ended then, no longer counts as tonight's.
