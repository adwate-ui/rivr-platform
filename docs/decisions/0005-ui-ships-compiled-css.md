# 0005 @rivr/ui ships compiled CSS

Date: 18 Oct 2026

Apps may not import Tailwind (`.claude/rules/ui.md`). That rule covers `apps/*/vite.config.ts` too, so an app cannot add the Tailwind Vite plugin to process `@rivr/ui`'s stylesheet itself.

Decision: `@rivr/ui` builds its stylesheet with the Tailwind CLI (`pnpm --filter ui build` writes `dist/styles.css`), scanning only `packages/ui/src`. `@rivr/ui/styles.css` points at that file. Apps import it once in `main.tsx` and never see Tailwind. Turborepo builds `@rivr/ui` before any app's `dev` or `build`.

Consequence: a class used anywhere outside `packages/ui/src` is not generated, which is the intended behaviour: styling lives in the library.
