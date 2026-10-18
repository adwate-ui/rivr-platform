# @rivr/tokens

The single source of every design value in RIVR: colours, typefaces, the type scale, weights, line heights, letter spacing, spacing, radius, borders, the one shadow, opacity, layers, breakpoints and device sizes, motion, icon sizes and the chart palette. `tokens.json` (W3C Design Tokens format) is the only file a person edits; Style Dictionary generates everything else.

## Public API

| Export | What it is | Who uses it |
|---|---|---|
| `@rivr/tokens` | `tokens` (every value, resolved; px dimensions as numbers) and `chartPalette` | `@rivr/ui` (icon sizes, the TV stage), `@rivr/render`, charts, visual tests |
| `@rivr/tokens/tokens.css` | `--rivr-*` custom properties on `:root`; aliases stay `var()` references | `@rivr/ui`'s stylesheet |
| `@rivr/tokens/tailwind.css` | Tailwind v4 theme: resets Tailwind's defaults, then maps every utility to a `--rivr-*` property (`docs/decisions/0008`) | `@rivr/ui`'s stylesheet only |
| `@rivr/tokens/manifest-colors.json` | `theme_color` and `background_color` for the PWA manifests | `player`, `console`, `display` |
| `@rivr/tokens/tokens.json` | The source | tests |
| `generated/android/res/values/` | `colors.xml` (`rivr_color_*`) and `themes.xml` (`Theme.Rivr`) | the `tablet` and `driver` Android shells |

Utility names follow the tokens: `bg-surface`, `bg-raised`, `text-content`, `text-content-muted`, `text-money`, `bg-action`, `border-hairline`, `p-4` (16 px), `text-16`, `font-display`, `rounded-lg`, `tracking-tv`, `max-w-phone`, `z-modal`, and the `phone:`, `tablet:`, `console:`, `tv:` breakpoints.

## Usage

```ts
import { chartPalette, tokens } from '@rivr/tokens';

tokens.color.gold; // '#C9A85C'
tokens.viewport.tv; // { width: 1920, height: 1080 }
chartPalette[0]; // the first series colour
```

Change a value:

1. Edit `tokens.json`.
2. `pnpm --filter @rivr/tokens build` regenerates `generated/`.
3. Commit both. `pnpm --filter @rivr/tokens check:generated` (run by `pnpm verify` when this package changes) fails if `generated/` is stale, modified or not committed.
4. Run `pnpm visual -- --update` and review the changed screenshots.

`src/*.test.ts` check text contrast (4.5:1, WCAG formula, translucent colours composited), the design-inventory colours, the type scale, the 6 px radius ceiling, the single shadow, and that the generated TypeScript, CSS and platform files match `tokens.json`.

## Must not

- Be edited in `generated/`. Change `tokens.json` and rebuild.
- Hold a value that is not a design value (copy, business rules, venue configuration).
- Be bypassed: no hex colour, px size or font name appears anywhere else in the repository; ESLint and stylelint reject them outside this package.
- Be changed at run time. Admins cannot change colours or type from the console; brand changes are a PR here.
