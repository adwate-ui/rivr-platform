# 0008 Tailwind v4 `@theme` from tokens replaces a v3 preset

Date: 18 Oct 2026

`docs/engineering/stack.md` and the additions plan a generated "Tailwind preset". Presets are a Tailwind v3 JavaScript config feature; Tailwind 4.3, which the repository uses, is configured in CSS with `@theme`.

Decision: Style Dictionary writes `packages/tokens/generated/tailwind/theme.css` (exported as `@rivr/tokens/tailwind.css`). It first resets Tailwind's defaults with `@theme { --*: initial; }`, then declares an `@theme inline` block whose values point at the `--rivr-*` custom properties from `tokens.css`: `--color-surface: var(--rivr-color-surface)`, `--spacing-4: var(--rivr-space-4)`, `--text-16`, `--radius-lg` and so on. `@rivr/ui`'s `src/styles.css` imports both files. Breakpoints are the one exception that carries literal values, because media queries cannot read custom properties.

Consequences: only token values exist as utilities. `bg-red-500` or `p-5` simply do not compile, which backs up the lint rule against arbitrary values. Utilities read the custom properties at run time, so the token CSS is the single place values live in the browser. Utility names follow token names (`text-content-muted`, `bg-raised`, `max-w-phone`), listed on the Storybook tokens page.
