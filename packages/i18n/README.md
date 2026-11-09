# @rivr/i18n

Every word a member or staff user reads, and the one formatter for money, numbers, time, dates and stakes. RIVR is English only (#186).

## Public API

| Export | What it does |
|---|---|
| `t(key, params?)` | The message for a key, placeholders filled: `t('common.retry')`. The one way to get copy, anywhere: components, Astro pages, Edge Functions, render templates, tests. It knows `common` and `ui` from the start; anything else must be registered first. |
| `registerMessages(namespaces)` | Adds namespaces to what `t` knows. Each app does it once, in `src/messages.ts`, imported first by its entry (`main.tsx`; on the website, the server modules that read its copy) and by its tests (`setupFiles`): `registerMessages({ player: playerApp })`. So an app ships only its own copy, and the player stays within its JavaScript budget. |
| `playerApp`, `consoleApp`, `tabletApp`, `displayApp`, `webApp`, `tv`, `social`, `documents`, `memberRewards` | The namespaces an app registers: its own, plus `tv` where it names hands or TV modes (console, tablet, display); `@rivr/render` registers `social`, `tv` and `documents` (receipts, invoices and statements). A screen loaded on demand may register its own copy when it loads, so the app's first load does not carry it: the player's Academy invoice registers `documents`, its Rewards tab `memberRewards` (#152). |
| `formatMoney(paise)` | `₹1,20,000`. Indian grouping, no decimals on whole rupees, never rounded, `−₹1,000` for negatives. |
| `formatChips(paise)` | `5,000`: chips, such as bonus chips, as a count with no rupee symbol, for the screens that show no rupee (#627). Otherwise as `formatMoney`. |
| `formatNumber(n)` | A count: `18,420`, `−5` with the minus sign money uses; −0 is `0` (F5-12). |
| `formatNights(thousandths)` | Hotel nights kept in thousandths: `1.25`, `0.175`, `2` (#146). |
| `formatGameStakes(game, small, big, straddle?)` | A game's stakes as everyone writes them: `NLH 100/200/500`. |
| `formatWaitingSince(at, now?)` | When something has waited since, with the year when it is not this one and its age from a day on: `Sun 15 Nov, 11:00 · 90 days`. |
| `formatStakes(small, big, straddle?)` | Blinds in paise to `100/200`, and a straddle after them, `100/200/400`; a blind with paise keeps them, `0.50/1`. |
| `formatTime(date)` | 24-hour IST clock, `02:40`. |
| `formatBlinds(small, big, ante?)` | A tournament level's blinds in chips: `400/800 ante 800`, or `400/800` with no ante (#119). |
| `formatRupeesForInput(paise)` | Paise as the rupees a form's field holds: `10000`, or `2500.50` with paise. |
| `settingCopy(key)`, `settingKeys` | Each setting key's name, help, field labels and option words, as Settings shows them (#604); undefined for a key with none. The copy test checks them with the catalogue. |
| `formatCountdown(seconds)` | A clock counting down, whole seconds: `11:29`, `05:00`, `1:15:00` from an hour up. The tournament clock. |
| `formatDate(date)`, `formatWeekday(date)`, `formatDayTime(date)`, `formatDateTime(date)` | `15 Nov 2026`, `Sunday`, `Sun 15 Nov, 02:40` (within the coming weeks), `15 Nov 2026, 02:40` (a moment that may be months away, as a break's end), in IST; every month in three letters, September `Sep` (F5-11). |
| `formatIsoDay(date)`, `istMidnight(day)`, `isLaterIstDay(day)` | `2026-11-15`, the IST calendar day as a date field gives it; `2026-11-15T00:00:00+05:30`, its midnight; whether a day is after today in IST, for a setting from a later day. The console's one way to name today (F1-30). |
| `formatMonth(month)` | A calendar month from `2026-11` or `2026-11-01`: `November 2026`, as a League month is named. |
| `formatList(items)` | `Black card and Founders' Circle`. |
| `formatMobile(e164)` | `+919876543210` to `+91 98765 43210`. |
| `en` | The catalogue itself, for code that needs a key's type (`keyof typeof en.ui.consoleRail.items`) or every message (the copy test). Screens use `t`, not this: importing it as a value ships every app's copy. |
| `Translate` | The type of `t`. |
| `MessageKey`, `MessageParams` | Types: every key (`'common.retry'`) and the values for a message's `{placeholders}`. |

## Usage

```tsx
import { formatMoney, t } from '@rivr/i18n';

function LockedLine({ tiers }: { tiers: string }) {
  return <Text>{t('common.featureLocked', { tiers })}</Text>; // "Black card only."
}

formatMoney(18_500_000n); // "₹1,85,000"
```

## Adding copy

Add the message to the namespace file in `src/catalogue/en/` (one file per area, such as `common.ts`). A new area gets a new file, registered in `en/index.ts`. A new top-level namespace is also exported from `src/index.ts`, so an app can register it. An app reading another namespace adds it to its `src/messages.ts`; until it does, `t` returns the key itself. In `apps.ts`, name each member of an app's object; never spread one in, or the bundler keeps every app's copy in every app.

`src/copy.test.ts` enforces `.claude/rules/copy.md` on every message: the banned words, no `!`, no emoji, no em dashes, no empty messages.

## Must not

- Hold business rules. It formats amounts it is given; it never computes them.
- Use another number format. Money is always Indian grouping (`docs/decisions/0007`).
- Be bypassed: no app or `@rivr/ui` component writes copy or formats money itself.
