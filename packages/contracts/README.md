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
| `gstinSchema`, `Gstin` | GSTIN in capitals, check character verified. |
| `upiVpaSchema`, `UpiVpa` | `arjun.mehta@hdfcbank`, lower-cased. |
| `utrSchema`, `Utr` | Twelve-digit bank reference, `412908771204`. |
| `academyBatchSchema` | A new Academy batch from the console: name, first and last day (in order), 1 to 500 seats as typed in a field. |
| `companyBookingSchema` | A company's Academy booking: the contact's mobile number, the company, 1 to 100 heads as typed in a field. |
| `signInCodeSchema` | A one-time sign-in code: six digits. The sign-in form and the hook payload both use it. |
| `sendSmsHookSchema`, `SignInCodeToSend` | Supabase Auth's Send SMS hook payload, parsed to the number being checked (`sms.phone`, E.164), and the six-digit code. |
| `SOCIAL_CHANNELS`, `socialChannelSchema`, `SocialChannel` | The eight publishing channels. |
| `INBOX_CHANNELS`, `inboxChannelSchema`, `InboxChannel` | Instagram, Facebook and WhatsApp. |
| `ATTRIBUTION_PARAMS`, `attributionFrom`, `attributionSearch`, `Attribution`, `AttributionField` | The referral, creator and UTM codes a link carries (`ref`, `creator`, `utm_*`): read from a query string, malformed ones dropped, and written back. `@rivr/contracts/attribution` holds no Zod. |

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
