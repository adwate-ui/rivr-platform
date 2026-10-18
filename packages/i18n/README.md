# @rivr/i18n

Every word a member or staff user reads, in English and Hindi, and the one formatter for money, numbers, time, dates and stakes.

## Public API

| Export | What it does |
|---|---|
| `useT()` | The translate function for the current language: `t('common.retry')`. |
| `I18nProvider` | Sets the language (`'en'` or `'hi'`) for everything below it. |
| `useLocale()` | The current language. |
| `createTranslator(locale)` | `t` outside React (Edge Functions, render templates, tests). |
| `formatMoney(paise)` | `₹1,20,000`. Indian grouping, no decimals on whole rupees, never rounded, `−₹1,000` for negatives. |
| `formatNumber(n)` | `18,420`. |
| `formatStakes(small, big)` | Blinds in paise to `100/200`. |
| `formatTime(date)` | 24-hour IST clock, `02:40`. |
| `formatDate(date, locale)`, `formatWeekday(date, locale)` | `15 Nov 2026`, `Sunday`, in IST. |
| `formatList(items, locale)` | `Black card and Founders' Circle`. |
| `en`, `hi` | The two catalogues themselves, for code that needs a key's type (`keyof typeof en.ui.consoleRail.items`) or every message (the copy test). Screens use `t`, not these. |
| `Translate` | The type of `t`. |
| `MessageKey`, `MessageParams`, `Messages`, `Locale`, `Catalogue` | Types: every key (`'common.retry'`), the values for a message's `{placeholders}`, the shape a Hindi file must match, `'en' \| 'hi'`, and a whole catalogue. |

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

1. Add the message to the namespace file in `src/catalogue/en/` (one file per area, such as `common.ts`). A new area gets a new file, registered in `en/index.ts` and `hi/index.ts`.
2. Add the Hindi message with the same key in `src/catalogue/hi/`. A missing key fails the typecheck.
3. Keep `{placeholders}` identical in both languages; the copy test checks this.

`src/copy.test.ts` enforces `.claude/rules/copy.md` on every message: the banned words, no `!`, no emoji, no em dashes, no empty messages.

## Must not

- Hold business rules. It formats amounts it is given; it never computes them.
- Use another number format. Money is always Indian grouping with Latin digits, in Hindi too (`docs/decisions/0007`).
- Be bypassed: no app or `@rivr/ui` component writes copy or formats money itself.
