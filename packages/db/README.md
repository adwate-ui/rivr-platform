# @rivr/db

The only code that talks to Supabase. It holds the typed client, the generated database types, the provider every app wraps its root in, and the hooks screens read data through. Row-level security in the database decides what each person sees; this package never filters for security.

## Public API

| Export | What it does |
|---|---|
| `createRivrClient({ url, publishableKey, deviceId? })` | The one client an app uses. `deviceId` (enrolled tablets, cage computers, TVs) goes to the audit log. Never pass the service-role key. |
| `RivrDataProvider` | Wraps an app: client, query cache, the signed-in user, and one Realtime channel that refreshes feature access and kill-switch state when an admin changes them. |
| `useFeature(key)` | How a member-facing feature shows for the signed-in member: `{ state: 'enabled' }`, `{ state: 'locked', tiers }` or `{ state: 'hidden' }`. Pass it to `FeatureGate`. Hidden until known. |
| `useControlState(venueId?)` | The kill switch: `isVenueFrozen`, `killedFeatures`, `isMemberFrozen` (member apps). Drives `KillSwitchBanner`. |
| `useRivrData()` | The client and user id, for the query hooks lanes add. |
| `queryKeys` | Every TanStack Query key. Keys holding a person's data start with their user id. |
| `Database` | The generated types (`pnpm db:types`). |
| `toFeatureAccess`, `toControlState` | The pure row parsers behind the hooks. |

## Usage

```tsx
import { createRivrClient, RivrDataProvider, useFeature } from '@rivr/db';
import { FeatureGate } from '@rivr/ui';

const client = createRivrClient({ url: import.meta.env.VITE_SUPABASE_URL, publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY });

function LearnTab() {
  return <FeatureGate access={useFeature('learn.library')}><LearnLibrary /></FeatureGate>;
}

root.render(<RivrDataProvider client={client}><App /></RivrDataProvider>);
```

## Adding data access for a feature

1. The migration grants the table or function and adds its policies (`.claude/skills/new-migration`).
2. `pnpm db:reset && pnpm db:types`. CI regenerates the types and fails if the committed file differs.
3. Add a query key here and a hook (`useXxx`) that calls the client, parses rows in `src/parse/` and returns typed data.
4. Apps import the hook. Nothing outside this package imports `@supabase/supabase-js` (dependency-cruiser enforces it).

`src/catalogues.test.ts` checks that the feature catalogue, the role matrix and the setting keys in `@rivr/contracts` match the migrations.

## Must not

- Compute money or apply business rules. Those live in `@rivr/domain` (or a SQL function proved equal to it).
- Hold the service-role key or any secret.
- Filter rows for security in TypeScript. If a person must not see a row, the policy says so.
