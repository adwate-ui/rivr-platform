# 0011 Webfonts ship inside @rivr/ui's dist

Date: 18 Oct 2026

Apps load only `@rivr/ui/styles.css` (`docs/decisions/0005`), yet Bodoni Moda, Instrument Sans, Tiro Devanagari Hindi and Noto Sans Devanagari must load in every app, in Storybook and in `@rivr/render`. Importing the `@fontsource` CSS from `src/styles.css` does not work: the Tailwind CLI inlines imported CSS without rewriting its `url()`s, so `./files/...` would point nowhere from `dist/styles.css`.

Decision: `packages/ui/scripts/fonts.mjs`, run before `build`, `storybook` and `build-storybook`, copies only the woff2 files the tokens use (display 400; text 400, 500, 600; Latin and Latin Extended for the Latin faces, Devanagari for the Hindi ones) from the `@fontsource` packages into `dist/fonts/`, and writes `dist/fonts.css` with their `@font-face` rules and `unicode-range`s, pointing at `./fonts/<file>.woff2`. `src/styles.css` imports `../dist/fonts.css`. Because `fonts.css` sits beside `styles.css`, the CLI's unchanged URLs resolve from `dist/styles.css`, and the Tailwind Vite plugin (Storybook) rebases them from `src/`. App bundlers pick the files up from `dist/fonts/` and fingerprint them.

Consequences: nothing binary is committed, and the faces come from `@fontsource` as the design inventory asks. `dist/` is a build output, so the ui `build` (which Turborepo runs before any app) must run before Storybook or `@rivr/render` can show the right faces. Adding a weight or a subset is one line in `fonts.mjs`.

RIVR is English only (0027): the Devanagari faces now set only the rupee sign, which the Latin faces lack.
