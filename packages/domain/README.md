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

### `@rivr/domain/waitlist`

| Export | What it does |
|---|---|
| `priorityOn(stake, { tier, qualifyingStake })`, `TierPriority`, `Priority` | A member's priority on the list for one stake (#40): the tier's weight from the setting `waitlist.priority_weights`, with its name as the reason. The black card's counts only at the member's qualifying stake; Founders' Circle on every list. The database's `private.priority_weight` is proved equal by `packages/testing/golden/waitlist.json`. |
| `orderWaitlist(stake, places)`, `WaitingPlace` | A list in order: highest weight first, then join time, then id. |

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
