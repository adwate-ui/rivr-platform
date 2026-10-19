# Lane B: floor

Tables and table types, seating, the waitlist and its priority, call time, the dealer tablet (hand entry, rake, jackpot drop, offline queue, down and drop-box), pot data, jackpots with their sub-pools, high hands, TVs and their modes, tournaments, CCTV references, table-side food and drink, the practice venue's training use, certification quizzes, SOPs, POCs, incidents and the offline pack, dealer rotation and tip-pool export, and the final-table stream overlay. The tablet and the money it records get line-by-line review and golden tests.

## Tables owned

| Table | Purpose |
|---|---|
| `table_type` | Game, blinds, buy-in range, straddle; its `code` is the subject of the effective-dated settings `rake.config` (rate and cap) and `call_time.minutes`; the jackpot drop is the venue's `jackpot.drop` (#34) |
| `game_table` | The six tables: name, type, open or closed |
| `seat_session` | A member in a seat: start, end, table moves and breaks (drives call time and hours) |
| `waitlist_entry` | Per stake and game: joined at, priority reason, hold expiry, called, seated, skipped |
| `interest_list` | Interest in a game that is not running |
| `early_departure` | A cash-out or check-out before call time, with the admin override and reason |
| `dealer_down` | A dealer's shift at one table: on and off times, drop-box count, variance |
| `tablet_assignment` | Which dealer tablet (lane 0 `device`) is fixed to which table |
| `hand` | Every hand: table, dealer, variant, pot, rake, cap applied, jackpot drop, high-hand claim, camera reference, idempotency key |
| `high_hand_claim` | Claims from the tablet, floor approval, payout |
| `jackpot_pool`, `jackpot_rule`, `jackpot_event` | Bad-beat main, season and freeroll pools; shares of the drop; qualifying rules; payouts and adjustments |
| `tv_pairing`, `tv_screen` | Six-digit pairing, assigned display mode, remote unpair |
| `tournament_template`, `blind_structure`, `tournament`, `tournament_level`, `tournament_entry`, `tournament_seat`, `payout_structure`, `tournament_deal` | Every tournament format, the server-side clock, entries and re-entries, alternates, seating and balancing, bust-outs, payouts, ICM and chip-chop |
| `camera`, `cctv_reference` | Camera ids and playback links on hands, cage transactions and incidents |
| `fnb_order` | Table-side orders, KOT printing, comp or paid, posted to the visit |
| `quiz`, `quiz_attempt` | Dealer and cashier certification, pass recorded on the staff record |
| `sop`, `sop_version`, `sop_ack`, `poc`, `incident`, `drill_schedule` | SOP library with acknowledgements by role, the escalation directory, the incident log, drills |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `public.join_waitlist(table_type, idempotency_key)` | player app (C screens) | Joins the list for a table type (one game and stake) at the member's venue; refuses without KYC (`RVKYC`) or while frozen (`RVFRZ`, `RVMBR`), and, once #56 adds it, while excluded; feature `waitlist.join`; emits `waitlist.joined`. Places are ordered by priority (the tier's weight in `waitlist.priority_weights` in force when the member joined; the black card's only at its qualifying stake), then join time (#40) |
| `public.add_to_waitlist(table_type, phone, idempotency_key)` | console | The floor (`waitlist.manage`) adds a member found by mobile number (`RVNOM` when none); same refusals as joining |
| `public.my_waitlist()`, `public.waitlist_lengths()`, `public.waitlist_board(venue)` | player app, console | The member's own places with their number on each list (never gated, decision 0040); how many wait per table type (members with `floor.live_view`, and staff); each list in priority order with names and `priority_reason`, the tier that put a place ahead of join time (`waitlist.manage`) |
| `public.leave_waitlist(entry)` | player app, console | A member gives up their own place (even while frozen), or the floor removes anyone's (not while the venue is frozen) |
| `public.call_from_waitlist(entry)`, `public.seat_from_waitlist(entry, table, seat)` | console, player app | Call-down and seating; emits `waitlist.called` (push and WhatsApp through lane D's consumers) and `seat.taken` |
| `public.log_hand(table, pot, variant, high_hand?, idempotency_key)` | tablet | Computes rake, cap and jackpot drop with `@rivr/domain`, posts rake and drop to the ledger, evaluates promotions (lane D); refuses during a freeze; replays from the offline queue land once; emits `hand.logged`. The ledger stamps `occurred_at` with the time the server receives the write, so a hand replayed from the offline queue reads the rake cap and other settings at the hand's own time (sent by the tablet and stored on the hand), never at the sync time |
| `public.request_buy_in(table, seat, amount)` | tablet | Queues a buy-in for the cage (lane A's `buy_in_request`) |
| `private.call_time_remaining(member, at)`, `private.call_time_shortfall(member, at)` | A (cash-out), C (check-out, player Home) | Minutes left before the member may leave, across table moves and breaks |
| `private.seated_hours(member, from, to)` | A (rakeback, accommodation), D (points) | Hours seated, by stake |
| `public.register_tournament_entry(tournament, method, idempotency_key)` | player app (C screens), console | Registration and re-entry from the wallet (lane A's `private.debit_wallet`) or the cage; feature `tournaments.register` from the app |
| Views `public_table_status`, `public_waitlist_length`, `public_jackpot`, `public_high_hand`, `public_tournament_clock`, `public_tournament_calendar` | web (C), TVs, link-in-bio | No personal data; never the practice venue |

## Events

- Emits: `waitlist.joined`, `waitlist.called`, `seat.taken`, `call_time.completed`, `hand.logged`, `high_hand.claimed`, `high_hand.approved`, `jackpot.paid`, `tournament.starting`, `tournament.finished`, `tournament.entered`, `fnb.ordered`, `incident.logged`.
- Consumes: `visit.opened` and `visit.closed` (lane C) for seat sessions; `promotion.published` (lane D) for the TV rotation.

## Uses from other lanes

- A: `private.debit_wallet`, `private.credit_wallet`, `private.tds_for`, `buy_in_request`, the chart of accounts for rake and jackpot.
- C: `private.is_kyc_complete`, `private.member_restrictions`, `private.current_visit(member)`.
- D: `private.evaluate_promotions(venue, trigger, context)` on hands; League points on tournament finish through `private.credit_points`.

## Screens

Tablet app: all of it. TV app: all modes (waitlist board, call-time board, jackpot and high hand, tournament clock, promotions rotation, rewards ticker, League leaderboard, social wall, spin wheel) built from `@rivr/ui` and lane D's templates. Console: `features/live-floor`, `features/waitlist`, `features/tables`, `features/tournaments`, `features/jackpots`, `features/high-hands`, `features/tv-screens`, `features/dealers`, `features/sops`, `features/incidents`, `features/fnb`, `features/pot-data`. Player app: `features/waitlist`, `features/call-time`, `features/tournament`, `features/fnb` (inside lane C's tabs). Feature keys: `waitlist.join`, `call_time.view`, `tournaments.register`, `floor.live_view`, `fnb.table_side`, `push.seat_ready`, `push.call_time_complete`, `push.tournament_starting`.

## Settings keys added

`rake.config` (percent and cap by table type), `jackpot.drop` (amount, minimum pot), `jackpot.shares` (main, season, freeroll), `waitlist.priority_weights`, `waitlist.hold_minutes`, `high_hand.payouts`, `tournament.late_registration_level` (per template), `dealer.variance_threshold`, `call_time.minutes` (lane 0 key, values by table type).
