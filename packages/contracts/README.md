# @rivr/contracts

The shapes every package and Edge Function agree on: the `Result` type, branded ids, money as paise, and the Zod schemas that check money and identity at the edges.

## Public API

Import from `@rivr/contracts`, or one module at a time (`@rivr/contracts/ids`).

| Export | What it does |
|---|---|
| `Result<T, E>`, `ok(value)`, `err(error)` | The outcome of anything that can fail in an expected way. Throw only for bugs (`docs/decisions/0012`). |
| `venueIdSchema`, `memberIdSchema`, `staffIdSchema`, `deviceIdSchema`, `tableIdSchema`, `ledgerAccountIdSchema`, `ledgerTransactionIdSchema`, `idempotencyKeySchema` and their types | Uuids branded by kind, so a `MemberId` cannot be passed as a `VenueId`. |
| `paiseSchema`, `Paise` | Money in integer paise, from a bigint or an integer string as Postgres returns `bigint`. Rejects JavaScript numbers, decimals and grouping. Combine amounts only through `@rivr/domain/money`. |
| `indianMobileSchema`, `IndianMobile` | `9876543210`, `+91 98765 43210` → `+919876543210`. Ten digits starting 6 to 9. |
| `panSchema`, `Pan` | PAN in capitals, holder type checked (fourth letter). |
| `kycInPersonSchema`, `KycInPerson` | A check in person at the club, as the console sends it with the photo: the member, the date of birth and PAN from the originals, only the last four Aadhaar digits, and the member's consent (#246). |
| `erasedKycFilesSchema`, `ErasedKycFilesRequest` | Removing an erased member's KYC files (#424), as the console asks the `member-erase` Edge Function: the member id alone; the database names the folder only for an erased member. |
| `noticeFormSchema`, `NoticeFormValues` (from `@rivr/contracts/notices`) | A club notice as the console puts one up or edits it (decision 0424): its words, and a start and an end, each an IST day and 24-hour time, blank for now and until ended. A day without its time, a time without its day or not as 19:00, and an end not after the start are that field's errors; out come the moments, null where blank. |
| `isReasonInWords(reason, max)` | Whether a reason kept in the audit log is in words: three characters at least, `max` at most, no digit (Devanagari included), as the database asks of a reopened check (500) and a photo sent back (200). |
| `kycReviewSchema` | A KYC reviewer's decision from the console: a reason of 3 to 500 characters with no document numbers, and a date of birth and PAN only where the check kept none. |
| `gstinSchema`, `Gstin` | GSTIN in capitals, check character verified. |
| `upiVpaSchema`, `UpiVpa` | `arjun.mehta@hdfcbank`, lower-cased. |
| `ifscSchema`, `Ifsc`, `bankAccountNumberSchema` | An IFSC in capitals, `HDFC0001234`; a bank account number of 9 to 18 digits. |
| `CLUB_CONTACT` (`@rivr/contracts/club`) | How the club is reached online: Instagram, YouTube and email, on the website's contacts. Its numbers for calls and WhatsApp are a setting (Settings, Club details; `useClubContact` in `@rivr/db`, decision 0582). A subpath with no Zod, for the player's first load. |
| `venueConfigSchema` (`@rivr/contracts/venueConfig`) | The venue configuration as a super admin types it on Settings (#33): optional fields empty for nothing, the GSTIN, UPI address, IFSC, alert number and the club's numbers (`indianPhoneSchema`: a mobile or landline, with or without +91 or a trunk 0; decision 0582) in their own schemas, the invoice prefix in six characters, each invoice series' SAC code in four or six digits (`sacSchema`) and the authorised signatory (#423). |
| `pairingCodeSchema`, `devicePairSchema`, `dealerTabletAddSchema`, `deviceRevokeSchema` | A dealer tablet's six-digit pairing code, as the tablet sends it to device-pair; a tablet's name and a revocation's reason from the console (#41). |
| `cameraSchema` | A CCTV camera as staff add it: a name and the recorder's channel for its feed, letters, digits and `. _ : -`, never dots alone (#122, decision 0238). |
| `dealerPinSchema`, `dealerPinEntrySchema` | A dealer's PIN as the console sets it (four digits, not one digit four times) and as a dealer enters it on the tablet (four digits; the database checks it) (#41). |
| `rakeChangeSchema` | A rake change as the console schedules it (#37): table type, rate in percent (at most 10%, two decimals), cap in whole rupees (whole ₹50 chips), IST date and 24-hour time, and a reason; out come the rate in basis points, the cap still in rupees (the console makes it paise with `fromRupees`) and the time with `+05:30`. |
| `PROMOTION_TRIGGERS`, `PROMOTION_EFFECTS`, `PROMOTION_HANDS`, `promotionConditionsSchema`, `promotionEffectSchema` and their types | A promotion rule as `promotion_rule` holds it (#83): the eight triggers and the six effects; conditions (tier and table ids, table type codes, ISO days, an IST window given whole that opens before it closes within the club's day, first N per table or day, new, lapsed days, visits this month, call time completed, hours played, high hands or a bad beat), all optional; an effect by kind (a bonus as an amount or a share with an optional cap, in whole ₹50 chips, ending in 1 to 90 days; a ticket, cab, prize, jackpot payout or message). The database checks the same shapes. |
| `newTournamentSchema`, `istMoment(day, time)`, `istParts(moment)` | At `@rivr/contracts/tournaments` (redesign RD-26): a new tournament as the console's panel takes it, its name, IST day and 24-hour time, and game, strict so no money is ever sent; an IST day and time as the moment it is, and a moment as its IST day and time. |
| `promotionRefusalSchema` | The reason a super admin sends a waiting promotion's version back to draft, 3 to 300 characters, which its author reads (#144, decisions 0244 and 0471). |
| `handEntrySchema`, `HAND_VARIANTS` | A hand as the dealer enters it on the tablet (#42): the pot in whole rupees as the keypad types it (whole ₹50 chips, up to ₹1 crore) and the game (`holdem`, `plo`, `bomb_pot`); `log_hand` checks both again. |
| `waitlistCalledSchema` | The payload of `waitlist.called` (member, table, seat, hold expiry) that the WhatsApp consumer sends for (#62). It names the member, never a number. |
| `reviewRequestedSchema` | The payload of `review.requested` (#159: the request, the member and the venue's review link). Nothing emits it since the review link was removed (redesign RD-18); it goes with #954. |
| `cageAgentRequestSchema`, `CageAgentRequest` | What the cage agent asks the `cage-agent` function (#168, decision 0260): to enrol, the six-digit code and the SHA-256 of its token; then the newest offline pack; and the KOTs waiting, 1 to 20 at a time, and how each one went (#123). |
| `FNB_ITEM_KINDS`, `fnbLineSchema`, `fnbOrderSchema`, `fnbItemSchema`, `fnbOrderedSchema` and their types | Table-side food and drink (#123, decision 0261): an item's kind (food, soft drink, alcohol); an order's line (an item and 1 to 9 of it) and an order (1 to 20 lines); a menu item as staff save it (a name of 1 to 60 characters, a place from 1 to 999); and `fnb.ordered`, the KOT the bar printer prints. |
| `offlinePackRowSchema`, `OfflinePackRow`, `offlinePackVenuesSchema`, `storedPacksSchema` | The offline pack as `public.offline_pack(venue)` returns it, the venues the nightly job packs (never the practice venue), and what Storage lists of a venue's packs (#168). |
| `signInCodeSchema` | A one-time sign-in code: six digits. The sign-in form and the hook payload both use it. |
| `sendSmsHookSchema`, `SignInCodeToSend` | Supabase Auth's Send SMS hook payload, parsed to the number being checked (`sms.phone`, E.164), and the six-digit code. |
| `ATTRIBUTION_PARAMS`, `attributionFrom`, `attributionSearch`, `Attribution`, `AttributionField` | The referral, creator and UTM codes a link carries (`ref`, `creator`, `utm_*`): read from a query string, malformed ones dropped, and written back. `@rivr/contracts/attribution` holds no Zod. |
| `returnPathFrom`, `returnSearchFrom`, `ReturnSearch` | The screen a link pointed at, carried through sign-in and sign-up as `?next=`: only a path in the same app (letters, digits, hyphens and slashes), never another site. `returnSearchFrom` is a route's `validateSearch` and always sets `next`, so an outside address is replaced. `@rivr/contracts/returnPath` holds no Zod. |
| `siteBlockSchema`, `SiteBlock`, `SITE_BLOCK_KINDS`, `PLAYER_DESTINATIONS`, `PlayerDestination` | A website block as `site_block.content` holds it, by kind (`hero`, `statement`, `gallery`, `feature`, `text`, `rules`, `faq`, `careers`, `map`, `links`, and the live `games` and `calendar`, whose rows come from public views); an optional field left blank is not shown. A map's directions go only to a Google Maps page over HTTPS. A block links into the player app only by a named destination (`sign-up`, `waitlist`, which is Home), never a raw address. Also at `@rivr/contracts/site`. Media (a hero's loop and still, a statement's, gallery's or feature's picture) is only a path to the website's own files, `/media/<name>.webp` or `.mp4`: never another site, never a path that climbs (decision 0118).; decision 0166 adds `story`, `cards` (linking only to the site's own pages), `marquee`, `timeline`, `table` and the live `promotions`, and a phone and email on `map` |

Feature keys, roles and settings schemas live here too, each documented in its own file. A setting only a super admin may change carries `superAdminOnly`; a test in `@rivr/db` matches it to the database's guard triggers (#604).

## Usage

```ts
import { err, ok, paiseSchema, upiVpaSchema, type Paise, type Result, type UpiVpa } from '@rivr/contracts';

function readPayee(row: { amount: string; vpa: string }): Result<{ amount: Paise; vpa: UpiVpa }, 'bad_row'> {
  const amount = paiseSchema.safeParse(row.amount);
  const vpa = upiVpaSchema.safeParse(row.vpa);
  return amount.success && vpa.success ? ok({ amount: amount.data, vpa: vpa.data }) : err('bad_row');
}
```

## Must not

- Import another `@rivr` package. Everything depends on this one.
- Hold business rules or compute money. A schema checks a shape; `@rivr/domain` decides what it means.
- Accept a JavaScript number as money, anywhere.

## Push

- `WEB_PUSH_PUBLIC_KEY`: the club's VAPID public key, public by design (decision 0272). `PUSH_SERVICE_ADDRESS` and `pushSubscriptionSchema`: a browser's push subscription, only at the browsers' own push services.
- `callTimeCompletedSchema`, `sessionReminderSchema`: the payloads the push consumer reads, beside `waitlistCalledSchema` and `promotionOfferedSchema`.
- The lock-screen live status (decisions 0323, 0360, 0361): `LIVE_STATUS_PLATFORMS` (`ios`, `android`); `liveStatusDeviceSchema`, a phone as the native app saves it (an iPhone's push-to-start token in hex and its APNs device token for alerts, an Android phone's Firebase token); `liveStatusTokenReportSchema`, an iPhone's Live Activity token reported with its own key to `live-status-token`; `waitlistMovedSchema`, the payload of `waitlist.moved`, emitted whenever a place on a list joins, is approved, is called or uncalled, sits or leaves.
- `callTimeEndingSchema` (15 minutes or less to run, with the table, seat and `ends_at`) and `callTimeUpdatedSchema` (the floor added time): the call time's events (decision 0320). With `waitlistCalledSchema` (now with its `entry_id`) and `seat.taken`, the events phase 2's lock-screen status runs on (decision 0323).
