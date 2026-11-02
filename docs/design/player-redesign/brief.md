# RIVR player app redesign: build brief

You are implementing an approved redesign of the RIVR **player app** (`apps/player`) in the `adwate-ui/rivr-platform` monorepo. Build it to match the reference prototype exactly: layout, spacing, copy, states and behaviour.

## 0. Reference and scope

- **Reference prototype:** `~/Downloads/RIVR Prototype.dc.html`. Open it in a browser. The right-hand panel jumps to every screen and state.
  - The file is the spec. Read its source as well as the rendered page.
  - The markup between `<x-dc>` and `</x-dc>` holds every layout, style value and string.
  - The `class Component` block holds every state, transition and timing.
  - Where this brief and the prototype disagree, the prototype wins on visuals and copy. This brief wins on architecture and data.
- **In scope:** `apps/player` only. You also touch `packages/ui` (new shared components), `packages/i18n` (copy) and, where section 7 says so, `packages/db` and `supabase/`.
- **Out of scope:** `apps/web` (the website), `apps/console`, `apps/display`, `apps/tablet`. The exception is the minimal floor-side changes that section 7 lists as required.
- Read `CLAUDE.md` and the `docs/decisions/` entries it points to before you start. Follow the repo's conventions for tokens, i18n, feature gates, tests and decision records.

## 1. Ground rules

1. **Tokens only.** Use `@rivr/tokens`. Do not add new colours. The prototype uses only:
   - `green #0E3B2C` (surface)
   - `green-black #0A2A20` (raised: sheets, tab bar, inputs, cards)
   - `cream #F3EDE0` (content)
   - `cream 60%` (muted)
   - `cream 50%` (control edge)
   - `gold #C9A85C` (primary action, accents, progress)
   - `gold 25%` (hairline)
   - `red #C4162A` (alert fills, and the call-time ring under 15 min)
   - `ink #141414` (text on cream)

   A few prototype values are tints of these, such as `rgba(201,168,92,.12/.2/.35)` for selected or tinted gold. Add them as named tokens in `packages/tokens/tokens.json`, for example `color.gold-tint`, `color.gold-edge` and `color.cream-track`. Do not hard-code them.
2. **Type.**
   - Bodoni Moda (`font-family-display`) for titles, big figures and timers. Never below 20px.
   - Instrument Sans for everything else.
   - Tabular figures everywhere, which the base layer already sets.
3. **Copy.** Copy every string from the prototype verbatim into `packages/i18n` under `player.*` keys. Do not paraphrase, add helper text or pad. The owner rejected explanatory copy, so keep labels short and plain.
4. **Touch targets.** At least 44×44px for every interactive element (`size.touch`).
5. **Feature gates.** Keep every existing `useFeature(...)` / `FeatureGate` check, including `floor.live_view`, `call_time.view`, `table.top_up`, `table.leave` and `fnb.table_side`. Locked tiers still show `LockedNotice`, restyled to the new system.
6. **Motion.** Use only `motion.duration.state` (200ms), ease-out:
   - Sheets slide up in 240ms.
   - The scrim fades in.
   - Push banners drop in.
   - Progress bars and the ring animate over 1s, linear.

   Respect `prefers-reduced-motion`; the existing base CSS already zeroes durations. Add a `durations.sheet = 240ms` token if needed.
7. **Accessibility.**
   - Timers use `role="timer"` with a readable `aria-label`, for example "Call time left 2h 41m".
   - Live regions are `aria-live="polite"`: toast, order tracker, banners (`role="status"`) and push (`role="alert"`).
   - Every icon-only button has an `aria-label`.
   - Switches use `role="switch"`.
   - The seat map is `role="img"` with an `aria-label` ("3 of 9 seats open").
8. **No regressions.** Update the unit tests (`*.test.tsx`) for every component you change and the Playwright flows in `e2e/flows`. Add tests for every new state listed in section 9.

## 2. Global structure

### 2.1 Navigation

- **Bottom tabs** (64px, raised, gold hairline top): **Tonight** (`/`), **Sessions**, **Card**, **Rewards**.
  - The active tab is cream and inactive tabs are muted.
  - Icons are 22px line icons with a 1.5 stroke; reuse or add them in `packages/ui`.
- **Remove the Menu tab.** Food and drink is now a pushed screen (`/fnb`) reached only from the seated Home ("Order to my seat") and "Order again". Direct visits to `/fnb` when not seated redirect to `/`.
- **Card** becomes a tab, served by the existing `features/card`.
- **Profile** has no tab. It opens from a 44px circular avatar button (initial, cream-50% border) at the top right of every tab screen, and has a back button that returns to the last tab.
- Tabs show on Tonight, Sessions, Session detail, Card, Rewards and Not found. They are hidden on sign-in, sign-up, KYC, Order, Profile and House rules.

### 2.2 Alert system (new, in `packages/ui`)

Replace the current mix of ad-hoc notices with exactly four patterns. Nothing else may show an alert.

| Pattern | Component | Where | Used for |
|---|---|---|---|
| **Banner** | `<Banner tone="neutral|alert" action? onDismiss?>` | Top of Tonight only, under the header, stacked with an 8px gap | Club notices (dismissible; browsing state only), Offline, "Couldn't refresh" (action: Retry), "Call time ends in N min" (action: Add time; seated only), Club paused (`tone="alert"`, red fill, not dismissible) |
| **Toast** | `<Toast>` + `useToast()` | Bottom, 20px inset, above the tab bar, 3.2s | Confirms the member's own action. Has an **Undo** action when reversible ("Joined waitlist", "Left waitlist") |
| **Push** | Web Push / native | Outside the app | Only two: **Seat ready** (action "I'm on my way") and **Call time ends in 15 min** (action "Add time") |
| **Field error** | existing `ErrorMessage`, restyled | Under its field | Red 8px dot and cream text. Never red text on green |

Banner spec:
- `min-height 48`, radius 6, padding `10 8 10 14`.
- Neutral: raised background with a gold-35% border and a gold info icon.
- Alert: red background and border with a cream icon.
- Text 14/500.
- The optional action is an outlined 44px button. Dismiss is a 32px ×.

Delete or migrate:
- `ClubNotices` becomes a Banner.
- `BreakNotice` is removed.
- `SeatNotes` text lines are replaced by the seated status list or the order tracker.
- The kill-switch strip becomes an alert Banner.
- The offline strip in `features/frame` becomes a Banner.
- Inline success texts such as "Sent to the bar. Order 1." become toasts.

### 2.3 Sheets (new `<Sheet>` in `packages/ui`)

- Bottom sheet with a scrim (`rgba(5,15,11,.6)`); tapping the scrim closes it.
- Raised background, 16px top radius, gold hairline top, 36×4 grabber, padding `12 20 36`, max-height 720 with internal scroll, slide-up animation, focus trap and Escape to close.
- All of these are Sheets: join table, all tables, top up, add time, leave seat, redeem, feedback, cookie choice and the sign-up pickers.

### 2.4 Pickers (new `<PickerSheet>`)

- Opens from a field button: a 60px tall raised box with the label at 12px muted inside the box, the value at 16px and a chevron.
- Options are 52px rows with a radio (single) or checkbox (multi) on the right.
- Single select closes when you pick. Multi select closes with **Done** or the scrim.
- This replaces the chip grids in sign-up.

### 2.5 Haptics

`haptic()` util: `navigator.vibrate?.(12)`, no-op when unsupported. Fire it on:
- joining a waitlist
- seat called (when the app is open)
- seated
- order sent

### 2.6 Loading and stale data

- **First load** is a skeleton (blocks at `cream 8%` / `5%`), never the word "Loading".
- **Refetch failure keeps the last data** on screen and shows the neutral Banner "Couldn't refresh. Showing HH:MM." with Retry. The full-screen error only shows when there is no cached data at all.
- Keep the query cache warm across tab switches; use TanStack Query `placeholderData` and `staleTime`.

## 3. Screens

Each item lists the prototype state(s) to match, the files to change and the behaviour.

### 3.1 Sign in (`features/sign-in`, `features/frame/CookieChoices`)

- **Splash:**
  - Large wordmark tiles (44×58, Bodoni 36), "POKER CLUB" at 13px with 0.3em tracking, and "Skill runs deep." in Bodoni italic 22 muted.
  - The form is anchored to the bottom: "Sign in or join", a +91 field and a **Send code** button.
  - Legal line: "Members only, 18+. By continuing you accept the terms and privacy notice."
- **Cookies** are a Sheet on first launch: "Cookies" / "Essential storage only, unless you allow analytics." with the buttons **Essential only** and **Allow analytics**.
- **Phone error** shows under the field: "Enter a 10-digit mobile number."
- **Code** (`CodeStep`):
  - Six separate 60px cells.
  - The active cell has a gold border; on error all cells have red borders.
  - A single hidden input sits over them (`inputmode="numeric"`, `autocomplete="one-time-code"`).
- **SMS auto-fill:** implement the WebOTP API (`navigator.credentials.get({ otp: { transport: ['sms'] } })`) where supported. The SMS template must end with `@<host> #<code>`, so update the Supabase SMS template.
  - On fill, show "✓ Filled from SMS" in gold and auto-submit.
  - Keep manual entry, the resend countdown ("Resend code in 0:24") and the error "That code didn't match. 2 tries left."

### 3.2 Sign up: About you (`features/sign-up/SignUpScreen`)

- **Top bar:** back chevron, a 2-segment progress bar (gold / cream 20%) and "1 of 2".
- **Title:** "About you" (Bodoni 40). Subtitle: "Signing up with +91 …".
- **Fields** are 60px boxes with the label inside:
  - "Full name, as on Aadhaar"
  - "City"
- **"Your game"** eyebrow, then three picker fields:
  - **Occupation:** single select. Options: Salaried, Business owner, Self-employed professional, Student, Homemaker, Retired, Prefer not to say.
  - **When you usually play:** single select. Options: Weekday afternoons, Weekday evenings, Late nights, Weekends.
  - **Games you play:** multi select. Options: Hold'em, PLO, Bomb pots, ROE. The value shows comma-joined, or "Select any".

  Map the new option labels to the existing stored enum values; do not change the DB values.
- **Remove "Add a photo".** The KYC selfie becomes the profile photo.
- **Continue** is pinned in a footer (gold hairline top). It validates name, city and occupation.
  - Name error: "Enter your name in English, as on Aadhaar."
  - City error: "Enter your city."
  - Occupation error: "Select your occupation."
- **Remove "Use another number"**; the back chevron returns to the phone step.

### 3.3 Identity check (`features/kyc`)

- **Start** (`KycStartScreen`, `KycSteps`):
  - Eyebrow "Step 2 of 2", title "Verify your identity", subtitle "Required before you play."
  - Three ruled step rows: Selfie ("A photo of your face"), DigiLocker ("Aadhaar and OTP"), Verified.
  - Storage line: "We store your photo, date of birth, address, PAN and the last 4 digits of your Aadhaar."
  - Primary button: **Take a selfie**, then **Continue to DigiLocker** once the selfie is done, with a busy spinner. Below it, a **Sign out** text button.
  - **Remove** "The front desk can check you in person" and every "prefer in person" alternative from this flow. The front desk appears only on the *Not verified* screen ("Bring your Aadhaar and PAN to the front desk.").
- **Resume:** when a member returns with KYC partly done, open at their exact step with the title "Pick up where you left off". Derive the step from the KYC record (selfie stored → step 2).
- **Camera** (`SelfieStep`, `SelfieTips`):
  - Full-bleed dark camera with an oval guide (250×330, 3px border).
  - The guidance line is live: "Move closer" → "Hold still" → "Capturing". The oval border goes from cream 60% to gold when the face is good.
  - Three tip chips: Even light, No cap or sunglasses, Only you.
  - **Auto-capture** once a single face fills the oval and holds steady for about 1s. Use the browser `FaceDetector` where available, otherwise a small on-device model such as MediaPipe Face Detection loaded lazily. The manual shutter (76px) stays.
  - Delete the green placeholder artwork.
- **Review:** "Use this photo?", a 3:4 preview, and **Retake** / **Use photo**.
- **Verified** (new screen; `KycVerified` exists): gold check, "You're verified.", "Welcome to RIVR, {first name}.", button **See tonight's tables**.
- **PAN fallback** (`PanStep`):
  - "Verify with PAN" / "DigiLocker didn't finish. Use your PAN instead."
  - PAN field, then date of birth as DD / MM / YYYY with a numeric input mask. Do not use the native mm/dd/yyyy picker.
  - **Verify** / **Try DigiLocker again**.
- **Under review:** "We're checking your details" / "We'll notify you when it's done." with **Sign out**.
- **Not verified:** "We couldn't verify you" / "Bring your Aadhaar and PAN to the front desk." with **Sign out**.

### 3.4 Tonight (Home) (`features/home`, `features/waitlist`)

The layout is **direction 1b, "Live night"**: the member's own state dominates the screen, and the floor sits in a bottom sheet.

**Header:**
- When browsing or waiting: small wordmark tiles on the left and the avatar on the right.
- When seated: "Table 1 · Seat 4" (Bodoni 28) with "NLH 50/100 · playing 19 min", plus the avatar.

Banners sit under the header.

**A. Browsing (not on a list, not seated)**
1. Banners: notices (dismissible, browsing only), plus any system banners.
2. Optional **Rate your visit** card (see 3.4.F).
3. **Offers carousel.** The title "Tonight" (Bodoni 32) with an "N offers" count, then horizontally scrolling, snap-aligned cards.
   - Each card is 300×168, raised background, 1px gold border, radius 8.
   - Contents: gold eyebrow (title), Bodoni 28 offer line, muted schedule, gold arrow.
   - Source: the existing promotions data (`HomePromotions`). Tap opens the linked destination; Referral opens Rewards.
   - **Do not pre-select or feature a table.** The old "Table 1 · Take a seat" hero is removed.
4. **Tables sheet** (in flow, raised, 16px top radius, grabber):
   - "All tables" with "N running".
   - Rows: "{name} · {game} {stakes}", nine seat dots (gold = open, cream 35% = taken), the wait status on the right (gold when "No wait", otherwise muted) and "N open" underneath.
   - Closed tables show at 40% opacity and can't be tapped.
   - Below the rows: **Tournaments** rows with a **Notify me** / **Notifying you** pill (44px).
   - The referral card that used to sit here is removed; referral is now an offer card.

**B. Join sheet** (tap any open table):
- Gold eyebrow with the table name, then "{game long} {stakes}" in Bodoni 32.
- **Seat map:** an oval table (felt green, a 6px rim in `#3a2a14` (add a token), "RIVR" watermark) with nine numbered 34px seats around it.
  - Open seats are gold-tinted with a gold border; taken seats are muted.
  - Positions: seat n at angle `270° + n·36°` on an ellipse at 44% / 42% of the box.
  - Display only; members don't choose seats.
  - Needs per-seat occupancy; see section 7.
- Stats row: Seats open "3 of 9" | Waiting "None" | Call time "3 h".
- One button: **Take a seat** when there are seats and no wait, **Join waitlist** otherwise. When the club is paused, the button is disabled and reads "The club is paused".
- **The waitlist is per table** (`FloorList` / `useJoinWaitlist` with a table id). Remove any "any table at this stake" option.

**C. On the waitlist:**
- Centred eyebrow "Waitlist · Table 1 · NLH 50/100", the position as a Bodoni 160 numeral, "Next in line" (or the ordinal), and "Joined 22:44".
- One full-width outlined button: **Leave waitlist**. Leaving fires the toast "Left waitlist" with Undo.
- **Remove Step away** completely: UI, copy and the `no_time_away` path in the player app.
- A peek bar above the tabs reads "All tables · 4 running · 2 tournaments" and opens the tables Sheet.

**D. Seat ready:**
- Eyebrow "Your seat is ready", "Table 1, seat 4" (Bodoni 48), "NLH 50/100".
- **Live hold countdown** (Bodoni 72, `mm:ss`, ticking every second) with "Held until 23:04" and a 200px gold progress bar that drains over the 20-minute hold.
- **I'm on my way** (gold, with a busy spinner while sending) and **Decline seat** (text). These map to the existing seat-call accept and decline actions.
- Fire the **Seat ready** push when the floor calls the seat (section 7). Tapping the push opens this screen. The push action "I'm on my way" accepts without opening the app.

**E. Seated:**
- **Live call-time ring:** 236px, 4px stroke, gold on a cream-12% track, linear 1s transition.
  - The centre shows `h:mm:ss` in Bodoni 50, ticking every second, then "call time left · ends HH:MM".
  - Under 15 minutes, the ring turns red and the Banner "Call time ends in N min" (action: **Add time**) appears. Fire the call-time push once at 15 minutes.
  - Keep pausing the ring while away (`isPaused`).
- **Three round actions** (52px circles, cream-50% border, labels underneath):
  - **Top up** opens a Sheet titled "Top up" with the button **Request top-up**.
  - **Add time** opens a Sheet titled "Add time" with three options (**30 min / 1 hour / 2 hours**, 56px tiles) and the button **Request {choice}**. This replaces "Add an hour" and is a request to the floor (see section 7). On approval: toast "{choice} added", and the ring grows.
  - **Leave seat** opens a Sheet titled "Leave your seat?" with "{h}h {mm}m call time left." and the buttons **Join leaving list** / **Stay seated**.

  Each action dims to 40% while its request is pending.
- **Order to my seat:** full-width gold button that opens the Order screen.
- **Order tracker card** (when there is an order tonight):
  - The items text with the current status in gold.
  - A four-segment stepper: **Sent → Preparing → On its way → Delivered**.
  - When delivered, an **Order again** button prefills the Order screen with the last order.
- **Status rows** (hairline-ruled):
  - "Top-up" with Requested / In progress
  - "+1 h" with Requested
  - "Leaving list" with "On the list"

**F. Rate your visit** (after the session ends, browsing state):
- Eyebrow "Tonight · {duration} at {table}", "How was your night?" (Bodoni 34).
- Five 52px number buttons labelled "Poor" and "Excellent" at the ends.
- After picking: an optional note field and **Send to the General Manager**, then the toast "Rating sent".

**G. Loading / error / offline / paused:** these follow 2.2 and 2.6.

### 3.5 Order (`features/fnb/FnbOrderScreen`, route `/fnb`)

- A back link "Tonight", the title "Order", and "Table 1, seat 4 · Pay on delivery".
- Category tabs: Food / Soft drinks / Bar (underline tabs, gold 2px when active).
- **"Your usual" card** at the top: the member's most-ordered pair from order history, with an **Add both** pill. Hide it when there is no history.
- Item rows: 56px initial tile, the name, then an **Add** pill (44px) that turns into a − / qty / + stepper once added (44px circles; + is gold).
- A sticky footer appears when the cart is non-empty: **Send to the bar** with "N items".
- Sending returns to Tonight, shows the toast "Order sent" and starts the tracker.

### 3.6 Sessions (`features/sessions`)

- **List:**
  - Title "Sessions".
  - Two-up stat row: "This month" count | "Hours played".
  - Rows: muted date, "{table} · {game}", duration and a chevron.
- **Detail:** back to "Sessions", the date, the table (Bodoni 36), and ruled rows Game / Time / Played. One outlined button, **Hide from my list**, which fires the toast "Hidden from your list". No explanatory note.

### 3.7 Card (`features/card`)

- Title "Card".
- ID-1 aspect card (85.6/54): raised background, gold border, radius 10.
  - Wordmark tiles and "No. {n}" on top.
  - Bottom row: the **KYC selfie** (64×80, radius 4), then the name in Bodoni 26 and the tier in gold.
- QR on a cream panel below.
- **No caption.** Remove "Show at the door". Still raise screen brightness silently via the Screen Wake Lock API while the screen is open.

### 3.8 Rewards (`features/rewards`)

- Title "Rewards", the tier eyebrow, and points (Bodoni 56, gold) with "points".
- **Next-reward progress:** "Next: {cheapest reward above balance}" with "{gap} to go" and a 4px gold bar at points ÷ cost.
- Filter pills (44px, scrolling): All, Tournament seats, F&B, Merch, Hotel.
- Catalogue rows: initial tile, name, cost in gold and a muted note. The CTA is **Redeem**, or "{n} to go" (disabled) when the member can't afford it.
- **Redeem Sheet:** eyebrow "Redeem", the name, ruled rows Cost / Balance after, the note, then **Redeem** / Cancel. On success: the toast "Redeemed", and the item appears under "Your redemptions" as "Ready to collect".
- Refer-a-friend card:
  - "1,000 bonus chips each when a friend joins and buys in."
  - The code (Bodoni 24) with "N joined".
  - **Copy link** / **Share invite**, which uses the Web Share API.

### 3.9 Profile (`features/profile`)

- Back button, then the photo or initial, the name (Bodoni 28) and "{tier} · +91 …".
- **Account:** Membership card → (opens the Card tab), Identity "Verified".
- **Notifications** (switches, 46×28): Seat calls, Call time, Tournaments, Offers, Name on club TVs, Analytics. Sub-copy is exactly as in the prototype.
- **Club:** House rules →, Send feedback → (Sheet with topic pills and a textarea; toast "Feedback sent"), and "To erase your data, ask at the front desk."
- **Sign out** (outlined).
- **Remove from the player UI:** `GamesSection` (waitlist / seat alerts), `LimitsSection` (session reminder), `BreakSection` / take a break and `BreakNotice`. Keep the backend data and any server enforcement. Write a decision record noting the removal and that the self-exclusion and limits backend is retained.

### 3.10 House rules, Not found

- **House rules:** back to "Profile", the title, "The floor applies these at every table.", seven numbered rules with Bodoni gold numerals, then "Poker is a game of skill" and the four case entries. Use the prototype's text.
- **404:** "404" in Bodoni 96 gold, "This page doesn't exist.", "The link may be old or mistyped.", and **Go to Tonight**.

## 4. Lock-screen live status (native shell; phase 2)

The prototype's "Lock screen" states show a live status widget for:
- **Waiting:** "Next in line"
- **Seat ready:** the hold countdown, with "I'm on my way"
- **Seated:** the call-time countdown, with "Order"

A PWA can't do this. Do not block phase 1 on it. Deliver in phase 2:
- Add a Capacitor shell for `apps/player`.
- Implement an iOS Live Activity (ActivityKit) and an Android ongoing notification with a chronometer, driven by the same server events as the pushes.

Write the ADR and the event contract in phase 1, so the server already emits `waitlist.position_changed`, `seat.called`, `seat.seated`, `call_time.updated` and `call_time.ending`.

## 5. Live timers

- Do not tick from stale query data. Fetch an absolute `call_time_ends_at` / `hold_expires_at` from the server and count down locally from `Date.now()` against those timestamps.
- Re-sync on Supabase realtime events and on `visibilitychange`.
- Display formats:
  - Call time: `h:mm:ss`
  - Hold: `m:ss`
  - Ends at: `HH:MM` local time

## 6. Removals checklist

- [ ] Menu tab
- [ ] Step away
- [ ] Any-table-at-stake waitlist option
- [ ] Add a photo in sign-up
- [ ] "Use another number" link
- [ ] Front-desk alternative copy in KYC (except Not verified)
- [ ] Selfie placeholder artwork
- [ ] Home table hero
- [ ] Referral card on Home (now an offer)
- [ ] Waitlist alerts / seat alerts
- [ ] Play limits
- [ ] Take a break, and the on-break Home state
- [ ] "Show at the door" caption
- [ ] Explanatory sub-copy on Top up, Add time, Leave, Feedback and Session detail
- [ ] "Loading" text

## 7. Data and backend changes required

Verify each of these against the existing schema first. If something already exists, wire to it. If something is missing, implement the minimal version below, add migrations and RLS, and note it in the PR. Do not invent data in the UI.

1. **Add time request.**
   - New request type `call_time_extension` with `minutes ∈ {30, 60, 120}`.
   - Player creates it (status `requested`). Floor approves or declines it in console / tablet: a minimal accept/decline action in the existing floor request queue, next to top-up.
   - On approval, extend `call_time_ends_at`.
   - Replaces the current fixed +1 hour `extend` mutation in `useMySeatActions`.
2. **Per-seat occupancy** for the seat map: expose seat numbers taken per table in `useFloorTables`, or a sibling query, respecting the TV-name privacy setting (numbers only, no names).
3. **Order status `on_its_way`** between accepted/preparing and delivered, set by the bar when a runner leaves. Map: placed → Sent, accepted → Preparing, on_its_way → On its way, delivered → Delivered.
4. **"Your usual":** derive it server-side from the member's order history (the top two items by count over the last 90 days). Hide it when there is no history.
5. **Pushes:**
   - Seat ready, with the action "I'm on my way" → accept.
   - Call time ending at T−15 min, with the action "Add time" → deep link `/?sheet=add-time`.

   Use the existing `phonePush` infrastructure, gated by the member's Seat calls / Call time switches. No other pushes.
6. **Server timestamps** `call_time_ends_at` and `hold_expires_at` on the seat and seat-call payloads.
7. **KYC resume step:** derive it from the KYC record (selfie stored? DigiLocker started?).
8. **Promotions:** use the existing promotions source. The offer cards need `title`, `offer`, `schedule` and an optional `link`. Add the fields if they're missing.
9. **WebOTP:** update the SMS template to the domain-bound format.
10. **Remaining event names:** see section 4.

## 8. Implementation order (one PR each)

1. Tokens: new tints, the rim colour and the sheet duration.
2. `packages/ui`: Banner, Toast + `useToast`, Sheet, PickerSheet, Field (label-inside box), SeatMap, ProgressRing, Stepper, haptics util and skeletons. Include Storybook / tests if the repo has them.
3. Shell: tabs, avatar → Profile, `/fnb` guard, alert system migration.
4. Sign-in, OTP cells, WebOTP and the cookie sheet.
5. Sign-up About you with pickers.
6. KYC: copy, resume, camera guidance, auto-capture and the Verified screen.
7. Tonight: browsing, offers, tables sheet, join sheet, per-table waitlist, seat ready, seated, timers and rate visit.
8. Seated actions: Add time request flow (plus the floor-side accept), top up, leave and the order tracker.
9. Order screen and "Your usual".
10. Sessions, Card, Rewards (next-reward progress) and Profile removals.
11. Push events (seat ready and call ending) and the ADR for phase 2 (lock screen).

## 9. Acceptance criteria

- Every state in the prototype's right panel has a matching, reachable state in the app, with the same copy. Use the panel's group names in Playwright test titles (for example `Tonight › Seat ready`).
- Pixel check at 390×844: spacing, type sizes, radii and colours match the prototype within 2px. Take screenshots with Playwright and compare against the prototype by eye.
- Timers stay correct after backgrounding the app for 5 minutes, because they're based on timestamps.
- A refetch failure never blanks a screen that has data.
- Lighthouse accessibility on Tonight, Order and Rewards is at least 95; there's no tap target under 44px.
- No hard-coded colours outside `@rivr/tokens`. No strings outside `packages/i18n`.
- With reduced motion on, there are no animations except the busy spinner.
- All existing feature gates still lock the right actions for the right tiers.

Stop and ask before:
- changing any DB enum values
- removing backend self-exclusion or limits logic
- touching `apps/web`
- adding a new third-party dependency other than a face-detection model and Capacitor (phase 2)
