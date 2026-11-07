# console

The staff web app at 1440 px: the live floor, waitlist, cage, members, promotions, staff and reports, with a left rail grouped as the design prompt lists it. What each person sees comes from their role's permissions in the database.

## Run it

```
pnpm db:start                 # this worktree's local Supabase, seeded
pnpm dev --filter console
```

The dev server listens on this worktree's port block (`console` is port `<block>41`, so `54340`-style on the root checkout; see `docs/decisions/0003`). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` default to the local stack; CI and deploys set them. `VITE_WEB_URL`, the website's address for the website editor's preview (#129), defaults to this worktree's website; a deploy that does not set it shows no preview (the owner kept CI as it is, #591). Sign in with a seed phone number and code `123456` (`supabase/seed/10_people.sql`).

`pnpm test --filter console` runs the app's tests; `pnpm e2e --grep "<flow>"` runs a flow across apps.

## Structure

```
src/
  main.tsx            the client, the providers and the router
  router.tsx          every route, in one list
  routes/             one file per URL; renders a feature's screen and nothing else
  features/<name>/    components/ and hooks/, imported only through index.ts
    frame/            the app's shell (console v3, decision 0476): staff only; the rail for the role (Tonight, Players,
                      Marketing, Admin folded), the phone's tab bar; the header's search, counts, clock and the staff
                      member's menu (density, practice venue, shortcuts, sign out); the practice venue's stripe; the
                      kill-switch banner; refusals under the screen's name; ScreenTabs for a screen that holds others
                      (`?tab=`, a tab's own parts `?part=`); not found
    sign-in/          mobile number and code, as in the player app (decision 0032)
    kyc-review/       identity checks waiting for a KYC reviewer: the queue beside the check open, decided with a reason in words, and Check in person in a sheet, beside the member's app selfie when they registered to be checked at the club (decision 0502) (/kyc-review)
    academy/          Academy batches, company bookings, recording a UTR and cancelling (Academy staff,
                      /academy); the payments the cage checks against the bank (/academy/payments)
    live-floor/       the room plan and each table's seats (/): seat (redeeming bonus chips with the buy-in, decision 0504), move, away, leaving, top-ups and a player's call time (#638);
                      joins waiting for approval, and tonight's top-ups by table with the time each took (#639)
    waitlist/         the Waitlist's Lists tab (/waitlist?tab=lists; decisions 0467, 0469): a card for each open table's own list, and a closed one while someone waits on it, with Open table once enough wait; joins from the app to approve or decline (#633); each place's Seat (the seat sheet at its table, with the member's bonus chips to redeem, decision 0504), or Check ID for a member whose ID the desk must check first (the check in person, /kyc-review?check=<name>, decision 0503), Hold place or Release and Remove; the bulk bar; add by mobile or member number
    pot-data/         every hand by table, dealer, variant and the club's days, for the super admin (/pot-data)
    dealers/          the rotation board, and each dealer's hours, hands, rake, variance and tip-pool share by time dealt (/dealers)
    fnb/              food and drink for staff who run F&B (#123), Service's whole role (#640): Orders in three lanes, to accept, being prepared and delivered tonight, each with its time; a KOT the bar printer missed, as its outbox delivery says, to print or read to the bar and mark handed over; New order, the table then the seat, paid or comp; the Menu tab, by kind, an item at a time or from a CSV (#799) (/fnb?tab=orders|menu, console v3)
    tables-setup/     the stakes the club runs and its tables, each added or changed, for the super admin (#642; /tables)
    games-history/    the tables run each club day, how often and how long, for the super admin (#643; Settings' Games history tab, /settings?tab=games-history)
    check-in/         the Door's Check-in tab (/door?tab=check-in): one field for the card the scanner reads (#71), a mobile, a member number or a name; then the members expected and in the room
    todays-players/   the Door's Today's players tab (/door?tab=players): every member at the club today by status, with times, tables and time played (#641)
    cage/             buy-ins by cash, UPI or wallet, the tables' requests, and markers signed for on the pad (/cage)
    markers/          credit: open markers by age, limits, raises waiting for a second super admin, room exposure (/markers)
    withdrawals/      members' withdrawals waiting for the cage and its second approvers (/withdrawals)
    treasury/         the cage's shift (/shift, #606): what the venue holds, the chips in play, opening the shift with
                      its float and counting its chips by denomination; then closing it against the ledger, with an
                      anomaly's reason from a manager, and every opening and close before (/treasury and
                      /end-of-day open their tab); the payment accounts (/accounts)
    members/          every member as a table, found by name, mobile or number, with where each is tonight, their KYC, hours played, city and member-since day, and the mobile for super admins (owner, 8 Nov); the record docked beside the list and in the address (/members?member=…&part=…), with the seat and a link to it on the floor, visits, early departures and promotions given, bonus chips (decision 0504), which a super admin adds by hand with a reason (owner, 8 Nov), what they told the club at sign-up and how they came (owner, 8 Nov), a tier change, a break (decision 0053), feature overrides and erasure on request
    admin/            the kill switch for super admins: what is engaged, engaging a level, release by two for a freeze (/kill-switch); reset the practice venue to its seed, after a dry run and its name typed (/practice-reset); purge a frozen live venue after its full archive is saved, a dry run and its name typed (/purge, #432); the full export archive and one member's data (what a member is owed, staff notes in their own folder, #498), locked to the owner's backup key (/exports, #103); the roster, for staff who manage staff: a week's shifts by job title, adding shifts for a job title's staff, copying the week before, and tonight's attendance (/roster, #106)
    aml/              the AML register for staff who review AML: patterns in members' cash buy-ins, their buy-ins, and the review (/aml, #105)
    devices/          the devices, Settings' Devices tab, by kind (/settings?tab=devices&part=, #606): dealer tablets and door kiosks to add, pair, fix to a
                      table and unpair; TVs to pair by their code, change and unpair; cage and admin computers to
                      add, enrol and revoke; CCTV cameras over a table or the cage (#122), whose Playback Pot data,
                      Incidents and the cage's receipt link to. /devices, /tablets and /tvs open it; /computers and /cameras say they are gone
    settings/         the rules in areas by job, each by name with its value now, who changes it and what is to come;
                      the club's details and chips for super admins (/settings, its areas by `?part=`, #604); /rake
                      opens it, saying rake is no longer on the console. Its Notices part puts a notice up, now or from
                      a start to an end (IST), edits one in place and ends one, with the card members see as its
                      preview (decision 0424)
    jackpots/         the jackpot's pools and payout rule, a bad beat paid in chips and a payout reversed; the high
                      hands claimed on the tablets, approved and paid or rejected, and their history (/jackpots,
                      #606; /high-hands opens its tab); the prompt across every other screen while one waits
    certification/    the dealer and cashier certification quizzes in the practice venue, and every attempt for managers (/certification)
    sops/             the SOP library: read and acknowledge; managers add SOPs, publish versions, see who acknowledged (/sops)
    staff/            the venue's staff as a table to search (C-03): add behind a button, open a name to change a job title or role, turn off; Removed staff by tab (/staff?tab=removed; owner, 8 Nov, decision 0506), when and by whom each was turned off, and Restore for a role within reach; each hire's onboarding checklist, the SOPs their role must acknowledge, ticked as they do (/staff); the dealers' PINs for the tablet sign-in, by tab (#606; /dealer-pins opens it)
    incidents/        the incident log, the club's contacts and its drills (/incidents)
    feedback/         the General Manager's feedback by tab (/feedback?tab=open|resolved): open tickets, each resolved with what was done, kept with the staff member's name; and the rest of the last 90 days
    host-queue/       lapsed regulars to call, longest gone first, beside the call open: why they stopped coming (needed to save it), the offer and a note; or off the queue (/host-queue)
    social/           by tab (/social?tab=wall|publish|leads): the social wall's tagged posts to approve or reject, publishing with the posts made, and the inbox's leads
    website/          Content's Website tab (/content?tab=website): the pages found by name in Club, Guides and Legal, beside the open page's draft, preview, publishing and history (#129)
    learn-sources/    Content's Learn content tab (/content?tab=learn), loaded when first opened as it carries the drill engine: licensed encodings and adding one that passes its checks (#131)
    rewards/          the Rewards tab of /rewards, by part (?part=catalogue|handover|points): the catalogue, its form opened by New reward or a reward's Edit; members' redemptions to hand over; points by hand, earned or locked, and released (#645), and League points from a CSV
    spin-wheel/       the Spin wheel tab of /rewards (?tab=spin-wheel): the spins waiting, and the wheel's prizes with their odds as bars, a bonus the month's spin budget cannot pay saying it is off the wheel, with a link to the budget
    league/           the RIVR League's standings by month or season, and its seasons (/league)
    tournament-interest/ a new tournament published without money: name, start, game and stake as text, description (#800);
                      who registered interest in each from the app, marked registered once paid (#636; the Waitlist's Tournament interest tab, /waitlist?tab=interest)
    tournaments/      the tournament clock and its controls, the field and the floor (players, bust-outs with
                      bounties, balancing, the room, buys in cash for a cashier), payouts (the places' shares,
                      the finish, deals, what was paid), tournaments from templates, templates, and blind
                      structures with the calculator (/tournaments; #115 to #121, #149)
    promotions/       current promotions by status with each count, Pause or Resume (Undo), Edit or Review, and End after a second press for one with no new version open; ended ones under their own tab with the day each ended (/promotions?tab=ended; owner, 8 Nov, decision 0506); the builder in five numbered sections from a template, beside the one-line summary, the TV slide, last week's simulation, Save draft and Submit for approval, which waits for a simulation on the terms as they stand; and the approver's view, the builder read only with what the waiting version changes, Approve (never the author's own) or Reject with a reason. Editing a running promotion drafts its next version (/promotions, ?open=new or ?open=<id>; console v3, decisions 0471, 0494 to 0496). |
```

Staff sign in at `/sign-in`; everyone else is sent there. The console works in one venue at a time, the club unless the staff member turns on "Practice venue", and every screen reads and writes for that venue through `useStaffVenue()` from `@rivr/db`. A screen adds its rail entry, with the permissions that may see it and its tabs, in `features/frame/components/railEntries.ts`; a hidden one (decision 0284) goes in its `HIDDEN` list. An old address that moved redirects from its own route file to its screen and tab. The practice venue's switch, and the staff member's density (decision 0475), are in their menu at the header's end.

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

A decision given with a reason, such as revoking a tablet or rejecting a claim, draws `ReasonForm` from `@rivr/ui`; the feature keeps its own `useForm` and the contracts schema for its reason and passes `register('reason')` in (decision 0211).

## Who builds what

Every lane adds console features: lane A the cage, markers, treasury, end of day, withdrawals, expenses, reports, owner dashboard, admin and settings (every effective-dated setting, built from each key's schema, and the venue configuration and chips, #33); lane B the live floor, waitlist, dealer tablets and their PINs, tables, tournaments, jackpots, high hands, TV screens, dealers, SOPs, incidents, F&B and pot data; lane C KYC review, members, Academy, website, Learn sources and cab; lane D promotions, rewards, League, social, creators, host queue, growth funnel and feedback (`docs/contracts/`).

## Budgets

Tables are virtualised past 200 rows.
