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
| `kyc` | `@rivr/adapters/kyc` | `KycAdapter` | DigiLocker pull (masked Aadhaar, PAN, a stable Aadhaar reference), PAN verification fallback, selfie liveness, face match, and the face search for duplicates (`enrolFace`) |
| `smsOtp` | `@rivr/adapters/sms-otp` | `SmsOtpAdapter` | Sign-in codes by SMS; live: `createMsg91SmsOtp({ authKey, templateId })` on a DLT template, the key as a header, a refusal inside HTTP 200 read from `type` |
| `whatsapp` | `@rivr/adapters/whatsapp` | `WhatsAppAdapter` | Utility, authentication and marketing templates; marketing needs `optedInAt`; `urlButton` for a template whose button opens a link (a payment link, a receipt). `WHATSAPP_TEMPLATES` lists every template as submitted to Meta (decision 0043) |
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
const sent = await adapters.whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', params: ['Table 3', '9', '00:30'] });
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
3. `supabase/functions/auth-send-code` checks the signature, then calls `handleSendSmsHook(payload, channels, noteSend)`. `noteSend` records the send in the database (`note_sign_in_code_send`: an HMAC of the number under a Vault key, and the time) and says whether a code went to the number in the last ten minutes.
4. `handleSendSmsHook` parses the payload with `sendSmsHookSchema` (`@rivr/contracts`) and calls `sendSignInCode`.
5. `sendSignInCode({ whatsapp, smsOtp }, { to, code, preferSms })` tries the WhatsApp authentication template (`sign_in_code`) first, then SMS; for a second code within ten minutes (`preferSms`), SMS first, since Meta accepts a code for a number not on WhatsApp and fails it only later (#181). A channel left out is skipped; with neither it fails closed (`not_configured`), and Auth refuses the sign-in.

SMS goes through MSG91 once `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` are set as function secrets (runbook `ci-and-release.md`); until then codes go by WhatsApp alone.

The hook secret, `SEND_SMS_HOOK_SECRET`, is made per checkout in the gitignored `supabase/.hook-secret` (`scripts/lib/supabase-config.mjs`). On staging and production it is generated in the Supabase dashboard and set as a function secret (`docs/runbooks/ci-and-release.md`).

Locally no channel is configured, so the hook refuses every real number and Auth answers the app with 503. Only the seed's test numbers sign in, with code `123456`; Auth answers those itself and never calls the hook.

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

## Outbox consumers

`runConsumer(store, consumer)` runs one consumer once (#12). It claims the consumer's batch, hands each delivery to its one adapter, and finishes each as delivered, or as failed with a backoff that doubles from a minute (`backoffSeconds`, at most six hours). A delivery the vendor rejected fails at once; any other fails for good after `MAX_ATTEMPTS` (ten) attempts. A delivery that fails for good alerts the owner (`private.raise_alert`), at most once an hour per consumer. A consumer Edge Function is one line over `supabase/functions/_shared/outbox.ts`: `Deno.serve(serveConsumer({ name, eventTypes, isMessaging, deliver }))`. Practice-venue events never reach a consumer.

`createWhatsAppConsumer({ whatsapp, findRecipient })` (`@rivr/adapters/messages`, kept off the main entry because it formats with `@rivr/i18n`) is the WhatsApp consumer (#62, `supabase/functions/whatsapp`): the seat call for `waitlist.called` (`seat_ready`: table, seat, hold expiry in IST; handled unsent once the hold has run out) and the receipt notice for `receipt.ready`, and a published promotion for `promotion.offered` (#86: the `promotion` marketing template with its card, only while the member's opt-in stands; handled unsent once they opted out). A messaging consumer, so a messaging stop holds it. Payloads name the member; `findRecipient(venueId, memberId)` reads the number and marketing opt-in at send time, for the event's venue and never a practice member (`message_recipient`, service role only), so no outbox row holds a phone. The live adapter refuses a marketing template sent as anything but marketing, and a link suffix that is not a plain path. `scripts/ci/check-function-imports.mjs` (in `pnpm verify`) fails when a function reaches a bare import its `deno.json` does not map.
