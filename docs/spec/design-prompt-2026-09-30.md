# RIVR: interactive demo of all four front ends

Design one clickable prototype for RIVR, a members' poker club opening on Sunday 15 November 2026 on the upper floor of Glaza, a licensed bar at M3M 65th Avenue, Gurugram. The club runs five tables from 2 pm to 8 am. The prototype contains four surfaces that share one live state: the player app, the operations console, the dealer tablet and the TV display. An action on one surface must visibly change the others. This is a sales demo for the club's promoter and his investors, so every screen has to look finished and every number has to add up.

The standard is a high-end casino or a private members' club. The product should feel expensive through restraint: few elements, exact typography, correct numbers, short copy. If a screen needs a sentence to explain itself, redesign the screen.

---

## 1. Frame and navigation

- A thin demo bar across the top of the viewport, outside the product, with four switches: **Player**, **Floor**, **Dealer**, **TV**. It is neutral grey, 32 px tall, and plainly demo scaffolding. It also holds **Reset**, **+20 min** (advances the clock for the tournament and waitlist holds) and **Tablet offline** (a toggle).
- **Player** renders in a 390 × 844 phone frame, centred. **Floor** renders at 1440 × 900. **Dealer** renders as a landscape tablet, 1180 × 820. **TV** renders at 1920 × 1080, scaled to fit.
- All four read and write one in-memory state object. No surface holds its own copy of anything another surface shows.
- Every button in the prototype does something. If a control leads nowhere in the demo, leave it out rather than stub it.

## 2. Brand

Taken from the RIVR investor deck. Use these values and no others.

| Role | Value | Use |
|---|---|---|
| Deep green | `#0E3B2C` | Primary background on every surface |
| Green-black | `#0A2A20` | Raised surfaces, nav bars, table rows on hover |
| Cream | `#F3EDE0` | Primary text and the wordmark tiles |
| Gold | `#C9A85C` | The one primary action per screen, money that belongs to the player, hairline rules at 25% opacity |
| Red | `#C4162A` | Alerts, negatives, the spade card in the mark. Nothing else |
| Ink | `#141414` | Text on cream tiles only |
| Muted | cream at 60% | Secondary text. Never below 4.5:1 contrast on green |

- Wordmark: R I V R set as four cream tiles with black serif capitals, followed by a red card carrying a cream spade, "POKER CLUB" letter-spaced beneath. Tagline, used once on the sign-in screen and nowhere else: *Skill runs deep.*
- Typefaces: **Bodoni Moda** for display only (screen titles on the TV, the jackpot figure, the wordmark lockup; never below 20 px). **Instrument Sans** for everything else, with tabular figures switched on wherever a number appears.
- Money is in rupees with Indian grouping: ₹1,20,000, ₹4,85,000. Never "INR", never "Rs", never decimals on whole rupees. Times use the 24-hour clock in IST: 02:40.
- Stakes are written as blinds: 100/200. Tables are named: Table 1 to Table 4, and the Private Room.

## 3. Visual rules

- Flat surfaces. Separation comes from spacing and 1 px gold hairlines at 25% opacity, not from shadows, borders on every card or background tints.
- Corner radius 6 px maximum. No pill-shaped cards. Buttons are rectangles with 6 px corners.
- One gold filled button per screen at most. Secondary actions are cream text buttons.
- Icons only where they carry meaning a word cannot (the seat map, card suits, the tab bar). Line icons, 1.5 px stroke, cream. No icon beside a heading.
- The only poker imagery is functional: the seat map, the cards dealt in a Learn drill, and the brand mark. No felt textures, no chip stacks, no card fans, no dice, no casino-lights backgrounds.
- Motion is limited to state changes: a seat filling, a number ticking up, a sheet sliding in. 200 ms, ease-out. No confetti, no pulsing, no parallax, no shimmer skeletons longer than the data takes to appear.
- Dark only. The floor is dimly lit and the room runs through the night.

## 4. Copy rules

The voice is a senior casino host: brief, exact, courteous, never chatty. The player is a member, not a user.

| Write | Never write |
|---|---|
| Your seat is ready. Table 3, seat 6. | 🎉 Great news! Your seat is ready and waiting for you! |
| Hold expires 02:40 | Don't worry, we'll hold your spot for a little while! |
| ₹4,000 bonus · expires Sunday | Unlock exclusive rewards and elevate your game |
| Withdrawal sent. UTR 412908771204 | Success! Your withdrawal has been processed successfully. |
| No sessions yet. | It looks like you haven't played any sessions yet. Get started today! |
| Too aggressive. | Oops! That wasn't quite right. |
| KYC incomplete. Finish it to join a table. | To ensure a safe and secure experience for everyone, please complete your KYC verification. |

- Headings are nouns: Balance, Waitlist, Tonight, Markers. No subtitles under headings.
- Sentence case everywhere except the wordmark and letter-spaced labels on the TV.
- No exclamation marks. No emoji. No em dashes. No questions to the player in headings.
- Banned words: unlock, elevate, seamless, effortless, experience (as a noun for the product), journey, discover, explore, dive in, level up, exclusive (unless it is literally a members-only event), premium, curated, welcome back, let's, oops, awesome, amazing, powered by, smart, AI.
- Empty states are one line. Errors say what happened and what to do, in that order, in one or two lines.
- Numbers are never rounded in a way that hides money: ₹1,85,000, not "₹1.8L".

## 5. Seed state

Use exactly this data so the flows below compute correctly. All people are fictional.

**Tables**

| Table | Game | Blinds | Buy-in | Rake | Cap | Seated |
|---|---|---|---|---|---|---|
| Table 1 | NLH | 50/100 | ₹5,000 | 5% | ₹3,000 | 6 of 9 |
| Table 2 | NLH + variation | 100/200 | ₹10,000 | 5% | ₹6,000 | 9 of 9 |
| Table 3 | NLH + variation | 100/200 | ₹10,000 | 5% | ₹6,000 | 8 of 9 |
| Table 4 | NLH + variation | 100/200 | ₹10,000 | 5% | ₹6,000 | closed |
| Private Room | NLH + ₹500 straddle | 100/200 | ₹20,000 | 5% | ₹12,000 | 7 of 9 |

**Waitlist** for 100/200: Kabir Sethi (joined 23:52), Naina Kapoor (23:58), Rohan Bhatia (00:07). For 50/100: empty.

**Demo member: Arjun Mehta.** Black card, qualifying stake 100/200. Cash balance ₹1,85,000. Bonus balance ₹4,000, expires Sunday. One open marker of ₹50,000, issued 14 days ago, limit ₹2,00,000. Points 18,420. Visits this month: 5 (cab eligible). Payout account: HDFC Bank, UPI verified.

**Bad-beat jackpot** ₹3,42,600. **High hand tonight**: four of a kind, Queens, Table 2, 22:18, ₹2,000.

**Tournament: RIVR Sunday.** ₹10,000 buy-in (₹9,000 to the pool, ₹1,000 fee). Re-entry to the end of level 9. 20-minute levels. Level 7, 400/800 ante 800, 11:40 remaining. 58 entries, 31 left. Pool ₹5,22,000 against a ₹5,00,000 guarantee. Top 8 paid.

**Promotions live:** Buy-in bonus Tuesday (20% on the first five buy-ins per table). High hands (royal flush ₹25,000, straight flush ₹10,000, four of a kind ₹2,000). Referral ₹1,000 to each side.

**Dealer on Table 3:** Pema Lepcha, down started 23:40.

**Clock** starts at Tuesday 00:10.

## 6. Surfaces and screens

### Player app (phone)

Bottom tab bar, five tabs: **Home, Sessions, Balance, Rewards, Learn**. Profile sits behind the member's initial, top right.

- **Sign-in and KYC**: phone number, OTP, DigiLocker hand-off (show the return state, not a fake DigiLocker page), selfie check, done. Four screens, no progress illustration.
- **Home**: tonight's floor as a compact list (table, blinds, seats open, waitlist count) with Join on each row; the member's waitlist position when joined; bad-beat jackpot figure; next tournament; one promotion card at a time with a quiet pager.
- **Waitlist position**: position, stake, joined time, hold timer after a seat call, Leave.
- **Sessions**: list by date (table, hours, buy-in, cash-out, net). Session detail with the receipt. TDS line shown only when it applies.
- **Balance**: cash, bonus with expiry, open markers with limit and due date. Movements list. Withdraw (amount, payout account, confirm). Deposit shows the club's UPI details and a UTR field.
- **Rewards**: points, tier, the catalogue (tournament seat, F&B upgrade, RIVR merchandise), League standing, referral code, cab request when eligible.
- **Learn**: Library (RIVR Academy Level 1 to 3, and *The Course* by Ed Miller shown as a licensed title), Hub (Due now, Mastery, Answered, Accuracy; session length 10, 20, 50), a drill spot (9-seat table drawing, action history, answer pad: Fold, Call, Raise, then size), Verdict, Summary, Review heatmap. Verdict classes: Correct, Too loose, Too tight, Too passive, Too aggressive, Right action wrong size, Right idea wrong spot. Do not write quotations attributed to Ed Miller or any author; drill feedback in the demo is RIVR Academy text and is labelled RIVR Academy.
- **Profile**: KYC status, game and stake preferences, limits and self-exclusion, notifications.

### Floor console (desktop)

Left rail with these sections, grouped: **Floor** (Live floor, Waitlist, Check-in, Tournaments), **Money** (Cage, Markers, Treasury, End of day), **Players** (Members, KYC review, Host queue), **Growth** (Promotions, Jackpots, Rewards, Academy), **Team** (Staff, Dealers, SOPs), **Reports**.

- **Live floor**: a plan of the room with the five tables, seat occupancy, each table's rake tonight, hands per hour and dealer. Selecting a table opens its seats and recent hands.
- **Waitlist**: per stake, priority order visible with the reason (Black card, Founders' Circle, join time), Call, Seat, Skip.
- **Cage**: player search with KYC photo, buy-in, cash-out, marker issue and settle, withdrawal queue with approve and UTR entry, second-approver prompt above ₹1,00,000.
- **Markers**: outstanding by player and age, limits, room exposure against cap.
- **Promotions**: list, and a builder with four blocks only: When, Who, Reward, Limits. A preview of the player card and the TV slide beside the form. Publish.
- **Jackpots**: pool, drops tonight, qualifying rules, payout history.
- **Tournaments**: clock control, entries, re-entries, payouts, table balancing prompt.
- **SOPs**: library with version and acknowledgements; POC directory; incident log; Print offline pack.
- **Reports**: tonight by table, dealer and variant; monthly investor MIS preview.

### Dealer tablet (landscape)

- **Sign in**: dealer PIN pad, table fixed as Table 3.
- **Hand entry**: the seat ring with player initials; a large pot keypad; variant toggle (Hold'em, PLO, Bomb pot); the computed rake, jackpot drop and "pull" amount shown as the pot is typed; Log hand. Hand counter for the down.
- **Seat events**: buy-in request to cage, player away, player left.
- **End of down**: drop-box count entry, variance against logged rake, hand over to the next dealer.
- **Offline**: a slim banner, "Offline. 3 hands queued." Hands keep logging.

### TV (1920 × 1080)

Four modes, each full screen, switchable from the console:

- **Waitlist board** by stake, names shown as first name and initial.
- **Jackpot and high hand**: the bad-beat figure large in Bodoni Moda, tonight's high hand beneath.
- **Tournament clock**: level, blinds, time remaining, players left, average stack, pool, payouts.
- **Promotions**: the published promotion slides, rotating every 12 seconds.

## 7. Linked flows the demo must play end to end

Each step names what changes on which surface. Build these first; they are what the promoter will click through.

1. **Join and seat.** Player: Arjun joins the 100/200 waitlist from Home. He goes to the top because his black card qualifies at 100/200. Floor: he appears first with the reason "Black card". TV: the 100/200 board updates. Floor: Call. Player: "Your seat is ready. Table 3, seat 9. Hold expires 00:30." Floor: Seat. Player: Home shows him seated at Table 3; the waitlist row disappears on all surfaces.
2. **Black card at another stake.** Player: Arjun joins 50/100 as well. Floor: he sits in join-time order on that list, no priority marker.
3. **Buy-in with the Tuesday bonus.** Dealer: buy-in request for seat 9, ₹10,000. Floor cage: request appears with his KYC photo; Approve from wallet. Player: Balance drops by ₹10,000; bonus ₹2,000 credited if it is among the first five buy-ins at Table 3 today.
4. **Log a hand.** Dealer: pot ₹48,000, Hold'em. Tablet shows rake ₹2,400, jackpot drop ₹100, pull ₹2,500. Log hand. Floor: Table 3 rake tonight rises by ₹2,400. TV and Player Home: jackpot ₹3,42,700.
5. **A pot at the cap.** Dealer: pot ₹1,40,000. Rake shows ₹6,000 (capped), drop ₹100.
6. **High hand.** Dealer: log a hand with a high-hand claim, straight flush, seat 4. Floor: approval prompt; Approve. TV: high hand updates to straight flush, Table 3, ₹10,000.
7. **Publish a promotion.** Floor: builder. When: Thursday 14:00 to 20:00. Who: 100/200. Reward: double points. Limits: none. Publish. Player Home: the card appears. TV Promotions: the slide appears in rotation.
8. **Marker and cash-out.** Floor cage: Arjun cashes out ₹1,20,000 of chips. The open ₹50,000 marker settles first; ₹70,000 goes to his cash balance. Player: marker gone, balance and movements updated. Floor Markers: exposure drops by ₹50,000.
9. **Withdrawal.** Player: withdraw ₹1,00,000 to HDFC Bank. Floor cage: request in the queue; second approver required; enter UTR 412908771204; Approve. Player: "Withdrawal sent. UTR 412908771204."
10. **Tournament.** Demo bar: +20 min. TV clock and Player Home tournament card both move to level 8.
11. **Learn.** Player: complete a 10-spot drill. Summary shows points earned. Rewards: points rise by the same amount.
12. **Offline tablet.** Dealer: toggle offline from the demo bar, log two hands, go back online. Floor: both hands arrive in order and the rake total is correct.

## 8. States to draw

For each surface, include the states that actually occur: empty waitlist, no sessions yet, KYC incomplete (blocks Join), marker overdue (blocks new credit), withdrawal pending, tablet offline, TV with no promotions published. One line of copy each.

## 9. Before you output, check

- Every number on every surface is consistent with the seed and with the flows above. Recompute the rake, the jackpot, the balances and the exposure after each flow.
- No banned word, exclamation mark, emoji or em dash anywhere, including placeholder text, button labels and toasts.
- No heading has an explanatory subtitle. No card explains what the card is.
- Gold appears on at most one filled button per screen.
- No decorative poker imagery, gradients, glass effects, glows or shadows beyond a modal's.
- Nothing in the prototype says "demo", "sample" or "lorem" except the demo bar.
- Every control works, or it is not there.
