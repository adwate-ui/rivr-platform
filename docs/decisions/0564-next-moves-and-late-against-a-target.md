# 0564. What the floor is told next, and when an age is late

Date: 9 Nov 2026. From the 180-day audit: F-036, F-075, F-085.

**A tile says how many are on its list.** On a list whose own table has no seat, a row says where else the stake has
room: "Table 4 has 6 open". It is a prompt and never a move, as a list is per table (the owner, 3 Nov).

**One late target for each of two queues, set in `@rivr/domain`.** A place on a list is late after 45 minutes, a ticket
at the bar after 15. Both show the word Late as well as the colour. The audit asked for two club-set thresholds per
queue. Its own verification narrowed that to the missing cue on waitlist rows and tickets, so that is what is built. Club-set
targets would extend `floor.request_targets` if the club wants them.

**A place called or held is never late**: its hold runs its own clock.

**A ticket knows its guest.** The bar's list says whether the member it goes to is still in that seat, has asked to leave,
or has gone. A guest gone asks the runner to deliver at the door, or void it.
