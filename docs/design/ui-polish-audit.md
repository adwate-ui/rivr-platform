# UI polish audit: live walkthrough, static audit and asset quality

Date: 2 Nov 2026. Worktree: `rivr-lane-c` at main `480a7d37` (#701). Status: awaiting approval of the batches in Table 5; nothing has been changed.

## Scope and method

**Bounded by the rules.** Every proposal stays inside these rules; where one would break a rule, it is listed as an owner decision instead:
- `.claude/rules/ui.md`: dark, flat, gold hairlines, 6 px radius, 200 ms motion on state changes only, one gold fill per screen, no Modal/Select/Checkbox by design;
- `.claude/rules/copy.md` and section 4 of the design prompt;
- decisions 0160, 0258 and 0282;
- decision 0284 (no rupee or rake on any console).

**Live walkthrough.** Three Playwright passes ran against the seeded local stack (port block 546), driving the built apps as their users do. Each pass recorded console errors, failed requests, layout shift (CLS), horizontal overflow, clipped or spilling text, touch targets, native controls, tabular figures, contrast, gold fills and a keyboard focus walk, with a full-page screenshot at every step.

| Pass | What it did | Result |
|---|---|---|
| 1 Sweep | Every live route of player (375, 430), console (1440, 1024, 375), tablet (1180×820, 1024×768, 768×1024), TV (1920×1080, every mode) and website (1440, 375, 16 pages and the 404); sign-in with an empty, short and wrong number and a wrong code; sign-up empty, then filled; not-staff; service, cashier and host landings | 5 passed in 4.3 min; 241 records, 171 screenshots |
| 2 Interact | Forms empty, wrong and right; a second tap 80 ms after the first on real writes (Join, Register interest, Send feedback, Add to the list, Check in, Send for approval); QR rotation over 40 s; the rail's overflow; Ctrl+K and /; Escape on the drawer; a revoked tablet; three TV modes given 12 s | 4 passed in 3.0 min; 70 records |
| 2b Seated | The floor seats a member; the member reads Home seated and orders from the seat; the console's food and drink list receives it | 1 passed in 13 s |

The scripts live outside the repo (scratchpad `audit/`: `probe.ts`, `sweep.audit.ts`, `interact.audit.ts`, `seated.audit.ts`) and can be re-run to check each batch.

**Static audit.** Two read-only reviews ran beside the walkthrough:
- `@rivr/ui` primitives and tokens: states, contrast, targets, print;
- the `en` catalogue and the apps' copy maps.

I checked every row kept below against the code. Rows that contradicted the spec were dropped:
- "KYC incomplete" is the design prompt's own example line;
- "locked" points is what decision 0284 chose;
- "Send by SMS" names the fallback channel on purpose;
- "DigiLocker" stays, since Cashfree Secure ID runs through DigiLocker.

**Not covered:**
- Screens hidden by decision 0284: Cage, Markers, Treasury, End of day, Withdrawals, console Tournaments, Jackpots, Dealers, Tiers, League, Events, Creators, Academy, SOPs, Incidents, Reports, Exports, and the player's Balance, Academy and jackpot. Their code stays, but nobody can reach the screens.
- The driver app (#141, closed as not planned).
- Tablet hand entry (removed, #630).
- KYC past its first screen (the selfie needs a camera; PAN needs Cashfree's sandbox).
- The tablet's offline mode.
- Printing: every screen that prints (`CageReceipt`, `PartnerStatements`, `AcademyInvoiceScreen`) is hidden.
- Hindi: English only (0027).

**Probe noise excluded:**
- "Skip to content" and the sign-in "Sign in" heading are visually hidden on purpose.
- The rail's Practice venue switch is labelled through `<label for>`.
- The phone fields' focus ring is drawn on their frame, which shows on screen.
- 403s logged after my own teardown revoked a tablet.
- TV modes captured before the TV's 3 s poll had switched.
- The website's reveal-on-scroll text measured before it was revealed.

---

## Table 1: Live walkthrough bugs and interaction failures

P0 means members or the public see it at launch; P1 breaks or confuses a workflow; P2 is minor. "(code read)" marks a finding from the code that the walkthrough did not trigger.

| ID | Persona / app | Workflow and step | Viewport | Observed bug | Root cause | Exact fix |
|---|---|---|---|---|---|---|
| E-01 P0 | Member, player | Learn tab address, or the website's Academy link (`/academy` redirects to `/learn`) | 375, 430 | A blank screen: no heading, no line, only the header and tab bar | `apps/player/src/features/learn/components/LearnScreen.tsx:55` wraps the whole `Screen` in `FeatureGate`, and `packages/ui/src/FeatureGate/FeatureGate.tsx:23-24` renders `null` for `hidden`; `learn.library` is hidden for every tier (0284) | Send `/learn`, `/learn/$sourceKey`, `/academy` and `/events` to Tonight when the feature is hidden, as 0284 says hidden addresses do: a `beforeLoad` redirect on those routes, reading the same feature access |
| E-02 P1 | Member, player | `/events` | 375, 430 | "Events" heading over an empty body: no empty line, no way on | `apps/player/src/features/events/components/EventsScreen.tsx:33` gates only the body; `events.book` is hidden | Same redirect as E-01 |
| E-03 P1 | Floor, console | Waitlist, Add to the list, a second tap 80 ms after the first | 1440 | `add_to_waitlist` was sent twice; the button showed no busy state after the first tap. Both calls were refused (identity check not finished), so nothing was duplicated this time | `apps/console/src/features/waitlist/components/AddMemberForm.tsx:23,36`: `isLoading={add.isPending}` turns on only after `handleSubmit`'s async validation, so a tap during validation submits again | `isLoading={form.formState.isSubmitting \|\| add.isPending}` (React Hook Form sets `isSubmitting` before validating); confirm `add_to_waitlist` is idempotent on the form's request id; apply the same pattern everywhere (UI-03) |
| E-04 P1 | Floor, console | Waitlist on a phone | 375 | "Add to the list" is squeezed to about 54 px and its label wraps to four lines beside the number field | `AddMemberForm.tsx:34`: `Inline` without wrap, and `Button` may shrink | Let the row wrap below the tablet breakpoint (field above, button below); make `Button` `shrink-0 whitespace-nowrap` (UI-02) |
| E-05 P1 | Dealer, tablet | Console revokes the tablet | 1180×820 | 12 s later the tablet still offers "Who is dealing? Pema Lepcha"; every poll of `tablet_dealers` returns 403; it never goes back to pairing | `apps/tablet/src/features/frame/components/Frame.tsx:72-89` decides "paired" from the local device session only | On a 403 from a device call, sign the device session out and show `PairScreen` with one line: "This tablet was unpaired. Pair it again." |
| E-06 P1 | Member, player | Tonight first load | 375, 430 | Layout shift 0.16 to 0.23: the whole table list jumps down when "Upcoming tournaments" arrives (the shift's source is the tables list) | `apps/player/src/features/home/components/HomeScreen.tsx:33,47`: the screen waits for tables and places only; `UpcomingTournaments` loads on its own, above the tables | Put the tables first (as the prototype does) and the tournaments after them; or include their query in the screen's loading gate |
| E-07 P1 | Marketing, console | Promotions first load | 1440, 1024, 375 | Layout shift 0.69 to 0.77, the worst in the product: Running, New promotion and Templates each arrive separately and push one another down | `apps/console/src/features/promotions/components/PromotionsScreen.tsx:154-155`: `RunningList` and `TemplatesList` load independently, with no reserved height | One loading gate for the screen's lists, or a reserved minimum height per section; same check on Food and drink (CLS 0.13 to 0.39) and console Rewards at 375 (0.28) |
| E-08 P2 | Marketing, console | Promotions | all | Two `h1`s: "Promotions" and "Double points" (the TV slide preview's title) | `packages/ui/src/TvPromotionSlide/TvPromotionSlide.tsx:44` hard-codes `level={1}` | Add a `level` prop (default 1 on the TV); the console preview passes 2 |
| E-09 P2 | Front desk, console | Check-in by phone, a second tap 80 ms after a success | 1440 | The member is checked in (they appear under In the room), but the second tap submits the now-empty field and "Enter a 10-digit mobile number." replaces the success line | `apps/console/src/features/check-in/components/PhoneCheckIn.tsx:27,45`: `form.reset()` on success leaves the button live and the outcome replaceable | Keep the success line until the next keystroke; ignore a submit with an empty field straight after a success |
| E-10 P2 | Floor, console | Live floor, Leave on a seated player | 1440 | (code read) No busy state while the leave is sent, and a refused leave is an unhandled promise | `apps/console/src/features/live-floor/components/TableDetail.tsx:100-101,140`: `ConfirmButton` without `isBusy`; `void leave.mutateAsync(...).then(report)` has no catch | `isBusy={leave.isPending}`; route it through the screen's failure copy, as the other seat actions do |
| E-11 P2 | Floor, console | Waitlist, Back on an away player | 1440 | (code read) The write has no busy state | `apps/console/src/features/waitlist/components/EntryRow.tsx:55` | `isLoading={away.isPending}` |
| E-12 P2 | Dealer, tablet | Pairing with a 2-digit code | 1180×820 | The code goes to `device-pair` (400), and the reply "That code is not right or has run out" misleads | `apps/tablet/src/features/pairing/components/PairScreen.tsx:38`: only `maxLength={6}` | Require six digits before sending: "Enter the six-digit code from the console." |
| E-13 P2 | Floor, console | Waitlist, Add to the list with the number empty | 1440 | `add_to_waitlist` answered 400 (a console error) before the field's message showed | `AddMemberForm.tsx:23`: the empty value reaches the server | Check the resolver stops an empty number before the call; add a unit test |
| E-14 P1 | All staff, console | Rail at a 1440×900 desk; drawer on a phone | 1440×900, 375 | The rail's list shows 493 of its 966 px, so Rewards, Social, Website, Learn content, Staff and all of Admin sit below the fold of an inner scroller, with no cue. The phone drawer shows 405 of 1,254 px. The page itself also scrolls 52 px at 1440×900 | `packages/ui/src/ConsoleShell/ConsoleShell.tsx:99`: `overflow-y-auto` on the list, with the user block pinned beneath it | Let the rail scroll as one column with the user block at its end; add a hairline and a fade where the list continues; find and remove the 52 px page overflow |
| E-15 P0 | Public, website | `/tournaments` on a phone | 375 | Horizontal scroll of 37 px: "CHAMPIONSHIP NIGHTS" runs off the right edge | `packages/ui/src/Heading/Heading.tsx:38-40`: `hero`, `band` and `statement` are 48 px uppercase Bodoni at phone width, with no wrap guard | 36 px at phone width; add `overflow-wrap: anywhere` as a guard; a long-word story and a 375 px visual baseline |
| E-16 P0 | Public, website | Every page header | all | A placeholder phone number, "+91 00000 00000", and a WhatsApp link to 910000000000 are live in the top bar | `apps/web/src/features/site/links.ts:30-31` (asserted in `SitePage.test.tsx:53`) | Leave the phone and WhatsApp links out until the owner gives the number (decision 0166 says the contact shows "once it is given"), or set the real number |

Checked and working:
- Join (one write, busy state shown).
- Feedback: empty Send explains what is missing; a double tap sends once.
- Seat a player and the order from the seat: one write each.
- Check-in by phone: one write.
- Send for approval: one write.
- The member card's QR: changed at 0, 20 and 40 s.
- `/` and Ctrl+K focus Go to; Escape closes the drawer.
- Sign-in errors say what happened and what to do.
- Sign-up moves focus to the first invalid field.
- Staff, Kill switch and New reward forms explain every empty field.
- Every TV mode loads.
- No page errors in any app.

---

## Table 2: Systemic upgrades in `@rivr/ui`

Each row changes one primitive; every app that uses it improves at once. All stay inside the visual standard.

| ID | Component / token file | Current shortcoming | Upgrade within the brand | Apps |
|---|---|---|---|---|
| UI-01 | `Button/Button.tsx:57-60` | Primary and danger have no hover and no pressed state; secondary's `hover:bg-raised` does nothing on raised surfaces (sheets, cards, nav) | A pressed state on every variant (opacity token, 200 ms); a hover token for gold (`color.actionHover`, a step lighter); on raised surfaces, hover brightens the hairline instead of the fill | all |
| UI-02 | `Button/Button.tsx` | Labels may wrap and the button may shrink in a row (E-04) | `shrink-0 whitespace-nowrap`; a long label takes `fullWidth` | all |
| UI-03 | Form pattern in the apps (`isLoading={mutation.isPending}`) | Busy only once the request starts; async validation leaves a window for a second submit (E-03) | `isLoading={form.formState.isSubmitting \|\| mutation.isPending}` in every React Hook Form submit, plus a lint check or test that finds the old pattern | P C T |
| UI-04 | `Input/Input.tsx:99`, `TextArea/TextArea.tsx:40` | The invalid edge `border-alert` is 2.56:1 on raised and 2.08:1 on the page, under the 3:1 a control edge needs (faint in the sign-up screenshot) | A 2 px invalid edge in a token that meets 3:1, keeping the icon and message | all |
| UI-05 | `styles.css` | No `:-webkit-autofill` override: Chrome paints its light autofill fill on the dark number and code fields | An inset fill of `raised` and `-webkit-text-fill-color` from the content token | P C T |
| UI-06 | `Switch/Switch.tsx:26,44-52` | On: a cream thumb on gold (1.95:1). The 16 px thumb overflows a 14 px inner box. The focus ring circles an invisible 44 px box. Disabled dims the whole row, hint included, so Profile's "Notifications are blocked… allow them in your phone's settings" reads at 1.95:1 | A green-black thumb when on (6.8:1 on gold); a thumb that fits; the ring on the track; disabled dims the control only, while the hint keeps full muted contrast | P C |
| UI-07 | `ChoiceChips/ChoiceChips.tsx:62` | Selected differs only by border and text strength. Profile's "Quick note / Detailed feedback" and "Any / 50/100" are hard to tell apart | Selected: raised fill, a gold hairline edge and a check mark (meaning a word can't carry at a glance); a pressed state | P C |
| UI-08 | `SideNav/SideNav.tsx:83,88`, `BottomNav/BottomNav.tsx:62` | The waiting-count pill is a gold fill on every item with a count (against one gold fill per screen); the current item is marked only by weight | An outlined count (gold hairline); the current item gets the 2 px gold rule `Tabs` already uses | C P |
| UI-09 | `ChoiceSheet/ChoiceSheet.tsx:39-42`, `ConsoleShell/ConsoleShell.tsx:130-135` | A green-black sheet over a 60% green-black overlay has no visible edge; it relies on a dark shadow on dark | A gold hairline on the sheet's top edge and the drawer's right edge | P C |
| UI-10 | `DataTable/DataTable.tsx:20,127,135,179` | No row hover (the tokens name raised as "rows on hover"); right alignment of numbers is opt-in; the sort chevron shifts the label; sort headers measured 34 to 41 px wide below 1180 px (Games history, Tables setup, Today's players) | Row hover; numeric columns end-aligned by default; space reserved for the chevron; `min-w-touch` on header buttons below 1180 px | C |
| UI-11 | `LoadState/LoadState.tsx:98`, `DataTable/DataTable.tsx:252`, `Screen` | "Loading" shows at once, so fast loads flash it; sections reserve no height, which is behind E-06 and E-07 | Show the loading text after 200 ms (keep `aria-busy` at once); a `minHeight` option for sections that load on their own | all |
| UI-12 | `styles.css:63` | Under reduced motion the busy circle stops turning, against `ui.md` and `Button.tsx:117` | Drop `[data-busy-turn]` from the reduced-motion block | all |
| UI-13 | `ConfirmButton/ConfirmButton.tsx:49-54`, `ConfirmQuestion/ConfirmQuestion.tsx:24-46` | The label swaps to the question with no live region, so a screen reader says nothing; ConfirmQuestion ignores Escape; callers can omit `isBusy` (E-10) | A visually hidden `role="status"` line; Escape cancels; make `isBusy` required where `onConfirm` writes | C T P |
| UI-14 | `SeatRing/SeatRing.tsx:55-75` | Sized by width only (`w-full`, viewBox 240×150): on the tablet the ring is taller than the screen and seats 5 and 6 fall below it; "Seat N" under each circle repeats the number and overlaps the table's edge; on the console's table cards its 12-unit labels render at about 8 px | Fit to the smaller of width and height; drop the visible "Seat N" when the circle carries the number (the accessible name keeps it); a minimum rendered label size. Pairs with the table art in AS-08 | C T |
| UI-15 | `TvWaitlistBoard/TvWaitlistBoard.tsx:36-37` | The 56 px stake name and 24 px tracked detail share one row, so in three columns "NLH / 50/100" and "1 TABLE / OPEN" each break onto two lines | Stake name on one line, detail beneath it; a long name scales down, never wraps | D |
| UI-16 | `Heading/Heading.tsx:37`, fonts | Bodoni Moda loads at weight 400 only, so `tvTitle`'s `font-medium` does nothing (`font-synthesis: none`) | The variable Bodoni Moda with its optical-size axis (AS-06), or drop `font-medium` | D W |
| UI-17 | `CookieBanner/CookieBanner.tsx:15` | Native 13×13 px checkboxes (the rules allow no Checkbox; targets must be 44 px), and the banner covers about 45% of a 375 px screen | `Switch` rows; a compact phone layout (one line and three buttons, choices behind "Choose") | W |
| UI-18 | `Text/Text.tsx:34` | `eyebrow` uses the TV's 0.2 em tracking; the tokens reserve 0.06 em for small capitals | `tracking-wide` for eyebrow; `tv` stays on the TV | W C |
| UI-19 | `tokens.json:161` (`opacity.disabled` 0.4) | Disabled actions say nothing about why: Verify with three digits, Save the stake with half a form | Prefer an enabled button that explains on press (as Feedback does); where a button must be disabled, a hint line beside it | all |
| UI-20 | Print: `DocumentTable.tsx:67,76-80`, `styles.css:151-177` | Gold row rules vanish on cream paper; totals in `tfoot` repeat on every printed page; no `print-color-adjust` | Deferred: no live screen prints today. Do it with the first printed document that returns | C P |

---

## Table 3: App by app layout, responsive and state polish

| ID | App | Screen / component | Category | Issue | Proposed fix |
|---|---|---|---|---|---|
| A-01 | Player | Tonight, `HomeScreen.tsx:47-48` | Layout | Upcoming tournaments sit above tonight's tables, and the tables have no heading of their own, so they read as part of "Upcoming tournaments" | Tables first under a "Tables" heading, then tournaments, then promotions (with E-06) |
| A-02 | Player | Profile, `PhonePushSwitch.tsx:13-15` | State gap | When notifications are blocked, the line that says how to fix it is the least legible text on the screen (1.95:1) | UI-06 |
| A-03 | Player | Profile | Ergonomics | One 2,284 px scroll at 375 px across nine sections, with feedback near the bottom | Order the sections by use (card, identity, alerts, limits, notifications, privacy, house rules, feedback, sign out) and keep each section's subtitle out (CP-19) |
| A-04 | Player | Rewards, `memberRewards.ts:95` | State gap | A RIVR League section ("Play cash games and tournaments to earn them"), while League is hidden on the console and points are by hand only (0284) | Owner decision Q5: hide League on the player and TV, or keep it as a points table |
| A-05 | Player | Rewards catalogue filter | Layout | Five filter chips wrap to three rows at 375 px | One row that scrolls sideways, with a fade at the edge |
| A-06 | Player | Menu, not seated | State gap | The menu is hidden entirely until the member sits; only "Order from your seat: sit at a table first." shows | Show the menu, read only, with one line saying ordering opens once seated (follow-up issue: beyond the F&B acceptance) |
| A-07 | Player | Menu, seated | Layout | A flat list of eight items, while the console has Food, Soft drink and Alcohol | Group under those three headings |
| A-08 | Player | Tonight, seated | Visual polish | Four stacked full-width buttons; "Order food and drink" repeats the Menu tab; call time is small text | Call time as the card's figure (`CallTimeTimer`, tabular), the table and seat as its heading, and the actions as a two-by-two grid |
| A-09 | Console | Waitlist, `EntryRow.tsx:44,61,65`; `waitlist.ts:152,155,170` | Ergonomics | Visible labels carry the full name ("Call Kabir Sethi", "Skip Kabir Sethi", "Remove Kabir Sethi"), so each entry takes three rows on a phone and the desk rows crowd; the prototype shows "Call · Skip" | Visible verb only; the name stays in the accessible name, so the e2e selectors keep working |
| A-10 | Console | Waitlist stake heading | Visual polish | "NLH 50/100   50/100" repeats the blinds | Show the blinds only when the stake's name lacks them |
| A-11 | Console | Live floor, `TableHeader.tsx:17-18`, `RoomPlan.tsx:35` | State gap | "Hands" and "Per hour" (always 0) and each card's pace "–" can never change: hand entry left the tablet (#630) | Remove them; use the space for call time due and top-ups waiting |
| A-12 | Console | Live floor cards | Typography | Seat ring labels render at about 8 px at 1440 px | UI-14 and AS-08 |
| A-13 | Console | Tables setup, `StakesBlock.tsx:87`, `TablesBlock.tsx:86` | Visual polish | Two gold filled buttons on one screen; the Stake column wraps "NLH / 50/100" | Both secondary (neither form is the screen's one action); widen the column |
| A-14 | Console | Rail, `ConsoleShell.tsx:99` | Ergonomics | E-14 | E-14 |
| A-15 | Console | Promotions templates | Visual polish | Every template row shows its own budget field and two chips, a dense back-office grid | One line per template with "Send for approval"; its budget opens in place on press |
| A-16 | Console | Members, `members.ts:12-13` | State gap | Two different hints for one search field | One line (CP-20) |
| A-17 | Console | Staff | Ergonomics | Every person repeats nine role chips, a job title field and Save, a very long list | One row per person (name, role, job title) with Change opening the chips in place |
| A-18 | Console | Below 1180 px: Games history, Tables, Today's players | Ergonomics | Sort headers 34 to 41 px wide; seat-count chips 42 px at 375 | UI-10; chips at `min-w-touch` |
| A-19 | Tablet | Seats, `SeatRing.tsx:58,71-72` | Layout | At 1180×820, 1024×768 and 768×1024 seats 5 and 6 sit below the screen; labels overlap the table's edge | UI-14; the table art of AS-08 |
| A-20 | Tablet | Pairing | State gap | E-12 | E-12 |
| A-21 | Tablet | Revoked | State gap | E-05 | E-05 |
| A-22 | TV | Waitlist board | Layout | UI-15 | UI-15 |
| A-23 | TV | League leaderboard, Rewards ticker | State gap | League shows "No League points yet." indefinitely, since points are now by hand | Owner decision Q5 |
| A-24 | Website | `/tournaments` | Layout | E-15 | E-15 |
| A-25 | Website | Top bar on a phone | Layout | The bar scrolls sideways by design, but "Member app" is cut off at the edge with no cue | On a phone, move "Member app" into the header beside "Reserve a seat" |
| A-26 | Website | Cookie banner | Ergonomics | UI-17 | UI-17 |
| A-27 | Website | Front page content | Content | "Every hand logged at the table" and "Points for every hour you play" (seeded blocks) and "Every hour at the table earns points" (`web.ts:48`) describe what 0284 removed | Owner decision Q6, then edit the blocks in the console's Website editor and CP-03 |
| A-28 | Website | Header | Copy | Title case and ampersands in the navigation | CP-01 |

---

## Table 4: Copy and tone corrections

All under `packages/i18n/src/catalogue/en/` unless noted. Each replacement passes the copy rules. Tests that match the old string are named; update them in the same commit.

| ID | File (key) | Current string | Rule or tone issue | Replacement |
|---|---|---|---|---|
| CP-01 | `web.ts:11-19` (nav) | The Club / The Room / What's On / Prizes & Calendar / Visit & Contact | Title case and ampersands; the footer is already sentence case | The club / The room / What's on / Prizes and calendar / Visit and contact (tests: `SitePage.test.tsx`, `website-pages.spec.ts`) |
| CP-02 | `web.ts:105` (`helplines`) | Need to talk? | A heading that is a question | Helplines (tests: `SitePage.test.tsx`, `WebFooter.test.tsx`) |
| CP-03 | `web.ts:48` (`intro`), `web.ts:56` (`rakeShare`) | Every hour at the table earns points, more at the higher stakes. / RIVR Rewards: {percent}% of your rake comes back as points. | Untrue since 0284 (points by hand only) | Points are given by the club and spent on rewards. Drop `rakeShare`, or show it only for a rate above zero (owner Q6) |
| CP-04 | `web.ts:31`, `web.ts:43` | No promotions are running just now. Check back soon. / No standings yet. They start with the first night of play. | Empty states are one line | No promotions running. / No standings yet. (tests: `ClubBlocks.test.tsx`) |
| CP-05 | `ui.ts:69` (`essentialHelp`) | Always on. Only your choice here. | Garbled | Always on. The website needs these to work. |
| CP-06 | `common.ts:40` (`codeRejected`) | Code wrong or expired. Check it, or request a new one. | Clipped; "request" is system language | That code is wrong or has expired. Check it, or send a new one. (tests: `sign-in.spec.ts`) |
| CP-07 | `common.ts:15` (`notFound`) | This page does not exist. | Says what happened, not what to do | This page is not here. Check the address, or go back. (tests: player and console `app.test.tsx`) |
| CP-08 | `feedback.ts:35,37` (`invalid`, `too_old`) | That ticket is resolved already. The list now shows it. | A wrong message: two different failures claim the ticket is resolved | invalid: That did not save. Check the entry and try again. too_old: This ticket is too old to resolve here. |
| CP-09 | `feedback.ts:47` (`prompt`) | How was {day}? | A question as a heading | Your visit on {day} (tests: `door-kiosk.spec.ts`) |
| CP-10 | `fnb.ts:25` (`notSeated`) | Order from your seat: sit at a table first. | Clumsy | Take a seat at a table to order. |
| CP-11 | `fnb.ts:30,49,92` (`sent`) | Sent to the bar: KOT {kot}, to {table}, seat {seat}. | "KOT" is kitchen jargon on a member's screen (it stays on staff screens) | Sent to the bar for {table}, seat {seat}. Order {kot}. (tests: `fnb.spec.ts`, `FnbOrderScreen.test.tsx`, `SeatFnbOrder.test.tsx`) |
| CP-12 | `ui.ts:28` (tab), `fnb.ts:22,24` | Menu / Menu / Order food and drink | Three names for one thing; "Menu" also reads as the hamburger | Tab: Food. Screen heading: Food and drink. Button: Order (tests: `fnb.spec.ts`) |
| CP-13 | `checkIn.ts:30` (`stillSeated`) | …The floor ends their seat, or the cage cashes them out, before they check out. | Points staff at a hidden screen (0284) | This member is still seated. The floor ends their seat before they check out. |
| CP-14 | `tablet.ts:40` (door `seated`) | You are still seated. Please cash out at the cage first. | Members now leave from the app or the floor (0284, #634) | You are still seated. Leave your seat in the app, or ask the floor. (tests: `doorCopy.test.ts`; owner Q7) |
| CP-15 | `tablet.ts:23-24` (offline start) | Waiting for the network / RIVR Dealer opens as soon as the club Wi-Fi and the internet are up… you don't need to do anything. | The heading is not a noun; the body is wordy | No network / RIVR Dealer opens when the club network is back. It tries again every few seconds. (tests: `OfflineStart.test.tsx`) |
| CP-16 | `promotions.ts:20` (`invalidBudget`) | Enter the budget in rupees, or leave it empty. | Rupees on a console (0284); the field says bonus chips | Enter the budget in bonus chips, or leave it empty. |
| CP-17 | `waitlist.ts:115` (`tooLate`) | You were away too long, so your place has gone. Join again if you still want to play. | Blames the member | Your time away ran out and your place has gone. Join again to play. |
| CP-18 | `waitlist.ts:21` (`not_allowed`) | This is not open to you. | No next step | This is not open to you. Ask at the front desk. |
| CP-19 | `profile.ts:11,83`; `feedback.ts:59` | We tell you when a seat opens in these games. / How the tables run at RIVR, and why poker is a game of skill. / Tell the club what would make your next visit better. The General Manager reads every note. | Explanatory subtitles under headings (design prompt section 4) | Remove; where a line is needed, fold it into the field's label or hint ("Games to hear about") |
| CP-20 | `members.ts:12-13` | Two hints: "A name, four or more digits…" and "Type a member number, two or more letters…" | One field, two different rules | Keep one: A member number, two or more letters of a name, or four or more digits of a mobile number. |
| CP-21 | `memberRewards.ts:95` (`noStandings`) | No League points yet. Play cash games and tournaments to earn them. | Untrue since 0284; two sentences | No League points yet. (or drop with A-04) |
| CP-22 | `profile.ts:69` (`breakIntro`) | Waitlists and buy-ins close for the period you choose. It cannot be shortened. | Buy-ins are off the app (0284) | Tables and waitlists close to you for the period you choose. It cannot be shortened. (tests: `self-exclusion.spec.ts` if matched) |
| CP-23 | `memberRewards.ts:50,61` | …you each get {chips} bonus chips. / …On your first buy-in, we both get a bonus. | "bonus" beside "bonus chips" on one screen | …we both get bonus chips. (tests: `ReferralCard.test.tsx`) |
| CP-24 | `common.ts:7` (`screenFailed`) | Screen unavailable | No next step | Screen unavailable. Reload the page. (tests: `console/router.test.tsx`) |
| CP-25 | `common.ts:8`, `ui.ts:120`, `apps.ts:76` | Offline. / Offline. What you see… / No connection. | Three phrasings of one state | No connection. What you see may be out of date. (tests: `OfflineBanner.test.tsx`, `TabletShell.test.tsx`, player `app.test.tsx`) |
| CP-26 | `push.ts:9`, `ui.ts:130` | Call time done | "complete" is used everywhere else | Call time complete (tests: `pushConsumer.test.ts`, `CallTimeTimer.test.tsx`) |
| CP-27 | `waitlist.ts:107` vs `push.ts:6` | Hold expires {time} / Hold until {time} | Two phrasings in one flow | Held until {time}. (tests: `waitlist.spec.ts`) |
| CP-28 | `supabase/seed/62_rewards.sql:8` | Registered to you at the cage | Seed content pointing at a hidden screen | Registered to you at the front desk |

Patterns behind these:
- **Words left from hidden features:** cage, buy-in, rupees and hourly points (CP-03, CP-13, CP-14, CP-16, CP-21, CP-22, CP-28). Sweep these once.
- **Empty states longer than one line,** and headings that are questions.
- **Staff words on member screens:** KOT.

---

## Table 5: Batched execution plan

One PR per batch, as agreed for named batches, with one commit per group of row IDs. A batch over 400 changed lines splits into two PRs. Local checks before each PR:
- typecheck and lint of the touched packages;
- the touched tests;
- `--coverage` on touched packages;
- new or changed story baselines (`node visual/run.mjs --update --grep <component>`);
- the touched e2e flows;
- a re-run of this walkthrough's scripts for the screens the batch changes.

CI is the gate.

**I recommend running Batch 2 first.** It holds the three P0s the public will meet on 15 November (E-01, E-15, E-16) and the workflow bugs. The primitives in Batch 1 do not block it.

| Batch | Scope | Packages and files | Verification | Waits on the owner |
|---|---|---|---|---|
| 1. `@rivr/ui` foundations | UI-01 to UI-19 (UI-20 deferred) | `packages/ui` (Button, Input, TextArea, Switch, ChoiceChips, SideNav, BottomNav, ChoiceSheet, ConsoleShell drawer edge, DataTable, LoadState, ConfirmButton, ConfirmQuestion, SeatRing, TvWaitlistBoard, Heading, CookieBanner, Text), `styles.css`, `tokens.json` (a gold hover token) | Unit tests per component; story baselines updated for every changed story; contrast figures in the PR; the walkthrough's contrast, target and focus probes at 375, 1024 and 1440 px | No |
| 2. Walkthrough bug fixes | E-01 to E-16; UI-03 applied in every form | player routes (learn, events, academy), `HomeScreen`, `PromotionsScreen`, `AddMemberForm`, `PhoneCheckIn`, `TableDetail`, `EntryRow`, tablet `Frame` and `PairScreen`, `TvPromotionSlide`, `ConsoleShell`, `Heading`, web `links.ts` | A failing test first for each: redirect, double submit (two taps, one write), revoked tablet goes back to pairing, CLS under 0.1 on Tonight and Promotions, no horizontal scroll at 375 on every website page; e2e: waitlist, check-in, tablet-pairing, website-pages | E-16: the real phone number, or hide it |
| 3. Copy sweep | CP-01 to CP-28 | `packages/i18n` catalogue, `supabase/seed/62_rewards.sql`, the tests named per row | `copy.test.ts`; every named test updated in the same commit; e2e flows that match changed strings | CP-03, CP-14: owner Q6, Q7 |
| 4. Player and website visual pass | A-01 to A-08, A-24 to A-28; AS-03, AS-07, AS-10; the free half of AS-06 | `apps/player` (home, profile, rewards, fnb), `apps/web`, `@rivr/ui` web blocks, `ReferralCard`, font packages | Screenshots at 375 and 430 (player) and 375 and 1440 (website) against the prototype, differences listed in the PR; the player's first-load budget (`pnpm build --filter player && node scripts/check-bundle.mjs`) after the variable font | A-04: Q5; A-27: Q6 |
| 5. Console, tablet and TV fit | A-09 to A-23 | `apps/console` (waitlist, live-floor, tables-setup, promotions, members, staff), `apps/tablet`, `apps/display`, `@rivr/ui` SeatRing and TV boards | Console at 375, 1024 and 1440; tablet at 1180×820 and 768×1024 (all nine seats on screen); TV at 1920×1080 (no wrapped stake titles); the console-fits and tv-boards flows; story baselines | A-23: Q5 |
| 6. Premium assets (added at the owner's request) | AS-01, AS-02, AS-04, AS-05, AS-08, AS-09, AS-11, AS-12; the licensed half of AS-06 | `apps/web/public/media`, `@rivr/ui` Wordmark, Icon and SeatRing, `@rivr/render` brand kit | Every image at 2× its largest shown size; the website's Lighthouse image audits clean; the brand kit regenerated and committed; visual baselines for the wordmark and icons | Yes: photo shoot, the teaser master, the logo master, icon and table commissions, font licences (Q1 to Q4) |

## Table 6: Asset quality

The brief asks for premium assets everywhere, "not generic AI generated", including high-quality images of the poker tables. The rules shape what that means here:
- **Inside the product:** dark and flat, with no decorative poker imagery, felt textures or stock images. The seat map is the one place poker imagery is allowed, because it does a job.
- **The website:** may show the club's own photos and video.

So "premium" means:
- the club's own photography and footage;
- the master logo;
- commissioned or licensed icons, type and table art;
- media delivered at full resolution.

It never means stock or AI-generated imagery.

| ID | Asset | Where | Today (measured) | Upgrade | Who / how |
|---|---|---|---|---|---|
| AS-01 | Website photography (`apps/web/public/media/*.webp`) | Every band with a photo | 11 stills at 480×360 px (one at 480×480), 10 to 28 KB, shown up to about 670 px wide at 2× density, so upscaled about 3×. They are frames from the launch teaser's "Concept visualisation": rendered rooms, not the club; the "RIVR" on the hero render's felt is malformed | A photo shoot of the finished room before or during opening week (room, Private Room, the tables in play, dealers' hands, chips, the bar, arrival): 3,200 px masters, graded to the brand's green, cream and gold | Owner commissions a hospitality or architectural photographer. **Stopgap until then:** re-export stills from the teaser's master file at full resolution (needed from the owner; not on this machine), then Topaz Photo AI (`tpai.exe`, installed) to 2× for sharpness. Upscaling the current 480 px frames 4 to 6× would magnify the render's flaws, so it is the last resort |
| AS-02 | Hero room loop (`hero-room.mp4`) | Website hero | 480×480, H.264, 517 kbps, 7.5 s, shown full-bleed | 1920×1080 for desk and 1080×1350 for phones, H.264 High at about 5 Mbps with an HEVC or AV1 alternative, poster at 2,400 px | From the shoot's footage, or Topaz Video AI (installed) upscaling the teaser master to 1080p as a bridge |
| AS-03 | App picture (`app-home.webp`, 540×960) | Website "the app" band | Shows the pre-pivot Home: bad-beat jackpot ₹3,42,600 and a ₹3,000 buy-in, both removed from the app (0284) | A fresh capture of today's Home at 3× (1170×2532) from seeded data, rendered by a script so it can be redone after any change | Code: a Playwright capture script (or `@rivr/render`) |
| AS-04 | Brand mark spade (`packages/ui/src/Wordmark/Wordmark.tsx:36`) | Every app's header, the app icon, splash, TV, social images | The spade is lucide's outline `Spade` icon filled with `strokeWidth={0}`; lucide draws the stem as a stroke, so it vanishes and the red card carries an inverted heart (visible on `icon-512.png` and the lockup) | The master vector logo from the brand's designer (the investor deck's source file): the exact spade, tile proportions and letterforms, as one SVG in `@rivr/ui`; then `pnpm --filter @rivr/render render:brand-kit` regenerates the icons, splash screens, social images, OG image and logo films | Owner supplies the master file; code takes it from there |
| AS-05 | Icons (`packages/ui/src/Icon/Icon.tsx`, `lucide-react`) | Tab bar, rail, notices, steppers | 25 stock lucide glyphs, the set most generated apps use | A commissioned set of about 30 line icons on a 24 px grid at the brand's 1.5 px stroke, drawn as one family, with the poker glyphs the product needs (suits, seat, table, call-time clock); vendored as SVG in `@rivr/ui` and lucide removed | An icon designer; or, as a cheaper step, a licensed premium set drawn at 1.5 px |
| AS-06 | Typefaces | Every screen | Bodoni Moda (static, weight 400 only) and Instrument Sans, both free. Neither draws ₹, which falls back to Noto Sans Devanagari or Tiro, so the website's rupee sign does not match the figures | **Free now:** the variable Bodoni Moda with its optical-size axis, so hairlines are right at 88 and 280 px on the TV and sturdier at 20 to 36 px. **Premium:** a licensed Didone family with display cuts and a ₹, and a text face with ₹ and true tabular figures | The free step is code. The licensed faces are an owner and brand decision (the design prompt fixed today's faces from the investor deck); Q2 |
| AS-07 | Referral share card (`ReferralCard`, decision 0258) | Player Rewards, shared to WhatsApp and Instagram | Rendered in the phone's fallback serif (Times), because the SVG does not carry the display font | Embed a subset of the display face in the SVG before it is saved as PNG (the follow-up 0258 already names) | Code |
| AS-08 | Poker table art (`SeatRing`) | Console Live floor, the tablet's seats, TV call-time context | A flat ellipse with circles (UI-14) | Table art made from the club's actual tables (shape, rail colour, felt colour, the RIVR mark on the felt), top-down, at 2,400×1,500 px with a transparent background, 2- to 10-seat variants, and a JSON of seat anchor points so `SeatRing` lays its seats on it. **Option A:** a vector illustration in token colours, no texture (fits today's rules). **Option B:** a photographic or 3D-rendered table with felt and leather rail (needs a decision amending "no felt textures"; it stays functional, being the seat map) | A 3D artist or illustrator working from photos of the real tables, not AI generation; owner decision Q1 |
| AS-09 | Share preview (`og-image.png`, 1200×630, 12 KB) | Every shared website link | The wordmark on flat green | A photo from the shoot with the lockup, drawn by `@rivr/render` | After AS-01 and AS-04 |
| AS-10 | Website image delivery (`StoryBlock.tsx:43`, `GalleryBlock.tsx:44`) | Website | One file per image; no `srcset`, `sizes` or AVIF anywhere | `<picture>` with AVIF and WebP at 640, 1280, 1920 and 2560 px, `sizes` per block, width and height set to stop layout shift; a build step that makes the variants from each master | Code; needed for AS-01 to pay off |
| AS-11 | Menu and reward imagery | Player Menu, Rewards catalogue | Text only, by rule ("no image slots") | Real photographs of Glaza's dishes and of each reward (hoodie, hotel suite) in one fixed 4:3 thumbnail, only where the club has real photography, never stock | Owner decision Q3; a rule change in `ui.md` if yes |
| AS-12 | PWA icons, splash screens, social images, logo films | Phones, stores, channels | Generated from the brand art; sizes correct | Regenerate after AS-04; nothing else needed | Code |

---

## Owner decisions needed

| Q | Decision | My recommendation |
|---|---|---|
| Q1 | Poker table art on the seat map: vector in token colours (A), or photographic or 3D felt and rail (B, amends "no felt textures") | B on the tablet and the Live floor's table detail, A on the small cards; made from the real tables |
| Q2 | Licensed typefaces with a ₹, replacing the free faces the investor deck named | Take the free variable Bodoni now; decide licences with the brand's designer |
| Q3 | Real photography of menu items and rewards in the app | Yes for rewards (members choose by looking); the menu only if Glaza has photographs |
| Q4 | A photo shoot of the finished room, and the teaser's master file | Book the shoot for opening week; send the teaser master now for the stopgap |
| Q5 | RIVR League on the player's Rewards and the TV, now that points are by hand | Hide both until League points have a source |
| Q6 | The website's claims of hands logged at the table and points per hour, and the placeholder phone | Remove the claims; hide the phone until the number is given |
| Q7 | The door kiosk's "cash out at the cage": does a cage desk exist at launch? | Point members to leaving their seat in the app (CP-14) |
| Q8 | The Bad-beat jackpot template and Buy-in bonus Tuesday (20% of buy-ins) still offered on Promotions while jackpots and buy-ins are off the system | Hide both templates, as 0284 hid the screens |

The walkthrough changed the local database for `rivr-lane-c`: joins, a check-in, a seated member, an order, feedback and a promotion sent for approval. Run `pnpm db:reset` before the next pgTAP or e2e run there.

---

## Update, 2 Nov evening: KYC on Cashfree's sandbox, answers and corrections

**KYC.** A new member's selfie went through, then the hand-off to DigiLocker reached Cashfree's sandbox. The walk stopped at DigiLocker's own sign-up page, on the government's domain, so no Aadhaar number was typed there. The member then came back without consent and met the PAN step. Cashfree's documented test PANs were used on it:
- `DEFPV0126D`, which is invalid;
- `ABCPV1234D`, which is valid, but its sandbox name differs from the member's, so the check goes to staff.

| ID | Finding | Fix |
|---|---|---|
| K-01 | The PAN step does not say DigiLocker did not finish | One line before the field |
| K-02 | "Check it and the name" points at a name that is not on the screen | Copy, in the B3 rewrite |
| K-03 | Under review locks the app to one screen with only Sign out; its heading "With staff" is not a noun, and it does not say what to bring | Heading "Identity check"; "Bring your Aadhaar and PAN to the front desk." Whether members may read Tonight meanwhile is a question for the owner |
| K-04 | The kyc function logs nothing when Cashfree refuses a call (found when it refused an http `redirect_url`) | Log Cashfree's error code, never its message |
| K-05 | Date fields follow the browser's locale (mm/dd/yyyy) | `lang="en-IN"` on every app |
| K-06 | Locally, DigiLocker needs an https return address | Documented in decision 0289 |

**Copy.** The owner judged the copy over-explained. A count of the live catalogue confirms it, out of 2,999 strings:
- 536 run to two or more sentences;
- 235 are over 14 words;
- 162 are intro or hint keys.

The rule check in Table 4 missed this, so B3 becomes a rewrite of every live string (CP-00), with the tightened voice in decision 0289.

**The owner's answers** are in decision 0289. On assets:
- Free, real, top-down table photos do not exist, so the table is drawn in `@rivr/ui`.
- Six licensed photos (Pexels and Unsplash licences, 4,000 to 6,720 px) are the website's placeholders.
- The teaser video is 480×848, so it is no better source than the stills.

**Corrections.** Reading the code downgraded these findings:
- E-03 and E-09: local timing;
- E-05: the tablet leaves within 30 s;
- E-10: only the busy state was missing;
- E-12: the right check, the wrong message;
- E-13: not a bug.
