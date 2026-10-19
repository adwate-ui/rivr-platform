# @rivr/contracts

The shapes every package and Edge Function agree on: the `Result` type, branded ids, money as paise, and the Zod schemas that check money and identity at the edges.

## Public API

Import from `@rivr/contracts`, or one module at a time (`@rivr/contracts/ids`).

| Export | What it does |
|---|---|
| `Result<T, E>`, `ok(value)`, `err(error)` | The outcome of anything that can fail in an expected way. Throw only for bugs (`docs/decisions/0012`). |
| `venueIdSchema`, `memberIdSchema`, `staffIdSchema`, `deviceIdSchema`, `tableIdSchema`, `ledgerAccountIdSchema`, `ledgerTransactionIdSchema`, `idempotencyKeySchema` and their types | Uuids branded by kind, so a `MemberId` cannot be passed as a `VenueId`. |
| `paiseSchema`, `Paise` | Money in integer paise, from a bigint or an integer string as Postgres returns `bigint`. Rejects JavaScript numbers, decimals and grouping. Combine amounts only through `@rivr/domain/money`. |
| `indianMobileSchema`, `IndianMobile` | `9876543210`, `+91 98765 43210` → `+919876543210`. Ten digits starting 6 to 9. |
| `panSchema`, `Pan` | PAN in capitals, holder type checked (fourth letter). |
| `kycInPersonSchema`, `KycInPerson` | A check in person at the club, as the console sends it with the photo: the member, the date of birth and PAN from the originals, only the last four Aadhaar digits, and the member's consent (#246). |
| `kycReviewSchema` | A KYC reviewer's decision from the console: a reason of 3 to 500 characters with no document numbers, and a date of birth and PAN only where the check kept none. |
| `gstinSchema`, `Gstin` | GSTIN in capitals, check character verified. |
| `upiVpaSchema`, `UpiVpa` | `arjun.mehta@hdfcbank`, lower-cased. |
| `utrSchema`, `Utr` | Twelve-digit bank reference, `412908771204`. |
| `academyBatchSchema` | A new Academy batch from the console: name, first and last day (in order), 1 to 500 seats as typed in a field. |
| `companyBookingSchema` | A company's Academy booking: the contact's mobile number, the company, 1 to 100 heads as typed in a field. |
| `pairingCodeSchema`, `devicePairSchema`, `dealerTabletAddSchema`, `deviceRevokeSchema` | A dealer tablet's six-digit pairing code, as the tablet sends it to device-pair; a tablet's name and a revocation's reason from the console (#41). |
| `dealerPinSchema`, `dealerPinEntrySchema` | A dealer's PIN as the console sets it (four digits, not one digit four times) and as a dealer enters it on the tablet (four digits; the database checks it) (#41). |
| `waitlistCalledSchema`, `receiptReadySchema` | The payloads of `waitlist.called` (member, table, seat, hold expiry) and `receipt.ready` (member, amount in paise, the link's suffix) that the WhatsApp consumer sends for (#62). They name the member, never a number. |
| `signInCodeSchema` | A one-time sign-in code: six digits. The sign-in form and the hook payload both use it. |
| `sendSmsHookSchema`, `SignInCodeToSend` | Supabase Auth's Send SMS hook payload, parsed to the number being checked (`sms.phone`, E.164), and the six-digit code. |
| `SOCIAL_CHANNELS`, `socialChannelSchema`, `SocialChannel` | The eight publishing channels. |
| `INBOX_CHANNELS`, `inboxChannelSchema`, `InboxChannel` | Instagram, Facebook and WhatsApp. |
| `ATTRIBUTION_PARAMS`, `attributionFrom`, `attributionSearch`, `Attribution`, `AttributionField` | The referral, creator and UTM codes a link carries (`ref`, `creator`, `utm_*`): read from a query string, malformed ones dropped, and written back. `@rivr/contracts/attribution` holds no Zod. |
| `returnPathFrom`, `returnSearchFrom`, `ReturnSearch` | The screen a link pointed at, carried through sign-in and sign-up as `?next=`: only a path in the same app (letters, digits, hyphens and slashes), never another site. `returnSearchFrom` is a route's `validateSearch` and always sets `next`, so an outside address is replaced. `@rivr/contracts/returnPath` holds no Zod. |
| `siteBlockSchema`, `SiteBlock`, `SITE_BLOCK_KINDS`, `PLAYER_DESTINATIONS`, `PlayerDestination` | A website block as `site_block.content` holds it, by kind (`hero`, `text`, `rules`, `faq`, `careers`, `map`, `links`, and the live `games` and `calendar`, whose rows come from public views); an optional field left blank is not shown. A map's directions go only to a Google Maps page over HTTPS. A block links into the player app only by a named destination (`sign-up`, `academy`, `waitlist`, which is Home), never a raw address. Also at `@rivr/contracts/site`. |

Feature keys, roles and settings schemas live here too, each documented in its own file.

## Usage

```ts
import { err, ok, paiseSchema, utrSchema, type Paise, type Result, type Utr } from '@rivr/contracts';

function readWithdrawal(row: { amount: string; utr: string }): Result<{ amount: Paise; utr: Utr }, 'bad_row'> {
  const amount = paiseSchema.safeParse(row.amount);
  const utr = utrSchema.safeParse(row.utr);
  return amount.success && utr.success ? ok({ amount: amount.data, utr: utr.data }) : err('bad_row');
}
```

## Must not

- Import another `@rivr` package. Everything depends on this one.
- Hold business rules or compute money. A schema checks a shape; `@rivr/domain` decides what it means.
- Accept a JavaScript number as money, anywhere.
