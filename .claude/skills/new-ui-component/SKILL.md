---
name: new-ui-component
description: Add or extend a component in @rivr/ui. Use whenever a screen needs something the library does not have.
---

# New UI component

1. Search `packages/ui/src` and Storybook for anything close. If one exists, add a prop or variant instead and stop at step 6.
2. Write down in the PR: the need, the components considered, why each does not fit.
3. Create `packages/ui/src/<Name>/` with `<Name>.tsx`, `<Name>.stories.tsx`, `<Name>.test.tsx`, `index.ts`. Export it from `packages/ui/src/index.ts`.
4. Style only with token-preset classes. Props are typed; no `className` or `style` prop is exposed to apps.
5. Stories: default, loading, empty, error, long text, Hindi. Test: rendering, keyboard, labels.
6. Run `pnpm test --filter ui`, `pnpm visual`, and the accessibility check. Accept new visual baselines only for the component you changed.
