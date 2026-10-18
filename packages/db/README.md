# @rivr/db

The only code that talks to Supabase. It holds the typed client, the generated database types, the provider every app wraps its root in, and the hooks screens read data through. Row-level security in the database decides what each person sees; this package never filters for security.

## Public API

| Export | What it does |
|---|---|
| `createRivrClient({ url, publishableKey })` | The one client an app uses. Never pass the service-role key. A tablet, cage computer or TV signs in as its own device login; that login is how the audit log knows the device. |
| `RivrClient`, `RivrClientOptions` | The client's type and its options. |
| `RivrDataProvider` | Wraps an app: client, query cache, the signed-in user, and one Realtime channel that refreshes feature access and kill-switch state when an admin changes them. |
| `useFeature(key)` | How a member-facing feature shows for the signed-in member: `{ state: 'enabled' }`, `{ state: 'locked', tiers }` or `{ state: 'hidden' }`. Pass it to `FeatureGate`. Hidden until known. |
| `useControlState(venueId?)` | The kill switch: `isVenueFrozen`, `killedFeatures`, `isMemberFrozen` (member apps). Drives `KillSwitchBanner`. |
| `useSignIn()` | Sign-in by mobile number and one-time code, for every app. `requestCode.mutateAsync({ phone })` asks Auth to send a code; `verifyCode.mutateAsync({ phone, code })` checks it, links the records registered under the number (`link_my_login`) and refetches the person's cached queries, or signs out on this device if linking fails. Each resolves to a `SignInResult`: `ok`, or a `SignInFailure` of `code_rejected` (wrong or expired, which Auth does not tell apart), `too_many_requests` or `unavailable`. |
| `useRivrData()` | The client and user id, for the query hooks lanes add. |
| `queryKeys` | Every TanStack Query key. Keys holding a person's data start with their user id. |
| `Database` | The generated types (`pnpm db:types`). |
| `toFeatureAccess`, `toFeatureAccessMap`, `HIDDEN`, `FeatureAccess`, `FeatureAccessRow` | The parser behind `useFeature`, the "not known yet" value, and their types. |
| `toControlState`, `NOTHING_ENGAGED`, `ControlState`, `KillableFeature` | The parser behind `useControlState`, the "nothing engaged" value, and their types. |
| `toSignInFailure`, `SignInFailure`, `SignInResult` | The parser behind `useSignIn`'s failures (Auth's error to `code_rejected`, `too_many_requests` or `unavailable`), and the types. |

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

Apps sign in through `useSignIn`, whose `verifyCode` calls `link_my_login`: it links the staff and member records registered under the login's verified phone. No client ever writes a login onto a record.

## How a feature is decided

The database decides; this package only carries the answer to the screen.

1. `public.my_feature_access()` returns one row per feature for the signed-in member. For each, `private.feature_state` applies, in order: the member's own override (a super admin's grant or removal), then the cell for the member's tier in the tier × feature matrix that is in force now, then off.
2. `toFeatureAccessMap` turns the rows into `enabled`, `locked` (with the tiers that have it, for "Black card only.") or `hidden`. An unknown state reads as `hidden`, the safe reading.
3. `useFeature(key)` returns that entry, or `hidden` while signed out or loading, so a locked entry point never flashes open.
4. When an admin edits the matrix, an override, a member's tier or a kill switch, the Realtime channel in `RivrDataProvider` marks the cached query stale and open screens refetch.

The same `private.has_feature` check guards the feature's tables and write functions, so hiding an entry point is never the only protection.

`FeatureAccess` here has the same shape as `FeatureAccess` in `@rivr/ui`. It is declared twice on purpose: `@rivr/ui` may not import `@rivr/db` (docs/decisions/0010), and TypeScript checks the two match wherever an app passes one to the other.

## Adding data access for a feature

1. The migration grants the table or function and adds its policies (`.claude/skills/new-migration`).
2. `pnpm db:reset && pnpm db:types`. CI regenerates the types and fails if the committed file differs.
3. Add a query key here and a hook (`useXxx`) that calls the client, parses rows in `src/parse/` and returns typed data.
4. Apps import the hook. Nothing outside this package imports `@supabase/supabase-js` (dependency-cruiser enforces it).

`src/catalogues.test.ts` checks that the feature catalogue, the role matrix and the setting keys in `@rivr/contracts` match the migrations. It reads every migration's SQL with regular expressions written for the way those inserts are laid out today: `insert into public.feature (...) values ('key', ..., true|false), ...;`, `select '<role>', permission from unnest(array['a.b', ...])`, and setting keys as `('key', 'description', 'scope', '{json schema}')`. A new migration that adds any of these must use the same shapes, or the test must be extended to read it; otherwise the test cannot see the new key and fails.

## Must not

- Compute money or apply business rules. Those live in `@rivr/domain` (or a SQL function proved equal to it).
- Hold the service-role key or any secret.
- Filter rows for security in TypeScript. If a person must not see a row, the policy says so.
