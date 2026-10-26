# 0180: A visit counts toward the month only with play

Date: 2026-10-26 · Task: #448 (from the review of the door kiosk, decision 0164)

With the door kiosk, a member could scan in, wait out the ten-minute "gone" window, and scan out and in again. Each short visit counted toward `private.visits_this_month`. That count drives the cab template's "fourth visit in a month" and every promotion with `min_visits_in_month`.

**Rule.** A closed visit counts toward the month only if one of these holds:

- the member sat at a table during it: a seat session in the visit with any time on it;
- the visit lasted an hour or more, which covers a tournament player or one who waited on the list.

The month is still the IST calendar month the visit closed in, as decision 0140 has it.

**Where.** Only `private.visits_this_month` (lane C's contract) changed, so every promotion and the cab read the same count. Check-in promotions were already once a club day per member, and the hours-played promotions already need seated time.
