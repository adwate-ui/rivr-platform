# 0323: Lock-screen live status (phase 2) and the events it runs on

Date: 3 Nov 2026. The redesign's prototype shows a live status on the lock screen: "Next in line" while waiting, the hold counting down with "I'm on my way" once called, and the call time counting down with "Order" once seated (brief 4). A PWA cannot draw on the lock screen. Phase 1 ships the two pushes (Seat ready, Call time ending) and this record; phase 2 builds the widget.

- **Phase 2.** A Capacitor shell around `apps/player` (the one new dependency the brief allows). On iOS a Live Activity (ActivityKit) started at the seat call and updated by APNs push; on Android an ongoing notification with a chronometer. Both count down locally to a server timestamp (`hold_until`, `call_time_ends_at`), as the app does (brief 5), and are updated only when that timestamp changes.
- **Driven by the outbox.** A new consumer (`live-status`, beside `push`) turns these events into Live Activity and ongoing-notification updates, through a `@rivr/adapters` interface with a fake, as every vendor call is. It is a messaging consumer, so a messaging stop holds it, and practice-venue events never reach it.
- **The event contract.** The brief names five events. Four exist under the names the outbox already uses, so phase 2 reads those rather than a second copy of each:

| Brief's name | Outbox event | Payload (`@rivr/contracts`) | Emitted by |
|---|---|---|---|
| `seat.called` | `waitlist.called` | `waitlistCalledSchema`: entry, member, table name, seat, `hold_until` | `private.put_call` |
| `seat.seated` | `seat.taken` | session, member, table, seat | `private.seat_member` and every other way a member sits |
| `call_time.updated` | `call_time.updated` | `callTimeUpdatedSchema`: session, member, minutes in all | `private.decide_call_time_request` |
| `call_time.ending` | `call_time.ending` | `callTimeEndingSchema`: session, member, table name, seat, `ends_at` | `private.sweep_seated_time`, once at 15 min |
| `waitlist.position_changed` | not emitted yet | | |

- **Ends.** `seat.left` ends a seated status; leaving or losing a place (`waitlist_entry.left_at`) ends a waiting one.
- **Not yet: `waitlist.position_changed`.** A place moves whenever anyone ahead joins, leaves, is called or is seated, so it is a fan-out to every member behind them. Phase 2 decides whether to emit it per member or have the consumer read `my_waitlist` on `waitlist.joined`, `waitlist.called` and `seat.taken` (#778). Nothing in phase 1 needs it. The phase-2 work is #779.
