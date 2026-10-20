# 0010 `FeatureAccess` is a structural type defined in @rivr/ui

Date: 18 Oct 2026

`FeatureGate`, `LockedNotice` and `BottomNav` render a tier-gated feature as enabled, locked or hidden, from what `useFeature(key)` in `@rivr/db` returns. `@rivr/ui` may import only `@rivr/tokens` and `@rivr/i18n` (dependency-cruiser), so it cannot import a type from `@rivr/db`, and `@rivr/contracts` is not on its list either.

Decision: `@rivr/ui` defines and exports

```ts
type FeatureAccess = { state: 'enabled' } | { state: 'locked'; tiers: readonly string[] } | { state: 'hidden' };
```

`@rivr/db`'s `useFeature()` returns a value of the same shape. TypeScript compares object types by structure, so the hook's result passes straight into `<FeatureGate access={...}>` without either package importing the other. `tiers` holds the tier names in rank order; `LockedNotice` joins them with `formatList` into `common.featureLocked` ("Black card only."). With none to name, because an override took the feature from this member alone (#353) or no tier has it, it says `common.featureUnavailable` ("Not available on your account. Ask the club.").

Consequences: the shape is a contract between two packages written in two places. A change to it is a change to both, in one PR; `@rivr/db`'s tests should pass a `useFeature()` result to `FeatureGate` so the typecheck catches drift.
