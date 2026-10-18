# @rivr/i18n

Every word a member or staff user reads, and the one formatter for money, numbers, time, dates and stakes. RIVR is English only (#186).

## Public API

| Export | What it does |
|---|---|
| `t(key, params?)` | The message for a key, placeholders filled: `t('common.retry')`. Works anywhere: components, Astro pages, Edge Functions, render templates, tests. |
| `useT()` | Returns `t`, for components written before #186. The next part of #186 replaces it with `t`. |
| `formatMoney(paise)` | `₹1,20,000`. Indian grouping, no decimals on whole rupees, never rounded, `−₹1,000` for negatives. |
| `formatNumber(n)` | `18,420`. |
| `formatStakes(small, big)` | Blinds in paise to `100/200`. |
| `formatTime(date)` | 24-hour IST clock, `02:40`. |
| `formatDate(date)`, `formatWeekday(date)` | `15 Nov 2026`, `Sunday`, in IST. |
| `formatList(items)` | `Black card and Founders' Circle`. |
| `en` | The catalogue itself, for code that needs a key's type (`keyof typeof en.ui.consoleRail.items`) or every message (the copy test). Screens use `t`, not this. |
| `Translate` | The type of `t`. |
| `MessageKey`, `MessageParams` | Types: every key (`'common.retry'`) and the values for a message's `{placeholders}`. |

## Usage

```tsx
import { formatMoney, useT } from '@rivr/i18n';

function LockedLine({ tiers }: { tiers: string }) {
  const t = useT();
  return <Text>{t('common.featureLocked', { tiers })}</Text>; // "Black card only."
}

formatMoney(18_500_000n); // "₹1,85,000"
```

## Adding copy

Add the message to the namespace file in `src/catalogue/en/` (one file per area, such as `common.ts`). A new area gets a new file, registered in `en/index.ts`.

`src/copy.test.ts` enforces `.claude/rules/copy.md` on every message: the banned words, no `!`, no emoji, no em dashes, no empty messages.

## Must not

- Hold business rules. It formats amounts it is given; it never computes them.
- Use another number format. Money is always Indian grouping (`docs/decisions/0007`).
- Be bypassed: no app or `@rivr/ui` component writes copy or formats money itself.
