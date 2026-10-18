# Lane C: member and web

The player app (sign-in, KYC, Home, Sessions, Balance, Rewards and Learn screens, Profile), check-in and check-out at the door, the membership card, Academy operations, the website and its editor, link-in-bio, the live floor widget, Learn with licensed sources, push notifications, PWA install, share cards, cab safety and the driver app, and the accessories store. Lane C carries the 30 Oct release.

## Tables owned

| Table | Purpose |
|---|---|
| `kyc_record` | Vendor reference, masked Aadhaar, PAN, date of birth, address, KYC photo path (private bucket), liveness and face-match results, status |
| `consent` | DPDP consent per purpose (marketing, KYC, analytics events), with time and withdrawal |
| `member_limit`, `self_exclusion` | Player-set and floor-set limits, cool-off and self-exclusion |
| `visit` | Check-in and check-out: opened by QR or phone at the door, closed at the door or on final cash-out |
| `membership_card` | Rotating QR secret per member |
| `push_subscription`, `notification_preference` | Web push endpoints; which push types a member wants |
| `member_preference` | Games and stake for waitlist alerts |
| `academy_batch`, `academy_booking`, `academy_attendance` | Batches, bookings and payment, attendance, graduation |
| `learn_source`, `learn_licence`, `learn_card`, `learn_attempt`, `learn_lesson` | Licensed encodings (private bucket), licences, FSRS cards and attempts per member, Academy lessons |
| `site_page`, `site_block`, `site_revision`, `site_publish` | Website pages of typed blocks, drafts, scheduled publish, history and rollback |
| `cab_request`, `cab_trip`, `driver` | Eligibility, pickup and drop requests, driver assignment, live trip, drop confirmed by player code |
| `share_card` | Rendered share cards with the member's referral code |
| `sign_up_attribution` | The referral, creator and UTM codes a member signed up with (first touch) |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `private.is_kyc_complete(member)` | A, B | KYC verified and at least the venue's minimum age (`kyc.minimum_age`, never below 18); duplicate identities never pass |
| `private.member_restrictions(member, at)` | A, B | Limits, cool-off and self-exclusion in force |
| `public.check_in(venue, card_code)`, `public.check_out(venue, card_code)` | door screen | Opens or closes a visit; refuses an excluded member; check-out before call time follows lane B's rule; emits `visit.opened` / `visit.closed` |
| `public.book_academy(batch)`, `public.claim_academy_payment(booking, utr)`, `public.academy_payment_details(booking)` | player app | A seat in an open Academy batch at the `academy.price` fee; the member's UPI payment and UTR (#8) |
| `public.academy_open_batches()`, `public.my_academy_bookings()` | player app | The batches the member can book, with seats left and the fee; the member's own seats, with the UTR given and the last one the cage turned down (decision 0033) |
| `public.confirm_academy_payment(booking, utr)` | console (cage) | A cashier confirms the UTR found in the bank (it must be the booking's, and never their own booking): bank in, Academy fees (`venue.academy`) out of the ledger; emits `academy.booked` |
| `public.reject_academy_payment(booking, utr)` | console (cage) | A cashier turns down a UTR not found in the bank: the booking is unpaid again and its UTR freed |
| `public.create_academy_batch(...)`, `public.book_academy_corporate(..., request_id)`, `public.record_academy_payment(booking, utr)`, `public.cancel_academy_booking(booking)` | console | Batches; a company's heads at the corporate fee per head, once per request id; the UTR of a payment the payer could not give in the app; cancelling a booking with no payment given |
| `private.current_visit(member)`, `private.close_visit(member, at, reason)` | A (final cash-out), B | The open visit; closing it emits `visit.closed` |
| `private.visits_this_month(member, at)` | D (cab and promotions conditions) | Closed visits in the calendar month |
| `private.has_consent(member, purpose)` | D (marketing sends, Meta events) | Consent in force |
| `private.wants_push(member, push_type)` | C and D push senders | Whether the member gets that push: only if their tier has the push feature, then on unless they turned it off in Profile; a promotion only with marketing consent |
| `public.sign_up(full_name, attribution)` | player app | Joins the signed-in number: links a registered member, or creates one in the club with the referral, creator and UTM codes it arrived with; emits `member.signed_up` |

## Events

- Emits: `member.signed_up` (`member_id`, and `referral_code`, `creator_code`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` when the link had them), `kyc.completed`, `visit.opened`, `visit.closed`, `academy.booked`, `academy.graduated`, `learn.session_completed`, `learn.principle_mastered`, `share_card.rendered`, `cab.requested`, `site.published`.
- Consumes: `seat.taken`, `waitlist.called`, `call_time.completed`, `withdrawal.sent`, `tournament.starting`, `promotion.published` (push through the `push` adapter); `site.published` (Cloudflare cache purge through the adapter).

## Uses from other lanes

- A: `public.request_withdrawal`, balances (`ledger_balance`), deposits with UTR; the `balance.deposits` key.
- B: `public.join_waitlist`, waitlist position, `private.call_time_remaining`, public floor views for the website and widget, tournament registration.
- D: points, catalogue, League, referral codes, promotion cards for Home; share and membership card templates in `@rivr/render`.

## Screens

Player app: the shell and routes, sign-in and KYC, Home (composing B's and D's features), Sessions, Profile, Learn, the membership card. Website (`apps/web`): every page and block. Console: `features/kyc-review`, `features/members` (records), `features/academy`, `features/website`, `features/learn-sources`, `features/cab`. Door screen (a console route on an enrolled door device). Driver app: all of it. Feature keys: `learn.*`, `sessions.history`, `academy.booking`, `cab.requests`, `referral.share_cards`, `push.withdrawal_sent`, `push.promotion_published`, and the core keys.

## Settings keys added

`kyc.minimum_age`, `academy.price` (individual, corporate per head), `cab.minimum_visits`, `learn.points_per_session`, `learn.daily_points_cap`, `card.qr_rotation_seconds`.
