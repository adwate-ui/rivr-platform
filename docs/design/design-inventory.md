# RIVR design reference

`prototype.html` is the Claude Design prototype as a self-contained bundle; its text is compressed, so searching the file finds almost nothing. Open it in a browser (Playwright locally), switch surfaces with its demo bar, and screenshot the screen you need. It is the visual reference for layout, density and copy. `@rivr/tokens` and `@rivr/ui` are the implementation; where the prototype and the rules below differ, the rules win.

## Tokens taken from the prototype

| Token | Value | Use |
|---|---|---|
| `color.green` | `#0E3B2C` | Primary background |
| `color.greenBlack` | `#0A2A20` | Raised surfaces, nav, row hover |
| `color.cream` | `#F3EDE0` | Primary text, wordmark tiles |
| `color.gold` | `#C9A85C` | One primary action per screen, player money, hairlines at 25% |
| `color.red` | `#C4162A` | Alerts, negatives, the spade card |
| `color.ink` | `#141414` | Text on cream only |
| `color.muted` | cream at 60% | Secondary text |
| Display face | Bodoni Moda | Wordmark, TV titles, jackpot figure; never below 20 px |
| Text face | Instrument Sans, tabular figures | Everything else |
| Radius | 3, 4, 6 px | 6 px maximum on product surfaces |

Type sizes used in the prototype, to normalise into a scale: 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 34, 36, 40, 44, 56, 96 px. Suggested scale: 12, 13, 14, 16, 18, 20, 24, 28, 36, 44, 56, 96.

Both faces are SIL OFL; install them from `@fontsource` packages rather than copying files from the prototype.

## Screens in the prototype

- **Player:** sign-in (mobile number, code), identity (DigiLocker, Aadhaar masked, date of birth), selfie, Home (Tonight, waitlist Join and Priority, bad-beat jackpot, tournament, promotion), Sessions, Balance (cash, bonus, markers, movements, Withdraw, Deposit with UTR), Rewards (points, catalogue, League, referral, cab), Learn (Library, Hub, drill, Verdict, Summary, Review), Profile (preferences, limits, self-exclusion, notifications).
- **Floor console:** Live floor (main room, Private Room, rake tonight, per hour, recent hands), Waitlist (Call, Seat, Skip), Check-in (Expected, In the room), Tournaments (levels, entries, re-entries, bust-outs, table balance, payouts), Cage (queue, KYC photo, wallet cash, bonus, credit available, approve, decline), Markers, Members, KYC review, Promotions (When, Who, Reward, Publish, player app and TV slide previews), Jackpots and high hands, Rewards, Reports.
- **Dealer tablet:** start down, hand entry with numeric keypad, rake, jackpot drop, pull, high-hand claim, buy-in request, player left, end of down with drop-box count and variance.
- **TV:** bad-beat jackpot, high hand tonight, RIVR Sunday clock, waitlist, promotions.

## Prototype elements not to carry into the product

- The demo bar (Demo, +20 min, Tablet offline, Reset) and the "Made with Claude Design" badge.
- `image-slot` placeholders.
- The UPI payee shown on Deposit ("RIVR Hospitality LLP", `rivrclub@hdfcbank`): placeholder values. Payee name and VPA come from venue configuration.
- Device frames and their corner radii (18, 34, 46, 58 px) and pill radius 999: frame chrome, not product.
- Hard-coded seed people and figures: they become `packages/testing` fixtures.
