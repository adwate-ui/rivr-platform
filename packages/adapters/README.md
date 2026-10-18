# @rivr/adapters

One interface per vendor, each with an in-memory fake, and the registry that decides which a venue gets. Outbox consumers (Edge Functions) are the only callers. Runs under Deno and Node: no Node built-ins, no vendor SDKs.

## The registry

`createAdapters({ isPracticeVenue, live })` returns every adapter for one venue (`docs/decisions/0014`):

- **Practice venue:** fakes, always, whatever `live` holds. Nothing from it reaches a vendor.
- **Real venue:** the live adapter where credentials exist. Without them, `upiPayouts` and `kyc` fail closed with `not_configured` (the cage pays by hand and enters the UTR; staff review KYC by hand), each social channel falls back to download-and-post, and every other adapter falls back to its fake.

`createFakeAdapters()` gives all sixteen fakes for tests and Storybook.

## Adapters

| Key | Import | Interface | What it does |
|---|---|---|---|
| `kyc` | `@rivr/adapters/kyc` | `KycAdapter` | DigiLocker pull (masked Aadhaar, PAN), PAN verification fallback, selfie liveness, face match |
| `smsOtp` | `@rivr/adapters/sms-otp` | `SmsOtpAdapter` | Sign-in codes by SMS |
| `whatsapp` | `@rivr/adapters/whatsapp` | `WhatsAppAdapter` | Utility, authentication and marketing templates; marketing needs `optedInAt` |
| `upiPayouts` | `@rivr/adapters/upi-payouts` | `UpiPayoutAdapter` | Withdrawals; one payout per idempotency key |
| `push` | `@rivr/adapters/push` | `PushAdapter` | Web push; `subscription_gone` means delete the subscription |
| `socialPublishing` | `@rivr/adapters/social-publishing` | `SocialPublishing` | One `SocialPublishingTarget` per channel; `published` or `download_and_post` |
| `socialInbox` | `@rivr/adapters/social-inbox` | `SocialInboxAdapter` | Instagram, Facebook and WhatsApp messages and replies |
| `instagramGraph` | `@rivr/adapters/instagram-graph` | `InstagramGraphAdapter` | Posts tagging RIVR, for the social wall |
| `channelAnalytics` | `@rivr/adapters/channel-analytics` | `ChannelAnalyticsAdapter` | Follower count per channel |
| `metaConversions` | `@rivr/adapters/meta-conversions` | `MetaConversionsAdapter` | `action_source: physical_store`, identifiers SHA-256 hashed by `toMetaServerEvent` |
| `googleAds` | `@rivr/adapters/google-ads` | `GoogleAdsConversionsAdapter` | Offline conversion import, phone hashed by `toClickConversion`; enabled |
| `cachePurge` | `@rivr/adapters/cache-purge` | `CachePurgeAdapter` | Cloudflare purge after a website publish |
| `store` | `@rivr/adapters/store` | `StoreAdapter` | Products of the hosted accessories store |
| `cctv` | `@rivr/adapters/cctv` | `CctvAdapter` | Playback link for a camera at a moment |
| `receiptPrinter` | `@rivr/adapters/receipt-printer` | `ReceiptPrinterAdapter` | Prints a rendered receipt image at exactly `widthPx` |
| `kitchenPrinter` | `@rivr/adapters/kitchen-printer` | `KitchenPrinterAdapter` | Prints a KOT at the bar |

Every method returns `Promise<Result<…, AdapterFailure>>` for expected failures: `unavailable` and `rate_limited` (retry later), `rejected` (do not retry), `not_configured`. Printers add `out_of_paper`.

Every fake records its calls (`fake.calls`) and fails on demand (`fake.failNext({ code: 'unavailable' })`). Some take options or have helpers, such as `createFakeKyc({ faceMatch: { isMatch: false, score: 41 } })` or `smsFake.lastCodeFor(phone)`. Fake links use the `.invalid` domain, which never resolves.

## Usage

```ts
import { createAdapters } from '@rivr/adapters';

const adapters = createAdapters({ isPracticeVenue: venue.isPractice, live: liveAdaptersFromVault() });
const sent = await adapters.whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', language: 'en', params: ['Table 3', '6'] });
if (!sent.ok && sent.error.code !== 'rejected') return retryLater();
```

In a test:

```ts
const payouts = createFakeUpiPayouts();
payouts.failNext({ code: 'unavailable' });
```

## Sign-in codes

The one exception to "outbox consumers only": Auth waits for the code to go out, and the outbox would store the code in a table (decision 0025). A code travels like this:

1. The app asks Auth for a code (`signInWithOtp`). Auth generates it.
2. Auth posts it to the Send SMS hook set in `supabase/config.template.toml` (`[auth.hook.send_sms]`), signed with the hook secret.
3. `supabase/functions/auth-send-code` checks the signature, then calls `handleSendSmsHook(payload, channels)`.
4. `handleSendSmsHook` parses the payload with `sendSmsHookSchema` (`@rivr/contracts`) and calls `sendSignInCode`.
5. `sendSignInCode({ whatsapp, smsOtp }, { to, code, language })` tries the WhatsApp authentication template (`sign_in_code`) first, then SMS. A channel left out is skipped; with neither it fails closed (`not_configured`), and Auth refuses the sign-in.

No SMS vendor is chosen yet, so `smsOtp` is never passed and codes go by WhatsApp alone until one is.

The hook secret, `SEND_SMS_HOOK_SECRET`, is made per checkout in the gitignored `supabase/.hook-secret` (`scripts/lib/supabase-config.mjs`). On staging and production it is generated in the Supabase dashboard and set as a function secret (`docs/runbooks/ci-and-release.md`).

Locally no channel is configured, so the hook answers 503 to every real number. Only the seed's test numbers sign in, with code `123456`; Auth answers those itself and never calls the hook.

## Live implementations

| Adapter | Import | Credentials |
|---|---|---|
| WhatsApp, Meta Cloud API | `createWhatsAppCloudApi({ phoneNumberId, accessToken })` from `@rivr/adapters/whatsapp` | `WHATSAPP_PHONE_NUMBER_ID` (the business number's id in Meta's dashboard) and `WHATSAPP_ACCESS_TOKEN` (a system user's permanent token), as Edge Function secrets |

The WhatsApp adapter sends every template category. Marketing opt-in rules, and the templates themselves, arrive with #62.

## Adding a live implementation

Implement the same interface in the vendor's folder (`live.ts`), with `fetch` only. Parse every response with Zod in a `parse/` folder, map vendor errors to `AdapterFailure`, and pass it to `createAdapters` through `live` when the venue's credentials exist.

## Must not

- Be called from an app, a hook or a request handler. External calls happen in outbox consumers only, with one exception: the Send SMS auth hook sends sign-in codes (decision 0025).
- Import Node built-ins or a vendor SDK, or log anything; no personal data in a `reason` either.
- Send raw phone numbers or ids to an ads vendor. Hash them as `toMetaServerEvent` and `toClickConversion` do.
- Let the practice venue reach a vendor.
