# console

The staff web app at 1440 px: the live floor, waitlist, members, promotions, staff and reports, with a left rail grouped as the design prompt lists it. What each person sees comes from their role's permissions in the database.

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
                      member's menu (density, practice venue, shortcuts, sign out); the practice venue's stripe;
                      refusals under the screen's name; ScreenTabs for a screen that holds others
                      (`?tab=`); not found; every table's order, search and filters in
                      the address under `t.<table>` (`useAddressTableViews`, the club's days for date filters), which a
                      screen's own links keep (`useNavigateKeepingViews`; decision 0512)
    sign-in/          mobile number and code, as in the player app (decision 0032)
    kyc-review/       identity checks waiting for a KYC reviewer: the queue beside the check open, decided with a reason in words, and Check in person in a sheet, as five steps under a progress bar (Member, Face, PAN card, Aadhaar front, Details; redesign RD-21), with the member's app selfie when they registered to be checked at the club (decision 0502); for the floor and hosts, who is due tonight under the search, a check held for its PAN among them (audit F-010, F-091) (/kyc-review)
    live-floor/       the room plan and each table's seats (/): seat (redeeming bonus chips with the buy-in, decision 0504, up to what the visit has left, decision 0579), move, away, leaving, top-ups and a player's call time (#638), and Bonus by hand in a seated player's sheet for staff who hold `bonus.give` (decision 0585);
                      joins waiting for approval, and tonight's top-ups by table with the time each took (#639)
    waitlist/         the Waitlist's Lists tab (/waitlist?tab=lists; decisions 0467, 0469): a card for each open table's own list, and a closed one while someone waits on it, with Open table once enough wait; joins from the app to approve or decline (#633); each place's Seat (the seat sheet at its table, with the member's bonus chips to redeem and what the visit has left, decisions 0504 and 0579), or Check ID for a member whose ID the desk must check first (the check in person, /kyc-review?check=<name>, decision 0503), Hold place or Release and Remove; the bulk bar; add by mobile or member number
    fnb/              food and drink for staff who run F&B (#123), Service's whole role (#640): Orders in three lanes, to accept, being prepared and delivered tonight, each with its time; a KOT the bar printer missed, as its outbox delivery says, to print or read to the bar and mark handed over; New order, the table then the seat, paid or comp; the Menu tab, by kind, an item at a time or from a CSV (#799) (/fnb?tab=orders|menu, console v3)
    tables-setup/     the stakes the club runs and its tables, each added or changed, for the super admin (#642; /tables)
    check-in/         the Door's Check-in tab (/door?tab=check-in): one field for a mobile, a member number or a name; then the members expected and in the room
    todays-players/   the Door's Today's players tab (/door?tab=players): every member at the club today by status, with times, tables and time played (#641)
    members/          every member as a table, found by name, mobile or number, with where each is tonight, their KYC, hours played, city and member-since day, and the mobile for super admins (owner, 8 Nov); the record docked beside the list and in the address (/members?member=…&part=…), with the seat and a link to it on the floor, visits, early departures and promotions given, bonus chips (decision 0504), which super admins, admins and floor managers add by hand there, on the record's own part, with a reason (owner, 9 Nov; redesign of 15 Nov), what they told the club at sign-up and how they came (owner, 8 Nov), a tier change, a break (decision 0053), feature overrides and erasure on request
    admin/            Activity for super admins (/activity): the audit log in words, who did what, about whom, why and when, newest first, narrowed by person, kind and club day, with its export
    devices/          the devices, Settings' TVs and Tablets tabs (/settings?tab=tvs|tablets, #606): dealer tablets to add, pair, fix to a
                      table and unpair; TVs to pair by their code, change and unpair; cage and admin computers to
                      add, enrol and revoke; CCTV cameras over a table or the cage (#122).
                      /devices, /tablets and /tvs open it; /computers and /cameras say they are gone
    settings/         the rules in groups by tab (Floor: Seating, Time at the table, Identity; Members: Bonus,
                      Membership; TVs: Rotation; redesign RD-18), each with its one line, its value now, who changes
                      it and what is to come; Change opens the setting's panel on the right, for a new value from now
                      or a day and time to come, Cancel and Save in its foot; History opens it to read, for a setting
                      the staff member may not change. Values are typed (RD-19): Add time choices a list of lengths, Call time one value for
                      each stake at once; the club's details, its numbers for calls and WhatsApp among them (decision 0582), for super admins
                      (/settings, its areas by `?tab=`, #604). Its Notices part puts a notice up, now or from
                      a start to an end (IST), edits one in place and ends one, with the card members see as its
                      preview (decision 0424)
    reports/          the MIS Tables view, money-free (owner, 8 Nov): each table over tonight, the last 7 or 30 club days, with hours run, players, the most at once, player hours and use (/reports); the money reports stay hidden
    staff/            the venue's staff as a table to search (C-03): add behind a button, open a name to change a job title or role, turn off; Removed staff by tab (/staff?tab=removed; owner, 8 Nov, decision 0506), when and by whom each was turned off, and Restore for a role within reach (/staff); the dealers' PINs for the tablet sign-in, by tab (#606; /dealer-pins opens it)
    feedback/         the General Manager's feedback by tab (/feedback?tab=open|resolved): open tickets, each resolved with what was done, kept with the staff member's name; and the rest of the last 90 days
    website/          Content's Website tab (/content?tab=website): the pages found by name in Club, Guides and Legal, beside the open page's draft, preview, publishing and history (#129); a page's sections added, moved, deleted or changed in kind from each one's menu, and list items added and removed (#906)
    tournament-interest/ a new tournament published without money: name, start, game and stake as text, description (#800);
                      who registered interest in each from the app, marked registered once paid (#636; the Waitlist's Tournament interest tab, /waitlist?tab=interest)
    promotions/       a high hand (redesign RD-23, decision 0622): hands from the fixed list, each with its Bonus, added and removed, its three rules and the budget it must have, from the High hand bonus template; on the list 'Up to 25,000 Bonus a hand' with its hands paid this week; its record beside the list with the hands and Bonus paid tonight, this week and the budget left, tonight's hits, its hands and rules, and Log a high hand, which opens on the Live floor for those who add Bonus by hand; a play-time bonus at set times or every few hours (decision 0507); a seat bonus at one amount or in tiers, the first members to claim it one amount and the next another, once a member (decision 0580); current promotions by status with each count, Pause or Resume (Undo), Edit or Review, and End after a second press for one with no new version open; ended ones under their own tab with the day each ended (/promotions?tab=ended; owner, 8 Nov, decision 0506); the builder in five numbered sections from a template, beside the one-line summary, the TV slide, last week's simulation, Save draft and Submit for approval, which waits for a simulation on the terms as they stand; and the approver's view, the builder read only with what the waiting version changes, Approve (never the author's own) or Reject with a reason. Editing a running promotion drafts its next version (/promotions, ?open=new or ?open=<id>; console v3, decisions 0471, 0494 to 0496). |
```

Every table a screen shows has Filters for the columns worth narrowing by (owner, 8 Nov): `filter: 'choice'` on a column of few values (a status, a role, a stake) and `filter: 'text'` on names; a column drawn as an element gives its words in `filterValue`.

Staff sign in at `/sign-in`; everyone else is sent there. The console works in one venue at a time, the club unless the staff member turns on "Practice venue", and every screen reads and writes for that venue through `useStaffVenue()` from `@rivr/db`. A screen adds its rail entry, with the permissions that may see it and its tabs, in `features/frame/components/railEntries.ts`. An old address that moved redirects from its own route file to its screen and tab. The practice venue's switch, and the staff member's density (decision 0475), are in their menu at the header's end.

Everything visible comes from `@rivr/ui`, every word from `@rivr/i18n`, every read through `@rivr/db`. A route imports only features, and a feature never imports another feature; `pnpm lint:deps` fails either (`.claude/rules/apps.md`).

A decision given with a reason, such as revoking a tablet, draws `ReasonForm` from `@rivr/ui`; the feature keeps its own `useForm` and the contracts schema for its reason and passes `register('reason')` in (decision 0211).

## Who builds what

Every lane adds console features: lane A reports, admin and settings (every effective-dated setting, built from each key's schema, and the venue configuration, #33); lane B the live floor, waitlist, dealer tablets and their PINs, tables, TV screens and F&B; lane C KYC review, members, website and cab; lane D promotions, growth funnel and feedback (`docs/contracts/`).

## Budgets

Tables are virtualised past 200 rows.
