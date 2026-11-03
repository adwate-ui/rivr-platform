# 0305: Time requests

Date: 3 Nov 2026. Set by the owner on 3 Nov. It changes decision 0320's add time and undoes 0324.

- **A queue of its own.** Time requests has its own rail entry and page, `/time-requests`, for the floor (waitlist.manage).
  - Each request shows the table, seat and member, the length asked and the call time left (or "met"), with Approve and Decline.
  - The rail counts open requests in red, with the chime and the tab title. Live floor counts the leaving list alone again.
- **The club picks the lengths.** `call_time.add_choices` (Settings → Floor) ticks the lengths offered from eight presets: 15, 30 or 45 minutes, 1 hour, 1 hour 30, or 2, 3 or 4 hours.
  - With none ticked, the offer is 30 minutes, 1 hour and 2 hours, as before.
  - The app's Add time sheet and the floor's buttons show the ticked lengths.
  - A request is checked against the setting when it is made. An approval is not checked again, so a request made under the old choices can still be approved.
- **Met or not.** More time may be asked for and approved after the call time is met (the owner, answering #782).
  - The rule, `extendedCallTime` and its SQL twin, golden `callTimeExtension.json`: the length is added whole to the later of the call time and the whole minutes played, never past a day in all. So "+1 h" after the call time is met means an hour from now. Before it is met, the length adds to the call time as before.
  - Time added clears the completion, so the seat owes it again. The minute sweep completes it once played, and says so again: `call_time.completed`'s key now carries the call time.
- **The floor adds time itself.** Staff with `call_time.override` (the floor, cashiers, admins, super admins) add an offered length from the seat's row on Live floor (`add_seat_call_time`), by the same rule and without a request. Hosts approve requests but do not add time themselves.
  - Each addition is kept as a request approved at once, with who added it.
  - It carries a request id, so a retry after a lost answer adds it once.
- **A completion earned is kept.** Promotions' `call_time_complete` counts a call time first met (`seat_session.call_time_first_met_at`), even when more was added after it and the member left before playing that too. This is the safer reading; the owner is asked to confirm in a question issue.
- **Not changed.** A seat with no call time takes none this way. The floor's "Call time" form, which sets the total, is as it was.
