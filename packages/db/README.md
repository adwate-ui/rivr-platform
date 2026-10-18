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
| `useSignOut()` | Signs out on this device only (other devices stay signed in) and drops the person's cached data. `mutate()`; `isPending` for the button. |
| `StaffVenueProvider`, `useStaffVenue()`, `StaffVenueState` | The venue the console works in for signed-in staff: the club, or the practice venue while they train (`setPractice`, offered when `canPractise`). `loading`, `error` (with `retry`), `not-staff`, or `ready` with the `StaffVenue`. Wrap the console in the provider, inside `RivrDataProvider` (decision 0032). |
| `useStaffVenues()`, `StaffVenue` | Every venue where the signed-in person is active staff, the club first: name, practice or not, their name, role and the role's `permissions`. |
| `useKycImageUrl(path)`, `KYC_IMAGE_URL_SECONDS` | A signed URL, valid for a minute, for one KYC image in the private `kyc` bucket (`<venue_id>/<member_id>/<file>`). The `kyc-image-url` Edge Function signs it for staff with KYC review or the cage at that venue and audits the view; no client reads the bucket. The one way an app shows a KYC image. |
| `usePreferences()` | The signed-in member's `games`, `stake` (blinds in paise, or null), `notificationsOff` (push types turned off; every other is on) and `marketing` (consent in force). |
| `usePreferenceActions()` | `saveGames({ games, stake })`, `setNotification({ type, isOn })` and `setMarketing(isOn)` (gives or withdraws the marketing consent). Each resolves to a Result and reloads the choices. `GAMES` and `PUSH_CHOICES` list the options. |
| `useSignUp()` | Joins the signed-in number to the club (`public.sign_up`): links a member staff registered, or creates one with the name given and the codes of the link the player arrived by. Resolves to a Result (`invalid_name`, `staff`, `stopped`, `unavailable`). |
| `rememberAttribution(search)`, `storedAttribution()` | Keeps the referral, creator and UTM codes of the first link the app opened with (30 days, this browser), for `useSignUp` to carry. The player app calls `rememberAttribution(window.location.search)` once at start. |
| `useKycRecord()` | The signed-in member's identity check: `status` (`started`, `needs_pan`, `needs_review`, `verified`, `refused`), `hasSelfie`, date of birth, masked Aadhaar and PAN, or null before the first check. |
| `useKycActions()` | `sendSelfie(photo)` (a JPEG, first), `start()` (the DigiLocker hand-off URL), `complete()` and `verifyPan({ pan, dateOfBirth? })`, through the `kyc` Edge Function. Each resolves to a Result; failures are `not_configured` (a real venue without vendor keys), `not_live`, `pan_rejected`, `stopped`, `too_many_attempts` or `unavailable` (`toKycFailure`). |
| `useAuthStatus()`, `AuthStatus` | `loading` until the stored session is read, then `signed-in` or `signed-out`: what an app decides sign-in by. |
| `useMember()`, `Member` | The signed-in member (id, name, initial), or null for staff and the public. A login with no member yet links once and asks again. |
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
- Import a runtime value from the `@rivr/contracts` index. Use the module itself (`@rivr/contracts/result`): the index builds every Zod schema, which would put Zod on the player app's first screen (#11). Type-only imports from the index are fine.
- Filter rows for security in TypeScript. If a person must not see a row, the policy says so.
