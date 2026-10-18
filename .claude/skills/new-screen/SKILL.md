---
name: new-screen
description: Build a screen in any app from @rivr/ui components, matching the prototype. Use for any new route or screen.
---

# New screen

1. Find the screen in `docs/design/design-inventory.md`, then open `docs/design/prototype.html` with Playwright (it is a compressed bundle, so do not grep it), navigate to the screen with the demo bar and screenshot it at the target size.
2. List the `@rivr/ui` components it needs. For anything missing, run the `new-ui-component` skill first.
3. If the screen is member-facing, declare its feature key in `packages/contracts/features.ts` (or reuse one) and wrap its entry points in `FeatureGate`; add the `has_feature` check to its policies.
4. Add the route file in `routes/`; put behaviour in `features/<name>/`. Strings go into `@rivr/i18n`, in English.
5. Wire data through `@rivr/db` hooks. Add loading, empty and error states.
6. Screenshot your screen at the same size with seed data. Compare side by side with the prototype. Fix layout, spacing, type and copy differences. Repeat until the only differences are prototype elements listed as not to carry over.
7. Add or extend the Playwright flow that covers this screen.
