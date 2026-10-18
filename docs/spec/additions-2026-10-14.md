# Additions from the 14 Oct audit

Items the earlier documents missed or left implicit. Each names its lane. These are in scope.

## Feature gaps

**Six tables in the seed** (lane B). The seed has Table 1 (₹5,000), Tables 2 to 5 (₹10,000) and the Private Room (₹20,000). Table 5 opens empty. Every linked flow in the design prompt still holds; where a flow names Table 4 as closed, Table 4 stays closed.

**Expenses and payment accounts** (lane A), from GPA. Expense entry with categories, attachments and approver; payment accounts (cash drawer, each UPI handle, each bank account) with balances, transfers between them and a statement per account. All are ledger accounts, so the end-of-day close and Tally export include them.

**Spin wheel** (lane D), from GPA. A promotion effect: the floor activates a spin for a qualifying member, prizes and odds come from configuration with a budget cap, the result posts to points or bonus, and the TV shows the spin live.

**Accommodation rewards** (lane A), from GPA. Points can be earned towards hotel stays at a configured hours-per-night rate by stake, and redeemed through the rewards catalogue.

**TV pairing** (lane B). A TV shows a six-digit code on first load; an admin enters it in the console and assigns a display mode. A paired TV can be unpaired remotely.

**Push notifications** (lane C). Web push in the player PWA through a `push` adapter: seat ready, call time complete, withdrawal sent, tournament starting, promotion published. Each type can be switched off in Profile. Native push replaces web push in the store builds.

**PWA install** (lane C). Manifest, icons and splash screens from the brand kit; a service worker that caches the shell and shows the offline state from `@rivr/ui`; install prompt on the second visit.

**Learn specification** (lane C). Lane 0 copies `docs/drill-engine/user-flow.md` and `encoding-guide.md` from poker-settle into `docs/spec/learn/`. Learn rebuilds all six screens it describes (Library, Hub, Session, Verdict, Summary, Review) from `@rivr/ui`; none of poker-settle's React components is reused. Licensed encodings are uploaded by a super admin from the console, validated by the engine's validator, stored in a private bucket and loaded at runtime.

**Hindi typeface** (lane 0, tokens). Bodoni Moda and Instrument Sans have no Devanagari. Add Tiro Devanagari Hindi for display and Noto Sans Devanagari for text as token fallbacks, so Hindi renders in the same scale and weights.

**Venue configuration** (lane 0). Legal entity name, GSTIN, address, UPI payee name and VPA, bank details, invoice prefix and logo live in venue configuration. Nothing in code holds them; the prototype's values are placeholders.

## Linked flows to add to the end-to-end suite

The design prompt lists twelve. Add these, each across the apps it touches:

13. Call time: a player cashes out before call time; the cashier sees the shortfall; an admin override with a reason lets it through; the early departure shows on the member record.
14. Check-out: scanning the membership QR at the door closes the visit; hours and points update.
15. Kill switch: a super admin freezes the venue; a buy-in on the tablet is refused; every app shows the banner; a second super admin releases it.
16. Purge: a super admin runs "reset to seed" on the practice venue; counts return to the seed.
17. Website edit: marketing edits a hero block, previews it, publishes; the live site shows it within a minute.
18. Tournament with re-entry and bounty: register two players, bust one, re-enter, pay a bounty, finish, pay out.
19. Credit: issue a marker within limit, refuse one above limit, settle on cash-out.
20. Export: export the member table filtered by tier; the audit log records it.

## Engineering gaps

**Environments and release** (lane 0). Three environments: local (per worktree), `rivr-staging`, `rivr-prod`. Merging to `main` deploys to staging: migrations, Edge Functions and all Cloudflare Pages apps. A tag `release-YYYYMMDD-N` deploys the same commit to production after the end-to-end suite passes on staging. Production is never seeded. Rollback is a Pages rollback plus a forward-fix migration; migrations are never reverted in production.

**Android builds** (lane 0, then B and C). CI builds signed release APKs for `tablet` and `driver` on every release tag. The signing key lives in GitHub secrets. Tablets run the app in Android lock-task (kiosk) mode; installation and updates are by ADB from the cage computer until a device-management tool is chosen.

**Performance budgets** (all lanes, checked in CI): `player` initial JavaScript under 200 KB gzipped; tablet tap-to-confirm under 100 ms on the dealer tablet; console tables virtualised past 200 rows; TV modes recover within 5 seconds of a reload.

**Load test** (lane 0 writes it, run in hardening week). k6 scripts for: 60 players on the waitlist, six tablets logging a hand every 90 seconds, 200 app users on Home, a 100-entry tournament registration burst.

**Alerting** (lane A). Sentry alerts and failed outbox items over a threshold notify the owner dashboard and a WhatsApp number in configuration.

**Time** (all lanes). Store UTC; display IST through `@rivr/i18n`.

## More feature gaps

**Rakeback** (lane A). Hourly rakeback is a promotion effect: a share of rake attributable to a member's seated hours, at a configured rate by stake, credited to bonus or points on a schedule. Add it to the promotion effects list.

**Jackpot sub-pools** (lane B). Bad-beat jackpot carries the main pool plus a season pool and a freeroll pool, each with its own share of the drop, adjustments and payouts, as GPA does. Not optional.

**TV modes** (lane B). The full list: waitlist board, call-time board (seated players and time remaining by table), jackpot and high hand, tournament clock, promotions rotation, rewards ticker (points leaders and recent redemptions), League leaderboard, social wall, spin wheel. All built from `@rivr/ui`.

**Chips** (lanes A and B). The smallest chip is ₹50. Chip denominations start at ₹50; every pot, buy-in, cash-out, bet-derived amount and rake entered on the tablet or at the cage is a multiple of ₹50, and inputs reject anything else.

**Shareholding register** (lane A). Partners and investors with holdings, effective-dated, feeding the monthly statements.

**Social channels** (lane D). Publishing targets: Instagram, Facebook, X, LinkedIn, YouTube, Telegram channel, Google Business Profile, and WhatsApp (marketing template to opted-in players). Inbox: Instagram, Facebook and WhatsApp. Analytics: follower counts for every channel. Each channel is an adapter target with a fake; a channel without credentials falls back to download-and-post.

**Adapters** (lane 0 creates the interfaces). In addition to the list in `docs/engineering/stack.md`: Meta Conversions API, Google Ads offline conversions, push, Instagram Graph (social wall), channel analytics, Cloudflare cache purge, DigiLocker (inside the KYC adapter).

**Staff job titles** (lane A). The manpower plan's job titles (dealer, floor supervisor, cashier, host and the rest) are a separate field from the seven permission roles. Rosters and the 38-person acceptance test use job titles; access uses roles.

## Resolved conflicts (these override every earlier document)

- **Dates.** Lane 0 runs 14 to 16 Oct; the four lanes start 16 Oct; schema, contracts and task issues freeze when Lane 0 finishes. Release gates stay: 30 Oct, 1 Nov, 10 Nov, 15 Nov. The design prompt's opening date reads 15 Nov 2026.
- **Ownership.** Lane 0 owns the schema foundation, tokens and the first cut of `@rivr/ui`; the tech plan's assignment of those to lanes A and D is superseded.
- **Review.** No human reviews code. The reviewer session merges after all applicable review subagents pass. Contract changes go through a `question` issue that the reviewer session decides.
- **Tables.** Six, as in this file.
- **Roles.** Seven permission roles; job titles are separate.
- **Data access.** Only `packages/db` talks to Supabase; the scope's `features/*/api` convention is superseded.
- **Website.** Astro renders on demand from Supabase content (not a static site). Website blocks are React components in `@rivr/ui`; Astro pages render them and contain only document elements (`html`, `head`, `body`, `meta`, `link`, `title`, `script`).
- **Social.** All channels above; the 14 Oct features note "Instagram and WhatsApp" is a minimum, not a limit.
- **Copy.** The banned-word list is the union of the design prompt and `.claude/rules/copy.md`, including "experience" (as a noun for the product) and "exclusive" (unless an event is members-only).
- **Platform-policy restrictions are removed.** Build Google conversion import enabled, not behind an off flag. The website may link into the player app. No store-review flags on money movement. WhatsApp templates may carry payment links. The one restriction kept is the review request going to every player after the third visit regardless of feedback score.
- **Learn** ships complete by 10 Nov and is not in any cut order.

## Tier-gated features (added 14 Oct, evening)

Every member-facing feature is gated by tier. Admins decide which tiers get which features.

**Model** (lane 0 schema, lane A console screen, lane C player app).
- `tier`: admins can create, rename, order and retire tiers. Seeded with Member, Academy graduate, Founders' Circle and Black card. Every member has exactly one tier; the default for new members is set in configuration.
- `feature`: a catalogue of feature keys declared in code (`packages/contracts/features.ts`), each with a name, a description, the screens it controls, and whether it is gateable. Licensed Learn sources add one key each at upload (`learn.source.<id>`).
- `tier_feature`: the matrix of tier × feature, effective-dated, with a display mode per cell: `hidden` (the entry point does not render) or `locked` (it renders with a one-line notice naming the tiers that have it).
- `member_feature_override`: a super admin can grant or revoke one feature for one member, with a reason and an optional end date.

**Feature keys to declare at minimum.** Learn (library, drills, review, each licensed source, Academy lessons); session history; balance deposits; rewards catalogue; points history; League; referral and share cards; cab requests; waitlist join from the app; call-time view; tournament registration from the app; promotions feed; live floor view; table-side F&B ordering; Academy booking; push notification types. Lanes add a key for every new member-facing feature.

**Never gateable** (core). Sign-in, KYC, profile, limits and self-exclusion, notification settings, the membership card, the balance view, withdrawals from an existing balance, the kill-switch banner, and house rules. Gating these would lock a member out of their own account or money.

**Enforcement, in both places.**
- Database: `has_feature(member_id, feature_key)` evaluated at the current time, used inside every row-level security policy and write function behind a gated feature. A cached or modified client cannot reach a feature its tier lacks.
- UI: `useFeature(key)` in `@rivr/db` and two `@rivr/ui` components, `FeatureGate` (renders children, the locked notice, or nothing) and `LockedNotice`. Bottom navigation hides or locks tabs from the same source. Changes reach open apps through Realtime without a reload.

**Console** (lane A). A Tiers screen for `admin` and `super_admin`: the tier list, and the tier × feature matrix as a `DataTable` with a toggle and a display-mode choice per cell, a preview of the player app as any tier, effective date on save, and every change in the audit log. Per-member overrides sit on the member record and are `super_admin` only.

**Tests.** pgTAP for `has_feature` across tiers, overrides, effective dates and the practice venue. Flow 21: an admin removes Learn from the Member tier; a Member's Learn tab locks within seconds and its API calls are refused; a Black card member still has it; a super admin grants Learn to one Member by override and it reappears for that member only.

## Design system (added 15 Oct)

One design system, one place to change it, every surface built from it.

**The single source.** `packages/tokens/tokens.json` holds every colour, typeface, type size, weight, line height, letter spacing, space, radius, border, shadow, opacity, z-index, breakpoint, motion duration and easing, icon size and chart colour. Values come from `docs/design/design-inventory.md`. Nothing else in the repository holds a raw design value; the write hook and ESLint enforce this.

**Generated, never hand-edited.** Style Dictionary builds from `tokens.json`: CSS custom properties, the Tailwind preset, TypeScript constants, Android colours and theme for the `tablet` and `driver` shells, PWA manifest and splash colours, and the chart palette. CI regenerates them and fails if the committed output differs.

**One component library on top.** `@rivr/ui` is the only consumer of tokens that draws anything. Every surface is assembled from it:

| Surface | How it uses the system |
|---|---|
| Player, console, display, driver | `@rivr/ui` components only |
| Dealer tablet | `@rivr/ui` components only; the Android shell takes its colours from generated tokens |
| Website and link-in-bio | `@rivr/ui` blocks rendered by Astro |
| TV slides, social cards, winner and share cards, receipts, membership card, offline pack PDF | `@rivr/render` renders `@rivr/ui` components in headless Chromium |
| Thermal receipts | The receipt component rendered to an image at printer width, then printed |
| Charts | `Chart` in `@rivr/ui`, palette from tokens |
| Copy and formats | `@rivr/i18n`: strings, money, time and stakes formatting |

**Changing the design.** Edit `tokens.json` (or a component in `@rivr/ui`) in one PR. CI regenerates the outputs, screenshots every Storybook story and every screen in the end-to-end flows, and shows the visual diff. The reviewer session approves the new baselines. Merging deploys every web surface, TV and the tablet and driver bundles together; no app changes, and no APK is reinstalled.

**Published reference.** Storybook for `@rivr/ui` deploys to Cloudflare Pages on every merge as the living design system: tokens, components, states and usage, in English and Hindi. It is the reference for anyone designing or reviewing RIVR material.

**Not runtime-editable.** Admins cannot change colours or type from the console. Brand changes go through the token file so that every surface, including printed and rendered material, changes together and the visual tests see it.
