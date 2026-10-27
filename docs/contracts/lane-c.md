# Lane C: member and web

The player app (sign-in, KYC, Home, Sessions, Balance, Rewards and Learn screens, Profile), check-in and check-out at the door, the membership card, Academy operations, the website and its editor, link-in-bio, the live floor widget, Learn with licensed sources, push notifications, PWA install, share cards, cab safety and the driver app, and the accessories store. Lane C carries the 30 Oct release.

## Tables owned

| Table | Purpose |
|---|---|
| `kyc_record` | Vendor reference, masked Aadhaar, PAN, date of birth, address, KYC photo path (private bucket), liveness and face-match results, status |
| `kyc_review` | A KYC reviewer's decision on a check: approve or reject, the reason, whether they entered the date of birth or the PAN, where the check ended, who, and whether it was a vendor's check or `manual`, in person (decision 0035, #246) |
| `consent` | DPDP consent per purpose (marketing, KYC, analytics events), with time and withdrawal, and the staff member who recorded one given in person |
| `member_limit`, `self_exclusion` | The member's session reminder; breaks taken by the member or set by the floor, never changed or shortened (#56) |
| `visit` | Check-in and check-out: opened by QR or phone at the door, closed at the door or on final cash-out |
| `member_tier_change` | Every change of a member's tier: from, to, the reason, the staff member, and a last day after which the sweep puts them back (#60); never changed |
| `membership_card` | Rotating QR secret per member |
| `push_subscription`, `notification_preference` | Web push endpoints; which push types a member wants |
| `member_preference` | Games and stake for waitlist alerts: blinds in paise as `table_type` has them, both null for any stake. Profile offers the stakes of `public.my_stakes()`, the member's own club's whatever their tier (#206, decision 0069). `name_on_tvs` (on unless the member turns it off through `public.set_my_name_on_tvs`): off, the TVs' waitlist board gives their place and no name (#326, decision 0070) |
| `academy_batch`, `academy_booking`, `academy_utr_rejection`, `academy_attendance` | Batches, bookings and payment, the UTRs the cage turned down and by whom, attendance, graduation |
| `learn_source`, `learn_licence`, `learn_card`, `learn_attempt`, `learn_lesson` | Licensed encodings (private bucket), licences, FSRS cards and attempts per member, Academy lessons |
| `site_page`, `site_block`, `site_revision`, `site_publish` | Website pages of typed blocks, drafts, scheduled publish, history and rollback (`site_page` and `site_block` from #9, read publicly through `public_site_page` and `public_site_block`, never the practice venue) |
| `cab_request`, `cab_trip`, `driver` | Eligibility, pickup and drop requests, driver assignment, live trip, drop confirmed by player code |
| `share_card` | Rendered share cards with the member's referral code |
| `sign_up_attribution` | The referral, creator and UTM codes a member signed up with (first touch) |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `private.is_kyc_complete(member)` | A, B | KYC verified and at least the venue's minimum age (`kyc.minimum_age`, never below 18); duplicate identities never pass |
| `private.member_restrictions(member, at)` | A, B | `break_until` (the end of the break running then, null for none) and `session_reminder_hours`; the waitlist, the door and the cage refuse a member on a break (#56) |
| `public.take_break(days)`, `public.set_session_reminder(hours?)`, `public.my_restrictions()` | player app | The member takes a break of 1, 7 or 30 days (off every waitlist; a shorter one while a longer runs changes nothing); sets a 4, 6 or 8-hour session reminder, or none; reads both (#56) |
| `public.set_member_break(member, days, reason)` | console | Staff with `members.manage` set a break of 1 day to 10 years, with a reason (#56; the member record, #60) |
| `public.member_search(venue, query)`, `public.member_record(venue, member)`, `public.member_early_departures(venue, member)`, `public.set_member_tier(venue, member, tier, reason, until)` | console (Members) | Staff who read members find one by name (two characters or more), mobile (four digits or more) or member number, and read the record: tier and a change's last day, qualifying stake, KYC, visits, in the room, early departures (#79) with the reason and the admin. Staff with `members.manage` change a tier with a reason of 3 to 500 characters and an optional last day (the change ends at 06:00 IST after it; `private.end_tier_changes` every minute); the tier is never written directly (#60) |
| `public.my_membership_card()` | player app (card) | The signed-in member's card: number, name, tier, the door code for now and when it changes (#71) |
| `public.check_in(venue, member)`, `public.check_in_by_phone(venue, phone)`, `public.door_board(venue)` | console (Check-in) | The front desk (`waitlist.manage`) opens a visit, refusing a member on a break (`RVBRK`), a frozen member or venue; checking in again gives the open visit; emits `visit.opened` (#72). The door's lists: expected (on a waitlist, not in the room) and in the room. `public.check_in_by_card(venue, code)` checks in by the code the door's scanner reads from a membership card, refusing one that is not current (`RVCRD`; #71, decision 0162); check-out (#82) follows |
| `public.door_scan(code)` | tablet (door kiosk) | A door kiosk (`device_kind` door, paired as a tablet; revoked, refused at once) scans a member's card code: in (the visit names the kiosk), or out under check-out's rules (`RVSTD`, `RVCTS` with the seconds owed), or `gone` within ten minutes of a visit closing. A check-in weighs the `check_in` promotions; every visit close weighs the `hours_played` ones once, with that visit's seated hours and points (decision 0164) |
| `public.book_academy(batch)`, `public.claim_academy_payment(booking, utr)`, `public.academy_payment_details(booking)` | player app | A seat in an open Academy batch at the `academy.price` fee; the member's UPI payment and UTR (#8); after the hold, a UTR given stays until the cage checks it (#222) |
| `public.academy_open_batches()`, `public.my_academy_bookings()` | player app | The batches the member can book, with seats left and the fee; the member's own seats, with the UTR given, the last one the cage turned down and `hold_until` while unpaid, and a seat the cage cancelled that way (decision 0033, #247, #222); a company's paid booking to its contact (#249) |
| `public.my_academy_invoice(booking)` | player app | The invoice of the signed-in member's paid booking: their own, or as its contact a company's (#249) |
| `public.kyc_review_queue(venue)`, `public.review_kyc(member, approve, reason, date_of_birth?, pan?)` | console (KYC review) | Checks waiting for a KYC reviewer, with what the vendor found; approve or reject with a reason, never one's own nor one for a member the reviewer added or changed (#112), the gate still applying; emits `kyc.completed` on verifying (decision 0035) |
| `public.kyc_in_person_candidates(venue, search)`, `public.authorize_in_person_kyc(member)`, `public.check_kyc_in_person(member, photo_path, date_of_birth, aadhaar_last4, pan, consent)` | console (KYC review), through the `kyc-in-person` Edge Function | A check in person while no vendor is live (#246): members with no check or one the app started, never the reviewer's own or one they added or changed; a photo path per check; the same gate, as method `manual`; emits `kyc.completed` on verifying |
| `public.reopen_kyc_check(member, reason)` | console (KYC review) | A super admin (`members.override_features`) reopens a refused check done in person, never their own, with a reason kept in the audit log (#267) |
| `public.my_tonight()` | player app (Home) | The signed-in member's tonight: whether their identity check is done, the bad-beat jackpot with `floor.live_view`, and the next published tournament at their venue with `tournaments.register` (#87, decision 0116) |
| `public.confirm_academy_payment(booking, utr)` | console (cage) | A cashier confirms the UTR found in the bank (it must be the booking's, never their own booking, never a UTR they turned down on another booking, and one turned down on another member's or a company's booking only by a manager, #222): bank in, Academy fees (`venue.academy`) out of the ledger; emits `academy.booked`; issues the booking's invoice in the Academy's series (`A`) at `academy.gst`, owing its GST in `venue.gst_payable` (#249, `RVGST`) |
| `public.reject_academy_payment(booking, utr)` | console (cage) | A cashier turns down a UTR not found in the bank, kept with who did: the booking is unpaid again and its UTR freed, or, for a UTR given after the 48-hour hold, cancelled (#222, question #257) |
| `public.create_academy_batch(...)`, `public.book_academy_corporate(..., request_id, company_gstin?)`, `public.record_academy_payment(booking, utr)`, `public.cancel_academy_booking(booking)` | console | Batches; a company's heads at the corporate fee per head, once per request id; the UTR of a payment the payer could not give in the app; cancelling a booking with no payment given |
| `private.current_visit(member)`, `private.close_visit(member, at, reason)` | A (final cash-out), B | The open visit (#72); closing it emits `visit.closed` (#82) |
| `private.visits_this_month(member, at)` | D (cab and promotions conditions) | Closed visits in the calendar month with play: seated time, or an hour or more in the club (#448, decision 0180) |
| `private.has_consent(member, purpose)` | D (marketing sends, Meta events) | Consent in force |
| `private.wants_push(member, push_type)` | C and D push senders | Whether the member gets that push: only if their tier has the push feature, then on unless they turned it off in Profile; a promotion only with marketing consent |
| `public.sign_up(full_name, attribution)` | player app | Joins the signed-in number: links a registered member, or creates one in the club with the referral, creator and UTM codes it arrived with; emits `member.signed_up` |

## Events

- Emits: `member.signed_up` (`member_id`, and `referral_code`, `creator_code`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` when the link had them), `kyc.completed`, `visit.opened`, `visit.closed`, `member.break_started` (`member_id`, `ends_at`), `academy.booked`, `academy.graduated`, `learn.session_completed`, `learn.principle_mastered`, `share_card.rendered`, `cab.requested`, `site.published`.
- Consumes: `seat.taken`, `waitlist.called`, `call_time.completed`, `withdrawal.sent`, `tournament.starting`, `promotion.published` (push through the `push` adapter); `site.published` (Cloudflare cache purge through the adapter).

## Uses from other lanes

- A: `public.request_withdrawal`, balances (`ledger_balance`), deposits with UTR; the `balance.deposits` key.
- B: `public.join_waitlist`, waitlist position, `private.call_time_remaining`, public floor views for the website and widget, tournament registration.
- D: points, catalogue, League, referral codes, promotion cards for Home; share and membership card templates in `@rivr/render`.

## Screens

Player app: the shell and routes, sign-in and KYC, Home (composing B's and D's features), Sessions, Profile, Learn, the membership card. Website (`apps/web`): every page and block. Console: `features/kyc-review`, `features/members` (records), `features/academy`, `features/website`, `features/learn-sources`, `features/cab`. Door screen (a console route on an enrolled door device). Driver app: all of it. Feature keys: `learn.*`, `sessions.history`, `academy.booking`, `cab.requests`, `referral.share_cards`, `push.withdrawal_sent`, `push.promotion_published`, and the core keys.

## Settings keys added

`kyc.minimum_age`, `academy.price` (individual, corporate per head), `cab.minimum_visits`, `learn.points_per_session`, `learn.daily_points_cap`, `card.qr_rotation_seconds`.
