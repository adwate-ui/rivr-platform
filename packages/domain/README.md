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
