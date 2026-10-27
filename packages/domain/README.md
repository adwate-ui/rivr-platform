# @rivr/domain

Every business rule, as pure TypeScript over `@rivr/contracts`. Lane 0 ships money and the ledger; lanes add rake, caps, call time, TDS, GST, markers, payouts, priority and points as folders beside them.

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
| `hourShares(seconds)`, `WHOLE_TIP_POOL` | Each dealer's share of the tip pool by time dealt, in basis points adding up to 10,000, the points left after rounding down to the largest remainders, the earlier dealer first on a tie (#124, decision 0252; tips belong to dealers). |

### `@rivr/domain/identity`

| Export | What it does |
|---|---|
| `isSameName(documentName, registeredName)` | Whether the name on an identity document is the member's, ignoring case, spacing and punctuation. Devanagari vowel signs count; a name with no letters matches nothing. |

### `@rivr/domain/academy`

| Export | What it does |
|---|---|
| `academyFee(kind, seats, prices)`, `AcademyPrices` | What an Academy booking costs: one seat at the individual fee, or each head at the corporate fee. No rounding. The database's `private.academy_fee` is proved equal by `packages/testing/golden/academy.json`. |

### `@rivr/domain/rake`

| Export | What it does |
|---|---|
| `potTake(pot, rules)`, `RakeRules`, `PotTake` | What the dealer takes from a pot: rake at the table type's rate, no more than its cap, rounded down to ₹50 chips; while the bad-beat jackpot is live, the drop (₹100) from a pot above `dropAbove` (₹5,000, not at it); and the pull, both together. A ₹48,000 pot gives rake ₹2,400, drop ₹100, pull ₹2,500. Golden cases in `packages/testing/golden/rake.json`. |

### `@rivr/domain/jackpot`

| Export | What it does |
|---|---|
| `splitDrop(drop, shares)`, `DropShares`, `PoolSplit` | A jackpot drop split between the pools (#48): season and freeroll take their shares (basis points) rounded down to the paisa, the main pool the rest, so the parts add up to the drop. ₹100 at 20% and 10% gives ₹70, ₹20, ₹10. |
| `badBeatPayout(pool, rule, others)`, `PayoutRule`, `BadBeatPayout` | What a bad beat pays in chips: the rule's share of the main pool, split between loser, winner and the `others` dealt in; each part rounded down to ₹50, the table's part shared equally; what rounds away stays in the pool (decision 0048, question #300). Golden cases for both in `packages/testing/golden/jackpot.json`, which `private.split_drop` and `private.bad_beat_payout` are proved on too. |

### `@rivr/domain/settings`

| Export | What it does |
|---|---|
| `ruleAt(rules, at)`, `Dated`, `RuleAt` | The effective-dated rule in force at a moment, the newest whose start is not after it (null start: since opening), and the changes still to come, soonest first, as `private.setting_at` finds it (#37). Golden cases in `packages/testing/golden/settings.json`, which 024 proves `private.setting_at` on. Imports nothing, so `@rivr/db` uses it without carrying Zod. |

### `@rivr/domain/waitlist`

| Export | What it does |
|---|---|
| `priorityOn(stake, { tier, qualifyingStake })`, `TierPriority`, `Priority` | A member's priority on the list for one stake (#40): the tier's weight from the setting `waitlist.priority_weights`, with its name as the reason. The black card's counts only at the member's qualifying stake; Founders' Circle on every list. The database's `private.priority_weight` is proved equal by `packages/testing/golden/waitlist.json`; the database orders each list by weight, then join time. |

### `@rivr/domain/credit`

| Export | What it does |
|---|---|
| `creditLimit(limit, threshold, bySuperAdmin)`, `CreditLimitState` | A credit limit as the floor sets it (#73): whole ₹50 chips (`not_chips` otherwise), 0 closing the line; in force at once up to the venue's approval threshold, or when a super admin sets it, otherwise waiting for one. The database's `private.credit_limit_check` is proved equal by `packages/testing/golden/credit.json`. |

### `@rivr/domain/markers`

| Export | What it does |
|---|---|
| `markerCheck(amount, terms)`, `MarkerTerms`, `MarkerRefusal` | A marker at the cage (#74, additions flow 19): whole ₹50 chips above nothing, refused while a marker of the member's is past due, above their credit limit, or above the room's exposure cap (exactly at either is allowed). The database's `private.marker_check` is proved equal by `packages/testing/golden/markers.json`. |
| `creditAvailable(limit, outstanding)` | What is left of a member's credit limit (#18, Balance: "Limit ₹2,00,000 · available ₹1,50,000"): the limit less what their open markers still owe, never below nothing. A marker of exactly that passes `markerCheck`'s limit (property-tested). |
| `isPastDue(dueAt, at)` | Whether an open marker's due time has gone by at a moment (#55): exactly at it is not yet past due, as `private.has_past_due_marker` has it. While one is, Balance says no new credit is given and Withdraw is blocked. |

### `@rivr/domain/cage`

| Export | What it does |
|---|---|
| `buyIn(method, amount, minimum, { wallet, bonus })`, `BuyInBalances`, `BuyInMethod`, `BuyInSource`, `BuyInRefusal` | A buy-in at the cage (#57, design prompt flow 3): whole ₹50 chips above nothing, at least the table's minimum, and from the wallet no more than its cash, from bonus no more than the bonus in force (#17). Gives the account the chips are paid from (cash drawer, bank, wallet or bonus). The database's `private.buy_in_check` is proved equal by `packages/testing/golden/cage.json`. |
| `walletAfter(method, amount, walletCash)` | The wallet cash a wallet buy-in leaves, for the cage's preview; null when it is not from the wallet or the wallet cannot cover it. |
| `cashOut(chips, outstanding)`, `CashOutSplit` | A cash-out (#75, design prompt flow 8): whole ₹50 chips handed back first settle the member's open markers, oldest first, each as far as the chips go; the rest goes to the member. ₹1,20,000 with a ₹50,000 marker settles it and leaves ₹70,000. The database's `private.cash_out_split` is proved equal by `packages/testing/golden/cashOut.json`. |

### `@rivr/domain/bonus`

| Export | What it does |
|---|---|
| `bonusAvailable(grants, at)`, `BonusGrant` | The bonus a member can spend at a moment (#17; scope-v1 module 5): what is left of every grant whose end is still to come. A grant is in force before its end, never at it. |
| `bonusSpend(amount, grants, at)`, `BonusRefusal` | Bonus is playable, not withdrawable: it buys whole ₹50 chips above nothing, drawn from the grants in force, the soonest to end first, each as far as it goes. Gives what each grant gives, in the order given; `bonus_short` above the bonus in force. The database's `private.bonus_draws` is proved equal by `packages/testing/golden/bonus.json`. |
| `bonusExpired(grants, at)` | What expires at a moment: the remainder of each grant whose end has come. The database's `private.bonus_expiring` is proved equal on the same file; `private.expire_bonus` reverses it every minute. |

### `@rivr/domain/wallet`

| Export | What it does |
|---|---|
| `withdrawalCheck(amount, walletCash)`, `WithdrawalRefusal` | A withdrawal from the member's wallet (#21; design prompt flow 9): whole rupees above nothing (`not_rupees`), no more than the wallet's cash (`wallet_short`); bonus and points are never withdrawn. The database's `private.withdrawal_check` is proved equal by `packages/testing/golden/wallet.json`. |

### `@rivr/domain/callTime`

| Export | What it does |
|---|---|
| `callTime(clock, at)`, `CallTimeClock`, `CallTime` | A seat session's call time (#78, decision 0057): whole seconds left of the table type's `call_time.minutes` fixed at seating, never below zero, and whether it is complete. The clock runs across moves, stands still while the player is away, and stops when they leave (the shortfall). The database's `private.call_time_left` is proved equal by `packages/testing/golden/callTime.json`. |

### `@rivr/domain/tds`

| Export | What it does |
|---|---|
| `tdsOnCashOut(cashOut, rule)`, `TdsCashOut`, `TdsRule`, `Tds` | TDS on a cash-out (#22, decision 0068): nothing until the period's net winnings exceed the threshold, then the rate (the no-PAN rate for a member without a PAN where one is required) on all of them, rounded down to the rupee; the cash-out bears that less what the period already recorded, never below nothing and never more than it pays after markers. The database's `private.tds_amount` is proved equal by `packages/testing/golden/tds.json`. |

### `@rivr/domain/gst`

| Export | What it does |
|---|---|
| `gstIncluded(inclusive, rate)`, `GstSplit` | GST taken out of an amount that includes it (#23, decision 0071): equal CGST and SGST halves, each rounded to the nearest paisa (a half up), and the taxable value as what is left, so the three add up to the amount. Throws on a negative amount or a rate outside 0 to 10,000 basis points (bugs). The database's `private.gst_included` is proved equal by `packages/testing/golden/gst.json`. |
| `igstIncluded(inclusive, rate)`, `IgstSplit` | IGST taken out of an amount that includes it, for a buyer registered in another state (#380, decision 0102): the whole tax at the full rate, rounded once to the nearest paisa (a half up), and the taxable value as the rest. Same refusals as `gstIncluded`. The database's `private.igst_included` is proved equal on the same golden file. |

### `@rivr/domain/accommodation`

Accommodation rewards (#146, decision 0246): hotel nights, kept in thousandths. Proved equal to `private.nights_for_time` by `packages/testing/golden/accommodation.json`.

| Export | What it does |
|---|---|
| `nightsForTime(playedSeconds, hoursPerNight)`, `NIGHT` | The thousandths of a night (`NIGHT` is 1,000) a table type's hours a night gives for the seconds played there, rounded down. At 20 hours a night, 5 hours is 250. |

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
| `promotionReward(effect, { amount, points })`, `PromotionReward` | What an effect gives: its rupee cost against the budget, and points. A bonus share is rounded down to whole ₹50 chips, then held to its cap; double points on 120 earned is 120 more; a bonus or points of nothing is `null`. |
| `promotionsToGive(candidates)`, `PromotionCandidate` | Of the promotions that apply to one event, in priority order, which to give: each while its count budget, rupee budget and per-player limit allow, never part of one; one that does not stack only alone. |
| `promotionDraft(choices)`, `PromotionDraft` | The builder's four blocks as one rule (#84): double or triple points on hours played, or 10% of a buy-in as bonus for a week; days, an IST window and a stake as conditions, only those chosen; "First 50 members" the first 50 grants a club day, "Once per member" one grant each over the promotion. |
| `simulatePromotion(draft, events, budget?)`, `ReplayEvent`, `SimulationBudget`, `PromotionSimulation` | A promotion replayed on last week's events before it is published (#144, decision 0214). Events are weighed in time order with `promotionApplies`, `promotionReward` and `promotionsToGive`, counting first N per club day and table, the per-player limit and the budget as the engine does. The result is the events replayed, the times given, the members, the rupee cost, the extra points, what is left of a rupee budget and whether the budget stopped a grant. A rule on past visits, call time or a hand is `not_replayable`. Proved on `promotionSimulation.json`. |
| `secondsInWindow(stint, conditions)`, `playedSecondsInWindow(time, conditions)` | Hours-played promotions with days or times (#457, decision 0186): a stint's whole seconds inside the window on the club days it touches, and a table's time inside the window less its share of the time away, which earns points at the table's rate (`pointsForTime`). |

The database's `private.promotion_applies`, `private.promotion_reward` and `private.promotions_to_give` are proved equal on `packages/testing/golden/promotions.json`, and `private.seconds_in_window` on `promotionWindow.json`; `private.evaluate_promotions` puts them together.

### `@rivr/domain/tally`

| Export | What it does |
|---|---|
| `tallyVouchers(day, postings)`, `TallyPosting`, `TallyVoucher`, `TallyUnmapped` | A club day's journal vouchers for Tally (#96, decision 0187): one per transaction kind, its postings summed by Tally ledger, ledgers that net to nothing left out, numbered `RIVR-<day>-<n>`; refused, naming the codes, while a code posted that day has no Tally ledger. Proved on `packages/testing/golden/tally.json`. |
| `tallyImportXml(day, vouchers)` | The vouchers as a file Tally imports (Import Data, Vouchers): journals dated the club day, debits deemed positive with negative amounts, names escaped. |

### `@rivr/domain/shareholding`

| Export | What it does |
|---|---|
| `holderShare(net, basisPoints)` | A partner's or investor's share of a club month's net result (#98, decision 0189): the net times their holding in basis points on the month's last day, rounded towards nothing to the paisa, so a loss is shared as a profit is. Proved on `packages/testing/golden/holderShare.json`. |

### `@rivr/domain/points`

Points (#89, decision 0161, question #395), in whole points (bigint); they never convert to cash. Each is proved equal to its `private.` twin by `packages/testing/golden/points.json`.

| Export | What it does |
|---|---|
| `pointsForTime(seconds, perHour)` | Hours by stake: a table type's points an hour for the seconds played there, rounded down. 2 h 59 min at 10 an hour is 29. |
| `tablePlayedSeconds(table, session, played)` | A session that moved tables shares its time played (seating to leaving, less away) among them in proportion to the time at each, rounded down to the second. |
| `rakeShare(rake, seated)` | RIVR Rewards: a hand's rake split equally among the members seated at its table, rounded down to the paisa. |
| `rakePoints(share, rate)` | A share (basis points, 500 is 5%) of a member's rake for a visit, as points at one a rupee, rounded down. ₹612.40 at 5% is 30. |

### `@rivr/domain/aml`

AML cash limits and structuring (#105, decision 0234; golden `aml.json`; SQL twins `private.cash_limit_hit` and `private.is_near_limit`).

| Export | What it does |
|---|---|
| `cashLimitHit(limits, visitSoFar, daySoFar, amount)`, `CashLimits`, `CashLimitHit` | Which limit a cash buy-in would take the member past, the visit's checked first (`visit`, `day`), or null within both. Reaching a limit exactly is within it; nothing, or null, is no limit. |
| `isNearLimit(total, limit, marginBasisPoints)` | Whether a total ended just under a limit: within the margin of it (1,000 is 10%), the limit itself included, the margin rounded down to the paisa. ₹36,000 is near ₹40,000 at 10%; ₹35,950 is not. |

### `@rivr/domain/clubDay`

The club's day runs 06:00 to 06:00 IST, so a night past midnight belongs to the day it began.

| Export | What it does |
|---|---|
| `clubDay(at)` | The club's day a moment falls in, as `2026-11-15`: 02:00 IST on the 16th is still the 15th. |
| `recentClubMonths(at, count)`, `lastDayOfMonth(first)` | The first days of the last club months, the one a moment falls in first, and a month's last day: Reports and the partner statements choose months by them (#99, #98). |
| `clubDaysPeriod(first, last)` | A run of club days as the moments it begins and ends: 06:00 IST on the first to 06:00 IST after the last. Pot data reads hands by it (#114). |
| `dayAfter(day, count)`, `weekOf(day)` | The club day `count` days after another (before, when negative), and the Monday of a club day's week: the roster shows a week by them (#106). |

### `@rivr/domain/league`

The RIVR League (#147, decision 0182, question #452). A month's League points are the points cash play earned for hours at the tables, plus tournament finishes. Each is proved equal to its `private.` twin by `packages/testing/golden/league.json`.

| Export | What it does |
|---|---|
| `leagueFinishPoints(place, schedule)`, `LeagueFinishPoints` | A tournament finish, from `league.points`: the points for taking part, plus first's, second's or third's, or the final table's for fourth to ninth; nothing more below ninth. With 100, 70, 50, 20 and 5, the winner earns 105 and tenth 5. |
| `leagueMonth(at)` | The League month of a moment, as its first day: the month of the club's day (06:00 to 06:00 IST), so 02:00 on 1 December is November. |

### `@rivr/domain/tournament`

Tournaments (#115, #116, #119; decisions 0200 to 0202). `clockAt` and `checkPurchase` are proved equal to their `private.` twins by `packages/testing/golden/tournamentClock.json` and `tournamentEntry.json`; the calculator by `blindStructure.json`.

| Export | What it does |
|---|---|
| `Stage`, `PlayLevel`, `BreakStage`, `structureProblem(stages)`, `structureMinutes`, `levelCount`, `MOST_STAGES` | A blind structure: levels (blinds and ante in chips, minutes) and breaks. What stops the clock running one: none, more than sixty stages, a break first, two breaks together, minutes outside 1 to 120, a small blind above the big. |
| `clockAt(stages, elapsedSeconds)`, `ClockPosition` | Where the clock stands: the stage, the level (a break counts as the level before it), whether it is a break, the seconds left. Before the start, level 1 in full; past the end, the last stage with none left. |
| `stageStartSeconds`, `nextLevelAfter`, `levelAtOrAfter` | When a stage starts; the next level after a stage; the level at a stage, or after a break. |
| `elapsedNow(reading, nowMs)`, `ClockReading` | A device's count down from the server's reading: a running clock runs on from when it was read, a paused one holds. |
| `planStructure(plan)`, `StructurePlan` | The calculator: levels for a target length, big blinds up the chip ladder to a twentieth of the chips in play, breaks every so many levels, an optional big-blind ante. |
| `checkPurchase(purchase, rules, level, player)`, `TOURNAMENT_FORMATS`, `EntryRules`, `PlayerStanding`, `Purchase`, `PurchaseRefusal` | Whether a player may enter, re-enter, rebuy or take the add-on at the clock's level: a `Result` with the refusal. |
| `poolShare(price, fee)` | What one buy puts in the prize pool: its price less the fee, refused unless the fee is nothing or more and below the price (golden `tournamentMoney.json`). |
| `prizePool(collected, guarantee)`, `payoutTable(pool, shares, runs)`, `areSharesWhole(shares)`, `WHOLE_POOL`, `MOST_PLACES` | The prize pool with the overlay a guarantee needs, and the prizes by the floor's shares in basis points adding up to 100%, rounded down to ₹50 chips, the rest to first (#121, decision 0205, question #470; golden `tournamentPayouts.json`). |
| `chipChop(stacks, prizes)`, `icmDeal(stacks, prizes)`, `dealAmounts(method, stacks, prizes)`, `DEAL_METHODS`, `MOST_DEAL_PLAYERS` | Deals among two to nine players for the prizes they would play for: each sure of the smallest, the rest by chips or by ICM (Malmuth-Harville), rounded down to ₹50 chips, the rest to the biggest stack (decision 0205). |
| `bountyOnBust(bounty, kind)`, `BOUNTY_KINDS` | A bust's bounty: all paid (standard), or half paid and half onto the eliminator's head (progressive) (#117, decision 0206). |
| `dayTwoField(runs)`, `FlightRun`, `DayTwoField` | Day 2 of a multi-flight event: who goes through (the bigger stack if twice) and the players out on Day 1, best first, by players outlasted in their flight, then the smaller flight, then the earlier run (#117, decision 0251; golden `tournamentSeating.json`). |
| `satelliteSeats(pool, targetBuyIn, runs)`, `SatelliteSeats` | A satellite's seats in its target event: the pool at the target's buy-in, rounded down and never more than the runs, and the cash left over with the place it goes to (#117, decision 0250; golden `tournamentPayouts.json`). |
| `eligibleSeats(occupied, tables, seatsPerTable)`, `balancingMoves(counts)`, `averageStack(chips, players)`, `TournamentSeat`, `BalancingMove` | Seating and balancing (#120, decision 0204; golden `tournamentSeating.json`): the free seats at the emptiest tables a new player may be given; the moves that bring every table within one player of the others; the chips per player left. |

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
