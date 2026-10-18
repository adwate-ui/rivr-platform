# @rivr/ui

Every visible element in every RIVR app. Apps compose these components; they write no HTML elements, no classes and no styles of their own. Styling uses only the token theme from `@rivr/tokens`; every word comes from `@rivr/i18n`.

## Public API

| Group | Components |
|---|---|
| Layout | `Box`, `Stack`, `Inline`, `Grid`, `Spacer`, `Divider`, `Container`, `ScrollArea`, `Screen` (heading plus loading, empty and error states) |
| Type | `Text`, `Heading`, `Label`, `Money` (bigint paise), `Number`, `Time` (IST), `Stakes`, `Icon`, `Wordmark` (`size`, `withTagline`; `withMotto` and `align="center"` for the sign-in lockup) |
| Controls | `Button` (`primary` gold, `secondary`, `text`, `danger`; loading and disabled; 44 px target), `Input` (label, hint, error; `variant` `boxed`, `line` or `code`; `prefix` such as `+91`) |
| Tier-gated features | `FeatureGate`, `LockedNotice`, and the `FeatureAccess` type (`docs/decisions/0010`) |
| Navigation | `BottomNav` (the five player tabs, hidden or locked from `FeatureAccess`), `SideNav` (grouped console rail) |
| Shells | `PlayerShell` (390 px), `ConsoleShell` (1440 px), `TabletShell` (1180 × 820), `DisplayShell` (1920 × 1080 stage scaled to the screen), `WebShell`, `DriverShell` |

`@rivr/ui/styles.css` is the compiled stylesheet: preflight, token custom properties, the utilities the components use, and the webfonts (`docs/decisions/0005`, `0011`). Each app imports it once.

Shells take their navigation and slots as props (`tabs`, `sections`, `banner`, `actions`, `corner`, `footer`) and an optional `onNavigate(href)` that hands a plain link click to the app's router. They hold no app logic and fetch nothing.

## Usage

```tsx
// apps/player/src/main.tsx
import '@rivr/ui/styles.css';

// apps/player/src/routes/balance.tsx
import { useT } from '@rivr/i18n';
import { Button, Inline, Money, Screen, Text } from '@rivr/ui';

export function Balance({ cashPaise }: { cashPaise: bigint }) {
  const t = useT();
  return (
    <Screen title={t('balance.title')} actions={<Button variant="primary">{t('balance.withdraw')}</Button>}>
      <Inline justify="between">
        <Text>{t('balance.cash')}</Text>
        <Money paise={cashPaise} tone="player" size="lead" />
      </Inline>
    </Screen>
  );
}
```

## Working on it

- `pnpm storybook --filter ui` starts Storybook on `RIVR_STORYBOOK_PORT` (default 6006). The toolbar switches English and Hindi; "Tokens / Design tokens" is the design-system reference.
- `pnpm test --filter ui` runs Testing Library and axe checks in jsdom.
- `pnpm --filter @rivr/ui build-storybook`, then `pnpm visual` compares every story with `visual/baselines/` inside the Playwright container (`docs/decisions/0009`). `pnpm visual -- --update` accepts changes; review the PNG diff in the PR.
- New component: follow `.claude/skills/new-ui-component/SKILL.md`. One folder per component with `Name.tsx`, `Name.stories.tsx` (default, loading, empty, error, long text, Hindi where they apply), `Name.test.tsx` and `index.ts`, exported from `src/index.ts`.

## Must not

- Accept `className` or `style` from callers. Add a typed prop or variant instead.
- Use a class outside the token theme: no hex, px, arbitrary values or font names. Tailwind's own palette does not exist here.
- Hold copy. Component text comes from the `ui` namespace of `@rivr/i18n`; content comes from the app.
- Compute money or apply a business rule. `Money` formats paise it is given.
- Import anything but `@rivr/tokens` and `@rivr/i18n` among our packages (dependency-cruiser enforces it).
- Animate except on a state change: 200 ms, ease-out. No shadows except a modal's, no gradients, radius 6 px at most.
