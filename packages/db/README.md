# @rivr/db

The only code that talks to Supabase. It holds the typed client, the generated database types, the provider every app wraps its root in, and the hooks screens read data through. Row-level security in the database decides what each person sees; this package never filters for security.

## Public API

| Export | What it does |
|---|---|
| `createRivrClient({ url, publishableKey })` | The one client an app uses. Never pass the service-role key. A tablet, cage computer or TV signs in as its own device login; that login is how the audit log knows the device. |
| `RivrClient`, `RivrClientOptions` | The client's type and its options. |
| `RivrDataProvider` | Wraps an app: client, query cache, the signed-in user, and one Realtime channel that refreshes feature access and kill-switch state when an admin changes them. |
| `useFeature(key)` | How a member-facing feature shows for the signed-in member: `{ state: 'enabled' }`, `{ state: 'locked', tiers }` or `{ state: 'hidden' }`. Pass it to `FeatureGate`. Hidden until known. |
| `useFeatureStatus(key)`, `FeatureStatus` | The same access for a screen that shows something with or without the feature: `loading`, `error` (with `retry`) or `ready` with the `access`, so the screen waits rather than switching once access arrives. |
| `useControlState(venueId?)` | The kill switch: `isVenueFrozen`, `killedFeatures`, `isMemberFrozen` (member apps). Drives `KillSwitchBanner`. |
| `useSignIn()` | Sign-in by mobile number and one-time code, for every app. `requestCode.mutateAsync({ phone })` asks Auth to send a code; `verifyCode.mutateAsync({ phone, code })` checks it, links the records registered under the number (`link_my_login`) and refetches the person's cached queries, or signs out on this device if linking fails. Each resolves to a `SignInResult`: `ok`, or a `SignInFailure` of `code_rejected` (wrong or expired, which Auth does not tell apart), `too_many_requests` or `unavailable`. |
| `useSignOut()` | Signs out on this device only (other devices stay signed in) and drops the person's cached data. `mutate()`; `isPending` for the button. |
| `StaffVenueProvider`, `useStaffVenue()`, `StaffVenueState` | The venue the console works in for signed-in staff: the club, or the practice venue while they train (`setPractice`, offered when `canPractise`). `loading`, `error` (with `retry`), `not-staff`, or `ready` with the `StaffVenue`. Wrap the console in the provider, inside `RivrDataProvider` (decision 0032). |
| `useStaffAcademyBatches(venueId)`, `useStaffAcademyBookings(venueId)` | A venue's Academy batches (open or closed, with the seats taken as the database counts them: `staff_academy_batches`) and its bookings that are not cancelled, as Academy staff and the cage see them: the member or company, seats, amount in paise, status, UTR and who recorded it. |
| `useStaffAcademyActions(venueId)` | `openBatch`, `bookCompany` (the contact found by their number; a request id books once), `recordPayment`, `cancelBooking` for Academy staff; `confirmPayment` and `rejectPayment` for the cage. Each resolves to a Result (`AcademyStaffFailure`) and reloads the venue's Academy data. |
| `useStaffVenues()`, `StaffVenue` | Every venue where the signed-in person is active staff, the club first: name, practice or not, their name, role and the role's `permissions`. |
| `useKycReviewQueue(venueId)`, `KycCheck` | A venue's identity checks for a KYC reviewer (`kyc_review_queue`): those waiting for review first, then the stopped and the refused, with what the vendor found and the members whose checks hold the same PAN, Aadhaar or face. |
| `useKycReviewActions(venueId)` | `reopen({ memberId, reason })` (`reopen_kyc_check`, #267): a super admin reopens a refused check done in person, so it can be done again. `review({ memberId, approve, reason, dateOfBirth?, pan? })` (`review_kyc`): resolves to `verified` or `refused` (the gate refuses under 18 and duplicates of a verified member whatever the reviewer decides), or a `KycReviewFailure`; reloads the queue. |
| `useKycInPersonCandidates(venueId, search)`, `KycCandidate` | The members a KYC reviewer may check in person (`kyc_in_person_candidates`), found by name or the last digits of their number once two characters are typed: no check yet, or one the app never finished, never the reviewer's own; twenty at most, with only the last four digits of the number. |
| `useKycInPerson(venueId)` | `check({ memberId, dateOfBirth, aadhaarLast4, pan, consent: true, photo })` through the `kyc-in-person` Edge Function (#246): the member's photo becomes their KYC photo and the gate settles the check as `manual`. Resolves to `verified` or `refused`, or a `KycInPersonFailure` (`not_allowed`, `decided`, `no_photo`, `invalid`, `stopped`, `unavailable`). |
| `useKycImageUrl(path)`, `KYC_IMAGE_URL_SECONDS` | A signed URL, valid for a minute, for one KYC image in the private `kyc` bucket (`<venue_id>/<member_id>/<file>`). The `kyc-image-url` Edge Function signs it for staff with KYC review or the cage at that venue and audits the view; no client reads the bucket. The one way an app shows a KYC image. |
| `useCageMembers(venueId, query)`, `useCageQueue(venueId)`, `useCageActions(venueId)` | The cage (#57): members found by name or mobile (`CageMember`: KYC, photo, wallet, bonus, markers, seat and the table's minimum, a break); the tables' waiting buy-in requests (`BuyInRequest`, asked every five seconds); `buyIn(BuyInOrder)` and `decline(requestId)`, each a Result (`CageFailure`). |
| `useFloorSeats(venueId)`, `useHeldSeats(venueId)`, `useSeatActions(venueId)` | Who sits where (`SeatedPlayer`: session, table, seat, tier, `startedAt` for call time, must-move turn; asked every ten seconds), the seats held for waitlist calls (`HeldSeat`), and `seat`, `move`, `leave`, `setOpen` and `setMustMove`, each a Result (`SeatFailure`) (#77). `FloorTable.mustMoveToTableId` names the main table a must-move table feeds. |
| `useDoorBoard(venueId)`, `useCheckInActions(venueId)` | The door's lists for the front desk (`DoorMember`: expected, on a waitlist and not yet in the room, or in the room since check-in; asked every ten seconds), and `checkIn(memberId)` and `checkInByPhone(phone)`, each a Result with the visit's id (`CheckInFailure`: `not_allowed`, `no_member`, `on_break`, `stopped`, `paused`, `unavailable`) (#72). |
| `useRestrictions()`, `useRestrictionActions()` | The signed-in member's `breakUntil` (the break running now, or null) and `sessionReminder` (4, 6 or 8 hours, or null) (#56); `setReminder(hours \| null)` and `takeBreak(days)` (1, 7 or 30, `BREAK_DAYS`), each a Result, reloading the member's waitlist places, which a break ends. |
| `usePreferences()` | The signed-in member's `games`, `stake` (blinds in paise, or null), `notificationsOff` (push types turned off; every other is on) and `marketing` (consent in force). |
| `usePreferenceActions()` | `saveGames({ games, stake })`, `setNotification({ type, isOn })` and `setMarketing(isOn)` (gives or withdraws the marketing consent). Each resolves to a Result and reloads the choices. `GAMES` and `PUSH_CHOICES` list the options. |
| `useSignUp()` | Joins the signed-in number to the club (`public.sign_up`): links a member staff registered, or creates one with the name given and the codes of the link the player arrived by. Resolves to a Result (`invalid_name`, `staff`, `stopped`, `unavailable`). |
| `rememberAttribution(search)`, `storedAttribution()` | Keeps the referral, creator and UTM codes of the first link the app opened with (30 days, this browser), for `useSignUp` to carry. The player app calls `rememberAttribution(window.location.search)` once at start. |
| `useAcademyBatches()`, `useAcademyBookings()`, `useAcademyPayment(bookingId)` | The Academy batches the member can book (seats left, fee in paise); their own seats, also once the batch has closed or started, and a seat the cage cancelled by turning down its UTR after the hold (`cancelled`, #222), with the UTR given, the last one the cashier turned down and, while unpaid, `holdUntil`: when the seat stops being held (`my_academy_bookings`, never the table); and what to pay and the club's UPI for an unpaid one. |
| `useAcademyActions()` | `book(batchId)` (resolves to the booking's id) and `claimPayment({ bookingId, utr })`. Each resolves to a Result (`full`, `closed`, `not_open`, `stopped`, `no_fee`, `invalid_utr`, `utr_used`, `unavailable`). |
| `useFloorTables()` | Tonight's tables in floor order (`FloorTable`: venue, name, open or closed, seats, game and stakes in paise, buy-in, straddle) with how many wait for each game. A member reads them only with `floor.live_view`; staff read every venue they work at, so the console filters by `venueId`. Refreshes every ten seconds. |
| `useMyWaitlist()`, `useWaitlistActions()` | The member's own places (`WaitlistPlace`, with their number on each list, `my_waitlist`), and `join({ tableTypeId, requestId })` and `leave(entryId)`, each a Result (`WaitlistFailure`: `not_open`, `kyc_needed`, `on_break` (#56), `stopped` for the member frozen, `paused` for the venue, `no_member`, `invalid`, `unavailable`). |
| `useMyDevice()`, `usePairDevice()` | The signed-in dealer tablet (`MyDevice`: name and the table it is fixed to, asked every 30 seconds; null for anyone else), and `mutateAsync(code)`, which pairs this tablet with the code read out from the console and keeps its session, as a Result (`PairFailure`: `wrong_code`, `unavailable`) (#41). |
| `useDealerTablets(venueId)`, `useDeviceActions(venueId)` | The venue's dealer tablets for staff with `devices.manage` (`DealerTablet`: paired or not, and its table), and `add({ name, staffId })`, which also starts pairing, `pair(deviceId)`, each giving a `PairingCode`; `assign({ deviceId, tableId })` and `revoke({ deviceId, reason })`, each a Result (`DeviceFailure`). |
| `useTvPairing()`, `useMyTvScreen()` | On the TV (#49): while no one is signed in, a code to show (`TvPairing`: `code` with when it runs out, or `loading`, `too_many`, `unavailable`, asked again after a minute), and the TV asks device-pair every three seconds whether staff typed it in, signing in as itself once they have and taking a new code once device-pair says this one ran out; then the TV's name and mode (`MyTvScreen`, asked every ten seconds). A session that is not a paired TV's is signed out there, so an unpaired TV shows a new code. |
| `useVenueTvs(venueId)`, `useTvActions(venueId)` | The venue's TVs for staff with `devices.manage` (`VenueTv`: paired or still waiting for the TV, and its mode, asked every ten seconds), and `pair({ code, name, mode })`, `setMode({ deviceId, mode })` and `unpair({ deviceId, reason })`, each a Result (`TvFailure`: `wrong_code`, `not_allowed`, `paused`, `invalid`, `unavailable`). |
| `useVenueDealers(venueId)`, `useSetDealerPin(venueId)` | The dealers whose PIN the signed-in manager may set (`VenueDealer`: has a PIN, locked until), and `mutateAsync({ staffId, pin })`, a Result (`DealerPinFailure`) (#41, decision 0046). |
| `useTabletDealers()`, `useCurrentDown(tableId)`, `useDownActions()` | On the tablet: the dealers with a PIN (asked every 15 seconds); the down at its table once it is fixed to one (`CurrentDown`, kept by table, asked every 30 seconds; null between downs); `signIn({ staffId, pin })`, which starts the down (`DealerSignInFailure`: `wrong_pin` with `triesLeft`, `locked`, `paused`, `unavailable`), and `end()`. |
| `useTableRules(tableId)`, `useDownHands(downId)` | On the tablet (#42): its table's rules now (`TableRules`: @rivr/domain `RakeRules` for `potTake`, and whether it plays variations; kept by table, asked every minute); the hands of the open down on the tablet (`DownHand`, latest first, kept by down). |
| `useHandQueue()` | On the tablet (#43), the one way it logs hands: `log(QueuedHand, requestId)` keeps the hand (pot, variant, `playedAt` and any high-hand claim) in the `@rivr/offline` queue `tablet-hands` and sends it, oldest first, by log_hand and then claim_high_hand, now, when the connection is back, or when the tablet opens again after a reload. A replay lands once by its key. A frozen venue, a switch turned off, a lost connection or a server error is tried again; any other refusal is set aside for a supervisor. `pending` and `refused` count what waits and what was set aside (`HandQueueState`). |
| `useTableTypeRake(venueId)`, `useRakeChangeActions(venueId)` | The venue's table types with their rake (#37): `TableTypeRake` with the rule `inForce` (a `RakeSetting`; `effectiveFrom` null since opening) and the changes `scheduled`, soonest first, found by `@rivr/domain/settings` `ruleAt` and asked every minute; `schedule(RakeChange)` adds a rake.config row (the cap as `Paise`) from a time more than a minute away, and `withdraw(settingId)` removes one still more than a minute away (one already withdrawn counts as done), each a Result (`RakeChangeFailure`: `not_allowed`, `invalid`, `too_soon`, `unavailable`; question #302). Writes go through the `setting` table's row-level security (`settings.manage`). |
| `useJackpot(venueId)`, `useJackpotActions(venueId)` | The venue's jackpot (#48) for staff who pay jackpots or read the ledger: `main`, `season` and `freeroll` pools, the payout `rule` (@rivr/domain `PayoutRule`, null when unset) and `events` (`JackpotEvent`, latest first), asked every half minute; `pay(BadBeat)` pays a bad beat in chips and `reverse({ eventId, reason, requestId })` reverses a payout once, each a Result (`JackpotFailure`). |
| `useTabletHighHands()` | On the tablet (#47): its own high-hand claims (`TabletHighHand`: the hand, category, seat and the floor's decision, asked every 15 seconds). A claim is sent with its hand through `useHandQueue`. |
| `useHighHands(venueId)`, `useHighHandActions(venueId)` | The venue's high hands for staff who approve jackpots or read the ledger (`HighHand`, latest first, with what a waiting claim pays now, asked every ten seconds); `approve({ claimId, payout })` pays the amount shown and `reject({ claimId, reason })`, each a Result (`HighHandFailure`: `not_allowed`, also for the dealer of the hand, `decided`, `changed`, `paused`, `switched_off`, `invalid`, `unavailable`). |
| `useWaitlistBoard(venueId)`, `useFloorWaitlistActions(venueId)` | The venue's lists for the floor (`WaitlistBoardEntry`, in priority order, with names, who the floor added and `priorityReason`, the tier that put a place ahead of join time; `waitlist.manage`), and `add({ tableTypeId, phone, requestId })` and `remove(entryId)`. |
| `useWaitlistCallActions()` | The floor's call-down (#63): `call({ entryId, tableId, seat })` holds a seat for the member and sends the seat call, `seat(entryId)` seats a called member and takes the place off every list, `away({ entryId, isAway })` skips a place or brings it back. A place's `callTableName`, `callSeat`, `holdUntil` and `awayUntil` say where it stands; members step away with `useWaitlistActions().stepAway`. |
| `useKycRecord()` | The signed-in member's identity check: `status` (`started`, `needs_pan`, `needs_review`, `verified`, `refused`), `hasSelfie`, date of birth, masked Aadhaar and PAN, or null before the first check. |
| `useKycActions()` | `sendSelfie(photo)` (a JPEG, first), `start()` (the DigiLocker hand-off URL), `complete()` and `verifyPan({ pan, dateOfBirth? })`, through the `kyc` Edge Function. Each resolves to a Result; failures are `not_configured` (a real venue without vendor keys), `not_live`, `pan_rejected`, `stopped`, `too_many_attempts` or `unavailable` (`toKycFailure`). |
| `shrinkPhoto(photo)`, `toBase64(photo)` | A camera photo as the JPEG the KYC functions take (at most 1024 px on its longest side), and a photo as base64, for their bodies or a `data:` preview. |
| `useAuthStatus()`, `AuthStatus` | `loading` until the stored session is read, then `signed-in` or `signed-out`: what an app decides sign-in by. |
| `useMember()`, `Member` | The signed-in member (id, name, initial), or null for staff and the public. A login with no member yet links once and asks again. |
| `useRivrData()` | The client and user id, for the query hooks lanes add. |
| `queryKeys` | Every TanStack Query key. Keys holding a person's data start with their user id. |
| `Database` | The generated types (`pnpm db:types`). |
| `toFeatureAccess`, `toFeatureAccessMap`, `HIDDEN`, `FeatureAccess`, `FeatureAccessRow` | The parser behind `useFeature`, the "not known yet" value, and their types. |
| `toControlState`, `NOTHING_ENGAGED`, `ControlState`, `KillableFeature` | The parser behind `useControlState`, the "nothing engaged" value, and their types. |
| `toSignInFailure`, `SignInFailure`, `SignInResult` | The parser behind `useSignIn`'s failures (Auth's error to `code_rejected`, `too_many_requests` or `unavailable`), and the types. |
| `fetchSitePage(client, slug)`, `SitePage`, `SiteLink` (from `@rivr/db/site`) | For the website's server: a published page of the club's website from the public views, with its readable blocks in order and the navigation, and, when its blocks need them, the club's games (`SiteGame`, from `public_table_status`, with how many wait from `public_waitlist_length`) and coming tournaments (`SiteTournament`, from `public_tournament_calendar`), or null for a draft or no such page, as a Result: `unavailable` when the database cannot be read (decision 0036). A subpath, so Zod stays out of the other apps. |

## Usage

```tsx
import { createRivrClient, RivrDataProvider, useFeature } from '@rivr/db';
import { FeatureGate } from '@rivr/ui';

const client = createRivrClient({ url: import.meta.env.VITE_SUPABASE_URL, publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY });

function LearnTab() {
  return <FeatureGate access={useFeature('learn.library')}><LearnLibrary /></FeatureGate>;
}

root.render(<RivrDataProvider client={client}><App /></RivrDataProvider>);
```

Apps sign in through `useSignIn`, whose `verifyCode` calls `link_my_login`: it links the staff and member records registered under the login's verified phone. No client ever writes a login onto a record.

## How a feature is decided

The database decides; this package only carries the answer to the screen.

1. `public.my_feature_access()` returns one row per feature for the signed-in member. For each, `private.feature_state` applies, in order: the member's own override (a super admin's grant or removal), then the cell for the member's tier in the tier × feature matrix that is in force now, then off.
2. `toFeatureAccessMap` turns the rows into `enabled`, `locked` (with the tiers that have it, for "Black card only.") or `hidden`. An unknown state reads as `hidden`, the safe reading.
3. `useFeature(key)` returns that entry, or `hidden` while signed out or loading, so a locked entry point never flashes open.
4. When an admin edits the matrix, an override, a member's tier or a kill switch, the Realtime channel in `RivrDataProvider` marks the cached query stale and open screens refetch.

The same `private.has_feature` check guards the feature's tables and write functions, so hiding an entry point is never the only protection.

`FeatureAccess` here has the same shape as `FeatureAccess` in `@rivr/ui`. It is declared twice on purpose: `@rivr/ui` may not import `@rivr/db` (docs/decisions/0010), and TypeScript checks the two match wherever an app passes one to the other.

## Adding data access for a feature

1. The migration grants the table or function and adds its policies (`.claude/skills/new-migration`).
2. `pnpm db:reset && pnpm db:types`. CI regenerates the types and fails if the committed file differs.
3. Add a query key here and a hook (`useXxx`) that calls the client, parses rows in `src/parse/` and returns typed data.
4. Apps import the hook. Nothing outside this package imports `@supabase/supabase-js` (dependency-cruiser enforces it).

`src/catalogues.test.ts` checks that the feature catalogue, the role matrix and the setting keys in `@rivr/contracts` match the migrations. It reads every migration's SQL with regular expressions written for the way those inserts are laid out today: `insert into public.feature (...) values ('key', ..., true|false), ...;`, `select '<role>', permission from unnest(array['a.b', ...])`, and setting keys as `('key', 'description', 'scope', '{json schema}')`. A new migration that adds any of these must use the same shapes, or the test must be extended to read it; otherwise the test cannot see the new key and fails.

## Must not

- Compute money or apply business rules. Those live in `@rivr/domain` (or a SQL function proved equal to it).
- Hold the service-role key or any secret.
- Import a runtime value from the `@rivr/contracts` index. Use the module itself (`@rivr/contracts/result`): the index builds every Zod schema, which would put Zod on the player app's first screen (#11). Type-only imports from the index are fine.
- Filter rows for security in TypeScript. If a person must not see a row, the policy says so.
