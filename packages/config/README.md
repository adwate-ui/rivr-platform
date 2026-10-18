# @rivr/config

Shared tooling configuration: the ESLint rules every file is checked against, the TypeScript base settings and the Vitest defaults. One place to change how the whole repository is checked.

## Public API

| Export | What it is |
|---|---|
| `@rivr/config/eslint` | The flat ESLint config. The root `eslint.config.js` re-exports it. |
| `@rivr/config/tsconfig/base.json` | TypeScript settings for non-React packages: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. |
| `@rivr/config/tsconfig/react.json` | The base plus DOM types and JSX. |
| `@rivr/config/vitest` | `vitestConfig({ environment })`, the Vitest defaults. |

The ESLint rules, all errors (from `docs/engineering/stack.md`):

- **Size:** files under 250 lines, functions under 40 lines (not in tests, see `docs/decisions/0006`), complexity 10, nesting depth 3, at most 4 parameters.
- **Types:** no `any`, no non-null assertions, no `as` outside `**/parse/**`.
- **Comments:** no `console`; `rivr/todo-needs-issue` requires an issue link on TODO, FIXME, XXX and HACK.
- **Design values:** no hex colours or arbitrary Tailwind values outside `packages/tokens` (`eslint/design-values.js`).
- **Apps** (`eslint/apps.js`):
  - no intrinsic JSX elements, and no `className` or `style`
  - no Radix, Tailwind, icon sets, styling libraries or Supabase client imports
  - no literal copy in JSX (`packages/ui` too)

`.dependency-cruiser.cjs` and `stylelint.config.mjs` at the repository root hold the import-layering and stylesheet rules.

## Usage

```ts
// packages/domain/vitest.config.ts
import { vitestConfig } from '@rivr/config/vitest';

export default vitestConfig();
```

```json
// packages/ui/tsconfig.json
{ "extends": "@rivr/config/tsconfig/react.json", "include": ["src"] }
```

`eslint/config.test.js` lints sample files against the real config, so every rule above has a test showing it fires.

## Must not

- Turn a rule off, or lower a limit, to get a change green. If a rule is wrong, open a `question` issue (CLAUDE.md rule 9).
- Hold anything other than tooling configuration.
