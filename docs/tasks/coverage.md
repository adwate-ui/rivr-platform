# Requirement coverage

Every requirement in every specification file mapped to the issues that deliver it. Written once by Lane 0 (`docs/tasks/README.md`); coverage is read from issue state from here on. A requirement with no issue would be a defect: there are none.

228 requirements, 166 task issues, 5 questions. Release gates are covered by every issue with that release label.

## scope-v1-2026-09-30.md

| Id | Requirement | Issues |
|---|---|---|
| S-D1 | Player balances held: double-entry ledger, cash and bonus balances, withdrawal requests, payout accounts, unclaimed-balance reporting | #18, #19, #110 |
| S-D2 | Full feature set; platform policies gate channels (narrowed by additions: platform restrictions removed) | #1 |
| S-D3 | WhatsApp through Meta Cloud API direct: utility and marketing templates, opt-in capture | #62 |
| S-D4 | TDS engine with an on/off switch and parameters; shadow computation while off | #22 |
| S-D5 | Per-hand entry on a dealer tablet; drop-box count per down reconciles against hand records | #42, #44 |
| S-D6 | Repository, Supabase, vendor accounts and domains in NewCo's name (accounts are out of scope for the build) | #1 |
| S-D7 | Fallback SOPs and POCs managed from the console: SOP library, escalation directory, incident log, nightly offline pack | #51 |
| S-D8 | Credit lines to players: limits, markers, repayment, ageing, approval by role, exposure caps | #73 |
| S-D9 | Licensed books open to every KYC'd member with quotes and page references; licence expiry switches a source off | #131 |
| S-D10 | Learn earns points; Academy graduates get a tier | #128, #135 |
| S-D11 | Black card priority only at the qualifying stake | #40 |
| S-D12 | Meta Conversions API, Google offline conversion import and influencer codes and links | #161, #162, #163 |
| S-D13 | Glaza F&B manual monthly import | #109 |
| S-D14 | Dealer tablet app, display modes and a cage workstation with a receipt printer | #57, #69 |
| S-D15 | Tier model with waitlist priority as a scoring rule, not a manual override | #1, #40 |
| S-D16 | PWA now with a Capacitor-ready structure (store flags removed by additions) | #1, #16 |
| S-AR1 | One Supabase project in Mumbai: Postgres, row-level security, Realtime, Edge Functions, pg_cron | #1 |
| S-AR2 | One monorepo, the front ends and shared domain packages | #1 |
| S-AR3 | Every rupee through a double-entry ledger; balances are sums; entries immutable; corrections reverse | #1 |
| S-AR4 | Idempotency keys on buy-ins, cash-outs, hand records and payouts | #1, #57 |
| S-AR5 | Audit row for every privileged action with actor, device, IP, before and after; second approver above a threshold | #1, #20 |
| S-P1 | Player app tabs Home, Sessions, Balance, Rewards, Learn; Profile behind the avatar | #6 |
| S-P2 | Home: live floor, join waitlist, promotions carousel, bad-beat counter, next tournament, events, tier badge | #87 |
| S-P3 | Sessions: history by visit with buy-in, cash-out, net and hours; receipts; TDS certificates; monthly totals | #93, #127 |
| S-P4 | Balance: cash and bonus with expiry, movements, withdrawals, verified payout accounts, UPI deposit with UTR | #18, #29, #55 |
| S-P5 | Rewards: points, tier progress, catalogue, League, referral code, cab eligibility | #152 |
| S-P6 | Learn tab: library, drill hub, sessions, review; Academy lessons and bookings | #133, #134 |
| S-P7 | Profile: KYC status, game and stake preferences, limits and self-exclusion, notification and marketing consent | #7 |
| S-L1 | Learn screens Library, Hub, Session, Verdict, Summary, Review with the RIVR changes | #133, #136 |
| S-L2 | Learn storage in Postgres with a local cache for offline sessions | #132 |
| S-L3 | Licensing as data: licence terms, state and expiry per source; entitlement | #131 |
| S-L4 | Academy lesson format (cards and quizzes) on the engine's answer kinds | #134 |
| S-L5 | The drill engine's CI gates move with it | #1 |
| S-DS1 | Display modes; each TV paired to a mode from the console, holds no state, recovers on refresh | #49, #66 |
| S-G1 | Meta Conversions API events (Academy booking, KYC, first visit, first buy-in, tournament entry, repeat visit), hashed, with consent | #161 |
| S-G2 | Google offline conversion import (enabled, additions) | #162 |
| S-G3 | Influencer codes and tracked links, attribution to KYC, first visit and first buy-in, dashboard and payout calculation | #10, #163, #166 |
| S-G4 | WhatsApp Cloud API messages: seat calls, receipts-ready notices, promotions | #62 |
| S-DM | The core data model entities by domain | #1 |
| S-V1 | KYC behind an adapter; the vendor is a contract decision | #1, #4 |
| S-V2 | Money in: UPI to the NewCo account with UTR capture and bank statement reconciliation | #29 |
| S-V3 | Money out: manual UPI with UTR; payout-provider adapter | #21 |
| S-V4 | Web push now, native push with store apps | #139 |
| S-BP | P0 exit test: ledger golden tests green; a buy-in and a cash-out post balanced entries | #1, #57 |
| S-CFG | Rules and weights live in configuration the floor can change from the console without a release, with effective times | #1, #33 |

## tech-plan-v2-2026-10-11.md

| Id | Requirement | Issues |
|---|---|---|
| T-G1 | Release A on 30 Oct: registration app, website, link-in-bio, brand kit, social templates, logo animation | #2, #4, #5, #3, #31, #6, #7, #8, #9, #35, #39, #16 and 6 more |
| T-G2 | Training on 1 Nov: floor stack in the practice venue (tablet, cage, wallet, markers, waitlist, TVs, SOPs, quizzes) | #50, #57, #75, #58, #18, #17, #19, #21, #20, #73, #74, #22 and 61 more |
| T-G3 | Feature freeze on 10 Nov; hardening 11 to 14 Nov: load test, outage drill, restore drill, security review, practice venue reset | #26, #112, #126, #92, #93, #95, #94, #96, #97, #98, #99, #101 and 67 more |
| T-M1 | Venue on every record with row-level security | #1 |
| T-M2 | Practice venue: real code, non-financial, excluded from reports, Tally, GST, Meta events and statements | #23, #96, #98, #50, #12 |
| T-M3 | One event outbox; WhatsApp, publishing, winner cards, Meta, feedback, reviews and Tally are consumers | #1, #12 |
| T-M4 | One graphics renderer for TV slides, social posts, winner and share cards, membership card and receipt | #1, #64, #13 |
| T-M5 | Strings in catalogues from the first commit | #1 |
| T-M6 | Public surfaces read only sanitised views | #1, #9 |
| T-I1 | Registration app: OTP, DigiLocker KYC, selfie liveness, 18+ gate, Academy booking and payment | #2, #4, #5, #8 |
| T-I2 | Website with live sections reading public views; Academy booking and sign-up hand off to the PWA | #9, #35 |
| T-I3 | Social accounts: handles, bios and profile assets from the brand kit | #15 |
| T-I4 | Link-in-bio: waitlist join, tonight's games, Academy, map | #39 |
| T-I5 | Brand graphics kit: tokens shared by app and console; TV layouts, membership card and receipt as templates | #64, #67, #15 |
| T-I6 | Social templates: tournament poster, promo card, winner card, high-hand card; logo animation | #13, #14 |
| T-I7 | One-click publishing through the outbox; WhatsApp marketing to opted-in players | #154 |
| T-I8 | Auto winner cards on tournament finish, high hand or jackpot, published after consent | #155 |
| T-I9 | Player share cards with the referral code; native share sheet | #153 |
| T-I10 | Social inbox: webhook creates a lead, linked to the member on sign-up | #156 |
| T-I11 | Channel analytics: daily follower counts joined to UTM, referral and creator codes through KYC and first buy-in | #164 |
| T-I12 | Final-table stream: tournament clock overlay for OBS with a hole-card delay | #125 |
| T-I13 | Social wall: tagged Instagram posts, moderation, rotation on TV and website | #157 |
| T-I14 | Live floor widget on the website from the public floor view | #130 |
| T-I15 | Google review request after the third visit, regardless of feedback | #159 |
| T-I16 | Tally export: daily voucher file per venue per day from a ledger-to-Tally mapping | #96 |
| T-I17 | CCTV: camera id and timestamp on hands, cage transactions and incidents with a playback link | #122 |
| T-I18 | Staff training: practice venue and dealer and cashier certification quizzes | #50 |
| T-I19 | Hindi: player app, dealer tablet, SOPs and WhatsApp templates; language per user and dealer | #137, #138, #62 |
| T-I20 | GST invoicing: series per venue, rate and basis effective-dated, PDF tax invoice | #23, #68 |
| T-I21 | Six tables: one ₹5,000, four ₹10,000, the ₹20,000 Private Room | #34 |
| T-I22 | Owner dashboard: role-scoped mobile view of live rake, tables, cash position, alerts | #101 |
| T-I23 | Partner and investor statements: monthly PDF from the ledger and the shareholding register | #98 |
| T-I24 | Table-side F&B: orders from app or tablet print a KOT; comp or paid posted to the visit | #123 |
| T-I25 | Cab safety: driver app with a foreground location service, live trip link, drop confirmed by player OTP | #141 |
| T-I26 | Visit feedback: WhatsApp survey on visit close; 3 or below opens a ticket for the GM | #160 |
| T-I27 | Backups and restore: provider backups with PITR, nightly logical dump, scripted restore drill | #25, #26 |
| T-I28 | Digital membership card with a rotating QR; the door screen scans it to open a visit | #71 |
| T-I29 | Multi-room ready: venue_id and row-level security on every table | #1 |
| T-I30 | Accessories store: a hosted store embedded in the website | #142 |

## design-prompt-2026-09-30.md

| Id | Requirement | Issues |
|---|---|---|
| DP-B | Brand values, wordmark, typefaces, money, time and stakes formats | #1 |
| DP-V | Visual rules: flat, hairlines, 6 px radius, one gold button, icons with meaning, motion on state changes, dark only | #1 |
| DP-C | Copy rules and banned words | #1 |
| DP-SD | Seed state: tables, waitlist, Arjun Mehta, jackpot, high hand, RIVR Sunday, promotions, dealer, clock | #1, #34, #115, #54, #88 |
| DP-PS | Player screens: sign-in and KYC, Home, waitlist position, Sessions, Balance, Rewards, Learn, Profile | #38, #2, #87, #127, #55, #152, #7, #133 |
| DP-CS | Console rail and screens: Live floor, Waitlist, Cage, Markers, Promotions, Jackpots, Tournaments, SOPs, Reports and the rest of the rail | #74, #99, #81, #31, #60, #84 |
| DP-TS | Dealer tablet: sign-in, hand entry, seat events, end of down, offline banner | #41 |
| DP-TV | TV modes: waitlist board, jackpot and high hand, tournament clock, promotions | #65 |
| DP-F1 | Flow 1, join and seat: black card first at his stake, call, seat, every surface updates | #40, #63 |
| DP-F2 | Flow 2, black card at another stake: join-time order, no priority marker | #40 |
| DP-F3 | Flow 3, buy-in with the Tuesday bonus: tablet request, cage approval from wallet, ₹2,000 bonus | #57, #59, #88 |
| DP-F4 | Flow 4, log a hand: ₹48,000 pot, rake ₹2,400, drop ₹100, pull ₹2,500; jackpot ₹3,42,700 | #42 |
| DP-F5 | Flow 5, a pot at the cap: ₹1,40,000 pot, rake ₹6,000 capped | #36, #42 |
| DP-F6 | Flow 6, high hand: claim on tablet, floor approval, TV updates | #47 |
| DP-F7 | Flow 7, publish a promotion: builder, player card and TV slide appear | #84 |
| DP-F8 | Flow 8, marker and cash-out: marker settles first, remainder to cash, exposure drops | #75 |
| DP-F9 | Flow 9, withdrawal: request, second approver, UTR, member sees it sent | #21 |
| DP-F10 | Flow 10, tournament clock: time advances, TV and player card move to level 8 | #119 |
| DP-F11 | Flow 11, Learn: a 10-spot drill earns points that show in Rewards | #136 |
| DP-F12 | Flow 12, offline tablet: two hands logged offline arrive in order with the right rake | #43 |
| DP-ST | States for every surface: empty waitlist, no sessions, KYC incomplete, marker overdue, withdrawal pending, tablet offline, TV without promotions | #148, #54, #87, #55 |

## features-2026-10-14.md

| Id | Requirement | Issues |
|---|---|---|
| F-ROL | Seven roles with permissions in one table, checked by row-level security | #1 |
| F-TRN | Tournaments: formats, registration, late registration, alternates, seating and balancing, clock, bust-outs, payouts, deals, TDS, League | #115, #116, #117, #118, #120, #121 |
| F-CHK | Check-in by membership QR opens a visit; check-out at the door or on final cash-out closes it | #76, #72, #82 |
| F-CT | Call time: per table type, effective-dated, timers, shortfall needs an admin override, early departures recorded, promotion condition | #79, #78, #80 |
| F-WAL | Wallet: cash, bonus and points together; points never convert to cash | #18, #89 |
| F-POT | Pot data on every hand; super admin views and exports | #42, #114 |
| F-WEB | Website editing: typed blocks, live preview, drafts, scheduled publish, history, rollback, cache purge | #129 |
| F-SOC | Social: publishing, winner cards with consent, inbox into leads, social wall with moderation | #154, #155, #156, #157 |
| F-KS | Kill switch: five levels in control_state checked in write functions; dual release for venue freeze; audited; alerts | #1, #27, #62, #91 |
| F-EXP | Exports: filtered tables, full encrypted archive, per-member export, audited, large-export alerts | #102, #103 |
| F-PRG | Purge: super admin only, scoped, dry run, automatic export, typed confirmation, consistent, audited; reset to seed | #104 |
| F-BAK | Backups and the nightly full export to separate storage | #25 |

## additions-2026-10-14.md

| Id | Requirement | Issues |
|---|---|---|
| AD-1 | Six tables in the seed | #34 |
| AD-2 | Expenses and payment accounts as ledger accounts | #95, #94 |
| AD-3 | Spin wheel promotion effect, live on TV | #158, #150 |
| AD-4 | Accommodation rewards | #146 |
| AD-5 | TV pairing by six-digit code | #49 |
| AD-6 | Web push notifications, each type switchable | #139 |
| AD-7 | PWA install: manifest, icons, splash, service worker, install prompt | #16 |
| AD-8 | Learn specification copied; six screens rebuilt; licensed encodings uploaded at runtime | #1, #131 |
| AD-9 | Hindi typefaces as token fallbacks | #1 |
| AD-10 | Venue configuration holds legal and payment details | #1, #33 |
| AD-F13 | Flow 13, call time: early cash-out shows the shortfall; admin override with reason; early departure recorded | #79 |
| AD-F14 | Flow 14, check-out: membership QR at the door closes the visit; hours and points update | #82 |
| AD-F15 | Flow 15, kill switch: venue freeze refuses a tablet buy-in, every app shows the banner, a second super admin releases | #27 |
| AD-F16 | Flow 16, purge: reset to seed on the practice venue returns counts to the seed | #104 |
| AD-F17 | Flow 17, website edit: hero block edited, previewed, published, live within a minute | #129 |
| AD-F18 | Flow 18, tournament with re-entry and bounty: register, bust, re-enter, bounty, finish, pay out | #149 |
| AD-F19 | Flow 19, credit: marker within limit issued, above limit refused, settled on cash-out | #74 |
| AD-F20 | Flow 20, export: member table filtered by tier exported; the audit log records it | #102 |
| AD-E1 | Environments and release: staging on merge, production on a release tag after e2e, never seeded, rollback | #1 |
| AD-E2 | Signed APKs for tablet and driver on release tags; kiosk mode; ADB installs | #1, #41 |
| AD-E3 | Performance budgets: player JS, tablet tap-to-confirm, console virtualisation, TV recovery | #30, #46, #66, #11 |
| AD-E4 | k6 load test scripts, run in hardening week | #1, #126 |
| AD-E5 | Alerting to the owner dashboard and a WhatsApp number | #100 |
| AD-E6 | Store UTC, display IST | #1 |
| AD-M1 | Hourly rakeback as a promotion effect | #108 |
| AD-M2 | Jackpot sub-pools: main, season, freeroll | #48 |
| AD-M3 | TV modes, the full list | #65, #148, #158 |
| AD-M4 | Chips: ₹50 smallest; every amount a multiple of ₹50 | #1, #24, #42 |
| AD-M5 | Shareholding register feeding monthly statements | #97 |
| AD-M6 | Social channels: every publishing target, inbox and analytics channel, download-and-post fallback | #154, #156, #164 |
| AD-M7 | Adapter interfaces | #1 |
| AD-M8 | Staff job titles separate from roles | #1, #28 |
| AD-RC | Resolved conflicts (dates, ownership, review, tables, roles, data access, website, social, copy, platform restrictions, Learn) | #1, #9, #159, #162 |
| AD-T1 | Tier model: tiers, feature catalogue, tier x feature matrix, overrides | #1 |
| AD-T2 | Minimum feature keys declared; never-gateable core | #1 |
| AD-T3 | Enforcement: has_feature in the database and FeatureGate, LockedNotice, useFeature in the UI; live updates | #1, #6 |
| AD-T4 | Console Tiers screen and per-member overrides | #32, #61 |
| AD-T5 | pgTAP for has_feature and flow 21 | #1, #32 |
| AD-DS | Design system: tokens single source, generated outputs, @rivr/ui on every surface, render pipeline, charts, Storybook published, not runtime-editable | #1, #68, #69, #64, #67, #90 |
