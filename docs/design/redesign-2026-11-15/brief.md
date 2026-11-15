# RIVR redesign: brief for the coding agent

You are implementing an approved redesign of the player app, the ops console and the TV display. Work inside WSL in `rivr-platform` and follow `CLAUDE.md` in full: `feature-task` for every task, tests first, `@rivr/ui` for every visible element, `@rivr/domain` for every rule, `@rivr/i18n` for every string in English and Hindi, forward-only migrations with row-level security and pgTAP, PRs under 400 changed lines. Never touch `rivr-prod`.

## 1. Sources of truth, in order

1. This brief.
2. The reference pack in `docs/design/redesign-2026-11-15/` (I will add it before you start): `screens/*.png` are renders of the approved prototype, named by flow. `prototype-source.dc.html` is the prototype's source. It does not run outside its host; read it for copy and behaviour only.
3. The app as it is on `main` today.

The rule that overrides everything else: **the existing app stands unless this brief changes it.** Where the prototype shows fewer rows, fields, columns, states or steps than the existing screen, keep the existing ones. The prototype is not a licence to remove anything outside section 3. Its data is sample data and its numbers are illustrative.

## 2. First deliverable, before any code

1. Write `docs/spec/redesign-2026-11-15.md` from this brief: one section per slice in section 9, each with acceptance criteria and the reference screens it must match.
2. Open one GitHub issue per slice, labelled by lane, each small enough for one PR. Open a `question` issue for every item in section 10 and take the safest reading meanwhile.
3. Post the issue list and stop for my go-ahead. After that, one issue per session.

## 3. Remove, in backend and frontend

Remove the feature, its screens, routes, feature keys, tier-gate rows, settings, i18n keys, seed data, TV boards, Edge Functions, outbox consumers and tests. Drop tables and columns in new migrations only, after confirming nothing still reads them.

- **Points and Rewards:** points earning, points history, the rewards catalogue and redemptions, points by hand, daily points limit, points on verification, the points-multiplier promotion reward, the Rewards tab in the player app, the console Rewards screen, the TV rewards ticker.
- **RIVR League:** league points and prizes settings, the TV league leaderboard.
- **Academy and Learn:** the Academy graduate tier, Academy promotions and templates, Learn content in the console, the player Learn and Academy screens.
- **Membership card and QR code:** the Card tab, QR generation and scanning. Door check-in stays by name, mobile or member number.
- **Spin wheel:** the free-spin reward, the budget setting, the TV board.
- **Social:** the social wall, moderation, the TV board.
- **Kill switch and Purge:** both console screens and what backs them.
- The 26 older console screens that today show "Not used at RIVR" (Cage, Markers, Shift, Tiers, TDS and the rest), except what section 6 keeps for tournaments.

## 4. Rename

"Bonus chips" becomes "Bonus" in every user-facing string, both languages, on every surface, including notifications and WhatsApp templates. Propose the Hindi strings in the PR for my review. Internal identifiers need not change.

## 5. Player app

Unchanged, keep exactly: sign-in, code entry (six boxes, Verify, resend countdown), sign-up "About you" with its three pickers, every ID check screen and state, seat request and waitlist, seat call, call time ring, top-up, leaving, food and drink, the rating after a visit, feedback, house rules, account deletion.

Changes:

- **Navigation:** Home, Sessions, Bonus, Profile. Bonus holds the balance, the history and refer a friend.
- **Home, top slot:** one card above the offers. It shows the ID check card while the check is not done, otherwise the live club notice. Neither shows while a seat is called or taken. A notice has no dismiss control.
- **Offers:** one carousel that cycles through every live promotion, with position dots. Tapping a dot holds that slide.
- **Tables:** each row shows the table's own minimum buy-in (section 7).
- **Add time:** the choices come from Settings, however many there are.
- **Refer a friend:** promise a reward only while a referral promotion is live. Otherwise offer the invite with no reward copy.
- **Tournaments:** interest only. "Notify me" on a tournament, a notification when the club sends one, past tournaments in Sessions. No registration, tickets or payments.
- **High hand:** a carousel card with the hands and their Bonus. When the floor pays the member, the Bonus lands at once with a toast and a history line.
- **Profile:** keep every existing row except Membership card.

## 6. Ops console

- **Navigation:** Tonight (Live floor, Waitlist, Door, Food and drink); Players (Members, ID checks, Feedback); Marketing (Promotions, Tournaments, Content); Admin (Tables, Staff, Reports, Settings, Activity).
- **Data tables, everywhere:** keep the column-header menu as built (sort both ways, then a filter by the column's kind). Add a row of removable chips for the active filters with "Clear all", and a result count. Never drop a column that exists today. Members gains a Bonus column.
- **Scale:** every list sorts, filters, searches and pages on the server, with indexes to match. Design for several hundred orders, sign-ins and check-ins a day and a five-figure member list. No list may load unbounded rows.
- **Live floor:** as today, plus a High hand bonus strip (hands paid tonight, Bonus paid, last hit) with "Log a high hand".
- **ID check in person:** the same checks, copy and rules as today, presented as five steps in order with a progress bar: Member, Face, PAN card, Aadhaar front, Details. Each "Use photo" moves to the next step and Back goes one step back. Details shows the three photos with Retake, the typed fields and consent. Keep auto-capture, zoom, the bars that must be confirmed, the QR hand-off when there is no back camera, the stored photos with "send back" and the desk retake.
- **Tables setup:** Stakes as today (name, small blind, big blind, optional straddle). A table has a name, seats, a stake and one **minimum buy-in**: required, prefilled at 50 big blinds of the chosen stake, editable. No maximum.
- **Promotions:** keep the builder page, its five sections, the one-line summary, preview, simulation and approval flow. Keep every existing reward type except points multiplier and free spin. Add **High hand Bonus** (section 7).
- **Tournaments:** create (name, start, game), see who asked to be notified, send the notification, keep a history with entries. Nothing else.
- **Reports:** keep the Tables report and its columns. Add Players, Waitlist, Food and drink and Bonus reports in the same pattern, with the same period control and export.
- **Settings:** section 8.
- **Unchanged apart from removals:** Door, Members and the member record, Feedback, Staff, Content, Activity, Club details, Tablets, console sign-in and what each role sees.

## 7. Rules for `@rivr/domain` (use the `money-rule` skill)

- **Minimum buy-in** belongs to the table, in integer paise.
- **Call time** is set per stake. A new stake needs one before a table can use it.
- **High hand Bonus:** a promotion holds a list of hands, each with its own Bonus, plus rules (both hole cards must play, shown at showdown, minimum players dealt in). Hands can be added and removed. The floor logs a hit against a table, a seated player and a hand, and the Bonus is paid at once, every time, with no hourly window and no "best hand" contest. The payout is one idempotent ledger entry, respects the promotion's budget and the daily Bonus limit, appears in Activity with who logged it, and reaches the member's app and the TV in real time. Only one high hand promotion can be live in a venue.
- **Notices:** visible on Home when live and when the member has no called or taken seat. Scheduling as today.
- **Referral promise:** derived from whether a referral promotion is live.

## 8. Settings

- Group the settings inside each tab under headings (for Floor: Seating, Time at the table, Identity; for Members and Bonus: Bonus, Membership; for TVs: Rotation). Each row keeps Setting, Now, Who changes it, Changes to come and Change, and gains a one-line description.
- **No fixed option lists for values.** Durations, counts and amounts are typed with their unit. Add time choices is a list the admin can add to, edit and remove from. Call time is one value per stake. Apply the same rule elsewhere: call time when seating a player, the amount when adding Bonus by hand (capped by its setting), the hands in a high hand promotion.
- A change applies from now or from a day and time the admin enters, never backwards, as today.
- Keep every existing setting that is not tied to a removed feature, placed in the fitting group. Keep Notices and Club details exactly as they are.

## 9. Slices, in this order

1. Removals, one feature per PR, in the order of section 3.
2. The rename.
3. `@rivr/ui`: data-table filter chips and count; the settings group and typed editors (number with unit, editable list, per-stake values); the step progress bar.
4. Stakes, per-stake call time and table minimum buy-in (migration, domain, console, player).
5. Settings regrouping and typed editors; add time choices end to end.
6. Player Home: top slot rule, offers carousel, navigation.
7. ID check in person as five steps.
8. High hand Bonus: domain and migration, builder reward type, floor logging, player, TV board.
9. Tournaments: interest, notification, history.
10. Reports.
11. TV: boards are Waitlist, Call time, Promotions, Hours leaderboard and High hand bonus.
12. Server-side paging, sorting and filtering for any list still unbounded.

## 10. Open questions (raise each as a `question` issue)

- Waitlist and Food and drink: the prototype shows tables; today they are per-table lists and an order board. Keep today's layouts until I decide.
- Host queue, Practice reset, the tournament clock and stream overlay: absent from the prototype. Do not delete them without my answer.
- Settings the prototype does not show (hotel night per hours played, Bonus per visit, door code refresh, dealer rotation, request targets, TV hours leaderboard, Google review link): keep unless I say otherwise.
- "SAC code, Academy" in Club details and "Cage and admin networks": both refer to removed screens. Keep the fields until I answer.
- The Call-time TV board is labelled "Seats opening" in the prototype. Keep today's name until I answer.

## 11. Done means

`CLAUDE.md`'s definition, plus: the screen matches its reference renders on the target device; nothing outside section 3 has disappeared; English and Hindi are complete; loading, empty, error and offline states exist as they do today; the practice venue behaves the same and nothing from it reaches an external system. Put the before and after screenshots and the `pnpm verify` summary in each PR.
