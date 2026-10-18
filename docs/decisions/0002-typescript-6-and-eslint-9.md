# 0002 TypeScript 6.0 and ESLint 9

Date: 18 Oct 2026

The latest TypeScript is 7.0 (the native compiler) and the latest ESLint is 10. Neither works with the linting this repository requires:

- `typescript-eslint` 8.71 supports TypeScript `>=4.8.4 <6.1.0`.
- `eslint-plugin-react` 7.37, which provides `react/forbid-elements` and `react/forbid-component-props` named in `docs/engineering/stack.md`, supports ESLint up to 9.7.

Decision: pin TypeScript `~6.0.3` and ESLint `^9.39`. Every other dependency is at its current release (Vite 8, React 19.3, Vitest 5, Storybook 10, Tailwind 4.3, Astro 7, Zod 4, Capacitor 8, Playwright 1.64, Stryker 10).

Revisit when `typescript-eslint` supports TypeScript 7 and `eslint-plugin-react` supports ESLint 10; upgrade in one PR with `pnpm verify:all`.
