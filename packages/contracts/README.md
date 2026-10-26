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
| `erasedKycFilesSchema`, `ErasedKycFilesRequest` | Removing an erased member's KYC files (#424), as the console asks the `member-erase` Edge Function: the member id alone; the database names the folder only for an erased member. |
| `kycReviewSchema` | A KYC reviewer's decision from the console: a reason of 3 to 500 characters with no document numbers, and a date of birth and PAN only where the check kept none. |
| `gstinSchema`, `Gstin` | GSTIN in capitals, check character verified. |
| `upiVpaSchema`, `UpiVpa` | `arjun.mehta@hdfcbank`, lower-cased. |
| `utrSchema`, `Utr` | Twelve-digit bank reference, `412908771204`. |
| `ifscSchema`, `Ifsc`, `bankAccountNumberSchema` | An IFSC in capitals, `HDFC0001234`; a bank account number of 9 to 18 digits. |
| `payoutAccountSchema`, `PayoutAccountInput`, `PAYOUT_KINDS` | A payout account as the member adds it on Balance (#19): the bank's name, and a UPI address or a bank account number, IFSC and holder's name; only the chosen kind's fields are checked, and they come out written as banks write them. |
| `reasonForMemberSchema` | Why the cage turns something down, a payout account (#19) or a withdrawal (#21): 3 to 200 characters, shown to the member. |
| `venueConfigSchema`, `networkSchema`, `chipAddSchema` (`@rivr/contracts/venueConfig`) | The venue configuration as a super admin types it on Settings (#33): optional fields empty for nothing, the GSTIN, UPI address, IFSC and alert number in their own schemas, the invoice prefix in six characters, each invoice series' SAC code in four or six digits (`sacSchema`) and the authorised signatory (#423), and the cage and admin networks as addresses or ranges that start their network; a new chip in whole rupees, a multiple of ₹50, with a name. |
| `withdrawalSchema`, `depositSchema`, `utrEntrySchema` | A withdrawal as the member asks for it (whole rupees, to a verified payout account, #21); a UPI deposit as the member enters it (whole rupees, its UTR and the verified UPI account it came from, #29); a UTR as staff type it, sending a withdrawal; and `bankAmountSchema`, the amount a bank statement shows for a deposit. |
| `academyBatchSchema` | A new Academy batch from the console: name, first and last day (in order), 1 to 500 seats as typed in a field. |
| `companyBookingSchema` | A company's Academy booking: the contact's mobile number, the company, 1 to 100 heads as typed in a field, and the company's GSTIN if it has one, empty if not (#249). |
| `pairingCodeSchema`, `devicePairSchema`, `dealerTabletAddSchema`, `deviceRevokeSchema` | A dealer tablet's six-digit pairing code, as the tablet sends it to device-pair; a tablet's name and a revocation's reason from the console (#41). |
| `dealerPinSchema`, `dealerPinEntrySchema` | A dealer's PIN as the console sets it (four digits, not one digit four times) and as a dealer enters it on the tablet (four digits; the database checks it) (#41). |
| `rakeChangeSchema` | A rake change as the console schedules it (#37): table type, rate in percent (at most 10%, two decimals), cap in whole rupees (whole ₹50 chips), IST date and 24-hour time, and a reason; out come the rate in basis points, the cap still in rupees (the console makes it paise with `fromRupees`) and the time with `+05:30`. |
| `creditLimitSchema` | The floor's credit limit form (#73): mobile number, the limit in whole rupees (0 closes the line), and why. |
| `markerIssueSchema` | The cage's marker form (#74): the amount in whole rupees. |
| `PROMOTION_TRIGGERS`, `PROMOTION_EFFECTS`, `PROMOTION_HANDS`, `promotionConditionsSchema`, `promotionEffectSchema` and their types | A promotion rule as `promotion_rule` holds it (#83): the eight triggers and effects; conditions (tier and table ids, table type codes, ISO days, an IST window given whole that opens before it closes within the club's day, first N per table or day, new, lapsed days, visits this month, call time completed, hours played, high hands or a bad beat), all optional; an effect by kind (a bonus as an amount or a share with an optional cap, in whole ₹50 chips, ending in 1 to 90 days; fixed points or a multiplier; a ticket, cab, prize, jackpot payout, message or spin). The database checks the same shapes. |
| `TOURNAMENT_FORMATS`, `TournamentFormat`, `stageFormSchema`, `blindStructureSchema`, `structurePlanSchema`, `tournamentTemplateSchema`, `newTournamentSchema`, `istMoment(day, time)` | At `@rivr/contracts/tournaments` (#115, #116): the formats; the console's structure editor, calculator, template and new-tournament forms, figures as typed; an IST day and time as a moment. |
| `BOUNTY_KINDS`, `DEAL_METHODS`, `sharePercentSchema`, `payoutSharesSchema`, `dealSchema` | At `@rivr/contracts/tournaments` (#117, #121): how bounties are paid; the deal methods; each paid place's share as typed, read as basis points, the shares above nothing, none above the place before's, adding up to 100% (question #470); a deal's method and each player's chips. The template form also takes a bounty and its kind. |
| `blindLevelsSchema` | At `@rivr/contracts/blindLevels`, apart so Home and the TV carry only it: a structure's levels as the database keeps them, read into `@rivr/domain/tournament`'s stages. |
| `REWARD_KINDS`, `RewardKind`, `rewardKindOf(text)`, `rewardItemSchema` | The kinds also at `@rivr/contracts/rewardKinds`, with no Zod, where `rewardKindOf` reads a kind from the database (anything unknown as merchandise). The rewards catalogue's form (#145, decision 0181): a tournament seat, F&B upgrade, merchandise or hotel night (never cash), its name, where to collect it, its price in whole points and how many are left (blank for no limit). |
| `leagueSeasonSchema` | A RIVR League season (#147, decision 0182): a name and its first and last months as `2026-11`, in order. |
| `PROMOTION_BUILDER_REWARDS`, `PROMOTION_BUILDER_LIMITS`, `promotionBuilderSchema` and their types | The builder's four blocks as the console's form holds them (#84): days, a window given whole within the club's day, a table type code or every stake, a reward and a limit. |
| `chipCountSchema`, `openShiftSchema` | The Treasury's forms (#24): how many of each of the venue's chips, a whole number from 0, and for opening the cage's shift the float in whole rupees. |
| `closeShiftSchema`, `eodReviewSchema` | End of day (#45): the cash, receipts and markers in whole rupees with the chips counted, and a reviewer's reason for a variance, 3 to 500 characters. |
| `cashOutSchema`, `CASH_OUT_TO` | The cage's cash-out form (#75): the chips in whole rupees, to cash or the wallet, and whether it is final (#76). |
| `HIGH_HAND_CATEGORIES`, `HIGH_HAND_RANKS`, `highHandClaimSchema`, `highHandRejectSchema` | High hands (#47): the hands the club pays, lowest first; a four of a kind's rank, A to 2; a claim as the tablet sends it (the category, a seat from 1 to 10, and a rank for a four of a kind only); and a rejection's reason, 3 to 300 characters. |
| `badBeatSchema`, `jackpotReversalSchema` | A bad beat as the console records it (#48): the table, the loser's and winner's mobile numbers and the others dealt in (commas or lines, at most nine), each a different player, as `+91…`; and a reversal's reason, 3 to 300 characters. |
| `quizAnswersSchema` | Certification quizzes (#50): the answers as the console hands them in, one choice from 0 for every question. (`@rivr/db` reads the questions by hand, so no Zod reaches the player's bundle.) |
| `sopVersionSchema`, `sopSchema` | The SOP library (#51): a version as the console publishes it (the owner's job title, the roles that must acknowledge it, its IST day as `2026-11-01`, and its text of up to 20,000 characters), and a new SOP, which adds its title. |
| `handEntrySchema`, `HAND_VARIANTS` | A hand as the dealer enters it on the tablet (#42): the pot in whole rupees as the keypad types it (whole ₹50 chips, up to ₹1 crore) and the game (`holdem`, `plo`, `bomb_pot`); `log_hand` checks both again. |
| `waitlistCalledSchema`, `receiptReadySchema` | The payloads of `waitlist.called` (member, table, seat, hold expiry) and `receipt.ready` (member, amount in paise, the link's suffix) that the WhatsApp consumer sends for (#62). They name the member, never a number. |
| `signInCodeSchema` | A one-time sign-in code: six digits. The sign-in form and the hook payload both use it. |
| `sendSmsHookSchema`, `SignInCodeToSend` | Supabase Auth's Send SMS hook payload, parsed to the number being checked (`sms.phone`, E.164), and the six-digit code. |
| `SOCIAL_CHANNELS`, `socialChannelSchema`, `SocialChannel` | The eight publishing channels. |
| `INBOX_CHANNELS`, `inboxChannelSchema`, `InboxChannel` | Instagram, Facebook and WhatsApp. |
| `ATTRIBUTION_PARAMS`, `attributionFrom`, `attributionSearch`, `Attribution`, `AttributionField` | The referral, creator and UTM codes a link carries (`ref`, `creator`, `utm_*`): read from a query string, malformed ones dropped, and written back. `@rivr/contracts/attribution` holds no Zod. |
| `returnPathFrom`, `returnSearchFrom`, `ReturnSearch` | The screen a link pointed at, carried through sign-in and sign-up as `?next=`: only a path in the same app (letters, digits, hyphens and slashes), never another site. `returnSearchFrom` is a route's `validateSearch` and always sets `next`, so an outside address is replaced. `@rivr/contracts/returnPath` holds no Zod. |
| `siteBlockSchema`, `SiteBlock`, `SITE_BLOCK_KINDS`, `PLAYER_DESTINATIONS`, `PlayerDestination` | A website block as `site_block.content` holds it, by kind (`hero`, `statement`, `gallery`, `feature`, `text`, `rules`, `faq`, `careers`, `map`, `links`, and the live `games` and `calendar`, whose rows come from public views); an optional field left blank is not shown. A map's directions go only to a Google Maps page over HTTPS. A block links into the player app only by a named destination (`sign-up`, `academy`, `waitlist`, which is Home), never a raw address. Also at `@rivr/contracts/site`. Media (a hero's loop and still, a statement's, gallery's or feature's picture) is only a path to the website's own files, `/media/<name>.webp` or `.mp4`: never another site, never a path that climbs (decision 0118).; decision 0166 adds `story`, `cards` (linking only to the site's own pages), `marquee`, `timeline`, `table` and the live `promotions`, and a phone and email on `map` |

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
