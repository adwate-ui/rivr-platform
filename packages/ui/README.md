# @rivr/ui

Every visible element in every RIVR app. Apps compose these components; they write no HTML elements, no classes and no styles of their own. Styling uses only the token theme from `@rivr/tokens`; every word comes from `@rivr/i18n`.

## Public API

| Group | Components |
|---|---|
| Layout | `Box`, `Stack`, `Inline`, `Grid`, `Spacer`, `Divider`, `Container`, `ScrollArea`, `Screen` (heading plus loading, empty and error states) |
| Type | `Text`, `Heading` (`isVisuallyHidden` for a screen named by an image, such as the sign-in wordmark), `Label` (small and muted, as the prototype's), `Money` (bigint paise), `Number`, `Time` (IST), `Stakes`, `Icon`, `Wordmark` (`size`, `withTagline`; `withMotto` and `align="center"` for the sign-in lockup; `isAnimated` for the logo animation: each tile rises in turn, then the tagline, off under reduced motion) |
| Controls | `Button` (`primary` gold and semibold, `secondary`, `text`, `danger`; loading and disabled; 44 px target, or 48 px with `size="large"` for a sign-in step's action; with `href`, a link that looks the same and is never loading or disabled), `Input` (label, hint, error; `variant` `boxed`, `line` or `code`; `prefix` such as `+91`, with the focus ring round the whole row), `ErrorMessage` (why a step failed and what to do: an alert icon and the message, announced; Input's error uses it), `CameraButton` (opens the phone's camera, the front one for a selfie, and hands back the photo), `Switch` (an on-off setting in a 44 px row; label, hint), `ChoiceChips` (a few choices as chips; `mode` `many` or `one`), `ChoiceSheet` (a sheet rising from the bottom of a phone screen to ask one choice: title, what choosing does, a row per choice with its detail, Cancel; focus stays in it), `KycPhoto` (a member's KYC photo at a fixed portrait size, saying when it is loading, missing or could not load), `FloorRow` (one table on tonight's floor: name, stakes, a line on its waitlist, one action; dimmed when closed), `TableCard` (one table on the live floor's room plan, pressed to open it: its ring, occupancy and rake tonight, dealer and hands per hour; #81), `CallTimeTimer` (a seated player's call time: "Call time 1 h 12 min left", paused while away, or done; #78), `SeatRing` (a table seen from above: name and stakes on the felt, each seat with its player's initials or its number, seat 1 at the top; one image with a spoken summary; dimmed when closed; with `onSelectSeat`, as on the dealer tablet, each seat is a button named "Seat 4, Kabir Sethi" with "Seat 4" under it, and the chosen one ringed), `PinPad` (the dealer tablet's PIN pad: a dot for each digit, never the digits; 1 to 9, 0 and Delete), `Keypad` (the dealer tablet's pot keypad: 1 to 9, 000, 0 and Delete, up to eight digits, never a leading nought; the screen shows the amount), `SignaturePad` (a member signs with a finger or pen on the cage screen; each stroke kept as SVG path data, with Clear; #74) |
| Tier-gated features | `FeatureGate`, `LockedNotice`, and the `FeatureAccess` type (`docs/decisions/0010`) |
| Installed app | `OfflineBanner` (a slim status bar while the device is offline: the player app's line, or `message`; online, `onlineMessage` if given, else nothing; the dealer tablet's queue of hands), `InstallOffer` (`kind` `prompt`, with Install, or `ios`, saying how; Not now) |
| Navigation | `BottomNav` (the five player tabs, hidden or locked from `FeatureAccess`), `SideNav` (grouped console rail) |
| Steps | `StepScreen` (one step of a flow outside the tabs: Back, the heading at the step size, content, the action at the bottom of the screen) |
| Website blocks | `HeroBlock` (a page's one h1, a line, and its one gold action as a link), `TextBlock` (an optional heading and paragraphs, split at blank lines, at reading width), `RulesBlock` (numbered rules, as the house rules), `FaqBlock` (questions that open to their answers, without JavaScript), `CareersBlock` (open roles and how to apply; says when there are none), `MapBlock` (address, hours and a link to directions; no embedded map), `GamesBlock` (games and stakes with buy-in, tables running and how many wait, live), `CalendarBlock` (coming tournaments with day and time in IST, buy-in and guarantee, live), `LinksBlock` (large stacked links at phone width, the first gold, for the link-in-bio page) |
| Social cards | `SocialCard` (a post for `@rivr/render` that fills the page it is drawn on: a feed post at `tokens.viewport.feed`, 1080 × 1350, or a story at `.story`, 1080 × 1920; the wordmark, then above the venue's address a label, a title, an optional gold figure with what it is, and detail lines; without a figure the title is the hero. Never scaled, unlike `DisplayShell`) |
| Brand art | `BrandArt` (`art` `icon`, `maskable`, `adaptive` or `lockup`: the red card or the wordmark on a fixed stage from `tokens.brand`, scaled to fill the page, for the brand kit's icons, splash screens and covers; `isAnimated` with `lockup` for the logo animation that `@rivr/render` draws to MP4) |
| Shells | `PlayerShell` (390 px), `ConsoleShell` (1440 px), `TabletShell` (1180 × 820), `DisplayShell` (1920 × 1080 stage scaled to the screen), `WebShell` (its links wrap under the wordmark on a phone), `DriverShell` |

`@rivr/ui/styles.css` is the compiled stylesheet: preflight, token custom properties, the utilities the components use, and the webfonts (`docs/decisions/0005`, `0011`). Each app imports it once.

Shells take their navigation and slots as props (`tabs`, `sections`, `banner`, `actions`, `corner`, `footer`) and an optional `onNavigate(href)` that hands a plain link click to the app's router. They hold no app logic and fetch nothing.

## Usage

```tsx
// apps/player/src/main.tsx
import '@rivr/ui/styles.css';

// apps/player/src/routes/balance.tsx
import { t } from '@rivr/i18n';
import { Button, Inline, Money, Screen, Text } from '@rivr/ui';

export function Balance({ cashPaise }: { cashPaise: bigint }) {
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

- `pnpm storybook --filter ui` starts Storybook on `RIVR_STORYBOOK_PORT` (default 6006). "Tokens / Design tokens" is the design-system reference.
- `pnpm test --filter ui` runs Testing Library and axe checks in jsdom.
- `pnpm --filter @rivr/ui build-storybook`, then `pnpm visual` compares every story with `visual/baselines/` inside the Playwright container (`docs/decisions/0009`). `pnpm visual -- --update` accepts changes; review the PNG diff in the PR.
- New component: follow `.claude/skills/new-ui-component/SKILL.md`. One folder per component with `Name.tsx`, `Name.stories.tsx` (default, loading, empty, error, long text), `Name.test.tsx` and `index.ts`, exported from `src/index.ts`.

## Must not

- Accept `className` or `style` from callers. Add a typed prop or variant instead.
- Use a class outside the token theme: no hex, px, arbitrary values or font names. Tailwind's own palette does not exist here.
- Hold copy. Component text comes from the `ui` namespace of `@rivr/i18n`; content comes from the app.
- Compute money or apply a business rule. `Money` formats paise it is given.
- Import anything but `@rivr/tokens` and `@rivr/i18n` among our packages (dependency-cruiser enforces it).
- Animate except on a state change: 200 ms, ease-out. No shadows except a modal's, no gradients, radius 6 px at most.
