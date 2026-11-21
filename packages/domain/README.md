# @rivr/domain

Every business rule, as pure TypeScript over `@rivr/contracts`. Lane 0 ships money and the ledger; lanes add rake, caps, call time, GST, payouts and priority as folders beside them.

## Public API

Import a rule area on its own (`@rivr/domain/money`, `@rivr/domain/ledger`) or everything from `@rivr/domain`.

### `@rivr/domain/money`

| Export | What it does |
|---|---|
| `Paise` | Money in integer paise (bigint). The only money type. |
| `fromPaise(n)`, `fromRupees(n)`, `ZERO` | Build an amount: `fromRupees(2_500n)` is ₹2,500. |
| `add`, `subtract`, `negate`, `sum`, `times(amount, count)` | Arithmetic. `times` takes a bigint count. |
| `compare`, `min`, `max`, `isZero`, `isNegative`, `isPositive` | Comparisons. `compare` sorts. |
| `shareOf(amount, basisPoints)` | A share rounded down to the paisa: `shareOf(pot, 500n)` is 5%. Throws on a negative amount or a rate outside 0 to 10,000 (bugs). |
| `CHIP`, `roundDownToChip(amount)`, `isChipMultiple(amount)` | The ₹50 chip. Rounding is always down. |
| `paiseToChips(amount)`, `chipsToPaise(chips)` | Money as a count of chips of ₹1, as blinds are typed and bonus chips shown, and back. Part of a chip is dropped; a negative throws. |
| `parseRupees(text)` | Typed rupees (`1,20,000`, `120000`, `₹2,449.50`) to `Result<Paise, 'empty' \| 'negative' \| 'too_many_decimals' \| 'invalid'>`. |

### `@rivr/domain/ledger`

| Export | What it does |
|---|---|
| `LedgerLine` | `{ account, amount }`; debits positive, credits negative. |
| `isBalanced(lines)`, `assertBalanced(lines)` | Lines must sum to zero. `assertBalanced` throws, because an unbalanced transaction is a bug. |
| `balanceOf(account, lines)` | A balance is always a sum of lines, never a stored number. |
| `reverse(lines)` | The correcting entry. Lines are never edited. |

### `@rivr/domain/staff`

| Export | What it does |
|---|---|
| `grantableRoles(permissions)` | The roles a staff member may give (#28, decision 0073), as `private.can_grant_role` decides: every role for a super admin (`venue.configure`), otherwise only roles whose every permission they hold. An admin gives admin or host. |

### `@rivr/domain/identity`

| Export | What it does |
|---|---|
| `kycIdentityKey(documentName, dateOfBirth, maskedAadhaar)` | The identity two KYC checks of one person share: the document's name in plain letters (case, spacing and punctuation ignored; Devanagari vowel signs count), the date of birth and the last four Aadhaar digits. Null without a name in letters or four digits. A DigiLocker name need not be the registered name (decision 0400). |
| `namesMatch(documentName, givenName)` | Whether a document's name is the name a member gave: the same words in any order, case, spacing and punctuation ignored (`SHARMA RAHUL` is `Rahul Sharma`). A middle name on one only still matches (`RAHUL KUMAR SHARMA` is `Rahul Sharma`, #1021, decision 0698); an initial, or a first or last name on one only, does not. Zoop's PAN check uses it (decision 0671). |

### `@rivr/domain/rake`

| Export | What it does |
|---|---|
| `potTake(pot, rules)`, `RakeRules`, `PotTake` | What the dealer takes from a pot: rake at the table type's rate, no more than its cap, rounded down to ₹50 chips; while the bad-beat jackpot is live, the drop (₹100) from a pot above `dropAbove` (₹5,000, not at it); and the pull, both together. A ₹48,000 pot gives rake ₹2,400, drop ₹100, pull ₹2,500. Golden cases in `packages/testing/golden/rake.json`. |

### `@rivr/domain/jackpot`

| Export | What it does |
|---|---|
| `splitDrop(drop, shares)`, `DropShares`, `PoolSplit` | A jackpot drop split between the pools (#48): season and freeroll take their shares (basis points) rounded down to the paisa, the main pool the rest, so the parts add up to the drop. ₹100 at 20% and 10% gives ₹70, ₹20, ₹10. Golden cases in `packages/testing/golden/jackpot.json`, which `private.split_drop` is proved on too. |

### `@rivr/domain/settings`

| Export | What it does |
|---|---|
| `ruleAt(rules, at)`, `Dated`, `RuleAt` | The effective-dated rule in force at a moment, the newest whose start is not after it (null start: since opening), and the changes still to come, soonest first, as `private.setting_at` finds it (#37). Golden cases in `packages/testing/golden/settings.json`, which 024 proves `private.setting_at` on. Imports nothing, so `@rivr/db` uses it without carrying Zod. |

### `@rivr/domain/waitlist`

| Export | What it does |
|---|---|
| `holdFraction(calledAt, holdUntil, at)` | How much of a called seat's hold is left, 1 to 0: the bar under the countdown (decision 0320). |
| `priorityOn(stake, { tier, qualifyingStake })`, `TierPriority`, `Priority` | A member's priority on a list at one stake (#40): the tier's weight from the setting `waitlist.priority_weights`, with its name as the reason. The black card's counts only at the member's qualifying stake; Founders' Circle on every list. The database's `private.priority_weight` is proved equal by `packages/testing/golden/waitlist.json`; the database orders each table's list (decision 0467) by the weight at the table's stake, then join time. |

### `@rivr/domain/tables`

| Export | What it does |
|---|---|
| `tableRetireRefusal({ seated, waiting })`, `TableInPlay`, `TableRetireRefusal` | Whether a table may be deactivated or deleted (decision 0466): `players_seated` while anyone sits at it, else `players_waiting` while a place waits on its list or is called to it, else null. `private.assert_table_empty` refuses with the same reasons (RVSTD, RVWTG). |
| `shareOf(part, whole)` | A part's whole-percent share of a whole, rounded; null with no whole (redesign RD-27, the Players report's Share). |
| `tableWithRoomFor(own, tables)`, `TableWithRoom` | For a list whose table is full, the open table at the same stake with seats beyond its own list: a prompt, never a move (audit F-036). |
| `tableToSeatAt(tables)`, `TableToSeat` | Where the Live floor's Seat a player seats (decision 0479): the first open table, in floor order, with a free seat and someone on its list; else the first open table with a free seat; else null. The call time its sheet starts with is the stake's own, typed over as the floor likes (redesign RD-19). |
| `suggestedMinBuyIn(bigBlind)`, `isMinBuyIn(amount)`, `SUGGESTED_MIN_BUY_IN_BIG_BLINDS` | A table's own minimum buy-in (redesign RD-16): Tables setup suggests 50 big blinds of the table's stake, and any whole ₹50 above zero may be saved; no maximum. Golden `tableMinBuyIn.json`; the database stores the amount and checks the same. |
| `stakeTableRefusal(callTimeMinutes)`, `StakeTableRefusal`, `isStakeCallTime(minutes)` | A stake is given to a table only once it has a call time above zero (`stake_without_call_time`; `private.assert_stake_ready` refuses the same, RVNCT); a stake's call time is whole minutes, 1 to 1,440. |
| `isBlind(amount)`, `areBlinds(smallBlind, bigBlind)`, `isStraddle(straddle, bigBlind)`, `BLIND_CEILING` | A stake's blinds as Tables setup takes them: each a whole 50 above zero and 1,00,00,000 at most, the big blind above the small, and a straddle, when there is one, a blind above the big blind (decision 0299). `table_type`'s checks, `private.assert_blinds_in_reach` and `private.assert_straddle` refuse the same. |
| `isSeatCount(seats)`, `SEAT_COUNTS` | A table seats 2 to 10 (owner, 15 Nov), as `game_table` checks; the counts in order, for the form's row. |

### `@rivr/domain/bonus`

| Export | What it does |
|---|---|
| `bonusAvailable(grants, at)`, `BonusGrant` | The bonus a member can spend at a moment (#17; scope-v1 module 5): what is left of every grant whose end is still to come. A grant is in force before its end, never at it. |
| `bonusSpend(amount, grants, at)`, `BonusRefusal` | Bonus is playable, not withdrawable: it buys whole ₹50 chips above nothing, drawn from the grants in force, the soonest to end first, each as far as it goes. Gives what each grant gives, in the order given; `bonus_short` above the bonus in force. The database's `private.bonus_draws` is proved equal by `packages/testing/golden/bonus.json`. |
| `bonusExpired(grants, at)` | What expires at a moment: the remainder of each grant whose end has come. The database's `private.bonus_expiring` is proved equal on the same file; `private.expire_bonus` reverses it every hour. |
| `bonusTake(amount, grants, at, first)`, `BonusTaken` | Bonus taken back after the fact (#1077): a reversal's whole amount from the grant reversed first (ended or not), then the other grants in force in `bonusSpend`'s order; what they cannot give is owed, the balance below nothing. Never refused. The database's `private.bonus_takes` is proved equal on `bonus.json`. |
| `bonusPayOff(given, owed)`, `BonusPaidOff` | Bonus given while some is owed pays it first; the member keeps the rest. `private.bonus_pay_off` is its twin on `bonus.json`. |
| `bonusEnd(givenAt, days, since)` | When a grant ends once a venue sets `bonus.expiry_days` (decision 0579): N days after it was given, or after the switch-on for chips held before; never at 0 days. `private.bonus_end` is its twin on `bonus.json`. |
| `visitBonusCap(heldAtFirstUse, basisPoints)`, `visitBonusLeft(cap, redeemed)` | The most bonus one visit redeems under `bonus.visit_cap` (decision 0579): that share of the bonus held at its first Bonus use, a seat's buy-in or a use without a seat (decision 0706), rounded down to whole ₹50 chips; and what is left of it. `private.visit_bonus_cap` and `private.visit_bonus_left` are their twins on `bonus.json`. |
| `bonusFileRun(lines, held)`, `bonusFileTotals(lines)`, `BonusFileLine`, `BonusHolding`, `BonusFileRefusal`, `BonusFileRun` | A Bonus file's lines in its order (decision 0707): an Add pays what is owed first, then the member keeps the rest; a Use is refused while any is owed (`owed`) or above what is in force by then (`bonus_short`), and a refused line changes nothing. Gives each line's refusal and each member's Bonus after; and the file's Bonus added and used. `private.bonus_from_file` runs a file the same way and refuses it whole; golden cases in `bonusFile.json`, the sequence in pgTAP 597. |

### `@rivr/domain/notices`

| Export | What it does |
|---|---|
| `noticeToShow(notices)` | The one notice that shows where there is room for one, Home's top slot and the foot of the TVs' boards (redesign correction 20): of those in force, the one that started last; of two that started together, the one listed first (the database lists the one made last first). `private.notice_to_show` is its twin, proved on `noticeToShow.json`; `homeTopSlot` and the TV's `tv_notice` both use it. |
| `homeTopSlot({ seat, isIdCheckDone, notices })`, `HomeSlot`, `LiveNotice`, `SeatStanding` | The one card above the offers on the player's Home (redesign RD-20): nothing while a seat is `called` or `taken`; else `idCheck` while the check is not done; else the notice in force that started last (the first listed of two that started together); else nothing. `notices` are those the server lists as in force. |

### `@rivr/domain/referral`

| Export | What it does |
|---|---|
| `referralPromise(liveBonus)`, `ReferralPromise` | What Refer a friend may say (redesign RD-20): a `reward` of that Bonus each while a referral promotion is live and gives something, else the `invite` alone, with no word of a reward. `liveBonus` is what `my_referral` reads from the live promotion; null with none live. |

### `@rivr/domain/fnb`

| Export | What it does |
|---|---|
| `orderStage({ acceptedAt, onWayAt, deliveredAt })`, `ORDER_STAGES` | Where a member's order stands from the bar's steps (decision 0320): sent, preparing, on its way, delivered; the furthest step taken wins. |

### `@rivr/domain/callTime`

| Export | What it does |
|---|---|
| `extendedCallTime(current, played, add)`, `ADD_TIME_CHOICES`, `CALL_TIME_CAP_MINUTES`, `isAddTimeLength` | More call time for a seat (decisions 0320, 0305; redesign RD-19): a length in whole minutes from 1 to 1,440 (`isAddTimeLength`; the club types the lengths it offers in `call_time.add_choices` to set and `call_time.extend_choices` to extend (#1089), `ADD_TIME_CHOICES` while it has typed none) added whole to the later of the call time and the whole minutes played, so time added after the call time is met runs from now; only to a seat with a call time, up to a day in all; anything else refused, never cut down. The database's `private.extended_call_time` is proved equal on `packages/testing/golden/callTimeExtension.json`. |
| `callTimeChoiceEnd(seat, length)`, `SeatCallTime`, `CallTimeChoiceRefusal` | A length of call time chosen for a seat, by the member's Set or Extend call time or the floor's Add call time (#1076, the owner, 18 Nov; it replaced `setCallTime`, #1059). Until a call time is set, the length counts from now (whole minutes played plus the length) and is open only if it ends strictly after the call time the seat started with, never before the one owed now (`not_after_call_time`); once set, it extends it (`extendedCallTime`); up to a day in all. The database's `private.call_time_choice_end` is proved equal on `packages/testing/golden/callTimeChoice.json`, and gives the apps the lengths open now. |
| `isCallTimeEnding(secondsLeft)`, `minutesLeftToSay`, `callTimeFraction`, `secondsUntil` | The seat's clock on Tonight: its last 15 minutes (the red ring, the banner, the push), the minutes to say, the ring's share left, and whole seconds to a time the server gave. |
| `callTime(clock, at)`, `CallTimeClock`, `CallTime` | A seat session's call time (#78, decision 0057): whole seconds left of the table type's `call_time.minutes` fixed at seating, never below zero, and whether it is complete. The clock runs across moves, stands still while the player is away, and stops when they leave (the shortfall). The database's `private.call_time_left` is proved equal by `packages/testing/golden/callTime.json`. |
| `isCallTimeMinutes(minutes)` | The call time the floor types when it seats a player, starting from the stake's own (decision 0299, redesign RD-19): a whole number of minutes from 0 to 1,440. The database's `private.set_seat_call_time` refuses the same. |

### `@rivr/domain/topUps`

| Export | What it does |
|---|---|
| `TOP_UP_TARGET_SECONDS`, `secondsWaiting(requestedAt, now)`, `isTopUpLate(seconds)` | How long a top-up request has waited, in whole seconds never below zero, and whether it is past the floor's 60-second target, when the Top-ups page marks it Late in red (decision 0299). |

### `@rivr/domain/floorRequests`

| Export | What it does |
|---|---|
| `isPlaceLate(seconds)`, `isTicketLate(seconds)`, `WAITLIST_TARGET_SECONDS`, `FNB_TARGET_SECONDS` | When a place on a list (45 min) or a ticket at the bar (15 min) shows late (audit F-075, decision 0564). |
| `requestTargets(set)`, `DEFAULT_REQUEST_TARGETS`, `REQUEST_TARGET_SECONDS`, `isRequestLate(kind, seconds, targets)`, `FloorRequestKind`, `RequestTargets` | How long a request may wait on the Live floor's panel before its age shows late (decision 0479): the club's setting `floor.request_targets` where set, each side on its own; else a top-up's `TOP_UP_TARGET_SECONDS` and five minutes for a join, more time, a player leaving, one who left owing call time, and a member's own Set or Extend call time until seen (`call_time_set`, #1090). An approved player to seat (`seat`, `seat_check`, `seat_wait`) is never late: their wait counts from their approval or call, and their alert, its count and chime tell the floor. Late is strictly past the target. |

### `@rivr/domain/gst`

| Export | What it does |
|---|---|
| `gstIncluded(inclusive, rate)`, `GstSplit` | GST taken out of an amount that includes it (#23, decision 0071): equal CGST and SGST halves, each rounded to the nearest paisa (a half up), and the taxable value as what is left, so the three add up to the amount. Throws on a negative amount or a rate outside 0 to 10,000 basis points (bugs). The database's `private.gst_included` is proved equal by `packages/testing/golden/gst.json`. |
| `igstIncluded(inclusive, rate)`, `IgstSplit` | IGST taken out of an amount that includes it, for a buyer registered in another state (#380, decision 0102): the whole tax at the full rate, rounded once to the nearest paisa (a half up), and the taxable value as the rest. Same refusals as `gstIncluded`. The database's `private.igst_included` is proved equal on the same golden file. |

### `@rivr/domain/rakeback`

Hourly rakeback (#108, decision 0245), in paise. `packages/testing/golden/rakeback.json` proves the split, the sum and the bonus against `private.rake_share` and `private.rakeback_bonus`; who sat where is tested by `147_rakeback`.

| Export | What it does |
|---|---|
| `weekRakeShares(hands)`, `RakeHand` | Each member's rake for the week at each stake: every hand's rake split equally among the members seated at its table (`rakeShare`), summed by member and stake. |
| `rakebackBonus(share, rateBasisPoints, cap?)` | The stake's `rakeback.rate` of that share, rounded down to whole ₹50 chips, then held to the cap, as a promotion's percentage bonus is. 10% of ₹2,500 is ₹250; 10% of ₹4,999 is ₹450. |

### `@rivr/domain/promotions`

| Export | What it does |
|---|---|
| `promotionApplies(conditions, facts)`, `PromotionFacts` | Whether a promotion rule applies (#83, decision 0140): every condition it names holds (tier, stake, table, day, time window, first N per table or day, new or lapsed, visits this month, call time completed, hours played, the hand). Days and windows are the club's, 06:00 to 06:00 IST. |
| `promotionReward(effect, { amount })`, `PromotionReward` | What an effect gives: its rupee cost against the budget. A bonus share is rounded down to whole ₹50 chips, then held to its cap; a bonus of nothing is `null`. |
| `promotionsToGive(candidates)`, `PromotionCandidate` | Of the promotions that apply to one event, in priority order, which to give: each while its count budget, rupee budget and per-player limit allow, never part of one; one that does not stack only alone. |
| `secondsInWindow(stint, conditions)`, `playedSecondsInWindow(time, conditions)` | Hours-played promotions with days or times (#457, decision 0186): a stint's whole seconds inside the window on the club days it touches, and a table's time inside the window less its share of the time away. |

The database's `private.promotion_applies`, `private.promotion_reward` and `private.promotions_to_give` are proved equal on `packages/testing/golden/promotions.json`, and `private.seconds_in_window` on `promotionWindow.json`; `private.evaluate_promotions` puts them together.

**The typed model (console v3; decisions 0470 to 0472).** A promotion's version holds a Reward, Eligibility, Schedule, Limits and Channels (`@rivr/contracts/promotionModel`), in bonus chips and perks, never paise. The console builds versions only (decision 0491); the rules above stay for the promotions that still run by a rule, which the engine weighs before the versions.

| Export | What it does |
|---|---|
| `isInSchedule(schedule, at)`, `secondsInSchedule(span, schedule)`, `openingMinutes` | When a version runs: on its club days from its start day to its end day, an opening from `from` to the next `to`, across midnight or the 06:00 turnover; the same time at both ends is 24 hours. Time-played rewards count the whole seconds of play inside the openings. Proved on `promotionSchedule.json`. |
| `isEligible(promo, member, context)`, `MemberFacts` | The member's tier and audience (everyone, new in 30 days or lapsed 30 days; no audience of women, decision 0497), and for an event at a moment its stake, table and moment. |
| `computeGrant(promo, event)`, `triggerOf(reward)`, `Grant` | What the reward gives for one event, before limits: a seat bonus its fixed chips on a visit's first seat or on the first N at a table (owner, 8 Nov); a play-time bonus step's chips on its own `hours_step` event (decision 0507); bonus chips on their event; waitlist priority on a visit (a cab home and a tournament entry are no longer rewards, decision 0622). `Result` with the reason for nothing. |
| `checkLimits(promo, grant, tally)`, `tallyFor`, `periodKey`, `slotKey`, `remainingBudget(promo, ledger, day)`, `decideGrant` | The limits in order: the member's period (up to `timesPerMember` times, each grant keyed as the member's Nth there by `slotKey`; a play-time bonus step's period `@` its place among the promotion's steps, so an edit that moves a step never pays it twice, and with no limit its visit; `periodKey` takes the reward for that, decisions 0507 and 0511), first N per table, members a day, most grants, the budget in chips whole or not at all; counted over all versions, and a monthly budget (`budgetPeriod` `month`) over the event's club month alone (decision 0499). |
| `highHandPayout(reward, hit)`, `ranksOf(hand)`, `highestHandChips(reward)`, `budgetLeft(limits, tally)` | The high hand bonus (redesign RD-22): a hit pays its listed hand's Bonus, whole, every time; a full house of three aces is Aces full where the promotion lists it and any full house otherwise; a hand not listed, a rank the hand cannot have, or a rule left unconfirmed pays nothing and says which. `ranksOf` gives the ranks a hand is logged with. Its budget alone holds it (`checkLimits`), and `budgetLeft` is what a refusal for the budget says. `private.high_hand_payout` and `private.promo_budget_left` are the twins on `promotionRewards.json`. |
| `tierChips(tiers, claimed)` | A seat bonus in tiers (decision 0580): the chips of the tier the claims so far fall in, null once every tier is claimed; `checkLimits` gives a tiered grant its tier's chips and refuses it `tiers_used_up` past the last. `private.promo_tier_chips` is its twin on `promotionRewards.json`. |
| `stackGrants(candidates)` | For one event: chips stack; one perk of each kind. |
| `hourSteps(reward)`, `stepsReached(reward, minutes)` | A play-time bonus's steps (decision 0507): one after a time, two to six set steps, or every so many minutes up to its times a visit and never past 24 hours; and those reached in the minutes played. |
| `simulate(promo, events)` | Last week replayed (a play-time bonus a step for each its visits reached): members qualified, times given, chips, perks, whether the budget stopped a grant, and every grant. |
| `transition(state, action, actor)`, `sameTerms` | The status machine: submit needs a simulation on these terms, approval `promotions.approve` and someone other than the author, an edit of a running version opens the next draft. |

`private.promo_is_eligible`, `private.promo_grant`, `private.promo_check_limits`, `private.promo_stack` and `private.seconds_in_schedule` are proved equal on `promotionRewards.json` and `promotionSchedule.json` in `supabase/tests/024_golden_twins.test.sql`.

### `@rivr/domain/shares`

A session's time shared among its tables and a hand's rake among its seats, which rakeback reads (decision 0585). Each is proved equal to its `private.` twin by `packages/testing/golden/shares.json`.

| Export | What it does |
|---|---|
| `tablePlayedSeconds(table, session, played)` | A session that moved tables shares its time played (seating to leaving, less away) among them in proportion to the time at each, rounded down to the second. |
| `rakeShare(rake, seated)` | A hand's rake split equally among the members seated at its table, rounded down to the paisa. |

### `@rivr/domain/hours`

A member's counted hours after a super admin resets them (redesign RD-36, decision 0609). Proved equal to `private.counted_seconds` by `packages/testing/golden/hours.json`.

| Export | What it does |
|---|---|
| `countedSeconds(stint, countedFrom)`, `PlayedStint` | The seconds of a stint that still count towards a member's hours (the TV's hours leaderboard, a play-time Bonus, the Members list): all of it when the stint began at or after the moment hours count from, none when it ended by then, else the share played after it by the clock, rounded down (`tablePlayedSeconds`). Null counts everything. |


### `@rivr/domain/clubDay`

The club's day runs 06:00 to 06:00 IST, so a night past midnight belongs to the day it began.

| Export | What it does |
|---|---|
| `clubDay(at)` | The club's day a moment falls in, as `2026-11-15`: 02:00 IST on the 16th is still the 15th. |
| `recentClubMonths(at, count)`, `lastDayOfMonth(first)` | The first days of the last club months, the one a moment falls in first, and a month's last day: Reports choose months by them (#99). |
| `clubDaysPeriod(first, last)` | A run of club days as the moments it begins and ends: 06:00 IST on the first to 06:00 IST after the last. |
| `dayAfter(day, count)`, `weekOf(day)` | The club day `count` days after another (before, when negative), and the Monday of a club day's week. |


### `@rivr/domain/glaza`

Glaza's monthly statement (#109, decision 0265, question #580), in paise. `packages/testing/golden/glaza.json` proves both against `private.glaza_statement_of` and `private.glaza_payable`.

| Export | What it does |
|---|---|
| `glazaStatement(lines)`, `GlazaStatementLine`, `GlazaStatement`, `GlazaKind` | A month of Glaza's lines as its statement: comped lines owed at cost by kind, alcohol sold with its cost and margin; food and soft drinks sold are Glaza's alone. |
| `glazaPayable(comps, alcoholMargin)`, `GlazaPayable` | RIVR's half of the alcohol margin, rounded toward nothing to the paisa (Glaza keeps an odd paisa), and NewCo's payable: the comps less that half, below nothing when Glaza owes RIVR. |

## Usage

```ts
import { parseRupees, roundDownToChip, shareOf } from '@rivr/domain/money';
import { formatMoney } from '@rivr/i18n';

const pot = parseRupees('48,000');
if (!pot.ok) return showError(pot.error);
const fivePercent = roundDownToChip(shareOf(pot.value, 500n)); // 2,40,000 paise
formatMoney(fivePercent); // "₹2,400", formatting is @rivr/i18n's job
```

## Tests

- Golden fixtures in `packages/testing/golden/money.json`, readable by a non-engineer; `money.golden.test.ts` runs them.
- Property tests in `*.property.test.ts` (fast-check).
- Mutation testing: `pnpm --filter @rivr/domain exec stryker run`; the score must stay at or above 80%. It uses Stryker's command runner because the vitest runner's per-test filter skips every test under Vitest 5 (see `stryker.config.mjs`). A new rule folder is added to `mutate`.

A new rule follows `.claude/skills/money-rule/SKILL.md`: `src/<rule>/index.ts`, a golden file, property tests, and a Stryker run.

## Must not

- Import anything but `@rivr/contracts`: no React, Supabase, vendor SDKs or Node built-ins.
- Use a JavaScript number or a float for money, or round up.
- Format money for people; that is `formatMoney` in `@rivr/i18n`.
- Throw for an expected failure such as a mistyped amount. Return a `Result`.
