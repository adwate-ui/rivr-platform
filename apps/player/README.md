# player

The member app: a PWA on a 390 px phone, with no rupee anywhere (#627, decision 0284). Home with tonight's floor and the waitlist, session history (when, the tables and how long; a member can hide a session from their own list), rewards, the member's profile with the house rules and the legal standing (/profile/rules, from the website's pages) and feedback in two forms, quick and detailed (#637), the way to the front desk (Call the desk, WhatsApp the desk; at the foot of Profile and of every sign-in, sign-up and identity step, decision 0540), and their membership card with the QR the door scans (/card, from Profile; core, never gated). Every other member-facing entry point is behind `FeatureGate` with its tier-gated feature key. Until a member's identity check is verified they see only its steps (#632): the frame sends every screen to /kyc. While the club checks identity at the desk (`kyc.at_the_club`, decision 0502), a selfie lets them in instead: they are registered, and Home and Profile say to bring their Aadhaar and PAN on the first visit, where the desk verifies them before they play. They may join a waitlist meanwhile, and their place says the desk checks their ID before they sit (decision 0503). Balance (with deposits and withdrawals), the Academy's batches and payments, and winner cards are hidden: their addresses go to Home or Learn, and their code stays in `features/` for when the club wants them back.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter player
```

The dev server listens on this worktree's port block (`player` is port `<block>40`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. `VITE_WEB_URL`, the website's address for the terms and privacy links under the sign-in line (#775), defaults to this worktree's website; the workflows set it (#825), and a build without it shows the line with no links. Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter player` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else, loaded with
                      lazyRouteComponent so it stays out of the initial JavaScript (#11). frame.tsx
                      (the tabs) and root.tsx are the only eager routes; sign-in sits outside the frame
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell: navigation, the kill-switch banner, not found
```

A link to any screen opened signed out goes to `/sign-in?next=<that screen>`, and a new number then to `/sign-up?next=…`, which shows the number and takes an optional photo, the name, the city, what best describes the member, when they usually play (#631) and the games they play (#653). Each returns there when done, which is how the website's links land on the Academy. `next` is checked by `returnSearchFrom` (`@rivr/contracts/returnPath`): only a path in the app, never another site (#233).

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

## Who builds what

Lane C owns the shell, routes, sign-in and KYC, Home, Sessions, Profile and Learn. Lane A adds `features/balance`, lane B `features/waitlist`, `call-time`, `tournament` and `fnb`, and lane D `features/rewards`, `promotions` and `winner-cards` (`docs/contracts/`). Home shows the member's tournament: the one running at their venue, its level and time left counting down from the server's reading, or the next; their own seat; and Register, Re-enter or Rebuy paid from their balance after asking (#118, #119; decisions 0201, 0203; `tournaments.register`). Rewards (#152, decision 0183) shows points and tier, any points the club holds locked for the member (#645), their bonus chips with a history closed until opened (`rewards.bonus`, decision 0504: they never expire and the floor redeems them with a buy-in), the catalogue and the member's redemptions (`rewards.catalogue`) and the League (`league.standings`); its copy (`memberRewards`) and hooks (`@rivr/db/myRewards`) load with the tab, so the first load stays under its budget. On any screen a toast tells bonus chips added or used while the app is open (the frame's `BonusToasts`), and Profile's Bonus chips switch turns their push off (`push.bonus`). The Menu tab (#635) took Balance's place: tonight's orders, each followed from placed to being prepared to delivered. Home's seat notice (#634) shows how long the member has played and their call time, three hours by the setting; from it they add an hour of call time, ask the floor for a top-up (`table.top_up`; no amount) and leave the seat, onto the floor's Leaving list while call time is owed. Food and drink (#123, decision 0261; `fnb.table_side`) opens from Home's seat notice while the member is seated: the menu, how many of each, and Send to the bar, paid to Glaza (/fnb).

## Installed app (PWA)

The build writes the manifest and a service worker (`vite-plugin-pwa`, `vite.config.ts`). The manifest's colours, and the theme colour in `index.html`, come from `@rivr/tokens`. The icons in `public/icons` and the iPhone launch screens in `public/splash` come from the brand kit (`docs/brand`, never edited by hand); `index.html` links each launch screen to the screen it fits.
- **Card.** The QR's cream panel spans the card's column; a gold bar under it runs down to the next code, so the desk sees the code is live, and the first look in a session says to turn the brightness up (F-182). The selfie covers the card's photo frame, the frame its one border, with the member's initial while it cannot load (F-201, F-205). Sessions list each cash session's stakes under its table, with the chevron of a row that opens (F-211).
- **Offline.** The service worker keeps the shell, so the app opens with no connection. The phone also keeps, for a club night and until sign-out, what the app opens with (decision 0541): who the member is, that their identity check let them in (none of its documents), their tabs, the card, and Home's tables, place, seat and notices. So a member opens on Home as of the last time, under a line saying when, and the card shows the number to give at the door, as its code goes stale in seconds (F3-25). Actions on a seat or a place are off while offline, as that seat may be one the phone only remembers. With nothing kept, the app says there is no connection and to open it again once online. Any other screen offline waits for the connection (its loading state) under the frame's offline banner, and loads once it returns. The app asks for a new version every hour. One that arrives waits until the page is out of sight, then takes over and reloads it (`takeUpdateWhenHidden`, #252), in every open window, so a reload never lands while a member is typing on the screen, and a fix still reaches an app left open the next time the member leaves it. It never takes over on sign-in or KYC, which a member leaves mid-step for the code or DigiLocker, but waits until they leave the app from another screen (F3-16).
- **Install offer.** The frame offers to install the app on Home, from a member's second visit, and only after sign-up: on iPhone an app installed before sign-up cannot read the link's codes (decision 0031). It asks the browser where it can, and on iPhone says how (Share, then Add to Home Screen). Not now, or answering the browser's dialog either way, puts it away for good. `startInstallWatch` (`main.tsx`) counts each opening of the app once (a reload or the return from DigiLocker is the same visit) and keeps the browser's prompt, which fires once and often before Home has drawn.

`pnpm e2e --grep "PWA"` checks the manifest and its icons, every launch screen against its screen, and opening offline.

## Native shell (Capacitor)

The phone app is a Capacitor shell around the player app (decisions 0323, 0361), as the dealer tablet's APK is: a release sets `RIVR_SHELL_URL` to the hosted player app, so code reaches phones without a store update; without it the shell carries `dist/`. It adds one thing a PWA cannot do, the lock-screen live status: Waiting ("Next in line"), Seat ready (the hold counting down, "I'm on my way") and Seated (the call time counting down, "Order"), each counting down by itself to the server's end. The app's own LiveStatus plugin (`android/…/LiveStatusPlugin.java`, `ios/App/App/LiveStatusPlugin.swift`) gives the phone's push token; Profile's "Notifications on this phone" turns it on and off there (`usePhone`), and signing out ends it. The frame opens the page a tapped status names (`NotificationLinks`): Home, `/?accept=<place>` or `/fnb`, nothing else. The `live-status` consumer sends every word.

Both platforms declare the camera for the sign-up selfie (`android.permission.CAMERA`, `NSCameraUsageDescription`), and the shell counts as installed, so it never offers Add to Home Screen.

**Android** (built locally and checked):

```
pnpm build --filter player
pnpm --filter player exec cap sync android
cd apps/player/android && ./gradlew assembleDebug
```

An ongoing notification with a chronometer, from a Firebase data message (`LiveStatusMessagingService`). A build shows it only with the Firebase app's `google-services.json` in `android/app/` (gitignored); without it the switch says it failed. Colours come from `@rivr/tokens`' generated Android resources.

**iOS** (written, never compiled: it needs a Mac with Xcode, or a macOS runner). The project has the `RivrLiveStatus` widget extension embedded in the app, the app's push entitlement, its privacy manifest and a shared `App` scheme. The project file was edited by hand and has not yet been opened in Xcode. On a Mac, with the Apple account that owns `club.rivr.player`:

1. `pnpm --filter player exec cap sync ios`, then open `ios/App/App.xcodeproj` and choose the team for both targets.
2. Set the build setting `RIVR_LIVE_STATUS_TOKEN_URL` to `https:/$()/<project-ref>.supabase.co/functions/v1/live-status-token` (an `.xcconfig` reads `//` as a comment).
3. Run on a device with iOS 17.2 or later, turn Notifications on this phone on in Profile, and join a list from the console.

**Store builds** come from a `release-*` tag once the keys are set (`docs/runbooks/store-listing.md`, decision 0577). With no network the app shows `offline.html`, built into it. It has no cookie sheet or Analytics switch, and loads no analytics.

## Budgets

Initial JavaScript under 200 KB gzipped, checked in CI by `scripts/check-bundle.mjs`. With the service worker's registration it is about 192 KB (October 2026). The player ships only its own copy (`src/messages.ts`); keep it that way, as every other app's copy would cost several KB.

Home offers seat-ready push once the member has a place on a list, while the phone's push is off and their tier sends seat calls; Not now is remembered on the phone (F3-26).
