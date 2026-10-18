---
paths:
  - "apps/**"
---

# Apps: structure a new developer can read

Every app uses the same shape:

```
apps/<app>/src/
  routes/            one file per URL; composes features, holds no logic
  features/<name>/
    components/      compositions of @rivr/ui with behaviour
    hooks/           data wiring through @rivr/db (TanStack Query)
    index.ts         the only import surface of the feature
  main.tsx
```

- A route imports features. A feature imports `@rivr/*` packages. A feature never imports another feature; shared logic moves to a package.
- Data fetching only through `@rivr/db` query hooks. Forms only through React Hook Form with schemas from `@rivr/contracts`.
- Every screen has loading, empty and error states using `Skeleton`, `EmptyState`, `ErrorState`.
- Every string comes from `@rivr/i18n`.
- Budgets checked in CI: player initial JavaScript under 200 KB gzipped; tablet tap-to-confirm under 100 ms; console tables virtualised past 200 rows; TV modes recover within 5 seconds of a reload.
- Every member-facing entry point is wrapped in `FeatureGate` with its feature key, and the key is declared in `packages/contracts/features.ts`. Navigation reads the same keys.
- Respect the kill switch: read `useControlState()` and render `KillSwitchBanner`; never hide it.
